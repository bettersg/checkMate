import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
} from "../common/sendWhatsappMessage"
import { sendDisputeNotification } from "../common/sendMessage"
import {
  sleep,
  checkMessageId,
} from "../common/utils"
import {
  getUserResponsesObject,
  sendInterimUpdate,
  sendVotingStats,
  sendReferralMessage,
  sendRationalisation,
  respondToRationalisationFeedback,
  updateLanguageAndSendMenu,
  sendLanguageSelection,
  sendBlast,
  respondToBlastFeedback,
} from "../common/responseUtils"
import { defineString } from "firebase-functions/params"
import {
  WhatsappMessageObject,
} from "../../types"
import { AppEnv } from "../../appEnv"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

//not whatsapp specific anymore
const userHandlerWhatsappInteractive = async function (message: WhatsappMessageObject) {
    if (!message?.id) {
        functions.logger.error("No message id")
        return
    }
    if (await checkMessageId(message.id)) {
        functions.logger.warn(`Message ${message.id} already exists`)
        return
    }

    let from = message.from // extract the wa phone no.
    let type = message.type // image/text
    let idField = "whatsappId"

    const responses = await getUserResponsesObject("user", from, idField) // change this to search for userID acc to fieldId

    //check whether new user
    const userSnapshot = await db.collection("users").where(idField, '==', from).get()
    const userDoc = userSnapshot.docs[0]

    const isIgnored = userDoc?.get("isIgnored")
    if (isIgnored) {
        functions.logger.warn(
        `Message from banned user ${from}!, text: ${message?.text}`
        )
        return
    }
    let step
    switch(type){
        //only for whatsapp
        case "interactive":
            // handle consent here
            const interactive = message.interactive
            if (!interactive) {
            functions.logger.error("Message has no interactive object")
            break
            }
            switch (interactive.type) {
            case "button_reply":
                step = await onButtonReply(message, idField)
                break
            case "list_reply":
                step = await onTextListReceipt(message, idField)
                break
            }
            break

        case "button":
            const button = message.button
            if (!button) {
            functions.logger.error("Message has no button object")
            break
            }
            switch (button.text) {
            case "Get Latest Update":
                await sendBlast(from, idField)
                break
            case "Unsubscribe":
                await toggleUserSubscription(from, false, idField)
                break
            case "Get Referral Message":
                await sendReferralMessage(from, idField)
                break
            default:
                functions.logger.error("Unsupported button type:", button.text)
                await sendWhatsappTextMessage(
                "user",
                from,
                responses.GENERIC_ERROR,
                null,
                true
                )
            }
            break

        default:
        sendWhatsappTextMessage(
            "user",
            from,
            responses?.UNSUPPORTED_TYPE,
            message.id
        )
        break
    }
    markWhatsappMessageAsRead("user", message.id)
    
}

async function onButtonReply(
    messageObj: WhatsappMessageObject,
    idField = "whatsappId",
    platform = "whatsapp"
  ) {
    const buttonId = messageObj.interactive?.button_reply.id
    if (!buttonId) {
      functions.logger.error("No buttonId in interactive object")
      return
    }
    const from = messageObj.from
    const responses = await getUserResponsesObject("user", from, idField)
    const [type, ...rest] = buttonId.split("_")
    let instancePath, selection, instanceRef, blastPath
    switch (type) {
        case "scamshieldDecline":
            ;[instancePath] = rest
            instanceRef = db.doc(instancePath)
            const replyText = responses?.SCAMSHIELD_ON_DECLINE
            await instanceRef.update({
            scamShieldConsent: false,
            })
            if (!replyText) {
            functions.logger.error("No replyText for scamshieldConsent")
            break
            }
            await sendWhatsappTextMessage("user", from, replyText)
            break
        case "votingResults":
            let scamShield
            ;[instancePath, ...scamShield] = rest
            const triggerScamShieldConsent =
            scamShield.length > 0 && scamShield[0] === "scamshield"
            //await sendVotingStats(instancePath, triggerScamShieldConsent)
            await sendVotingStats(instancePath)
            break
        case "sendInterim":
            ;[instancePath] = rest
            await sendInterimUpdate(instancePath)
            break
        case "rationalisation":
            ;[instancePath] = rest
            await sendRationalisation(instancePath)
            break
        case "feedbackRationalisation":
            ;[instancePath, selection] = rest
            await respondToRationalisationFeedback(instancePath, selection)
            break
        case "feedbackBlast":
            ;[blastPath, selection] = rest
            await respondToBlastFeedback(blastPath, selection, from, idField)
            break
        case "languageSelection":
            ;[selection] = rest
            await updateLanguageAndSendMenu(from, selection, idField)
            break
    }
    const step = type + (selection ? `_${selection}` : "")
    return Promise.resolve(step)
}
  
async function onTextListReceipt(
    messageObj: WhatsappMessageObject,
    idField = "whatsappId",
    platform = "whatsapp"
) {
    const listId = messageObj.interactive?.list_reply.id
    if (!listId) {
        functions.logger.error("No listId in interactive object")
        return
    }
    const from = messageObj.from
    const responses = await getUserResponsesObject("user", from, idField)
    const [type, selection, ...rest] = listId.split("_")
    let response, instancePath
    const step = `${type}_${selection}`
    let hasReplied = false
    switch (type) {
        case "menu":
        switch (selection) {
            case "check":
            response = responses.PROCEED_TO_SEND
            break
            case "help":
            response = responses.HOW_TO
            break

            case "about":
            response = responses.LEARN_MORE
            break

            case "feedback":
            response = responses.FEEDBACK
            break

            case "language":
            await sendLanguageSelection(from, false, idField)
            hasReplied = true
            break

            case "contact":
            const nameObj = { formatted_name: "CheckMate", suffix: "CheckMate" }
            response = responses.CONTACT
            await sendWhatsappContactMessage(
                "user",
                from,
                runtimeEnvironment.value() === "PROD"
                ? "+65 80432188"
                : "+1 555-093-3685",
                nameObj,
                "https://checkmate.sg"
            )
            await sleep(3000)
            break

            case "referral":
            await sendReferralMessage(from, idField)
            hasReplied = true
            break

            case "dispute":
            ;[instancePath] = rest
            const instanceRef = db.doc(instancePath)
            const parentMessageRef = instanceRef.parent.parent
            if (!parentMessageRef) {
                throw new Error(
                `parentMessageRef is null for instance ${instancePath}`
                )
            }
            const instanceSnap = await instanceRef.get()
            const parentMessageSnapshot = await parentMessageRef.get()
            const instanceType = instanceSnap.get("type")
            const text = instanceSnap.get("text")
            const category = parentMessageSnapshot.get("primaryCategory")
            await sendDisputeNotification(
                from,
                instancePath,
                instanceType,
                text,
                category
            )
            response = responses.DISPUTE
            break
            case "unsubscribeUpdates":
            await toggleUserSubscription(from, false, idField)
            response = responses.UNSUBSCRIBE
            break
            case "subscribeUpdates":
            await toggleUserSubscription(from, true, idField)
            response = responses.SUBSCRIBE
            break
        }
        break
        case "satisfactionSurvey":
        ;[instancePath] = rest
        const instanceRef = db.doc(instancePath)
        //check if selection is number
        if (!isNaN(Number(selection))) {
            const selectionNumber = parseInt(selection)
            await instanceRef.update({
            satisfactionScore: selectionNumber,
            })
        } else {
            functions.logger.warn(
            `invalid selection for satisfaction survey: ${selection}`
            )
        }
        response = responses.SATISFACTION_SURVEY_THANKS
        break
    }
    if (!hasReplied && response) {
        await sendWhatsappTextMessage("user", from, response, null, true)
    }
    return Promise.resolve(step)
}

async function toggleUserSubscription(userId: string, toSubscribe: boolean, idField: string) {
    const userSnapshot = await db.collection("users").where(idField, '==', userId).get()
    userSnapshot.docs[0].ref.update({
        isSubscribedUpdates: toSubscribe,
    })
}



const onUserInteractivePublish = onMessagePublished(
    {
      topic: "userInteractiveEvents",
      secrets: [
        "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
        "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
        "WHATSAPP_TOKEN",
        "VERIFY_TOKEN",
        "TYPESENSE_TOKEN",
        "TELEGRAM_REPORT_BOT_TOKEN",
        "OPENAI_API_KEY",
      ],
      timeoutSeconds: 120,
    },
    async (event) => {
      if (event.data.message.json) {
        functions.logger.log(`Processing ${event.data.message.messageId}`)
        await userHandlerWhatsappInteractive(event.data.message.json)
      } else {
        functions.logger.warn(
          `Unknown message type for messageId ${event.data.message.messageId})`
        )
      }
    }
)
export { onUserInteractivePublish }
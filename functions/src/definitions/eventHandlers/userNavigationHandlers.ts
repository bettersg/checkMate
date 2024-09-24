import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { checkNewlyJoined } from "../../validators/common/checkNewlyJoined"
import { Timestamp } from "firebase-admin/firestore"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
} from "../common/sendWhatsappMessage"
import { sendDisputeNotification } from "../common/sendMessage"
import { sleep, checkMessageId } from "../common/utils"
import { getUserSnapshot } from "../../services/common/userManagement"
import { checkMenu } from "../../validators/whatsapp/checkWhatsappText"
import { sendMenuMessage } from "../common/responseUtils"
import {
  getResponsesObj,
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
import { WhatsappMessageObject } from "../../types"
import { AppEnv } from "../../appEnv"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

//not whatsapp specific anymore
const userWhatsappInteractionHandler = async function (
  message: WhatsappMessageObject
) {
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
  const messageTimestamp = new Timestamp(Number(message.timestamp), 0)

  const userSnap = await getUserSnapshot(from, "whatsapp")
  if (userSnap === null) {
    functions.logger.error(`User ${from} not found in database`)
    return
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language) // change this to search for userID acc to fieldId
  const isNewlyJoined = checkNewlyJoined(userSnap, messageTimestamp)

  let step
  switch (type) {
    //only for whatsapp
    case "text":
      const text = message.text.body
      if (checkMenu(text)) {
        step = "text_menu"
        await sendMenuMessage(userSnap, "MENU_PREFIX", "whatsapp", null, null)
        break
      }
    case "interactive":
      // handle consent here
      const interactive = message.interactive
      if (!interactive) {
        functions.logger.error("Message has no interactive object")
        break
      }
      switch (interactive.type) {
        case "button_reply":
          step = await onButtonReply(userSnap, message, "whatsapp")
          break
        case "list_reply":
          step = await onTextListReceipt(userSnap, message, "whatsapp")
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
          await sendBlast(userSnap)
          break
        case "Unsubscribe":
          await toggleUserSubscription(userSnap, false)
          break
        case "Get Referral Message":
          await sendReferralMessage(userSnap)
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
  if (isNewlyJoined && step) {
    const timestampKey =
      messageTimestamp.toDate().toISOString().slice(0, -5) + "Z"
    userSnap.ref.update({
      [`initialJourney.${timestampKey}`]: step,
    })
  }

  markWhatsappMessageAsRead("user", message.id)
}

async function onButtonReply(
  userSnap: FirebaseFirestore.DocumentSnapshot,
  messageObj: WhatsappMessageObject,
  platform = "whatsapp"
) {
  const buttonId = messageObj.interactive?.button_reply.id
  if (!buttonId) {
    functions.logger.error("No buttonId in interactive object")
    return
  }
  const from = messageObj.from
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
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
      await sendVotingStats(userSnap, instancePath)
      break
    case "sendInterim":
      ;[instancePath] = rest
      await sendInterimUpdate(userSnap, instancePath)
      break
    case "rationalisation":
      ;[instancePath] = rest
      await sendRationalisation(userSnap, instancePath)
      break
    case "feedbackRationalisation":
      ;[instancePath, selection] = rest
      await respondToRationalisationFeedback(userSnap, instancePath, selection)
      break
    case "feedbackBlast":
      ;[blastPath, selection] = rest
      await respondToBlastFeedback(userSnap, blastPath, selection)
      break
    case "languageSelection":
      ;[selection] = rest
      await updateLanguageAndSendMenu(userSnap, selection)
      break
  }
  const step = type + (selection ? `_${selection}` : "")
  return Promise.resolve(step)
}

async function onTextListReceipt(
  userSnap: FirebaseFirestore.DocumentSnapshot,
  messageObj: WhatsappMessageObject,
  platform = "whatsapp"
) {
  const listId = messageObj.interactive?.list_reply.id
  if (!listId) {
    functions.logger.error("No listId in interactive object")
    return
  }
  const from = messageObj.from
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
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
          await sendLanguageSelection(userSnap, false)
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
          await sendReferralMessage(userSnap)
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
          await toggleUserSubscription(userSnap, false)
          response = responses.UNSUBSCRIBE
          break
        case "subscribeUpdates":
          await toggleUserSubscription(userSnap, true)
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

async function toggleUserSubscription(
  userSnap: FirebaseFirestore.DocumentSnapshot,
  toSubscribe: boolean
) {
  userSnap.ref.update({
    isSubscribedUpdates: toSubscribe,
  })
}

const onUserInteractivePublish = onMessagePublished(
  {
    topic: "userNavigationEvents",
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
      await userWhatsappInteractionHandler(event.data.message.json)
    } else {
      functions.logger.warn(
        `Unknown message type for messageId ${event.data.message.messageId})`
      )
    }
  }
)
export { onUserInteractivePublish }

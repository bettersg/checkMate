import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { checkNewlyJoined } from "../../validators/common/checkNewlyJoined"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
} from "../common/sendWhatsappMessage"
import { sendDisputeNotification } from "../common/sendMessage"
import { sleep, checkMessageId } from "../common/utils"
import { getUserSnapshot } from "../../services/user/userManagement"
import {
  checkMenu,
  checkShare,
  checkHelp,
} from "../../validators/whatsapp/checkWhatsappText"
import {
  sendCheckMateDemonstration,
  sendFoundersMessage,
  sendMenuMessage,
  sendChuffedLink,
  sendSharingMessage,
  updateLanguageAndFollowUp,
} from "../common/responseUtils"
import {
  getResponsesObj,
  sendInterimUpdate,
  sendVotingStats,
  sendRationalisation,
  respondToRationalisationFeedback,
  sendLanguageSelection,
  sendBlast,
  respondToBlastFeedback,
  respondToCommunityNoteFeedback,
  respondToIrrelevantDispute,
  respondToWaitlist,
  sendGetMoreSubmissionsMessage,
  sendCommunityNoteFeedbackMessage,
  sendCommunityNoteSources,
  handleDisclaimer,
  sendCheckSharingMessage,
} from "../common/responseUtils"
import { defineString } from "firebase-functions/params"
import { LanguageSelection, WhatsappMessageObject } from "../../types"
import { AppEnv } from "../../appEnv"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

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
      if (checkShare(text)) {
        step = "text_share"
        await sendSharingMessage(userSnap)
        break
      }
      if (checkHelp(text)) {
        step = "text_help"
        await sendCheckMateDemonstration(userSnap)
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
        case "nfm_reply":
          step = await onFlowResponse(userSnap, message, "whatsapp")
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
          await sendSharingMessage(userSnap)
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
    case "isWronglyIrrelevant":
      ;[instancePath] = rest
      await respondToIrrelevantDispute(userSnap, instancePath)
      break
    case "feedbackRationalisation":
      ;[instancePath, selection] = rest
      await respondToRationalisationFeedback(userSnap, instancePath, selection)
      break
    case "feedbackNote":
      ;[instancePath] = rest
      await sendCommunityNoteFeedbackMessage(userSnap, instancePath)
      break
    case "feedbackNoteResponse":
      ;[instancePath, selection] = rest
      await respondToCommunityNoteFeedback(userSnap, instancePath, selection)
      break
    case "viewSources":
      ;[instancePath] = rest
      await sendCommunityNoteSources(userSnap, instancePath)
      break
    case "getMoreChecks":
      ;[instancePath] = rest
      await sendGetMoreSubmissionsMessage(userSnap, instancePath)
      break
    case "controversial":
      ;[instancePath] = rest
      await handleDisclaimer(userSnap, instancePath)
      break
    case "feedbackBlast":
      ;[blastPath, selection] = rest
      await respondToBlastFeedback(userSnap, blastPath, selection)
      break
    case "languageSelection":
      ;[selection] = rest as [LanguageSelection]
      await updateLanguageAndFollowUp(userSnap, selection, false)
      break
    case "supportOnChuffed":
      ;[instancePath] = rest
      if (instancePath === "outOfSubmissions") {
        await sendChuffedLink(userSnap, null, "outOfSubmissions")
      } else if (instancePath === "foundersMessage") {
        await sendChuffedLink(userSnap, null, "foundersMessage")
      } else {
        await sendChuffedLink(userSnap, instancePath, "onReply")
      }
      break
    case "show":
      await sendCheckMateDemonstration(userSnap)
      break
    case "viewFoundersMessage":
      await sendFoundersMessage(userSnap)
      break
    case "shareWithOthers":
      await sendSharingMessage(userSnap)
      break
    case "shareCheck":
      ;[instancePath] = rest
      await sendCheckSharingMessage(userSnap, instancePath)
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
          await sendCheckMateDemonstration(userSnap)
          hasReplied = true
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
          await sendSharingMessage(userSnap)
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

async function onFlowResponse(
  userSnap: FirebaseFirestore.DocumentSnapshot,
  messageObj: WhatsappMessageObject,
  platform = "whatsapp"
) {
  const from = messageObj.from
  const jsonString = messageObj.interactive?.nfm_reply?.response_json
  if (!jsonString) {
    functions.logger.error("No jsonString in interactive object")
    return
  }
  const flowResponse = JSON.parse(jsonString)
  const flowToken = flowResponse?.flow_token

  const flowRef = db.collection("flows").doc(flowToken)
  const flowSnap = await flowRef.get()
  if (!flowSnap.exists) {
    functions.logger.error("Flow not found in database")
    return
  }
  const flowType = flowSnap.get("type")
  await flowRef.update({
    outcome: "completed",
    outcomeTimestamp: Timestamp.now(),
  })
  switch (flowType) {
    case "onboarding":
      const language = flowResponse?.language ?? "en"
      const ageGroup = flowResponse?.age_group ?? null
      await userSnap.ref.update({
        isOnboardingComplete: true,
        ageGroup: ageGroup,
      })
      await updateLanguageAndFollowUp(userSnap, language, true)
      break
    case "waitlist_cn":
    case "waitlist_en":
      const isInterestedInSubscription = flowResponse?.is_interested === "yes"
      const isInterestedAtALowerPoint =
        flowResponse?.is_interested_when_cheaper === "yes"
          ? true
          : flowResponse?.is_interested_when_cheaper === "no"
          ? false
          : null
      const priceWhereInterested =
        flowResponse?.price_where_interested == null
          ? null
          : Number(flowResponse?.price_where_interested)
      const interestedFor = flowResponse?.interested_for ?? null
      const feedback = flowResponse?.feedback ?? null
      await userSnap.ref.update({
        isInterestedInSubscription: isInterestedInSubscription,
        isInterestedAtALowerPoint: isInterestedAtALowerPoint,
        priceWhereInterested: priceWhereInterested,
        interestedFor: interestedFor,
        feedback: feedback,
      })
      await respondToWaitlist(userSnap, isInterestedInSubscription)
      break
    default:
      functions.logger.error("Unsupported flow type:", flowType)
  }
}

async function toggleUserSubscription(
  userSnap: FirebaseFirestore.DocumentSnapshot,
  toSubscribe: boolean
) {
  userSnap.ref.update({
    isSubscribedUpdates: toSubscribe,
  })
}

const onUserNavigationPublish = onMessagePublished(
  {
    topic: "userNavigationEvents",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "VERIFY_TOKEN",
      "TYPESENSE_TOKEN",
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
export { onUserNavigationPublish }

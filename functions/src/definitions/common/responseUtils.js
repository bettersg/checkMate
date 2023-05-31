const admin = require("firebase-admin")
const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } = require("./constants")
const { sleep, getThresholds } = require("./utils")
const { sendTextMessage } = require("./sendMessage")
const { sendWhatsappButtonMessage } = require("./sendWhatsappMessage")
const functions = require("firebase-functions")
const { Timestamp } = require("firebase-admin/firestore")

async function respondToInstance(instanceSnap, forceReply = false) {
  const parentMessageRef = instanceSnap.ref.parent.parent
  const parentMessageSnap = await parentMessageRef.get()
  const data = instanceSnap.data()
  if (!data.from) {
    functions.logger.log("Missing 'from' field in instance data")
    return Promise.resolve()
  }
  const responses = await getResponsesObj("user")
  const thresholds = await getThresholds()
  const isAssessed = parentMessageSnap.get("isAssessed")
  const isIrrelevant = parentMessageSnap.get("isIrrelevant")
  const isScam = parentMessageSnap.get("isScam")
  const isIllicit = parentMessageSnap.get("isIllicit")
  const truthScore = parentMessageSnap.get("truthScore")
  const isSpam = parentMessageSnap.get("isSpam")
  const isUnsure = parentMessageSnap.get("isUnsure")
  const isInfo = parentMessageSnap.get("isInfo")
  const isLegitimate = parentMessageSnap.get("isLegitimate")
  const isMachineCategorised = parentMessageSnap.get("isMachineCategorised")

  if (!isAssessed && !forceReply) {
    await sendTextMessage(
      "user",
      data.from,
      responses.MESSAGE_NOT_YET_ASSESSED,
      data.id
    )
    return
  }
  const updateObj = { isReplied: true, isReplyForced: forceReply }
  if (isScam || isIllicit) {
    let responseText
    if (isScam) {
      updateObj.replyCategory = "scam"
      responseText = responses.SCAM
    } else {
      updateObj.replyCategory = "illicit"
      responseText = responses.SUSPICIOUS
    }
    const buttons = [
      {
        type: "reply",
        reply: {
          id: `scamshieldConsent_${instanceSnap.ref.path}_consent`,
          title: "Yes",
        },
      },
      {
        type: "reply",
        reply: {
          id: `scamshieldConsent_${instanceSnap.ref.path}_decline`,
          title: "No",
        },
      },
      {
        type: "reply",
        reply: {
          id: `scamshieldExplain_${instanceSnap.ref.path}_${data.id}`,
          title: "What is ScamShield?",
        },
      },
    ]
    await sendWhatsappButtonMessage(
      "user",
      data.from,
      responseText,
      buttons,
      data.id
    )
  } else if (isSpam) {
    updateObj.replyCategory = "spam"
    await sendTextMessage("user", data.from, responses.SPAM, data.id)
  } else if (isLegitimate) {
    updateObj.replyCategory = "legitimate"
    await sendTextMessage("user", data.from, responses.LEGITIMATE, data.id)
  } else if (isIrrelevant) {
    if (isMachineCategorised) {
      updateObj.replyCategory = "irrelevant_auto"
      await sendTextMessage(
        "user",
        data.from,
        responses.IRRELEVANT_AUTO,
        data.id
      )
    } else {
      updateObj.replyCategory = "irrelevant"
      await sendTextMessage("user", data.from, responses.IRRELEVANT, data.id)
    }
  } else if (isInfo) {
    if (truthScore === null) {
      updateObj.replyCategory = "error"
      await sendTextMessage("user", data.from, responses.ERROR, data.id)
    } else if (truthScore < (thresholds.falseUpperBound || 1.5)) {
      updateObj.replyCategory = "untrue"
      await sendTextMessage("user", data.from, responses.UNTRUE, data.id)
    } else if (truthScore < (thresholds.misleadingUpperBound || 3.5)) {
      updateObj.replyCategory = "misleading"
      await sendTextMessage("user", data.from, responses.MISLEADING, data.id)
    } else {
      updateObj.replyCategory = "accurate"
      await sendTextMessage("user", data.from, responses.ACCURATE, data.id)
    }
  } else if (isUnsure) {
    updateObj.replyCategory = "unsure"
    await sendTextMessage("user", data.from, responses.UNSURE, data.id)
  } else {
    functions.logger.warn("did not return as expected")
    return
  }
  updateObj.replyTimestamp = Timestamp.fromDate(new Date())
  await instanceSnap.ref.update(updateObj)
  return
}

async function getResponsesObj(botType = "user") {
  const db = admin.firestore()
  let path
  let fallbackResponses
  if (botType === "user") {
    path = "systemParameters/userBotResponses"
    fallbackResponses = USER_BOT_RESPONSES
  } else if (botType === "factChecker") {
    path = "systemParameters/factCheckerBotResponses"
    fallbackResponses = FACTCHECKER_BOT_RESPONSES
  }
  const defaultResponsesRef = db.doc(path)
  const defaultResponsesSnap = await defaultResponsesRef.get()
  return defaultResponsesSnap.data() ?? fallbackResponses
}

exports.getResponsesObj = getResponsesObj
exports.respondToInstance = respondToInstance

const { getThresholds } = require("./utils")
const { sendTextMessage } = require("./sendMessage")
const { sendWhatsappButtonMessage } = require("./sendWhatsappMessage")
const functions = require("firebase-functions")
const { Timestamp } = require("firebase-admin/firestore")
const {
  respondToInterimFeedback,
  getResponsesObj,
  sendMenuMessage,
  sendSatisfactionSurvey,
  sendVotingStats,
  sendInterimUpdate,
  sendInterimPrompt,
} = require("./responseUtilsTs")

async function respondToInstance(
  instanceSnap,
  forceReply = false,
  isImmediate = false
) {
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
  const instanceCount = parentMessageSnap.get("instanceCount")

  function getFinalResponseText(responseText) {
    return responseText
      .replace(
        "{{thanks}}",
        isImmediate ? responses.THANKS_IMMEDIATE : responses.THANKS_DELAYED
      )
      .replace(
        "{{matched}}",
        instanceCount >= 5
          ? `In fact, others have already sent this message in ${instanceCount} times. `
          : ""
      )
      .replace(
        "{{methodology}}",
        isMachineCategorised
          ? responses.METHODOLOGY_AUTO
          : responses.METHODOLOGY_HUMAN
      )
      .replace("{{results}}", isImmediate ? "" : responses.VOTE_RESULTS_SUFFIX)
  }

  if (!isAssessed && !forceReply) {
    await sendTextMessage(
      "user",
      data.from,
      responses.MESSAGE_NOT_YET_ASSESSED,
      data.id
    )
    return
  }
  const updateObj = {
    isReplied: true,
    isReplyForced: forceReply,
    isReplyImmediate: isImmediate,
  }
  let buttons = [
    {
      type: "reply",
      reply: {
        id: `votingResults_${instanceSnap.ref.path}`,
        title: "See voting results",
      },
    },
  ]
  let scamShieldButtons = [
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
        id: `votingResults_${instanceSnap.ref.path}_scamshield`,
        title: "See voting results",
      },
    },
  ]

  let category
  if (isScam) {
    category = "scam"
  } else if (isIllicit) {
    category = "illicit"
  } else if (isSpam) {
    category = "spam"
  } else if (isLegitimate) {
    category = "legitimate"
  } else if (isIrrelevant) {
    if (isMachineCategorised) {
      category = "irrelevant_auto"
    } else {
      category = "irrelevant"
    }
  } else if (isInfo) {
    if (truthScore === null) {
      functions.logger.error(
        "Null truth score despite category info, error response sent"
      )
      category = "error"
    } else if (truthScore < (thresholds.falseUpperBound || 1.5)) {
      category = "untrue"
    } else if (truthScore < (thresholds.misleadingUpperBound || 3.5)) {
      category = "misleading"
    } else {
      category = "accurate"
    }
  } else if (isUnsure) {
    category = "unsure"
  } else {
    functions.logger.error("No category assigned, error response sent")
    updateObj.replyCategory = "error"
    return
  }

  let responseText
  switch (category) {
    case "irrelevant_auto":
      await sendMenuMessage(
        data.from,
        "IRRELEVANT_AUTO_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path
      )
      break
    case "irrelevant":
      await sendMenuMessage(
        data.from,
        "IRRELEVANT_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path
      )
      break
    case "error":
      responseText = getFinalResponseText(responses.ERROR)
      await sendTextMessage("user", data.from, responseText, data.id)
      break
    default:
      responseText = getFinalResponseText(responses[category.toUpperCase()])
      if (category === "scam" || category === "illicit") {
        if (isImmediate) {
          scamShieldButtons.pop()
        }
        buttons = scamShieldButtons
      }
      if (isImmediate && !(category === "scam" || category === "illicit")) {
        await sendTextMessage("user", data.from, responseText, data.id)
      } else {
        await sendWhatsappButtonMessage(
          "user",
          data.from,
          responseText,
          buttons,
          data.id
        )
      }
  }
  updateObj.replyCategory = category
  updateObj.replyTimestamp = Timestamp.fromDate(new Date())
  await instanceSnap.ref.update(updateObj)
  if (
    Math.random() < thresholds.surveyLikelihood &&
    category != "irrelevant_auto"
  ) {
    await sendSatisfactionSurvey(instanceSnap)
  }
  return
}

exports.getResponsesObj = getResponsesObj
exports.respondToInstance = respondToInstance
exports.sendMenuMessage = sendMenuMessage
exports.sendInterimPrompt = sendInterimPrompt
exports.sendInterimUpdate = sendInterimUpdate
exports.sendVotingStats = sendVotingStats
exports.respondToInterimFeedback = respondToInterimFeedback

const admin = require("firebase-admin")
const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } = require("./constants")
const { sleep, getThresholds } = require("./utils")
const { sendTextMessage } = require("./sendMessage")
const {
  sendWhatsappButtonMessage,
  sendWhatsappTextListMessage,
} = require("./sendWhatsappMessage")
const functions = require("firebase-functions")
const { Timestamp } = require("firebase-admin/firestore")

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
  const updateObj = { isReplied: true, isReplyForced: forceReply }
  let buttons = [
    {
      type: "reply",
      reply: {
        id: `votingResults_${instanceSnap.ref.path}_${data.id}`,
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
        id: `votingResults_${instanceSnap.ref.path}_${data.id}_scamshield`,
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

async function sendMenuMessage(
  to,
  prefixName,
  platform = "whatsapp",
  replyMessageId = null,
  disputedInstancePath = null
) {
  const responses = await getResponsesObj("user")
  if (!(prefixName in responses)) {
    functions.logger.error(`prefixName ${prefixName} not found in responses`)
    return
  }
  const text = responses.MENU.replace("{{prefix}}", responses[prefixName])
  switch (platform) {
    case "telegram":
      functions.logger.warn("Telegram menu not implemented yet")
      break
    case "whatsapp":
      const type = "menu"
      const rows = [
        {
          id: `${type}_check`,
          title: "Check/Report",
          description: "Send in messages, images, or screenshots for checking!",
        },
        {
          id: `${type}_help`,
          title: "Get Help",
          description:
            "Find out how to use CheckMate to check or report dubious messages",
        },
        {
          id: `${type}_about`,
          title: "About CheckMate",
          description: "Learn more about CheckMate and the team behind it",
        },
        {
          id: `${type}_feedback`,
          title: "Send Feedback",
          description: "Send us feedback on anything to do with CheckMate",
        },
        {
          id: `${type}_contact`,
          title: "Get Contact",
          description: "Get CheckMates contact to add to your contact list",
        },
        //TODO: Implement these next time
        // {
        //   id: `${type}_newsletter`,
        //   title: "Get Newsletter",
        //   description: "Get our newsletter on the latest scams, hoaxes and misinformation",
        // },
        // {
        //   id: `${type}_tips`,
        //   title: "Get Tips",
        //   description: "Get tips on how to spot scams, hoaxes and misinformation",
        // },
        // {
        //   id: `${type}_stats`,
        //   title: "See My Stats",
        //   description: "View your latest stats and how you've contributed!",
        // },
      ]
      if (disputedInstancePath) {
        rows.splice(4, 0, {
          id: `${type}_dispute_${disputedInstancePath}`,
          title: "Dispute Assessment",
          description: "Dispute CheckMate's assesment of this message",
        })
      }
      const sections = [
        {
          rows: rows,
        },
      ]
      await sendWhatsappTextListMessage(
        "user",
        to,
        text,
        "View Menu",
        sections,
        replyMessageId
      )
      break
  }
}

exports.getResponsesObj = getResponsesObj
exports.respondToInstance = respondToInstance
exports.sendMenuMessage = sendMenuMessage

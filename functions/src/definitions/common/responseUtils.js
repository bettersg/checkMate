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
      await sendMenuMessage(
        data.from,
        "IRRELEVANT_AUTO_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path
      )
    } else {
      updateObj.replyCategory = "irrelevant"
      await sendMenuMessage(
        data.from,
        "IRRELEVANT_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path
      )
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

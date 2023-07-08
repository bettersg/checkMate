const admin = require("firebase-admin")
const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } = require("./constants")
const { sleep, getThresholds } = require("./utils")
const { getCount } = require("./counters")
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

async function sendSatisfactionSurvey(instanceSnap) {
  const db = admin.firestore()
  const data = instanceSnap.data()
  const responses = await getResponsesObj("user")
  const isSatisfactionSurveySent = instanceSnap.get("isSatisfactionSurveySent")
  const userRef = db.collection("users").doc(data.from)
  const userSnap = await userRef.get()
  const lastSent = userSnap.get("satisfactionSurveyLastSent")
  //check lastSent is more than 1 month ago
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  if (
    !isSatisfactionSurveySent &&
    (!lastSent || lastSent.toDate() < oneMonthAgo)
  ) {
    const rows = Array.from({ length: 10 }, (_, i) => {
      const number = 10 - i
      return {
        id: `satisfactionSurvey_${number}_${instanceSnap.ref.path}`,
        title: `${number}`,
      }
    })
    rows[0].description = "Extremely likely 🤩"
    rows[9].description = "Not at all likely 😥"
    const sections = [
      {
        rows: rows,
      },
    ]
    await sendWhatsappTextListMessage(
      "user",
      data.from,
      responses.SATISFACTION_SURVEY,
      "Tap to respond",
      sections
    )
    const batch = db.batch()
    batch.update(instanceSnap.ref, {
      isSatisfactionSurveySent: true,
    })
    batch.update(userRef, {
      satisfactionSurveyLastSent: Timestamp.fromDate(new Date()),
    })
    await batch.commit()
  }
}

async function sendInterimPrompt(instanceSnap) {
  const data = instanceSnap.data()
  const responses = await getResponsesObj("user")
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `sendInterim_${instanceSnap.ref.path}`,
        title: "Get interim update",
      },
    },
  ]
  await sendWhatsappButtonMessage(
    "user",
    data.from,
    responses.INTERIM_PROMPT,
    buttons,
    data.id
  )
  await instanceSnap.ref.update({
    isInterimPromptSent: true,
  })
}

async function sendInterimUpdate(instancePath) {
  //get statistics
  const FEEDBACK_FEATURE_FLAG = true
  const db = admin.firestore()
  const responses = await getResponsesObj("user")
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  if (instanceSnap.get("isReplied")) {
    await sendTextMessage(
      "user",
      instanceSnap.get("from"),
      responses.ALREADY_REPLIED,
      data.id
    )
    return
  }
  const parentMessageRef = db.doc(instancePath).parent.parent
  const parentMessageSnap = await parentMessageRef.get()
  const primaryCategory = parentMessageSnap.get("primaryCategory")
  const truthScore = parentMessageSnap.get("truthScore")
  const voteRequestQuerySnapshot = await parentMessageRef
    .collection("voteRequests")
    .get()
  const numFactCheckers = voteRequestQuerySnapshot.size
  const voteCount = await getCount(parentMessageRef, "responses")
  const percentageVoted = ((voteCount / numFactCheckers) * 100).toFixed(2)
  let prelimAssessment
  let infoPlaceholder = ""
  const infoLiner = `, with an average score of ${truthScore} on a scale of 0-5 (5 = completely true)`
  switch (primaryCategory) {
    case "scam":
      prelimAssessment = "is a scam🚫"
      break
    case "illicit":
      prelimAssessment = "is suspicious🚨"
      break
    case "untrue":
      prelimAssessment = "is untrue❌"
      infoPlaceholder = infoLiner
      break
    case "misleading":
      prelimAssessment = "is misleading⚠️"
      infoPlaceholder = infoLiner
      break
    case "accurate":
      prelimAssessment = "is accurate✅"
      infoPlaceholder = infoLiner
      break
    case "spam":
      prelimAssessment = "is spam🚧"
      break
    case "legitimate":
      prelimAssessment = "is legitimate✅"
      break
    case "irrelevant":
      prelimAssessment =
        "message doesn't contain a meaningful claim to assess.😕"
      break
    case "unsure":
      prelimAssessment = "unsure"
      break
  }
  const updateObj = {}
  let finalResponse
  if (primaryCategory === "unsure") {
    finalResponse = responses.INTERIM_TEMPLATE_UNSURE
    if (data.isInterimUseful === null) {
      updateObj.isInterimUseful = false
    }
  } else {
    finalResponse = responses.INTERIM_TEMPLATE
  }
  const getFeedback =
    data.isInterimUseful === null &&
    primaryCategory !== "unsure" &&
    FEEDBACK_FEATURE_FLAG
  finalResponse = finalResponse
    .replace("{{prelim_assessment}}", prelimAssessment)
    .replace("{{info_placeholder}}", infoPlaceholder)
    .replace("{{%voted}}", percentageVoted)
    .replace("{{get_feedback}}", getFeedback ? responses.INTERIM_FEEDBACK : "")

  let buttons
  if (getFeedback) {
    buttons = [
      {
        type: "reply",
        reply: {
          id: `feedbackInterim_${instancePath}_yes`,
          title: "Yes, it's useful",
        },
      },
      {
        type: "reply",
        reply: {
          id: `feedbackInterim_${instancePath}_no`,
          title: "No, it's not",
        },
      },
    ]
  } else {
    buttons = [
      {
        type: "reply",
        reply: {
          id: `sendInterim_${instancePath}`,
          title: "Get another update",
        },
      },
    ]
  }
  await sendWhatsappButtonMessage(
    "user",
    data.from,
    finalResponse,
    buttons,
    data.id
  )
  if (!instanceSnap.get("isInterimReplySent")) {
    updateObj.isInterimReplySent = true
  }
  //if updateObj is not empty
  if (Object.keys(updateObj).length !== 0) {
    await instanceRef.update(updateObj)
  }
}

async function respondToInterimFeedback(instancePath, isUseful) {
  const db = admin.firestore()
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const responses = await getResponsesObj("user")
  const data = instanceSnap.data()
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `sendInterim_${instancePath}`,
        title: "Get another update",
      },
    },
  ]
  let response
  switch (isUseful) {
    case "yes":
      response = responses?.INTERIM_USEFUL
      await instanceRef.update({ isInterimUseful: true })
      break
    case "no":
      response = responses?.INTERIM_NOT_USEFUL
      await instanceRef.update({ isInterimUseful: false })
      break
  }

  await sendWhatsappButtonMessage("user", data.from, response, buttons, data.id)
}

async function sendVotingStats(instancePath, triggerScamShieldConsent) {
  //get statistics
  const db = admin.firestore()
  const messageRef = db.doc(instancePath).parent.parent
  const instanceSnap = await db.doc(instancePath).get()
  const responseCount = await getCount(messageRef, "responses")
  const irrelevantCount = await getCount(messageRef, "irrelevant")
  const scamCount = await getCount(messageRef, "scam")
  const illicitCount = await getCount(messageRef, "illicit")
  const infoCount = await getCount(messageRef, "info")
  const spamCount = await getCount(messageRef, "spam")
  const legitimateCount = await getCount(messageRef, "legitimate")
  const unsureCount = await getCount(messageRef, "unsure")
  const susCount = scamCount + illicitCount
  const voteTotal = await getCount(messageRef, "totalVoteScore")
  const truthScore = infoCount > 0 ? voteTotal / infoCount : null
  const thresholds = await getThresholds()
  const responses = await getResponsesObj("user")
  const from = instanceSnap.get("from")
  let truthCategory
  if (truthScore !== null) {
    if (truthScore < (thresholds.falseUpperBound || 1.5)) {
      truthCategory = "untrue"
    } else if (truthScore < (thresholds.misleadingUpperBound || 3.5)) {
      truthCategory = "misleading"
    } else {
      truthCategory = "accurate"
    }
  } else truthCategory = "NA"

  const categories = [
    { name: "trivial", count: irrelevantCount, isInfo: false },
    {
      name: scamCount >= illicitCount ? "scam" : "illicit",
      count: susCount,
      isInfo: false,
    },
    { name: "spam", count: spamCount, isInfo: false },
    { name: truthCategory, count: infoCount, isInfo: true },
    { name: "legitimate", count: legitimateCount, isInfo: false },
    { name: "unsure", count: unsureCount, isInfo: false },
  ]

  categories.sort((a, b) => b.count - a.count) // sort in descending order
  const highestCategory =
    categories[0].name === "scam" ? "a scam" : categories[0].name
  const secondCategory =
    categories[1].name === "scam" ? "a scam" : categories[1].name
  const highestPercentage = (
    (categories[0].count / responseCount) *
    100
  ).toFixed(2)
  const secondPercentage = (
    (categories[1].count / responseCount) *
    100
  ).toFixed(2)
  const isHighestInfo = categories[0].isInfo
  const isSecondInfo = categories[1].isInfo

  const infoLiner = `, with an average score of ${
    typeof truthScore === "number" ? truthScore.toFixed(2) : "NA"
  } on a scale of 0-5 (5 = completely true)`
  let response = `${highestPercentage}% of our CheckMates ${
    isHighestInfo ? "collectively " : ""
  }thought this was *${highestCategory}*${isHighestInfo ? infoLiner : ""}.`
  if (secondPercentage > 0) {
    response += ` ${secondPercentage}% ${
      isSecondInfo ? "collectively " : ""
    } thought this was *${secondCategory}*${isSecondInfo ? infoLiner : ""}.`
  }

  await sendTextMessage("user", from, response, instanceSnap.get("id"))

  if (triggerScamShieldConsent) {
    await sleep(2000)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: `scamshieldConsent_${instancePath}_consent`,
          title: "Yes",
        },
      },
      {
        type: "reply",
        reply: {
          id: `scamshieldConsent_${instancePath}_decline`,
          title: "No",
        },
      },
    ]
    await sendWhatsappButtonMessage(
      "user",
      from,
      responses.SCAMSHIELD_SEEK_CONSENT,
      buttons,
      instanceSnap.get("id")
    )
  }
}

exports.getResponsesObj = getResponsesObj
exports.respondToInstance = respondToInstance
exports.sendMenuMessage = sendMenuMessage
exports.sendInterimPrompt = sendInterimPrompt
exports.sendInterimUpdate = sendInterimUpdate
exports.sendVotingStats = sendVotingStats
exports.respondToInterimFeedback = respondToInterimFeedback

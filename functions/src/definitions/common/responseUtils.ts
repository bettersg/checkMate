import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } from "./constants"
import {
  sendWhatsappButtonMessage,
  sendWhatsappTextListMessage,
  sendWhatsappTextMessage,
} from "./sendWhatsappMessage"
import { DocumentSnapshot, Timestamp } from "firebase-admin/firestore"
import { getThresholds, sleep } from "./utils"
import { sendTextMessage } from "./sendMessage"
import { getCount } from "./counters"

const db = admin.firestore()

function getInfoLiner(truthScore: null | number) {
  return `, with an average score of ${
    typeof truthScore === "number" ? truthScore.toFixed(2) : "NA"
  } on a scale of 0-5 (5 = completely true)`
}

async function respondToInterimFeedback(
  instancePath: string,
  isUseful: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const responses = await getResponsesObj("user")
  const data = instanceSnap.data()
  if (!data) {
    functions.logger.log("Missing data in respondToInterimFeedback")
    return
  }
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
    default:
      response = responses?.INTERIM_NOT_USEFUL
      await instanceRef.update({ isInterimUseful: false })
      break
  }

  await sendWhatsappButtonMessage("user", data.from, response, buttons, data.id)
}

async function respondToRationalisationFeedback(
  instancePath: string,
  isUseful: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const responses = await getResponsesObj("user")
  const data = instanceSnap.data()
  if (!data) {
    functions.logger.log("Missing data in respondToRationalisationFeedback")
    return
  }
  let response
  switch (isUseful) {
    case "yes":
      response = responses?.RATIONALISATION_USEFUL
      await instanceRef.update({ isRationalisationUseful: true })
      break
    default:
      response = responses?.RATIONALISATION_NOT_USEFUL
      await instanceRef.update({ isRationalisationUseful: false })
      break
  }

  await sendWhatsappTextMessage("user", data.from, response)
}

async function getResponsesObj(
  botType: "factChecker"
): Promise<typeof FACTCHECKER_BOT_RESPONSES>
async function getResponsesObj(
  botType: "user"
): Promise<typeof USER_BOT_RESPONSES>
async function getResponsesObj(botType: "user" | "factChecker" = "user") {
  let path
  let fallbackResponses
  if (botType === "factChecker") {
    path = "systemParameters/factCheckerBotResponses"
    fallbackResponses = FACTCHECKER_BOT_RESPONSES
  } else {
    path = "systemParameters/userBotResponses"
    fallbackResponses = USER_BOT_RESPONSES
  }
  const defaultResponsesRef = db.doc(path)
  const defaultResponsesSnap = await defaultResponsesRef.get()
  return defaultResponsesSnap.data() ?? fallbackResponses
}

async function sendMenuMessage(
  to: string,
  prefixName: string,
  platform = "whatsapp",
  replyMessageId: string | null = null,
  disputedInstancePath: string | null = null
) {
  const responses = await getResponsesObj("user")
  if (!(prefixName in responses)) {
    functions.logger.error(`prefixName ${prefixName} not found in responses`)
    return
  }
  const text = responses.MENU.replace(
    "{{prefix}}",
    responses[prefixName as keyof typeof responses]
  )
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
          id: `${type}_referral`,
          title: "Get Referral Link",
          description: "Get referral link to forward to others",
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
          description: "Get CheckMate's contact to add to your contact list",
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
        rows.splice(5, 0, {
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

async function sendSatisfactionSurvey(instanceSnap: DocumentSnapshot) {
  const data = instanceSnap.data()
  if (!data) {
    return
  }
  const responses = await getResponsesObj("user")
  const isSatisfactionSurveySent = instanceSnap.get("isSatisfactionSurveySent")
  const userRef = db.collection("users").doc(data.from)
  const thresholds = await getThresholds()
  const cooldown = thresholds.satisfactionSurveyCooldownDays ?? 30
  const userSnap = await userRef.get()
  const lastSent = userSnap.get("satisfactionSurveyLastSent")
  //check lastSent is more than cooldown days ago
  let cooldownDate = new Date()
  cooldownDate.setDate(cooldownDate.getDate() - cooldown)
  if (
    !isSatisfactionSurveySent &&
    (!lastSent || lastSent.toDate() < cooldownDate)
  ) {
    const rows: { id: string; title: string; description?: string }[] =
      Array.from({ length: 10 }, (_, i) => {
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

async function sendVotingStats(instancePath: string) {
  //get statistics
  const messageRef = db.doc(instancePath).parent.parent
  if (!messageRef) {
    return
  }
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

  if (responseCount <= 0) {
    functions.logger.error(
      `Stats requested for instance ${instancePath} with 0 votes`
    )
    await sendTextMessage(
      "user",
      from,
      "Sorry, an error occured!",
      instanceSnap.get("id")
    )
    return
  }

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
  const highestPercentage = (categories[0].count / responseCount) * 100
  const secondPercentage = (categories[1].count / responseCount) * 100
  const isHighestInfo = categories[0].isInfo
  const isSecondInfo = categories[1].isInfo

  const infoLiner = getInfoLiner(truthScore)
  let response = `${highestPercentage.toFixed(2)}% of our CheckMates ${
    isHighestInfo ? "collectively " : ""
  }thought this was *${highestCategory}*${isHighestInfo ? infoLiner : ""}.`
  if (secondPercentage > 0) {
    response += ` ${secondPercentage.toFixed(2)}% ${
      isSecondInfo ? "collectively " : ""
    } thought this was *${secondCategory}*${isSecondInfo ? infoLiner : ""}.`
  }

  await sendTextMessage("user", from, response, instanceSnap.get("id"))

  // if (triggerScamShieldConsent) {
  //   await sleep(2000)
  //   const buttons = [
  //     {
  //       type: "reply",
  //       reply: {
  //         id: `scamshieldConsent_${instancePath}_consent`,
  //         title: "Yes",
  //       },
  //     },
  //     {
  //       type: "reply",
  //       reply: {
  //         id: `scamshieldConsent_${instancePath}_decline`,
  //         title: "No",
  //       },
  //     },
  //   ]
  //   await sendWhatsappButtonMessage(
  //     "user",
  //     from,
  //     responses.SCAMSHIELD_SEEK_CONSENT,
  //     buttons,
  //     instanceSnap.get("id")
  //   )
  // }
}

async function sendRationalisation(instancePath: string) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const responses = await getResponsesObj("user")
  try {
    const messageRef = instanceRef.parent.parent
    if (!data) {
      throw new Error("instanceSnap data missing")
    }
    if (!messageRef) {
      throw new Error("messageRef is null")
    }
    const messageSnap = await messageRef.get()
    if (!messageSnap) {
      throw new Error("messageSnap is null")
    }
    const rationalisation = messageSnap.get("rationalisation")
    const category = messageSnap.get("primaryCategory")
    if (!rationalisation) {
      throw new Error("rationalisation is null")
    }
    if (!category) {
      throw new Error("category is null")
    }
    const buttons = [
      {
        type: "reply",
        reply: {
          id: `feedbackRationalisation_${instancePath}_yes`,
          title: "Yes, it's useful",
        },
      },
      {
        type: "reply",
        reply: {
          id: `feedbackRationalisation_${instancePath}_no`,
          title: "No, it's not",
        },
      },
    ]
    const replyText = responses.HOWD_WE_TELL.replace(
      "{{rationalisation}}",
      rationalisation
    )
    await instanceRef.update({
      isRationalisationSent: true,
    })
    await sendWhatsappButtonMessage(
      "user",
      data.from,
      replyText,
      buttons,
      data.id
    )
  } catch (e) {
    functions.logger.error(`Error sending rationalisation: ${e}`)
    if (data?.from) {
      await sendTextMessage("user", data.from, responses.GENERIC_ERROR)
    }
  }
}

async function sendInterimUpdate(instancePath: string) {
  //get statistics
  const FEEDBACK_FEATURE_FLAG = true
  const responses = await getResponsesObj("user")
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  if (!data) {
    return
  }
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
  if (!parentMessageRef) {
    return
  }
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
  const infoLiner = getInfoLiner(truthScore)
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
    default:
      functions.logger.log("primaryCategory did not match available cases")
      return
  }
  const updateObj: {
    isInterimUseful?: boolean
    isMeaningfulInterimReplySent?: boolean
    prelimAssessment?: string
    isInterimReplySent?: boolean
  } = {}
  let finalResponse
  let isFirstMeaningfulReply = false
  if (primaryCategory === "unsure") {
    finalResponse = responses.INTERIM_TEMPLATE_UNSURE
    if (data.isInterimUseful === null) {
      updateObj.isInterimUseful = false
    }
    if (data.isMeaningfulInterimReplySent === null) {
      updateObj.isMeaningfulInterimReplySent = false
    }
  } else {
    finalResponse = responses.INTERIM_TEMPLATE
    if (!data.isMeaningfulInterimReplySent) {
      updateObj.isMeaningfulInterimReplySent = true
      isFirstMeaningfulReply = true
    }
  }
  const getFeedback =
    (data.isInterimUseful === null || isFirstMeaningfulReply) &&
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

async function sendInterimPrompt(instanceSnap: DocumentSnapshot) {
  const data = instanceSnap.data()
  if (!data) {
    return
  }
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
async function respondToInstance(
  instanceSnap: DocumentSnapshot,
  forceReply = false,
  isImmediate = false
) {
  const parentMessageRef = instanceSnap.ref.parent.parent
  if (!parentMessageRef) {
    return
  }
  const parentMessageSnap = await parentMessageRef.get()
  const data = instanceSnap.data()
  if (!data?.from) {
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
  const responseCount = await getCount(parentMessageRef, "responses")
  const isImage = data?.type === "image"

  function getFinalResponseText(responseText: string) {
    console.log(isImage)
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
      .replace("{{image_caveat}}", isImage ? responses.IMAGE_CAVEAT : "")
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
  const updateObj: {
    isReplied: boolean
    isReplyForced: boolean
    isReplyImmediate: boolean
    replyCategory?: string
    replyTimestamp?: Timestamp
    scamShieldConsent?: boolean
  } = {
    isReplied: true,
    isReplyForced: forceReply,
    isReplyImmediate: isImmediate,
  }
  let buttons = []

  const votingResultsButton = {
    type: "reply",
    reply: {
      id: `votingResults_${instanceSnap.ref.path}`,
      title: "See voting results",
    },
  }

  const declineScamShieldButton = {
    type: "reply",
    reply: {
      id: `scamshieldDecline_${instanceSnap.ref.path}`,
      title: "Don't report this",
    },
  }

  const viewRationalisationButton = {
    type: "reply",
    reply: {
      id: `rationalisation_${instanceSnap.ref.path}`,
      title: "How'd we tell?",
    },
  }

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
      if (!(category.toUpperCase() in responses)) {
        functions.logger.error(`category ${category} not found in responses`)
        return
      }
      responseText = getFinalResponseText(
        responses[category.toUpperCase() as keyof typeof responses]
      )

      if (!(isMachineCategorised || responseCount <= 0)) {
        buttons.push(votingResultsButton)
      }

      const rationalisation = parentMessageSnap.get("rationalisation")

      if ((category === "scam" || category === "illicit") && rationalisation) {
        buttons.push(viewRationalisationButton)
      }

      if (category === "scam" || category === "illicit") {
        buttons.push(declineScamShieldButton)
        updateObj.scamShieldConsent = true
      }

      if (buttons.length > 0) {
        await sendWhatsappButtonMessage(
          "user",
          data.from,
          responseText,
          buttons,
          data.id
        )
      } else {
        await sendTextMessage("user", data.from, responseText, data.id)
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

async function sendReferralMessage(user: string) {
  let referralResponse
  const code = (await db.collection("users").doc(user).get()).get("referralId")
  const responses = await getResponsesObj("user")
  if (code) {
    referralResponse = responses.REFERRAL.replace(
      "{{link}}",
      `https://ref.checkmate.sg/${code}`
    )
  } else {
    referralResponse = responses.GENERIC_ERROR
    functions.logger.error(`Referral code not found for ${user}`)
  }
  await sendTextMessage("user", user, referralResponse, null, "whatsapp", true)
}

export {
  getResponsesObj,
  respondToInstance,
  sendMenuMessage,
  sendInterimPrompt,
  sendInterimUpdate,
  sendVotingStats,
  sendReferralMessage,
  respondToInterimFeedback,
  sendRationalisation,
  respondToRationalisationFeedback,
}

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import USER_BOT_RESPONSES from "./parameters/userResponses.json"
import CHECKER_BOT_RESPONSES from "./parameters/checkerResponses.json"
import {
  sendWhatsappButtonMessage,
  sendWhatsappImageMessage,
  sendWhatsappTextListMessage,
  sendWhatsappTextMessage,
} from "./sendWhatsappMessage"
import { DocumentSnapshot, Timestamp } from "firebase-admin/firestore"
import { getThresholds, sleep } from "./utils"
import { getSignedUrl } from "./mediaUtils"
import { sendTextMessage } from "./sendMessage"
import { getCount } from "./counters"

const db = admin.firestore()

type BotResponses = {
  [key: string]: {
    [key: string]: string
  }
}

type ResponseObject = {
  [key: string]: string
}

async function getResponsesObj(botType: "factChecker"): Promise<ResponseObject>
async function getResponsesObj(botType: "user"): Promise<ResponseObject>
async function getResponsesObj(
  botType: "user",
  user: string
): Promise<ResponseObject>
async function getResponsesObj(
  botType: "user" | "factChecker" = "user",
  user: string | null = null
) {
  let path
  if (botType === "factChecker") {
    path = "systemParameters/factCheckerBotResponses"
    const checkerResponseSnap = await db.doc(path).get()
    return checkerResponseSnap.data() ?? CHECKER_BOT_RESPONSES
  } else {
    if (typeof user !== "string") {
      functions.logger.error("user not provided to getResponsesObj")
      return "error"
    }
    path = "systemParameters/userBotResponses"
    const userResponseSnap = await db.doc(path).get()
    const userResponseObject = userResponseSnap.data() ?? USER_BOT_RESPONSES
    const userSnap = await db.collection("users").doc(user).get()
    const language = userSnap.get("language") ?? "en"
    const responseProxy = new Proxy(userResponseObject as BotResponses, {
      get(target, prop: string) {
        if (prop === "then") {
          //somehow code tries to access then property
          return undefined
        }
        if (target[prop] && target[prop][language]) {
          return target[prop][language]
        } else if (target[prop] && target[prop]["en"]) {
          // Fallback to English
          return target[prop]["en"]
        }
        functions.logger.error(`Error getting ${prop} from user bot responses`)
        return "error" // Or some default value or error handling
      },
    })
    return responseProxy
  }
}

function getInfoLiner(truthScore: null | number, infoPlaceholder: string) {
  return infoPlaceholder.replace(
    "{{score}}",
    typeof truthScore === "number" ? truthScore.toFixed(2) : "NA"
  )
}

async function respondToRationalisationFeedback(
  instancePath: string,
  isUseful: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const responses = await getResponsesObj("user", from)
  if (!data) {
    functions.logger.log("Missing data in respondToRationalisationFeedback")
    return
  }
  let response
  switch (isUseful) {
    case "yes":
      response = responses?.FEEDBACK_THANKS
      await instanceRef.update({ isRationalisationUseful: true })
      break
    default:
      response = responses?.RATIONALISATION_NOT_USEFUL
      await instanceRef.update({ isRationalisationUseful: false })
      break
  }

  await sendWhatsappTextMessage("user", from, response)
}

async function respondToBlastFeedback(
  blastPath: string,
  feedbackCategory: string,
  from: string
) {
  const blastFeedbackRef = db.doc(blastPath).collection("recipients").doc(from)
  const responses = await getResponsesObj("user", from)
  blastFeedbackRef.update({
    feebackCategory: feedbackCategory,
  })
  await sendWhatsappTextMessage("user", from, responses.FEEDBACK_THANKS)
}

async function sendMenuMessage(
  to: string,
  prefixName: string,
  platform = "whatsapp",
  replyMessageId: string | null = null,
  disputedInstancePath: string | null = null,
  isTruncated: boolean = false
) {
  const userSnap = await db.collection("users").doc(to).get()
  const isSubscribedUpdates = userSnap.get("isSubscribedUpdates") ?? false
  const responses = await getResponsesObj("user", to)
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
          title: responses.MENU_TITLE_CHECK,
          description: responses.MENU_DESCRIPTION_CHECK,
        },
        {
          id: `${type}_referral`,
          title: responses.MENU_TITLE_REFERRAL,
          description: responses.MENU_DESCRIPTION_REFERRAL,
        },
        {
          id: `${type}_help`,
          title: responses.MENU_TITLE_HELP,
          description: responses.MENU_DESCRIPTION_HELP,
        },
        {
          id: `${type}_about`,
          title: responses.MENU_TITLE_ABOUT,
          description: responses.MENU_DESCRIPTION_ABOUT,
        },
        {
          id: `${type}_feedback`,
          title: responses.MENU_TITLE_FEEDBACK,
          description: responses.MENU_DESCRIPTION_FEEDBACK,
        },
        {
          id: `${type}_language`,
          title: responses.MENU_TITLE_LANGUAGE,
          description: responses.MENU_DESCRIPTION_LANGUAGE,
        },
        {
          id: `${type}_contact`,
          title: responses.MENU_TITLE_CONTACT,
          description: responses.MENU_DESCRIPTION_CONTACT,
        },
        {
          id: isSubscribedUpdates
            ? `${type}_unsubscribeUpdates`
            : `${type}_subscribeUpdates`,
          title: isSubscribedUpdates
            ? responses.MENU_TITLE_UNSUB
            : responses.MENU_TITLE_SUB,
          description: isSubscribedUpdates
            ? responses.MENU_DESCRIPTION_UNSUB
            : responses.MENU_DESCRIPTION_SUB,
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
          title: responses.MENU_TITLE_DISPUTE,
          description: responses.MENU_DESCRIPTION_DISPUTE,
        })
      }
      //filter truncated rows such that only those containing check, referral, and contact in the id are kept
      const keep = ["check", "referral", "contact"]
      const truncatedRows = rows.filter((row) =>
        keep.some((id) => row.id.includes(id))
      )
      const sections = [
        {
          rows: isTruncated ? truncatedRows : rows,
        },
      ]
      await sendWhatsappTextListMessage(
        "user",
        to,
        text,
        responses.MENU_BUTTON,
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
  const from = data?.from ?? null
  const responses = await getResponsesObj("user", from)
  const isSatisfactionSurveySent = instanceSnap.get("isSatisfactionSurveySent")
  const userRef = db.collection("users").doc(from)
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
    rows[0].description = responses.MENU_DESCRIPTION_NPS_LIKELY
    rows[9].description = responses.MENU_DESCRIPTION_NPS_UNLIKELY
    const sections = [
      {
        rows: rows,
      },
    ]
    await sendWhatsappTextListMessage(
      "user",
      from,
      responses.SATISFACTION_SURVEY,
      responses.NPS_MENU_BUTTON,
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
  const from = instanceSnap.get("from")
  const responses = await getResponsesObj("user", from)
  let truthCategory

  if (responseCount <= 0) {
    functions.logger.error(
      `Stats requested for instance ${instancePath} with 0 votes`
    )
    await sendTextMessage(
      "user",
      from,
      responses.GENERIC_ERROR,
      instanceSnap.get("id")
    )
    return
  }

  if (truthScore !== null) {
    if (truthScore < (thresholds.falseUpperBound || 1.5)) {
      truthCategory = responses.PLACEHOLDER_UNTRUE
    } else if (truthScore < (thresholds.misleadingUpperBound || 3.5)) {
      truthCategory = responses.PLACEHOLDER_MISLEADING
    } else {
      truthCategory = responses.PLACEHOLDER_ACCURATE
    }
  } else truthCategory = "NA"

  const categories = [
    {
      name: responses.PLACEHOLDER_IRRELEVANT,
      count: irrelevantCount,
      isInfo: false,
    },
    {
      name:
        scamCount >= illicitCount
          ? responses.PLACEHOLDER_SCAM
          : responses.PLACEHOLDER_ILLICIT,
      count: susCount,
      isInfo: false,
    },
    { name: responses.PLACEHOLDER_SPAM, count: spamCount, isInfo: false },
    { name: truthCategory, count: infoCount, isInfo: true },
    {
      name: responses.PLACEHOLDER_LEGITIMATE,
      count: legitimateCount,
      isInfo: false,
    },
    { name: responses.PLACEHOLDER_UNSURE, count: unsureCount, isInfo: false },
  ]

  categories.sort((a, b) => b.count - a.count) // sort in descending order
  const highestCategory = categories[0].name
  const secondCategory = categories[1].name
  const highestPercentage = (categories[0].count / responseCount) * 100
  const secondPercentage = (categories[1].count / responseCount) * 100
  const isHighestInfo = categories[0].isInfo
  const isSecondInfo = categories[1].isInfo

  const infoLiner = getInfoLiner(truthScore, responses.INFO_PLACEHOLDER)
  let response = responses.STATS_TEMPLATE_1.replace(
    "{{top}}",
    `${highestPercentage.toFixed(2)}`
  )
    .replace("{{category}}", highestCategory)
    .replace("{{info_placeholder}}", isHighestInfo ? infoLiner : "")
  // let response = `${highestPercentage.toFixed(2)}% of our CheckMates ${
  //   isHighestInfo ? "collectively " : ""
  // }thought this was *${highestCategory}*${isHighestInfo ? infoLiner : ""}.`
  if (secondPercentage > 0) {
    response += responses.STATS_TEMPLATE_2.replace(
      "{{second}}",
      `${secondPercentage.toFixed(2)}`
    )
      .replace("{{category}}", secondCategory)
      .replace("{{info_placeholder}}", isSecondInfo ? infoLiner : "")
    // response += ` ${secondPercentage.toFixed(2)}% ${
    //   isSecondInfo ? "collectively " : ""
    // } thought this was *${secondCategory}*${isSecondInfo ? infoLiner : ""}.`
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
  const from = data?.from ?? null
  const responses = await getResponsesObj("user", from)
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
          title: responses.BUTTON_USEFUL,
        },
      },
      {
        type: "reply",
        reply: {
          id: `feedbackRationalisation_${instancePath}_no`,
          title: responses.BUTTON_NOT_USEFUL,
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
    await sendWhatsappButtonMessage("user", from, replyText, buttons, data.id)
  } catch (e) {
    functions.logger.error(`Error sending rationalisation: ${e}`)
    if (data?.from) {
      await sendTextMessage("user", from, responses.GENERIC_ERROR)
    }
  }
}

async function updateLanguageAndSendMenu(from: string, language: string) {
  const userRef = db.collection("users").doc(from)
  await userRef.update({
    language: language,
  })
  await sendMenuMessage(from, "MENU_PREFIX", "whatsapp", null, null, true) //truncated menu on onboarding
}

async function sendInterimUpdate(instancePath: string) {
  //get statistics
  const FEEDBACK_FEATURE_FLAG = true
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  if (!data) {
    return
  }
  const from = data?.from ?? null
  const responses = await getResponsesObj("user", from)
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
  const infoLiner = getInfoLiner(truthScore, responses.INFO_PLACEHOLDER)
  switch (primaryCategory) {
    case "scam":
      prelimAssessment = responses.PLACEHOLDER_SCAM
      break
    case "illicit":
      prelimAssessment = responses.PLACEHOLDER_SUSPICIOUS
      break
    case "untrue":
      prelimAssessment = responses.PLACEHOLDER_UNTRUE
      infoPlaceholder = infoLiner
      break
    case "misleading":
      prelimAssessment = responses.PLACEHOLDER_MISLEADING
      infoPlaceholder = infoLiner
      break
    case "accurate":
      prelimAssessment = responses.PLACEHOLDER_ACCURATE
      infoPlaceholder = infoLiner
      break
    case "spam":
      prelimAssessment = responses.PLACEHOLDER_SPAM
      break
    case "legitimate":
      prelimAssessment = responses.PLACEHOLDER_LEGITIMATE
      break
    case "irrelevant":
      prelimAssessment = responses.PLACEHOLDER_IRRELEVANT
      break
    case "unsure":
      prelimAssessment = responses.PLACEHOLDER_UNSURE
      break
    default:
      functions.logger.log("primaryCategory did not match available cases")
      return
  }
  const updateObj: {
    isMeaningfulInterimReplySent?: boolean
    prelimAssessment?: string
    isInterimReplySent?: boolean
  } = {}
  let finalResponse
  if (primaryCategory === "unsure") {
    finalResponse = responses.INTERIM_TEMPLATE_UNSURE
    if (data.isMeaningfulInterimReplySent === null) {
      updateObj.isMeaningfulInterimReplySent = false
    }
  } else {
    finalResponse = responses.INTERIM_TEMPLATE
    if (!data.isMeaningfulInterimReplySent) {
      updateObj.isMeaningfulInterimReplySent = true
    }
  }
  finalResponse = finalResponse
    .replace("{{prelim_assessment}}", prelimAssessment)
    .replace("{{info_placeholder}}", infoPlaceholder)
    .replace("{{%voted}}", percentageVoted)

  const buttons = [
    {
      type: "reply",
      reply: {
        id: `sendInterim_${instancePath}`,
        title: responses.BUTTON_ANOTHER_UPDATE,
      },
    },
  ]
  await sendWhatsappButtonMessage("user", from, finalResponse, buttons, data.id)
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
  const from = data?.from ?? null
  const responses = await getResponsesObj("user", from)
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `sendInterim_${instanceSnap.ref.path}`,
        title: responses.BUTTON_GET_INTERIM,
      },
    },
  ]
  await sendWhatsappButtonMessage(
    "user",
    from,
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
  const from = data.from
  const responses = await getResponsesObj("user", from)
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
  const isMatched = data?.isMatched ?? false

  function getFinalResponseText(responseText: string) {
    return responseText
      .replace(
        "{{thanks}}",
        isImmediate ? responses.THANKS_IMMEDIATE : responses.THANKS_DELAYED
      )
      .replace(
        "{{matched}}",
        instanceCount >= 5
          ? responses.MATCHED.replace("{{numberInstances}}", `${instanceCount}`)
          : ""
      )
      .replace(
        "{{methodology}}",
        isMachineCategorised
          ? responses.METHODOLOGY_AUTO
          : isMatched ? responses.METHODOLOGY_HUMAN_PREVIOUS : responses.METHODOLOGY_HUMAN
      )
      .replace("{{image_caveat}}", isImage ? responses.IMAGE_CAVEAT : "")
  }

  if (!isAssessed && !forceReply) {
    await sendTextMessage(
      "user",
      from,
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
      title: responses.BUTTON_RESULTS,
    },
  }

  const declineScamShieldButton = {
    type: "reply",
    reply: {
      id: `scamshieldDecline_${instanceSnap.ref.path}`,
      title: responses.BUTTON_DECLINE_REPORT,
    },
  }

  const viewRationalisationButton = {
    type: "reply",
    reply: {
      id: `rationalisation_${instanceSnap.ref.path}`,
      title: responses.BUTTON_RATIONALISATION,
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
        from,
        "IRRELEVANT_AUTO_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path
      )
      break
    case "irrelevant":
      await sendMenuMessage(
        from,
        "IRRELEVANT_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path
      )
      break
    case "error":
      responseText = getFinalResponseText(responses.ERROR)
      await sendTextMessage("user", from, responseText, data.id)
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
        const language =
          (await db.collection("users").doc(from).get()).get("language") ?? "en"
        if (language === "en") {
          buttons.push(viewRationalisationButton)
        }
      }

      if (category === "scam" || category === "illicit") {
        buttons.push(declineScamShieldButton)
        updateObj.scamShieldConsent = true
      }

      if (buttons.length > 0) {
        await sendWhatsappButtonMessage(
          "user",
          from,
          responseText,
          buttons,
          data.id
        )
      } else {
        await sendTextMessage("user", from, responseText, data.id)
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
  const responses = await getResponsesObj("user", user)
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

async function sendLanguageSelection(user: string, newUser: boolean) {
  const responses = await getResponsesObj("user", user)
  const response = responses.LANGUAGE_SELECTION.replace(
    "{{new_user_en}}",
    newUser ? responses.NEW_USER_PREFIX_EN : ""
  ).replace("{{new_user_cn}}", newUser ? responses.NEW_USER_PREFIX_CN : "")
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `languageSelection_en`,
        title: responses.BUTTON_ENGLISH,
      },
    },
    {
      type: "reply",
      reply: {
        id: `languageSelection_cn`,
        title: responses.BUTTON_CHINESE,
      },
    },
  ]
  await sendWhatsappButtonMessage("user", user, response, buttons)
}

async function sendBlast(user: string) {
  const blastQuerySnap = await db
    .collection("blasts")
    .where("isActive", "==", true)
    .orderBy("createdDate", "desc") // Order by createdDate in descending order
    .limit(1) // Limit to 1 document
    .get()
  const responses = await getResponsesObj("user", user)
  if (blastQuerySnap.empty) {
    functions.logger.warn(
      `No active blast found when attempting to send blast to user ${user}`
    )
    await sendTextMessage("user", user, responses.GENERIC_ERROR)
    return
  }
  const blastSnap = blastQuerySnap.docs[0]
  const blastData = blastSnap.data()
  switch (blastData.type) {
    case "image":
      if (!blastData.storageUrl) {
        functions.logger.error(
          `No image url found for blast ${blastSnap.ref.path}`
        )
        await sendTextMessage("user", user, responses.GENERIC_ERROR)
        return
      } else {
        //send image to user
        const signedUrl = await getSignedUrl(blastData.storageUrl)
        await sendWhatsappImageMessage(
          "user",
          user,
          null,
          signedUrl,
          blastData.text ?? null,
          null
        )
      }
      break
    case "text":
      if (!blastData.text) {
        functions.logger.error(`No text found for blast ${blastSnap.ref.path}`)
        await sendTextMessage("user", user, responses.GENERIC_ERROR)
        return
      } else {
        //send text to user
        await sendTextMessage("user", user, blastData.text)
      }
      break
  }
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `feedbackBlast_${blastSnap.ref.path}_negative`,
        title: responses.BUTTON_BOO,
      },
    },
    {
      type: "reply",
      reply: {
        id: `feedbackBlast_${blastSnap.ref.path}_neutral`,
        title: responses.BUTTON_MEH,
      },
    },
    {
      type: "reply",
      reply: {
        id: `feedbackBlast_${blastSnap.ref.path}_positive`,
        title: responses.BUTTON_SHIOK,
      },
    },
  ]
  await blastSnap.ref
    .collection("recipients")
    .doc(user)
    .set(
      {
        feedbackCategory: null,
        sentTimestamp: Timestamp.fromDate(new Date()),
      },
      { merge: true }
    )
  await sendWhatsappButtonMessage(
    "user",
    user,
    responses.BLAST_FEEDBACK,
    buttons
  )
}

export {
  getResponsesObj,
  respondToInstance,
  sendMenuMessage,
  sendInterimPrompt,
  sendInterimUpdate,
  sendVotingStats,
  sendReferralMessage,
  sendRationalisation,
  respondToRationalisationFeedback,
  updateLanguageAndSendMenu,
  sendLanguageSelection,
  sendBlast,
  respondToBlastFeedback,
}

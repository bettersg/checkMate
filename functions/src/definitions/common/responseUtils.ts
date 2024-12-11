import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import USER_BOT_RESPONSES from "./parameters/userResponses.json"
import CHECKER_BOT_RESPONSES from "./parameters/checkerResponses.json"
import {
  sendWhatsappButtonMessage,
  sendWhatsappImageMessage,
  sendWhatsappTextListMessage,
  sendWhatsappTextMessage,
  sendWhatsappFlowMessage,
} from "./sendWhatsappMessage"
import {
  DocumentSnapshot,
  Timestamp,
  DocumentReference,
} from "firebase-admin/firestore"
import { getUserSnapshot } from "../../services/user/userManagement"
import { getThresholds, sleep } from "./utils"
import { getSignedUrl } from "./mediaUtils"
import { sendTextMessage } from "./sendMessage"
import { getVoteCounts } from "./counters"
import {
  CustomReply,
  LanguageSelection,
  UserBlast,
  CommunityNote,
  FlowData,
} from "../../types"
import { incrementCheckerCounts } from "./counters"
import { FieldValue } from "firebase-admin/firestore"
import { create } from "domain"

const db = admin.firestore()

type BotResponses = {
  [key: string]: {
    [key: string]: string
  }
}

type ResponseObject = {
  [key: string]: string
}

// async function getUserResponsesObject(
//   botType: "factChecker"
// ): Promise<ResponseObject>
// async function getUserResponsesObject(
//   botType: "user",
//   userSnap: DocumentSnapshot
// ): Promise<ResponseObject>
// async function getUserResponsesObject(
//   botType: "user" | "factChecker" = "user",
//   userSnap?: DocumentSnapshot,
//   idField?: string
// ) {
//   if (botType === "factChecker") {
//     const returnObj = await getResponsesObj("factChecker")
//     return returnObj
//   } else {
//     if (userSnap == null) {
//       functions.logger.error("user not provided to getUserResponseObject")
//       return "error"
//     }
//     if (typeof idField !== "string") {
//       functions.logger.error("idField not provided to getUserResponseObject")
//       return "error"
//     }

//     let language
//     if (userSnap !== null) {
//       language = userSnap.get("language") ?? "en"
//     } else {
//       language = "en"
//     }
//     const returnObj = await getResponsesObj("user", language)
//     return returnObj
//   }
// }

async function getResponsesObj(botType: "factChecker"): Promise<ResponseObject>
async function getResponsesObj(
  botType: "user",
  language: LanguageSelection
): Promise<ResponseObject>
async function getResponsesObj(
  botType: "user" | "factChecker" = "user",
  language: LanguageSelection = "en"
) {
  let path
  if (botType === "factChecker") {
    path = "systemParameters/factCheckerBotResponses"
    const checkerResponseSnap = await db.doc(path).get()
    return checkerResponseSnap.data() ?? CHECKER_BOT_RESPONSES
  } else {
    if (typeof language !== "string") {
      functions.logger.error("language not provided to getResponsesObj")
      return "error"
    }
    path = "systemParameters/userBotResponses"
    const userResponseSnap = await db.doc(path).get()
    const userResponseObject = userResponseSnap.data() ?? USER_BOT_RESPONSES
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
    typeof truthScore === "number" ? truthScore.toFixed(1) : "NA"
  )
}

async function respondToRationalisationFeedback(
  userSnap: DocumentSnapshot,
  instancePath: string,
  isUseful: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
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
      response = responses?.FEEDBACK_NOT_USEFUL
      await instanceRef.update({ isRationalisationUseful: false })
      break
  }

  await sendWhatsappTextMessage("user", from, response)
}

async function respondToWaitlist(
  userSnap: DocumentSnapshot,
  isInterested: boolean
) {
  const whatsappId = userSnap.get("whatsappId")
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  let response
  if (isInterested) {
    response = responses?.WAITLIST_THANKS
  } else {
    response = responses?.FEEDBACK_THANKS
  }
  await sendWhatsappTextMessage("user", whatsappId, response)
}

async function respondToCommunityNoteFeedback(
  userSnap: DocumentSnapshot,
  instancePath: string,
  isUseful: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  if (!data) {
    functions.logger.log("Missing data in respondToCommunityNoteFeedback")
    return
  }
  let response
  let followUpWithReferral = false
  switch (isUseful) {
    case "yes":
      response = responses?.FEEDBACK_THANKS
      await instanceRef.update({ isCommunityNoteUseful: true })
      // const isReminderMessageSent =
      //   userSnap.get("isReminderMessageSent") ?? false
      const isReferralMessageSent =
        userSnap.get("isReferralMessageSent") ?? false

      followUpWithReferral = !isReferralMessageSent

      // if (followUpWithReminder) {
      //   await sleep(3000)
      //   await sendTextMessage("user", from, responses.NEXT_TIME)
      //   await userSnap.ref.update({
      //     isReminderMessageSent: true,
      //   })
      // }
      break
    case "no":
      response = responses?.FEEDBACK_NOT_USEFUL
      await instanceRef.update({ isCommunityNoteUseful: false })
      break
    default:
      response = responses?.FEEDBACK_NOT_USEFUL
      await instanceRef.update({ isRationalisationUseful: false })
      break
  }

  await sendWhatsappTextMessage("user", from, response)
  if (followUpWithReferral) {
    await sendReferralMessage(userSnap)
    await userSnap.ref.update({
      isReferralMessageSent: true,
    })
  }
}

async function respondToIrrelevantDispute(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  if (!data) {
    functions.logger.log("Missing data in respondToCommunityNoteFeedback")
    return
  }
  const response = responses?.IRRELEVANT_APPEAL
  await instanceRef.update({ isIrrelevantAppealed: true })

  await sendWhatsappTextMessage("user", from, response, data.id)
}

async function respondToBlastFeedback(
  userSnap: DocumentSnapshot,
  blastPath: string,
  feedbackCategory: string
) {
  const from = userSnap.get("whatsappId") //TODO: think about non whatsapp cases
  const language = userSnap.get("language") ?? "en"
  const blastFeedbackRef = db.doc(blastPath).collection("recipients").doc(from)
  const responses = await getResponsesObj("user", language)
  blastFeedbackRef.update({
    feebackCategory: feedbackCategory,
  })
  await sendWhatsappTextMessage("user", from, responses.FEEDBACK_THANKS)
}

async function sendMenuMessage(
  userSnap: DocumentSnapshot,
  prefixName: string,
  platform = "whatsapp",
  replyMessageId: string | null = null,
  disputedInstancePath: string | null = null,
  isTruncated: boolean = false,
  isGenerated: boolean = false,
  isIncorrect: boolean = false,
  language: LanguageSelection | null = null
) {
  const isSubscribedUpdates = userSnap.get("isSubscribedUpdates") ?? false
  const resolvedLanguage = language ?? userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", resolvedLanguage)
  if (!(prefixName in responses)) {
    functions.logger.error(`prefixName ${prefixName} not found in responses`)
    return
  }
  const text = getFinalResponseText(
    responses.MENU,
    responses,
    null,
    null,
    false,
    1,
    false,
    false,
    false,
    false,
    isGenerated,
    isIncorrect,
    "irrelevant",
    prefixName
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
        userSnap.get("whatsappId"),
        text,
        responses.MENU_BUTTON,
        sections,
        replyMessageId
      )
      break
  }
}

async function sendSatisfactionSurvey(instanceSnap: DocumentSnapshot) {
  const userSnap = await getUserSnapshot(
    instanceSnap.get("from"),
    instanceSnap.get("source")
  )
  if (userSnap == null) {
    functions.logger.error(
      `User ${instanceSnap.get("from")} not found in database`
    )
    return Promise.resolve()
  }
  const data = instanceSnap.data()
  if (!data) {
    return
  }
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  //to get the platform the user sent the message from
  const isSatisfactionSurveySent = instanceSnap.get("isSatisfactionSurveySent")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const thresholds = await getThresholds()
  const cooldown = thresholds.satisfactionSurveyCooldownDays ?? 30
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  const lastSent = userSnap.get("satisfactionSurveyLastSent")
  const userRef = userSnap.ref
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

async function getVotingStatsMessage(
  truthScore: number | null,
  numberPointScale: number,
  messageRef: DocumentReference,
  language: LanguageSelection = "en"
) {
  if (!messageRef) {
    throw new Error("messageRef missing")
  }
  const {
    irrelevantCount,
    scamCount,
    illicitCount,
    infoCount,
    spamCount,
    legitimateCount,
    unsureCount,
    satireCount,
    validResponsesCount,
    susCount,
  } = await getVoteCounts(messageRef)
  const thresholds = await getThresholds(numberPointScale === 5)
  const responses = await getResponsesObj("user", language)
  let truthCategory

  if (validResponsesCount <= 0) {
    functions.logger.error(
      `Stats requested for instance ${messageRef.path} with 0 votes`
    )
    throw new Error("No votes for message")
  }

  if (truthScore !== null) {
    if (truthScore < (thresholds.falseUpperBound || 1.5)) {
      truthCategory = responses.PLACEHOLDER_UNTRUE
    } else if (truthScore < (thresholds.misleadingUpperBound || 3.75)) {
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
          : responses.PLACEHOLDER_SUSPICIOUS,
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
    { name: responses.PLACEHOLDER_SATIRE, count: satireCount, isInfo: false },
    { name: responses.PLACEHOLDER_UNSURE, count: unsureCount, isInfo: false },
  ]

  categories.sort((a, b) => b.count - a.count) // sort in descending order
  const highestCategory = categories[0].name
  const secondCategory = categories[1].name
  const highestPercentage = (categories[0].count / validResponsesCount) * 100
  const secondPercentage = (categories[1].count / validResponsesCount) * 100
  const isHighestInfo = categories[0].isInfo
  const isSecondInfo = categories[1].isInfo

  const infoLiner = getInfoLiner(truthScore, responses.INFO_PLACEHOLDER)
  let response = responses.STATS_TEMPLATE_1.replace(
    "{{top}}",
    `${highestPercentage.toFixed(1)}`
  )
    .replace("{{category}}", highestCategory)
    .replace("{{info_placeholder}}", isHighestInfo ? infoLiner : "")
  if (secondPercentage > 0) {
    response += responses.STATS_TEMPLATE_2.replace(
      "{{second}}",
      `${secondPercentage.toFixed(1)}`
    )
      .replace("{{category}}", secondCategory)
      .replace("{{info_placeholder}}", isSecondInfo ? infoLiner : "")
  }
  return response
}

async function sendVotingStats(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const instanceSnap = await db.doc(instancePath).get()
  const from = instanceSnap.get("from")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instancePath} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  try {
    const messageRef = db.doc(instancePath).parent.parent
    if (!messageRef) {
      throw new Error("messageRef is null")
    }
    const messageSnap = await messageRef.get()
    const truthScore = messageSnap.get("truthScore")
    const numberPointScale = messageSnap.get("numberPointScale")
    const response = await getVotingStatsMessage(
      truthScore,
      numberPointScale,
      messageRef,
      language
    )
    if (!response) {
      return
    }
    await sendTextMessage("user", from, response, instanceSnap.get("id"))
  } catch {
    const responses = await getResponsesObj("user", "en")
    await sendTextMessage(
      "user",
      from,
      responses.GENERIC_ERROR,
      instanceSnap.get("id")
    )
  }
}

async function sendRationalisation(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instancePath} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
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

async function updateLanguageAndSendMenu(
  userSnap: DocumentSnapshot,
  language: LanguageSelection
) {
  await userSnap.ref.update({
    language: language,
  })
  await sendMenuMessage(
    userSnap,
    "MENU_PREFIX",
    "whatsapp",
    null,
    null,
    true,
    false,
    false,
    language
  ) //truncated menu on onboarding
}

async function sendInterimUpdate(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  //get statistics
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  if (!data) {
    return
  }
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instancePath} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
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
  const { validResponsesCount, factCheckerCount } = await getVoteCounts(
    parentMessageRef
  )
  const percentageVoted = (
    (validResponsesCount / factCheckerCount) *
    100
  ).toFixed(1)
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
    case "satire":
      prelimAssessment = responses.PLACEHOLDER_SATIRE
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
  const userSnap = await getUserSnapshot(
    instanceSnap.get("from"),
    instanceSnap.get("source")
  )
  if (userSnap == null) {
    functions.logger.error(
      `User ${instanceSnap.get("from")} not found in database`
    )
    return Promise.resolve()
  }
  const data = instanceSnap.data()
  if (!data) {
    return
  }
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
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
  const userSnap = await getUserSnapshot(
    instanceSnap.get("from"),
    instanceSnap.get("source")
  )
  if (userSnap == null) {
    functions.logger.error(
      `User ${instanceSnap.get("from")} not found in database`
    )
    return Promise.resolve()
  }
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
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  const numSubmissionsRemaining = userSnap.get("numSubmissionsRemaining")
  const monthlySubmissionLimit = userSnap.get("monthlySubmissionLimit")
  const thresholds = await getThresholds()
  const isAssessed = parentMessageSnap.get("isAssessed")
  const isMachineCategorised = parentMessageSnap.get("isMachineCategorised")
  const isWronglyCategorisedIrrelevant = parentMessageSnap.get(
    "isWronglyCategorisedIrrelevant"
  )
  const machineCategory = parentMessageSnap.get("machineCategory")
  const instanceCount = parentMessageSnap.get("instanceCount")
  const customReply: CustomReply = parentMessageSnap.get("customReply")
  const communityNote: CommunityNote = parentMessageSnap.get("communityNote")
  const { validResponsesCount } = await getVoteCounts(parentMessageRef)
  const isImage = data?.type === "image"
  const hasCaption = data?.caption != null
  const isMatched = data?.isMatched ?? false
  const primaryCategory = parentMessageSnap.get("primaryCategory")
  const isIncorrect = parentMessageSnap.get("tags.incorrect") ?? false
  const isGenerated = parentMessageSnap.get("tags.generated") ?? false

  let category = primaryCategory

  let bespokeReply = false

  let isMachineCase = false

  if (customReply) {
    if (customReply.type === "text" && customReply.text) {
      category = "custom"
      await sendTextMessage("user", from, customReply.text, data.id)
      bespokeReply = true
    } else if (customReply.type === "image") {
      //TODO: implement later
    }
  }

  if (
    isMachineCategorised &&
    machineCategory &&
    !(machineCategory === "irrelevant" && isWronglyCategorisedIrrelevant)
  ) {
    category = machineCategory
    isMachineCase = true
  }

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

  const getMoreChecksButton = {
    type: "reply",
    reply: {
      id: `getMoreChecks_${instanceSnap.ref.path}`,
      title: responses.BUTTON_GET_MORE_CHECKS,
    },
  }

  const viewSourcesButton = {
    type: "reply",
    reply: {
      id: `viewSources_${instanceSnap.ref.path}`,
      title: responses.BUTTON_VIEW_SOURCES,
    },
  }

  if (communityNote && !communityNote.downvoted) {
    category = "communityNote"
    bespokeReply = true
    //get the text based on language
    const note = communityNote[language as keyof CommunityNote] as string
    const sources = communityNote.links as string[]

    const responseText = responses.COMMUNITY_NOTE.replace(
      "{{community_note}}",
      note
    )
      .replace(
        "{{submissions_remaining}}",
        responses.REMAINING_SUBMISSIONS_SUFFIX
      )
      .replace(
        "{{num_remaining_submissions}}",
        numSubmissionsRemaining.toString()
      )
      .replace("{{free_tier_limit}}", monthlySubmissionLimit.toString())
    const buttons = [
      {
        type: "reply",
        reply: {
          id: `feedbackNote_${instanceSnap.ref.path}`,
          title: responses.BUTTON_GIVE_FEEDBACK,
        },
      },
    ]
    //if sources exists, add them in between the 2 buttons
    if (sources.length > 0) {
      buttons.push(viewSourcesButton)
    }
    buttons.push(getMoreChecksButton)

    await sendWhatsappButtonMessage(
      "user",
      from,
      responseText,
      buttons,
      data.id
    )
  }

  if (!isAssessed && !forceReply && !isMachineCase && !bespokeReply) {
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
    isCommunityNoteSent?: boolean
  } = {
    isReplied: true,
    isReplyForced: forceReply,
    isReplyImmediate: isImmediate,
  }
  let buttons = []

  if (
    category !== "irrelevant" &&
    category !== "custom" &&
    category !== "communityNote" &&
    !Object.keys(responses).includes(category.toUpperCase())
  ) {
    functions.logger.error("Unknown category assigned, error response sent")
    updateObj.replyCategory = "error"
    await sendTextMessage("user", from, responses.ERROR, data.id)
    return
  }

  if (category === "irrelevant" && isMachineCase) {
    category = "irrelevant_auto"
  }

  let responseText
  switch (category) {
    case "irrelevant_auto":
      responseText = getFinalResponseText(
        responses["IRRELEVANT_AUTO"],
        responses,
        numSubmissionsRemaining,
        monthlySubmissionLimit
      )
      const misunderstoodButton = {
        type: "reply",
        reply: {
          id: `isWronglyIrrelevant_${instanceSnap.ref.path}`,
          title: responses.BUTTON_MISUNDERSTOOD,
        },
      }
      await sendWhatsappButtonMessage(
        "user",
        from,
        responseText,
        [misunderstoodButton],
        data.id
      )
      break
    case "irrelevant":
      await sendMenuMessage(
        userSnap,
        "IRRELEVANT_MENU_PREFIX",
        "whatsapp",
        data.id,
        instanceSnap.ref.path,
        false,
        isGenerated,
        isIncorrect
      )
      break
    case "error":
      responseText = getFinalResponseText(responses.ERROR, responses)
      await sendTextMessage("user", from, responseText, data.id)
      break
    case "custom":
      break
    case "communityNote":
      break
    default:
      if (category === "unsure") {
        const isHarmful = parentMessageSnap.get("isHarmful") ?? false
        const isHarmless = parentMessageSnap.get("isHarmless") ?? false
        if (isHarmful) {
          category = "harmful"
        } else if (isHarmless) {
          category = "harmless"
        } else {
          const truthScore = parentMessageSnap.get("truthScore")
          const numberPointScale = parentMessageSnap.get("numberPointScale")
          const votingStatsResponse = await getVotingStatsMessage(
            truthScore,
            numberPointScale,
            parentMessageRef,
            language
          )
          const responseText = getFinalResponseText(
            responses["UNSURE"],
            responses,
            numSubmissionsRemaining,
            monthlySubmissionLimit,
            isImmediate,
            instanceCount,
            isMachineCategorised,
            isMatched,
            isImage,
            hasCaption,
            isGenerated,
            isIncorrect,
            "unsure",
            null,
            votingStatsResponse
          )
          //reinstate count if we really unsure.
          await userSnap.ref.update({
            numSubmissionsRemaining: FieldValue.increment(1),
          })
          await sendTextMessage("user", from, responseText, data.id)
          break
        }
      }
      if (!(category.toUpperCase() in responses)) {
        functions.logger.error(`category ${category} not found in responses`)
        return
      }
      responseText = getFinalResponseText(
        responses[category.toUpperCase() as keyof typeof responses],
        responses,
        numSubmissionsRemaining,
        monthlySubmissionLimit,
        isImmediate,
        instanceCount,
        isMachineCategorised,
        isMatched,
        isImage,
        hasCaption,
        isGenerated,
        isIncorrect,
        category,
        null,
        null
      )

      if (!(isMachineCategorised || validResponsesCount <= 0)) {
        buttons.push(votingResultsButton)
      }

      if (category === "scam" || category === "illicit") {
        buttons.push(declineScamShieldButton)
        updateObj.scamShieldConsent = true
      }

      buttons.push(getMoreChecksButton)

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
  updateObj.isCommunityNoteSent = category === "communityNote"
  updateObj.replyTimestamp = Timestamp.fromDate(new Date())
  await instanceSnap.ref.update(updateObj)

  //check if category does not contain irrelevant, then updated reported number by 1
  if (category !== "irrelevant" && category !== "irrelevant_auto") {
    //count number of instances from this sender
    const countOfInstancesFromSender = (
      await parentMessageRef
        .collection("instances")
        .where("from", "==", from)
        .count()
        .get()
    ).data().count
    if (countOfInstancesFromSender == 1) {
      await incrementCheckerCounts(from, "numReported", 1)
    }
  }

  //await sendRemainingSubmissionQuota(userSnap)

  // if (
  //   Math.random() < thresholds.surveyLikelihood &&
  //   category != "irrelevant_auto"
  // ) {
  //   await sendSatisfactionSurvey(instanceSnap)
  // }
  return
}

async function sendWaitingMessage(
  userSnap: DocumentSnapshot,
  replyMessageId: string | null = null
) {
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  await sendTextMessage(
    "user",
    userSnap.get("whatsappId"),
    responses.WAIT_FOR_AI,
    replyMessageId,
    "whatsapp"
  )
}

async function sendReferralMessage(userSnap: DocumentSnapshot) {
  let referralResponse
  const language = userSnap.get("language") ?? "en"
  const code = userSnap.get("referralId")
  const whatsappId = userSnap.get("whatsappId")
  const responses = await getResponsesObj("user", language)
  if (code) {
    referralResponse = responses.REFERRAL.replace(
      "{{link}}",
      `https://ref.checkmate.sg/${code}`
    )
  } else {
    referralResponse = responses.GENERIC_ERROR
    functions.logger.error(`Referral code not found for ${whatsappId}`)
  }
  await sendTextMessage(
    "user",
    whatsappId,
    referralResponse,
    null,
    "whatsapp",
    true
  )
}

async function sendCommunityNoteFeedbackMessage(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  const responseText = responses.COMMUNITY_NOTE_FEEDBACK
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `feedbackNoteResponse_${instancePath}_yes`,
        title: responses.BUTTON_USEFUL,
      },
    },
    {
      type: "reply",
      reply: {
        id: `feedbackNoteResponse_${instancePath}_no`,
        title: responses.BUTTON_NOT_USEFUL,
      },
    },
  ]
  await sendWhatsappButtonMessage(
    "user",
    whatsappId,
    responseText,
    buttons,
    data?.id ?? null
  )
}

async function sendRemainingSubmissionQuota(userSnap: DocumentSnapshot) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const responses = await getResponsesObj("user", language)
  const numSubmissionsRemaining = userSnap.get("numSubmissionsRemaining")
  const monthlySubmissionLimit = userSnap.get("monthlySubmissionLimit")
  const hasExpressedInterest = userSnap.get("isInterestedInSubscription")
  const isPaidTier = userSnap.get("tier") !== "free"
  const responseText = responses.REMAINING_SUBMISSION_QUOTA.replace(
    "{{num_remaining_submissions}}",
    numSubmissionsRemaining.toString()
  ).replace("{{free_tier_limit}}", monthlySubmissionLimit.toString())
  //TODO: change to whatsapp flow
  if (isPaidTier || hasExpressedInterest) {
    await sendTextMessage(
      "user",
      whatsappId,
      responseText,
      null,
      "whatsapp",
      true
    )
    return
  } else {
    const waitListFlowID = process.env.WAITLIST_FLOW_ID
    const ctaText = responses.CTA_GET_MORE
    if (!waitListFlowID) {
      functions.logger.error("WAITLIST_FLOW_ID not defined")
      return
    }
    await createAndSendFlow(
      whatsappId,
      "waitlist",
      ctaText,
      responseText,
      null,
      null,
      true
    )
  }
}

async function sendCommunityNoteSources(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)

  const parentMessageRef = instanceRef.parent.parent
  if (!parentMessageRef) {
    functions.logger.error(`Parent message not found for ${instancePath}`)
    await sendErrorMessage(userSnap)
    return
  }
  const parentMessageSnap = await parentMessageRef.get()
  const communityNote = parentMessageSnap.get("communityNote") as CommunityNote
  if (!communityNote) {
    functions.logger.error(
      `Community note not found for message: ${parentMessageRef.path}`
    )
    await sendErrorMessage(userSnap)
    return
  }
  const links = communityNote.links
  if (!links || links.length === 0) {
    functions.logger.error(
      `Source links not found for community note for message: ${parentMessageRef.path}`
    )
    await sendErrorMessage(userSnap)
    return
  }
  const sourceText = links.join("\n")
  const responseText = responses.COMMUNITY_NOTE_SOURCES.replace(
    "{{sources}}",
    sourceText
  )
  await sendTextMessage(
    "user",
    whatsappId,
    responseText,
    data?.id ?? null,
    "whatsapp",
    false
  )
}

async function sendGetMoreSubmissionsMessage(
  userSnap: DocumentSnapshot,
  instancePath: string
) {
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const data = instanceSnap.data()
  const from = data?.from ?? null
  const whatsappId = userSnap.get("whatsappId")
  if (from !== whatsappId) {
    functions.logger.error(
      `Instance ${instanceSnap.ref.path} requested by ${from} but accessed by ${whatsappId}`
    )
  }
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  const hasExpressedInterest = userSnap.get("isInterestedInSubscription")
  const isPaidTier = userSnap.get("tier") !== "free"
  //TODO: change to whatsapp flow
  if (isPaidTier || hasExpressedInterest) {
    const responseText = responses.GET_MORE_SUBMISSIONS
    await sendTextMessage(
      "user",
      whatsappId,
      responseText,
      null,
      "whatsapp",
      true
    )
    return
  } else {
    const thresholds = await getThresholds()
    const paidTierLimit = thresholds.paidTierMonthlyLimit ?? 50
    const responseText = responses.GET_MORE_SUBMISSIONS_NUDGE.replace(
      "{{paid_tier_limit}}",
      paidTierLimit.toString()
    )
    const waitListFlowID = process.env.WAITLIST_FLOW_ID
    const ctaText = responses.CTA_GET_MORE
    if (!waitListFlowID) {
      functions.logger.error("WAITLIST_FLOW_ID not defined")
      return
    }
    const flowId = await createAndSendFlow(
      whatsappId,
      "waitlist",
      ctaText,
      responseText,
      null,
      null,
      true,
      "get_more_submissions"
    )
    await instanceRef.update({
      flowId: flowId,
    })
  }
}

async function sendOutOfSubmissionsMessage(userSnap: DocumentSnapshot) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const responses = await getResponsesObj("user", language)
  const thresholds = await getThresholds()
  const monthlySubmissionLimit = userSnap.get("monthlySubmissionLimit")
  const hasExpressedInterest = userSnap.get("isInterestedInSubscription")
  const isPaidTier = userSnap.get("tier") !== "free"
  const paidTierLimit = thresholds.paidTierMonthlyLimit ?? 50
  if (isPaidTier || hasExpressedInterest) {
    const responseText = responses.OUT_OF_SUBMISSIONS.replace(
      "{{free_tier_limit}}",
      monthlySubmissionLimit.toString()
    )
    await sendTextMessage(
      "user",
      whatsappId,
      responseText,
      null,
      "whatsapp",
      true
    )
  } else {
    const waitListFlowID = process.env.WAITLIST_FLOW_ID
    if (!waitListFlowID) {
      functions.logger.error("WAITLIST_FLOW_ID not defined")
      return
    }
    const responseText = responses.OUT_OF_SUBMISSIONS_NUDGE.replace(
      "{{paid_tier_limit}}",
      paidTierLimit.toString()
    ).replace("{{free_tier_limit}}", monthlySubmissionLimit.toString())
    const ctaText = responses.CTA_JOIN_WAITLIST
    await createAndSendFlow(
      whatsappId,
      "waitlist",
      ctaText,
      responseText,
      null,
      null,
      true,
      "out_of_submissions"
    )
  }
}

async function sendOnboardingFlow(
  userSnap: DocumentSnapshot,
  firstTime: boolean
) {
  const onboardingFlowId = process.env.ONBOARDING_FLOW_ID
  const language = userSnap.get("language") ?? "en"
  const responses = await getResponsesObj("user", language)
  let responseText = responses.INTRODUCTION
  if (!onboardingFlowId) {
    functions.logger.error("ONBOARDING_FLOW_ID not defined")
    return
  }
  if (!firstTime) {
    responseText = responses.PLEASE_ONBOARD
  }
  const ctaText = responses.BUTTON_SIGN_UP
  await createAndSendFlow(
    userSnap.get("whatsappId"),
    "onboarding",
    ctaText,
    responseText,
    null,
    null,
    true
  )
}

async function createAndSendFlow(
  to: string,
  flow_type: "waitlist" | "onboarding",
  cta: string,
  bodyText: string,
  headerText: string | null = null,
  footerText: string | null = null,
  isDraft: boolean = false,
  variant: string | null = null
) {
  let flow_id = ""
  switch (flow_type) {
    case "waitlist":
      flow_id = process.env.WAITLIST_FLOW_ID ?? ""
      break
    case "onboarding":
      flow_id = process.env.ONBOARDING_FLOW_ID ?? ""
      break
    default:
      throw new Error("Invalid flow type")
  }
  const flowData: FlowData = {
    type: flow_type,
    whatsappId: to,
    sentTimestamp: Timestamp.now(),
    outcomeTimestamp: null,
    outcome: null,
    variant: variant ?? "1",
  }
  const flowRef = await db.collection("flows").add(flowData)
  const token = flowRef.id
  if (token) {
    await sendWhatsappFlowMessage(
      "user",
      to,
      token,
      flow_id,
      cta,
      bodyText,
      headerText,
      footerText,
      isDraft
    )
  } else {
    functions.logger.error("Failed to create flow")
  }
  return token
}

async function sendLanguageSelection(
  userSnap: DocumentSnapshot,
  newUser: boolean
) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const responses = await getResponsesObj("user", language)
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
  await sendWhatsappButtonMessage("user", whatsappId, response, buttons)
}

async function sendUnsupportedTypeMessage(
  userSnap: DocumentSnapshot,
  replyMessageId: string | null = null
) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const responses = await getResponsesObj("user", language)
  await sendWhatsappTextMessage(
    "user",
    whatsappId,
    responses?.UNSUPPORTED_TYPE,
    replyMessageId
  )
}

async function sendBlast(userSnap: DocumentSnapshot) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const blastQuerySnap = await db
    .collection("blasts")
    .where("isActive", "==", true)
    .orderBy("createdDate", "desc") // Order by createdDate in descending order
    .limit(1) // Limit to 1 document
    .get()
  const responses = await getResponsesObj("user", language)
  if (blastQuerySnap.empty) {
    functions.logger.warn(
      `No active blast found when attempting to send blast to user ${whatsappId}`
    )
    await sendTextMessage(
      "user",
      whatsappId,
      responses.GENERIC_ERROR,
      null,
      "whatsapp"
    )
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
        await sendTextMessage(
          "user",
          whatsappId,
          responses.GENERIC_ERROR,
          null,
          "whatsapp"
        )
        return
      } else {
        //send image to user
        const signedUrl = await getSignedUrl(blastData.storageUrl)
        //TODO: implement generic version
        await sendWhatsappImageMessage(
          "user",
          whatsappId,
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
        await sendTextMessage(
          "user",
          whatsappId,
          responses.GENERIC_ERROR,
          null,
          "whatsapp"
        )
        return
      } else {
        //send text to user
        await sendTextMessage(
          "user",
          whatsappId,
          blastData.text,
          null,
          "whatsapp"
        )
      }
      break
  }
  //TODO: edit to include tele bot
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
  const blastStatistics: UserBlast = {
    feedbackCategory: null,
    sentTimestamp: Timestamp.fromDate(new Date()),
  }
  await blastSnap.ref
    .collection("recipients")
    .doc(whatsappId)
    .set(blastStatistics, { merge: true })
  await sendWhatsappButtonMessage(
    "user",
    whatsappId,
    responses.BLAST_FEEDBACK,
    buttons
  )
}

function getFinalResponseText(
  responseText: string,
  responses: ResponseObject,
  remainingSubmissions: number | null = null,
  freeTierLimit: number | null = null,
  isImmediate: boolean = false,
  instanceCount: number = 1,
  isMachineCategorised: boolean = false,
  isMatched: boolean = false,
  isImage: boolean = false,
  hasCaption: boolean = false,
  isGenerated: boolean = false,
  isIncorrect: boolean = false,
  primaryCategory: string = "irrelevant",
  prefixName: string | null = null,
  votingStats: string | null = null
) {
  let finalResponse = responseText
    .replace("{{prefix}}", prefixName ? responses[prefixName] : "")
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
        : isMatched
        ? responses.METHODOLOGY_HUMAN_PREVIOUS
        : responses.METHODOLOGY_HUMAN
    )
    .replace(
      "{{image_caveat}}",
      isImage && hasCaption ? responses.IMAGE_CAVEAT : ""
    )
    .replace("{{reporting_nudge}}", responses.REPORTING_NUDGE)
    .replace("{{generated}}", isGenerated ? responses.GENERATED : "")
    .replace("{{incorrect}}", isIncorrect ? responses.INCORRECT_SUFFIX : "")
    .replace(
      "{{incorrect_trivial}}",
      isIncorrect && primaryCategory.includes("irrelevant")
        ? responses.INCORRECT_TRIVIAL
        : ""
    )
    .replace("{{voting_stats}}", votingStats ?? "")
    .replace(
      "{{submissions_remaining}}",
      responses.REMAINING_SUBMISSIONS_SUFFIX
    )
    .replace(
      "{{num_remaining_submissions}}",
      remainingSubmissions?.toString() ?? ""
    )
    .replace("{{free_tier_limit}}", freeTierLimit?.toString() ?? "")
  return finalResponse
}

async function sendErrorMessage(userSnap: DocumentSnapshot) {
  const language = userSnap.get("language") ?? "en"
  const whatsappId = userSnap.get("whatsappId")
  const responses = await getResponsesObj("user", language)
  await sendTextMessage(
    "user",
    whatsappId,
    responses.GENERIC_ERROR,
    null,
    "whatsapp"
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
  sendUnsupportedTypeMessage,
  sendBlast,
  respondToBlastFeedback,
  respondToCommunityNoteFeedback,
  respondToIrrelevantDispute,
  respondToWaitlist,
  sendOutOfSubmissionsMessage,
  sendOnboardingFlow,
  sendGetMoreSubmissionsMessage,
  sendCommunityNoteFeedbackMessage,
  sendCommunityNoteSources,
  sendWaitingMessage,
}

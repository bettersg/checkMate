import * as admin from "firebase-admin"
import { sendWhatsappTemplateMessage } from "../common/sendWhatsappMessage"
import {
  respondToInstance,
  sendInterimPrompt as sendInterimPromptImported,
} from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { getVoteCounts } from "../common/counters"
import { getThresholds } from "../common/utils"
import { defineString } from "firebase-functions/params"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { logger } from "firebase-functions/v2"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { AppEnv } from "../../appEnv"
import { TIME } from "../../utils/time"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

if (!admin.apps.length) {
  admin.initializeApp()
}

async function deactivateAndRemind() {
  try {
    const db = admin.firestore()
    const cutoffHours = 72
    const activeCheckMatesSnap = await db
      .collection("checkers")
      .where("type", "==", "human")
      .where("isActive", "==", true)
      .get()
    const promisesArr = activeCheckMatesSnap.docs.map(async (doc) => {
      const lastVotedTimestamp =
        doc.get("lastVotedTimestamp") ?? Timestamp.fromDate(new Date(0))
      const factCheckerDocRef = doc.ref
      const whatsappId = doc.get("whatsappId")
      const telegramId = doc.get("telegramId")
      const preferredPlatform = doc.get("preferredPlatform") ?? "whatsapp"
      const lastVotedDate = lastVotedTimestamp.toDate()
      //set cutoff to 72 hours ago
      const cutoffDate = new Date(Date.now() - cutoffHours * TIME.ONE_HOUR)
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate)
      const voteRequestsQuerySnap = await db
        .collectionGroup("voteRequests")
        .where("factCheckerDocRef", "==", factCheckerDocRef)
        .where("createdTimestamp", "<", cutoffTimestamp)
        .where("category", "==", null)
        .get()
      if (!voteRequestsQuerySnap.empty && lastVotedDate < cutoffDate) {
        logger.log(`Checker ${doc.id}, ${doc.get("name")} set to inactive`)
        await doc.ref.update({ isActive: false })
        if (preferredPlatform === "whatsapp") {
          if (!whatsappId) {
            logger.error(
              `No whatsappId for ${doc.id}, ${doc.get(
                "name"
              )} despite preferred platform being whatsapp`
            )
            return Promise.resolve()
          }
          return sendWhatsappTemplateMessage(
            "factChecker",
            whatsappId,
            "deactivation_notification",
            "en",
            [doc.get("name") || "CheckMate", `${cutoffHours}`],
            [`${whatsappId}`]
          )
        } else if (preferredPlatform === "telegram") {
          if (!telegramId) {
            logger.error(
              `No telegramId for ${doc.id}, ${doc.get(
                "name"
              )} despite preferred platform being telegram`
            )
            return Promise.resolve()
          }
          const reactivationMessage = `Hello ${doc.get("name")},

          Just a reminder - you've not completed a check within the last ${cutoffHours} hours! No worries, we know everyone's busy! But because the replies to our users are contingent on a large enough proportion of CheckMates voting, not doing so adds to the denominator and slows down the response to our users. Thus, we've temporarily removed you from the active CheckMates pool so you can take a break without worries!
          
          Anytime you wish to continue checking, just vist the portal below to reactivate yourself and you'll be immediately added back into the pool! (You can do so right now too!)`
          return sendTelegramTextMessage(
            "factChecker",
            telegramId,
            reactivationMessage
          )
        }
      }
    })
    await Promise.all(promisesArr)
  } catch (error) {
    logger.error("Error in deactivateAndRemind:", error)
  }
}

async function checkConversationSessionExpiring() {
  try {
    const db = admin.firestore()
    const hoursAgo = 23
    const windowStart = Timestamp.fromDate(
      new Date(Date.now() - hoursAgo * TIME.ONE_HOUR)
    )
    const windowEnd = Timestamp.fromDate(
      new Date(Date.now() - (hoursAgo + 1) * TIME.ONE_HOUR)
    )
    const unrepliedInstances = await db
      .collectionGroup("instances")
      .where("isReplied", "==", false)
      .where("timestamp", "<=", windowStart) //match all those earlier than 23 hours ago
      .where("timestamp", ">", windowEnd) //and all those later than 24 hours ago
      .get()
    const promisesArr = unrepliedInstances.docs.map(async (doc) => {
      return respondToInstance(doc, true)
    })
    await Promise.all(promisesArr)
  } catch (error) {
    logger.error("Error in checkConversationSessionExpiring:", error)
  }
}

async function interimPromptHandler() {
  try {
    const db = admin.firestore()
    const dayAgo = Timestamp.fromDate(new Date(Date.now() - TIME.ONE_DAY))
    const halfHourAgo =
      runtimeEnvironment.value() === "PROD"
        ? Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000))
        : Timestamp.fromDate(new Date())
    const thresholds = await getThresholds()
    const eligibleInstances = await db
      .collectionGroup("instances")
      .where("isReplied", "==", false) //match all those that haven't been replied to
      .where("timestamp", ">", dayAgo) //and came in later than 24 hours ago
      .where("timestamp", "<=", halfHourAgo) //but also at least 30 minutes ago
      .where("isInterimPromptSent", "==", null) //and for which we haven't sent the interim yet
      .get()
    const promisesArr = eligibleInstances.docs.map(async (doc) => {
      const parentMessageRef = doc.ref.parent.parent
      if (!parentMessageRef) {
        throw new Error("parentMessageRef was null in interimPromptHandler ")
      }
      const { validResponsesCount } = await getVoteCounts(parentMessageRef)
      if (
        validResponsesCount >=
        (runtimeEnvironment.value() === "PROD"
          ? thresholds.sendInterimMinVotes
          : 1)
      ) {
        return sendInterimPromptImported(doc)
      } else {
        return Promise.resolve()
      }
    })
    await Promise.all(promisesArr)
  } catch (error) {
    logger.error("Error in interimPromptHandler:", error)
  }
}

const checkSessionExpiring = onSchedule(
  {
    schedule: "1 * * * *",
    timeZone: "Asia/Singapore",
    secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"],
    region: "asia-southeast1",
  },
  checkConversationSessionExpiring
)

const scheduledDeactivation = onSchedule(
  {
    schedule: "11 20 * * *",
    timeZone: "Asia/Singapore",
    secrets: [
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "TELEGRAM_CHECKER_BOT_TOKEN",
    ],
    region: "asia-southeast1",
  },
  deactivateAndRemind
)

const sendInterimPrompt = onSchedule(
  {
    schedule: "2,22,42 * * * *",
    timeZone: "Asia/Singapore",
    secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"],
    region: "asia-southeast1",
  },
  interimPromptHandler
)

export {
  checkSessionExpiring,
  scheduledDeactivation,
  sendInterimPrompt,
  interimPromptHandler,
}

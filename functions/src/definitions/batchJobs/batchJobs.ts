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
import { getFullLeaderboard } from "../common/statistics"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)
const checkerAppHost = process.env.CHECKER_APP_HOST

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

async function deactivateAndRemind() {
  try {
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
        if (preferredPlatform === "whatsapp") {
          if (!whatsappId) {
            logger.error(
              `No whatsappId for ${doc.id}, ${doc.get(
                "name"
              )} despite preferred platform being whatsapp`
            )
            return Promise.resolve()
          }
          await doc.ref.update({ isActive: false })
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
          const replyMarkup = checkerAppHost
            ? {
                inline_keyboard: [
                  [
                    {
                      text: "CheckMates' Portal↗️",
                      web_app: { url: checkerAppHost },
                    },
                  ],
                ],
              }
            : null
          const reactivationMessage = `Hello ${doc.get(
            "name"
          )}! Thanks for all your contributions so far🙏. We noticed that you haven't voted in 3 days! You're probably busy, and we don't want your votes to pile up, so we're temporarily stopped sending you messages to vote on. 

To resume getting messages, just vote on any of your outstanding messages, which you can find by visiting the CheckMates' Portal. Remember, if you're busy, you can vote "pass" too!`
          await doc.ref.update({ isActive: false })
          return sendTelegramTextMessage(
            "factChecker",
            telegramId,
            reactivationMessage,
            null,
            replyMarkup
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

async function resetLeaderboardHandler() {
  await saveLeaderboard()
  try {
    // reset leaderboard stats for all checkers
    const checkersQuerySnap = await db.collection("checkers").get()
    const promisesArr = checkersQuerySnap.docs.map(async (doc) => {
      return doc.ref.update({
        leaderboardStats: {
          numVoted: 0,
          numCorrectVotes: 0,
          totalTimeTaken: 0,
          score: 0,
        },
      })
    })
    await Promise.all(promisesArr)
  } catch (error) {
    logger.error("Error in resetLeaderboard:", error)
  }
}

async function saveLeaderboard() {
  try {
    const leaderboardData = await getFullLeaderboard()
    const storageBucket = admin.storage().bucket()
    //get date string
    const date = new Date()
    const dateString = date.toISOString().split("T")[0]
    const leaderboardFile = storageBucket.file(`leaderboard_${dateString}.json`)

    await leaderboardFile.save(JSON.stringify(leaderboardData), {
      contentType: "application/json",
    })
    logger.log("Leaderboard saved successfully")
  } catch (error) {
    logger.error("Failed to save leaderboard:", error)
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

const resetLeaderboard = onSchedule(
  {
    schedule: "0 0 1 * *",
    timeZone: "Asia/Singapore",
    region: "asia-southeast1",
  },
  resetLeaderboardHandler
)

export {
  checkSessionExpiring,
  scheduledDeactivation,
  sendInterimPrompt,
  resetLeaderboard,
  interimPromptHandler,
}

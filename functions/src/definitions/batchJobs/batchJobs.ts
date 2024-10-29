import * as admin from "firebase-admin"
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
import { getResponsesObj } from "../common/responseUtils"
import { checkCheckerActivity } from "../../services/checker/checkActivity"
import { enqueueTask } from "../common/cloudTasks"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)
const CHECKERS_GROUP_LINK = String(process.env.CHECKERS_GROUP_LINK)
const CHECKERS_CHAT_ID = String(process.env.CHECKERS_CHAT_ID)

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

async function handleInactiveCheckers() {
  try {
    const remindAfterDays = 3
    const deactivateAfterDays = 10
    const remindAfter =
      runtimeEnvironment.value() === "PROD"
        ? remindAfterDays * 24 * 60 * 60 //3 days in seconds
        : 60
    const deactivateAfter =
      runtimeEnvironment.value() === "PROD"
        ? deactivateAfterDays * 24 * 60 * 60 //10 days in seconds
        : 300
    const activeCheckMatesSnap = await db
      .collection("checkers")
      .where("type", "==", "human")
      .where("isActive", "==", true)
      .get()
    const promisesArr = activeCheckMatesSnap.docs.map(async (doc) => {
      const telegramId = doc.get("telegramId")
      const preferredPlatform = doc.get("preferredPlatform") ?? "whatsapp"
      const deactivationCheckResponse = await checkCheckerActivity(
        doc,
        deactivateAfter
      )
      if (deactivationCheckResponse.data?.isActive === false) {
        logger.log(`Checker ${doc.id}, ${doc.get("name")} set to inactive`)
        if (preferredPlatform === "telegram") {
          if (!telegramId) {
            logger.error(
              `No telegramId for ${doc.id}, ${doc.get(
                "name"
              )} despite preferred platform being telegram`
            )
            return Promise.resolve()
          }
          const replyMarkup = {
            inline_keyboard: [
              [
                {
                  text: "Reactivate Now",
                  callback_data: "REACTIVATE",
                },
              ],
            ],
          }
          const responses = await getResponsesObj("factChecker")
          const deactivationMessage = responses.DEACTIVATION.replace(
            "{{name}}",
            doc.get("name")
          )
          await doc.ref.update({ isActive: false })

          //enqueue reactivation message
          const lastVotedTimestamp = doc.get("lastVotedTimestamp")
          const onboardingTime = doc.get("onboardingTime")
          const referenceTime =
            lastVotedTimestamp ?? onboardingTime ?? Timestamp.now()
          const secondsSinceLastVote = Math.floor(
            Date.now() / 1000 - referenceTime.seconds
          )
          const baseDelaySeconds = 7 * 24 * 60 * 60 // 1 week in seconds
          const nextAttemptPayload = {
            attemptNumber: 1,
            maxAttempts: 4,
            baseDelaySeconds: baseDelaySeconds,
            cumulativeDelaySeconds: secondsSinceLastVote + baseDelaySeconds,
            checkerId: doc.id,
          }
          await enqueueTask(
            nextAttemptPayload,
            "sendCheckerReactivation",
            baseDelaySeconds,
            "asia-southeast1"
          )
          return sendTelegramTextMessage(
            "factChecker",
            telegramId,
            deactivationMessage,
            null,
            "HTML",
            replyMarkup
          )
        } else {
          logger.error("Unsupported preferred platform for checker")
          return
        }
      }
      //if didn't hit 10 days, check 3 days reminder
      const reminderCheckResponse = await checkCheckerActivity(doc, remindAfter)
      if (reminderCheckResponse.data?.isActive === false) {
        logger.log(`Reminder sent to checker ${doc.id}, ${doc.get("name")}`)
        if (preferredPlatform === "telegram") {
          if (!telegramId) {
            logger.error(
              `No telegramId for ${doc.id}, ${doc.get(
                "name"
              )} despite preferred platform being telegram`
            )
            return Promise.resolve()
          }
          const responses = await getResponsesObj("factChecker")
          const reminderMessage = responses.REMINDER.replace(
            "{{name}}",
            doc.get("name")
          )
            .replace("{{checkers_group_link}}", CHECKERS_GROUP_LINK)
            .replace("{{num_days}}", `${remindAfterDays}`)
          return sendTelegramTextMessage(
            "factChecker",
            telegramId,
            reminderMessage,
            null,
            "HTML",
            null
          )
        } else {
          logger.error("Unsupported preferred platform for checker")
          return
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

async function welcomeNewCheckers() {
  // find checkers that onboarded since last week 12pm on Tuesday
  try {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    lastWeek.setHours(12, 3, 0, 0)
    const lastWeekTimestamp = Timestamp.fromDate(lastWeek)
    const checkersQuerySnap = await db.collection("checkers").where("onboardingTime", ">=", lastWeekTimestamp).get()
    if (checkersQuerySnap.empty) {
      return
    }

    // Create concatenated string of names
    const names = checkersQuerySnap.docs
      .map(doc => {
        const name = doc.get("name")
        const telegramUsername = doc.get("telegramUsername")
        const username = telegramUsername ? ` @${telegramUsername}` : ""
        return `${name}${username}`
      })
      .join("\n")

    // Get responses object
    const responses = await getResponsesObj("factChecker")
    const welcomeMessage = responses.WELCOME.replace("{{names}}", names)

    // Send single welcome message to group chat
    if (!CHECKERS_CHAT_ID) {
      logger.error("Missing TELEGRAM_CHECKERS_GROUP_ID env var")
      return
    }

    await sendTelegramTextMessage(
      "admin",
      CHECKERS_CHAT_ID,
      welcomeMessage,
      null,
      "HTML",
      null
    )
  } catch (error) {
    logger.error("Error occured in welcomeNewCheckers:", error)
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
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
    region: "asia-southeast1",
  },
  handleInactiveCheckers
)

const sendCheckersWelcomeMesssage = onSchedule(
  {
    schedule: "3 12 * * 2",
    timeZone: "Asia/Singapore",
    secrets: ["TELEGRAM_ADMIN_BOT_TOKEN"],
    region: "asia-southeast1",
  },
  welcomeNewCheckers
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
  handleInactiveCheckers,
  welcomeNewCheckers,
  checkSessionExpiring,
  scheduledDeactivation,
  sendInterimPrompt,
  resetLeaderboard,
  interimPromptHandler,
}

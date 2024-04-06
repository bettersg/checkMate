import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { sendWhatsappTemplateMessage } from "../common/sendWhatsappMessage"
import {
  respondToInstance,
  sendInterimPrompt as sendInterimPromptImported,
} from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { getCount } from "../common/counters"
import { getThresholds } from "../common/utils"
import { defineString } from "firebase-functions/params"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { AppEnv } from "../../appEnv"

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
      .where("isActive", "==", true)
      .get()
    const promisesArr = activeCheckMatesSnap.docs.map(async (doc) => {
      const lastVotedTimestamp =
        doc.get("lastVotedTimestamp") ?? Timestamp.fromDate(new Date(0))
      const factCheckerId = doc.get("whatsappId")
      const lastVotedDate = lastVotedTimestamp.toDate()
      //set cutoff to 72 hours ago
      const cutoffDate = new Date(Date.now() - cutoffHours * 60 * 60 * 1000)
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate)
      const voteRequestsQuerySnap = await db
        .collectionGroup("voteRequests")
        .where("platformId", "==", factCheckerId)
        .where("createdTimestamp", "<", cutoffTimestamp)
        .where("category", "==", null)
        .get()
      if (!voteRequestsQuerySnap.empty && lastVotedDate < cutoffDate) {
        functions.logger.log(
          `${factCheckerId}, ${doc.get("name")} set to inactive`
        )
        await doc.ref.update({ isActive: false })
        return sendWhatsappTemplateMessage(
          "factChecker",
          factCheckerId,
          "deactivation_notification",
          "en",
          [doc.get("name") || "CheckMate", `${cutoffHours}`],
          [`${factCheckerId}`]
        )
      }
    })
    await Promise.all(promisesArr)
  } catch (error) {
    functions.logger.error("Error in deactivateAndRemind:", error)
  }
}

async function checkConversationSessionExpiring() {
  try {
    const db = admin.firestore()
    const hoursAgo = 23
    const windowStart = Timestamp.fromDate(
      new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    )
    const windowEnd = Timestamp.fromDate(
      new Date(Date.now() - (hoursAgo + 1) * 60 * 60 * 1000)
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
    functions.logger.error("Error in checkConversationSessionExpiring:", error)
  }
}

async function interimPromptHandler() {
  try {
    const db = admin.firestore()
    const dayAgo = Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    )
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
      const voteCount = await getCount(parentMessageRef, "responses")
      if (
        voteCount >=
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
    functions.logger.error("Error in interimPromptHandler:", error)
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
    secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"],
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

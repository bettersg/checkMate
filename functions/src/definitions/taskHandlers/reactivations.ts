import { onTaskDispatched } from "firebase-functions/tasks"
import { logger } from "firebase-functions/v2"
import { enqueueTask } from "../common/cloudTasks"
import { HttpsError } from "firebase-functions/https"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import * as admin from "firebase-admin"
import { getResponsesObj } from "../common/responseUtils"
import { checkCheckerActivity } from "../../services/checker/checkActivity"

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = getFirestore()

interface TaskPayload {
  attemptNumber: number
  maxAttempts: number
  baseDelaySeconds: number
  cumulativeDelaySeconds: number
  checkerId: string
}

function calculateBackoffWithJitter(
  attemptNumber: number,
  baseDelaySeconds: number
): number {
  // Calculate exponential backoff
  const expBackoff = Math.pow(2, attemptNumber) * baseDelaySeconds

  // Add random jitter between -30 and +30 minutes (in seconds)
  const thirtyMinutesInSeconds = 30 * 60
  const jitter =
    Math.floor(Math.random() * (thirtyMinutesInSeconds * 2)) -
    thirtyMinutesInSeconds

  return Math.max(0, expBackoff + jitter) // Ensure we don't get negative delay
}

export const sendCheckerReactivation = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 6,
    },
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
  },
  async (req) => {
    const {
      attemptNumber = 1,
      maxAttempts = 5,
      baseDelaySeconds = 7 * 24 * 60 * 60, // 1 week in seconds
      cumulativeDelaySeconds = 0,
      checkerId = "",
    } = req.data as TaskPayload

    try {
      logger.info(
        `Processing reactivation ${attemptNumber} for Checker: ${checkerId}`
      )
      const checkerDocRef = db.collection("checkers").doc(checkerId)
      const checkerDocSnap = await checkerDocRef.get()
      if (!checkerDocSnap.exists) {
        logger.error(`Checker ${checkerId} not found`)
        return
      }
      const reactivationCheckResponse = await checkCheckerActivity(
        checkerDocSnap,
        cumulativeDelaySeconds
      )
      //if active and last voted within the previous base delay
      if (reactivationCheckResponse.data?.isActive) {
        logger.info(
          `Checker ${checkerId} last voted within the last ${baseDelaySeconds} seconds`
        )
        return
      } else {
        //send reminder
        await remindChecker(checkerDocSnap, cumulativeDelaySeconds)
        //if reach max attempts stop liao
        if (attemptNumber >= maxAttempts) {
          logger.info(
            `Max reactivation attempts reached for checker ${checkerId}. Giving up.`
          )
          return
        }
        //trigger next delay
        const delaySeconds = calculateBackoffWithJitter(
          attemptNumber,
          baseDelaySeconds
        )
        const nextAttemptPayload: TaskPayload = {
          attemptNumber: attemptNumber + 1,
          maxAttempts,
          baseDelaySeconds,
          cumulativeDelaySeconds: cumulativeDelaySeconds + delaySeconds,
          checkerId,
        }
        try {
          await enqueueTask(
            nextAttemptPayload,
            "sendCheckerReactivation",
            delaySeconds,
            "asia-southeast1"
          )

          const delayMinutes = Math.round(delaySeconds / 60)
          const delayHours = Math.round(delaySeconds / 3600)
          const delayDays = Math.round(delaySeconds / 86400)
          logger.info(
            `Scheduled retry attempt ${
              attemptNumber + 1
            } in approximately ${delayDays} days, ${delayHours % 24} hours, ${
              delayMinutes % 60
            } minutes`
          )
        } catch (err) {
          logger.error("Error scheduling retry:", err)
        }
      }
    } catch (error) {
      logger.error(`Reactivation ${attemptNumber} failed:`, error)
      throw new HttpsError("internal", "Uh-oh. Something broke.")
    }
  }
)

async function remindChecker(
  checkerDocSnap: FirebaseFirestore.DocumentSnapshot,
  secondsTranspired: number
) {
  const daysTranspired = Math.floor(secondsTranspired / 86400)
  const responses = await getResponsesObj("factChecker")
  const checkerId = checkerDocSnap.id
  logger.info(`Sending reminder for checker ${checkerId}`)
  const telegramId = checkerDocSnap.get("telegramId")
  const checkerName = checkerDocSnap.get("name")
  if (!telegramId) {
    logger.error(`No telegramId found for checker ${checkerId}`)
    return
  }
  const response = responses.REACTIVATION
  const message = response
    .replace("{{name}}", checkerName)
    .replace("{{num_days}}", `${daysTranspired}`)
  try {
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
    await sendTelegramTextMessage(
      "factChecker",
      telegramId,
      message,
      null,
      "HTML",
      replyMarkup
    )
    logger.info(`Reminder successfully sent to ${checkerName}`)
  } catch {
    logger.error(`Failed to send reminder to ${checkerName}`)
    throw new HttpsError("internal", "Uh-oh. Something broke.")
  }
}

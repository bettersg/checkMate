import { onTaskDispatched } from "firebase-functions/tasks"
import { logger } from "firebase-functions/v2"
import { HttpsError } from "firebase-functions/https"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import { offboardChecker } from "../../services/checker/managementService"
import * as admin from "firebase-admin"
import { CheckerData } from "../../types"

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = getFirestore()

export const secondCompletionCheck = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 6,
    },
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN", "TELEGRAM_ADMIN_BOT_TOKEN"],
  },
  async (req) => {
    const { checkerId = "" } = req.data
    try {
      const checkerDocRef = db.collection("checkers").doc(checkerId)
      const checkerDocSnap = await checkerDocRef.get()
      if (!checkerDocSnap.exists) {
        logger.error(`Checker ${checkerId} not found upon firstCompletionCheck`)
        throw new HttpsError("not-found", "Checker not found")
      } else {
        const hasCompletedProgram = checkerDocSnap.get("hasCompletedProgram")
        if (!hasCompletedProgram) {
          try {
            await offboardChecker(checkerDocSnap)
          } catch (error) {
            logger.error(
              `Error in secondCompletionCheck for checker ${checkerId}: ${error}`
            )
          }
        }
      }
    } catch (error) {
      logger.error(
        `Error in firstCompletionCheck for checker ${checkerId}: ${error}`
      )
      throw new HttpsError("internal", "Uh-oh. Something broke.")
    }
  }
)

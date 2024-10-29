import { onTaskDispatched } from "firebase-functions/tasks"
import { logger } from "firebase-functions/v2"
import { HttpsError } from "firebase-functions/https"
import { getFirestore } from "firebase-admin/firestore"
import { sendNudge } from "../../services/checker/nudgeService"
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = getFirestore()

export const firstCompletionCheck = onTaskDispatched(
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
        const replaceParams = {
          name: checkerDocSnap.get("name"),
          revision_quiz_link: "", //TODO
        }
        if (!hasCompletedProgram) {
          await sendNudge(
            checkerDocSnap,
            "EXTENSION",
            replaceParams,
            null,
            null
          )
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

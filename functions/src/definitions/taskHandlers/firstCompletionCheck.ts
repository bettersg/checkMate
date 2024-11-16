import { onTaskDispatched } from "firebase-functions/tasks"
import { getFirestore } from "firebase-admin/firestore"
import { initialCompletionCheck } from "../../services/checker/managementService"
import * as admin from "firebase-admin"
import { HttpsError } from "firebase-functions/https"

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
    const checkerDocRef = db.collection("checkers").doc(checkerId)
    const checkerDocSnap = await checkerDocRef.get()
    const result = await initialCompletionCheck(checkerDocSnap)
    if (result.hasError()) {
      throw new HttpsError("internal", "Uh-oh. Something broke.")
    }
  }
)

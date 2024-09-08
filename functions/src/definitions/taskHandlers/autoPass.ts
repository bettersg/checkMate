import { onTaskDispatched } from "firebase-functions/v2/tasks"
import { onRequest, HttpsError } from "firebase-functions/v2/https"
import { getFunctions } from "firebase-admin/functions"
import { getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import { VoteRequestUpdateObject } from "../../types"

const db = getFirestore()

const passVoteRequest = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 6,
    },
  },
  async (req) => {
    const voteRequestPath = req.data.voteRequestPath
    const voteRequestRef = db.doc(voteRequestPath)
    const voteRequestSnap = await voteRequestRef.get()
    if (!voteRequestSnap.exists) {
      logger.error(`Vote request ${voteRequestPath} not found`)
      return
    }
    const category = voteRequestSnap.get("category")

    if (category === null) {
      const updateObj = {
        category: "pass",
        isAutoPassed: true,
      } as VoteRequestUpdateObject
      await voteRequestRef.update(updateObj)
      logger.log(`Vote request ${voteRequestPath} auto-passed`)
    }
  }
)

export { passVoteRequest }

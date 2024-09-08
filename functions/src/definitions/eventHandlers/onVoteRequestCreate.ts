import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { logger } from "firebase-functions/v2"
import { enqueueTask } from "../common/cloudTasks"
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  admin.initializeApp()
}

const env = process.env.ENVIRONMENT
const delaySeconds =
  env === "DEV" ? 300 : env === "UAT" ? 60 * 60 : 2 * 24 * 60 * 60 //2 day leeway in prod

const onVoteRequestCreate = onDocumentCreated(
  {
    document: "messages/{messageId}/voteRequests/{voteRequestId}",
  },
  async (event) => {
    const snap = event.data
    if (!snap) {
      logger.log("No data associated with the event")
      return Promise.resolve()
    }
    try {
      await enqueueTask(
        {
          voteRequestPath: snap.ref.path,
        },
        "passVoteRequest",
        delaySeconds
      )
    } catch (error) {
      logger.error("Failed to enqueue task:", error)
    }
  }
)

export { onVoteRequestCreate }

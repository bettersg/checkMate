import * as admin from "firebase-admin"
import { getThresholds } from "../common/utils"
import { despatchPoll } from "../../services/checker/votingService"
import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { logger } from "firebase-functions/v2"

if (!admin.apps.length) {
  admin.initializeApp()
}

const onMessageCreate = onDocumentCreated(
  {
    document: "messages/{messageId}",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "TYPESENSE_TOKEN",
      "TELEGRAM_CHECKER_BOT_TOKEN",
      "OPENAI_API_KEY",
    ],
  },
  async (event) => {
    const snap = event.data
    if (!snap) {
      logger.log("No data associated with the event")
      return Promise.resolve()
    }
    const data = snap.data()

    const parentMessageSnap = snap
    const parentMessageRef = snap.ref

    if (
      !parentMessageSnap.get("isAssessed") &&
      parentMessageSnap.get("machineCategory") !== "irrelevant"
    ) {
      const parentInstanceCount = 1
      const thresholds = await getThresholds()
      if (
        parentInstanceCount >= thresholds.startVote &&
        !parentMessageSnap.get("isPollStarted")
      ) {
        await parentMessageRef.update({ isPollStarted: true })
        try {
          await despatchPoll(parentMessageRef)
        } catch (error) {
          logger.error(
            `Error despatching poll for message ${parentMessageRef.id}: `,
            error
          )
          await parentMessageRef.update({ isPollStarted: false })
        }
        return Promise.resolve()
      }
      return Promise.resolve()
    }
  }
)

export { onMessageCreate }

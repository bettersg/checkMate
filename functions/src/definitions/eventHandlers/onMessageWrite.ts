import { onDocumentWritten } from "firebase-functions/firestore"
import * as admin from "firebase-admin"
import {
  sendCommunityNoteNotification,
  sendVotingUpdate,
} from "../../services/admin/notificationService"

if (!admin.apps.length) {
  admin.initializeApp()
}

const adminMessageHandler = onDocumentWritten(
  {
    document: "messages/{messageId}",
    secrets: ["TELEGRAM_ADMIN_BOT_TOKEN"],
  },
  async (event) => {
    const isDocumentCreation = !event.data?.before.exists
    const docSnap = event.data?.after
    if (!docSnap) {
      return
    }
    const adminMessageId = docSnap.get("adminGroupSentMessageId") ?? null
    if (isDocumentCreation) {
      const communityNote = docSnap.get("communityNote")

      await sendCommunityNoteNotification(
        communityNote,
        adminMessageId,
        docSnap.ref
      )
      const machineCategory = docSnap.get("machineCategory")
      const isMachineCategorised = docSnap.get("isMachineCategorised")
      if (isMachineCategorised) {
        await sendVotingUpdate({
          messageId: docSnap.get("adminGroupSentMessageId"),
          machineCategory: machineCategory,
        })
      }
    } else {
      const before = event.data?.before
      if (!before) {
        return
      }
      if (
        before.get("communityNote") === null &&
        docSnap.get("communityNote") !== null
      ) {
        await sendCommunityNoteNotification(
          docSnap.get("communityNote"),
          adminMessageId,
          docSnap.ref
        )
      }
    }
  }
)

export { adminMessageHandler }

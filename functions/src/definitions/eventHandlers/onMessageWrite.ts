import { onDocumentWritten } from "firebase-functions/firestore"
import * as admin from "firebase-admin"
import {
  sendCommunityNoteNotification,
  sendVotingUpdate,
} from "../../services/admin/notificationService"
import { logger } from "firebase-functions/v2"

if (!admin.apps.length) {
  admin.initializeApp()
}

const adminMessageHandler = onDocumentWritten(
  {
    document: "messages/{messageId}",
    secrets: ["TELEGRAM_ADMIN_BOT_TOKEN"],
  },
  async (event) => {
    const isDocumentCreation = !event.data?.before?.exists
    const docSnap = event.data?.after
    if (!docSnap) {
      logger.error("Missing after data on onMessageWrite")
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
      if (isMachineCategorised && machineCategory !== null) {
        await sendVotingUpdate({
          messageId: docSnap.get("adminGroupSentMessageId"),
          machineCategory: machineCategory,
        })
      }
    } else {
      const before = event.data?.before
      if (!before) {
        logger.error("Missing before data on onMessageWrite")
        return
      }
      const isAssessedBefore = before.get("isAssessed") ?? null
      const isAssessedAfter = docSnap.get("isAssessed") ?? null
      const communityNoteBefore = before.get("communityNote") ?? null
      const communityNoteAfter = docSnap.get("communityNote") ?? null
      const primaryCategoryBefore = before.get("primaryCategory") ?? null
      const primaryCategoryAfter = docSnap.get("primaryCategory") ?? null
      if (communityNoteBefore === null && communityNoteAfter !== null) {
        //if community note was newly generated
        await sendCommunityNoteNotification(
          docSnap.get("communityNote"),
          adminMessageId,
          docSnap.ref
        )
      }
      if (!isAssessedBefore && isAssessedAfter) {
        //if message was newly assessed
        await sendVotingUpdate({
          messageId: docSnap.get("adminGroupSentMessageId"),
          currentCategory: primaryCategoryAfter,
        })
      } else if (
        isAssessedAfter &&
        primaryCategoryBefore !== primaryCategoryAfter &&
        primaryCategoryBefore !== null
      ) {
        //if there was a change in categories after the message was assessed
        await sendVotingUpdate({
          messageId: docSnap.get("adminGroupSentMessageId"),
          previousCategory: primaryCategoryBefore,
          currentCategory: primaryCategoryAfter,
        })
      }
      if (
        communityNoteBefore !== null &&
        communityNoteAfter !== null &&
        !communityNoteBefore.downvoted &&
        communityNoteAfter.downvoted
      ) {
        //if community note got downvoted
        await sendVotingUpdate({
          messageId: docSnap.get(
            "communityNote.adminGroupCommunityNoteSentMessageId"
          ),
          downvoted: true,
        })
      }
    }
  }
)

export { adminMessageHandler }

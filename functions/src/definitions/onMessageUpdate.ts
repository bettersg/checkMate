import * as functions from "firebase-functions"
import { respondToInstance } from "./common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import {} from "./common/genAI"

const onMessageUpdate = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] })
  .firestore.document("/messages/{messageId}")
  .onUpdate(async (change, context) => {
    // Grab the current value of what was written to Firestore.
    const before = change.before
    const after = change.after
    const messageData = after.data()
    if (!before.data().isAssessed && messageData.isAssessed) {
      //TODO: rationalisation here
      await after.ref.update({
        assessedTimestamp: Timestamp.fromDate(new Date()),
      })
      const machineCategory = messageData.machineCategory
      let primaryCategory = messageData.primaryCategory
      if (["misleading", "untrue", "accurate"].includes(primaryCategory)) {
        primaryCategory = "info"
      }
      if (
        machineCategory &&
        machineCategory !== "unsure" &&
        primaryCategory !== machineCategory
      ) {
        functions.logger.warn(
          "Voted category does not match machine category",
          {
            issue: "classification_mismatch",
            primaryCategory: messageData.primaryCategory,
            machineCategory: messageData.machineCategory,
            text: messageData.text,
          }
        )
      }
      await replyPendingInstances(after)
    }
    return Promise.resolve()
  })

async function replyPendingInstances(
  docSnap: functions.firestore.QueryDocumentSnapshot
) {
  const pendingSnapshot = await docSnap.ref
    .collection("instances")
    .where("isReplied", "==", false)
    .get()
  pendingSnapshot.forEach(async (instanceSnap) => {
    await respondToInstance(instanceSnap)
  })
}

export { onMessageUpdate }

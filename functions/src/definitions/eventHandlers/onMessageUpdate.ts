import * as functions from "firebase-functions"
import { respondToInstance } from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { rationaliseMessage, anonymiseMessage } from "../common/genAI"

const onMessageUpdate = functions
  .region("asia-southeast1")
  .runWith({
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "OPENAI_API_KEY",
    ],
  })
  .firestore.document("/messages/{messageId}")
  .onUpdate(async (change, context) => {
    // Grab the current value of what was written to Firestore.
    const before = change.before
    const after = change.after
    const messageData = after.data()
    const text = messageData.text
    const primaryCategory = messageData.primaryCategory
    if (!before.data().isAssessed && messageData.isAssessed) {
      //TODO: rationalisation here
      let rationalisation: null | string = null
      let primaryCategory = messageData.primaryCategory
      if (
        primaryCategory &&
        primaryCategory !== "irrelevant" &&
        primaryCategory !== "unsure" &&
        !messageData.caption &&
        text
      ) {
        rationalisation = await rationaliseMessage(text, primaryCategory)
      }
      await after.ref.update({
        assessedTimestamp: Timestamp.fromDate(new Date()),
        rationalisation: rationalisation,
      })
      await replyPendingInstances(after)
    }
    // if either the text changed, or the primaryCategory changed, rerun rationalisation
    else if (
      before.data().text !== text ||
      before.data().primaryCategory !== primaryCategory
    ) {
      let rationalisation: null | string = null
      if (
        primaryCategory &&
        primaryCategory !== "irrelevant" &&
        primaryCategory !== "unsure" &&
        !messageData.caption &&
        text
      ) {
        rationalisation = await rationaliseMessage(text, primaryCategory)
      }
      await after.ref.update({
        rationalisation: rationalisation,
      })
    }
    if (
      before.data().primaryCategory !== primaryCategory &&
      primaryCategory === "legitimate"
    ) {
      const anonymisedText = await anonymiseMessage(text, false)
      await after.ref.update({
        text: anonymisedText,
      })
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

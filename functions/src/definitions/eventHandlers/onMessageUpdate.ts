import * as functions from "firebase-functions"
import { respondToInstance } from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { rationaliseMessage, anonymiseMessage } from "../common/genAI"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { tabulateVoteStats } from "../common/statistics"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"

const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID)

const onMessageUpdateV2 = onDocumentUpdated(
  {
    document: "messages/{messageId}",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "OPENAI_API_KEY",
    ],
  },
  async (event) => {
    // Grab the current value of what was written to Firestore.
    const preChangeSnap = event?.data?.before
    const postChangeSnap = event?.data?.after
    if (!preChangeSnap || !postChangeSnap) {
      return Promise.resolve()
    }
    const messageData = postChangeSnap.data()
    const preChangeData = preChangeSnap.data()
    const text = messageData.text
    const primaryCategory = messageData.primaryCategory

    // If changes from not assessed to assessed
    if (!preChangeSnap.data().isAssessed && messageData.isAssessed) {
      // Reply the admin feed with the primary category results
      let message = `Primary Category: ${primaryCategory}`
      await sendTelegramTextMessage(
        "admin",
        ADMIN_CHAT_ID,
        message,
        messageData?.sentMessageId
      )

      //TODO: rationalisation here
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
      await postChangeSnap.ref.update({
        assessedTimestamp: Timestamp.fromDate(new Date()),
        rationalisation: rationalisation,
      })
      await replyPendingInstances(postChangeSnap)
    }
    // if either the text changed, or the primaryCategory changed, rerun rationalisation
    else if (
      messageData.isAssessed &&
      (preChangeData.text !== text ||
        preChangeData.primaryCategory !== primaryCategory)
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
      await postChangeSnap.ref.update({
        rationalisation: rationalisation,
      })
    }

    // If the primaryCategory changes, update the admin feed
    if (preChangeSnap.data().primaryCategory !== primaryCategory) {
      // Reply the admin feed with the primary category results
      let message = `There is a change in the primary categorisation to ${primaryCategory}`
      await sendTelegramTextMessage(
        "admin",
        ADMIN_CHAT_ID,
        message,
        messageData?.sentMessageId
      )
    }

    if (
      preChangeSnap.data().primaryCategory !== primaryCategory &&
      primaryCategory === "legitimate" &&
      text
    ) {
      const anonymisedText = await anonymiseMessage(text, false)
      await postChangeSnap.ref.update({
        text: anonymisedText,
      })
    }
    if (shouldRecalculateAccuracy(preChangeSnap, postChangeSnap)) {
      //get all voteRequests
      const voteRequestsQuerySnap = await postChangeSnap.ref
        .collection("voteRequests")
        .where("category", "!=", null)
        .get()
      const promiseArr = voteRequestsQuerySnap.docs.map((voteRequestSnap) => {
        const { isCorrect, score, duration } = tabulateVoteStats(
          postChangeSnap,
          voteRequestSnap
        )
        return voteRequestSnap.ref.update({
          isCorrect: isCorrect,
          score: score,
          duration: duration,
        })
      })
      await Promise.all(promiseArr)
    }
    return Promise.resolve()
  }
)

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

function shouldRecalculateAccuracy(
  preChangeSnap: functions.firestore.DocumentSnapshot,
  postChangeSnap: functions.firestore.DocumentSnapshot
) {
  if (postChangeSnap.get("isAssessed") !== true) {
    return false
  }
  if (preChangeSnap.get("isAssessed") !== postChangeSnap.get("isAssessed")) {
    return true
  }
  if (
    preChangeSnap.get("primaryCategory") !==
    postChangeSnap.get("primaryCategory")
  ) {
    return true
  }
  if (preChangeSnap.get("truthScore") !== postChangeSnap.get("truthScore")) {
    return true
  }
  return false
}

export { onMessageUpdateV2 }

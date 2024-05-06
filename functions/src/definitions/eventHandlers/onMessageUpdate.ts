import * as functions from "firebase-functions"
import { respondToInstance } from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { rationaliseMessage, anonymiseMessage } from "../common/genAI"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { tabulateVoteStats } from "../common/statistics"

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
    const text = messageData.text
    const primaryCategory = messageData.primaryCategory
    if (!preChangeSnap.data().isAssessed && messageData.isAssessed) {
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
      await postChangeSnap.ref.update({
        assessedTimestamp: Timestamp.fromDate(new Date()),
        rationalisation: rationalisation,
      })
      await replyPendingInstances(postChangeSnap)
    }
    // if either the text changed, or the primaryCategory changed, rerun rationalisation
    else if (
      preChangeSnap.data().text !== text ||
      preChangeSnap.data().primaryCategory !== primaryCategory
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
      console.log()
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

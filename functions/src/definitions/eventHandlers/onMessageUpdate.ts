import * as functions from "firebase-functions"
import {
  respondToInstance,
  correctCommunityNote,
} from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { anonymiseMessage } from "../common/genAI"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { tabulateVoteStats } from "../common/statistics"
import { logger } from "firebase-functions"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { sendVotingUpdate } from "../../services/admin/notificationService"

const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID)

const onMessageUpdateV2 = onDocumentUpdated(
  {
    document: "messages/{messageId}",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "OPENAI_API_KEY",
      "TELEGRAM_ADMIN_BOT_TOKEN",
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
    let correctionSent = false

    // If changes from not assessed to assessed
    if (!preChangeSnap.data().isAssessed && messageData.isAssessed) {
      // Reply the admin feed with the primary category results
      sendVotingUpdate({
        messageId: postChangeSnap.get("adminGroupSentMessageId"),
        currentCategory: primaryCategory,
      })

      await postChangeSnap.ref.update({
        assessedTimestamp: Timestamp.fromDate(new Date()),
      })
      await replyPendingInstances(postChangeSnap)
      if (
        messageData?.communityNote?.downvoted &&
        messageData?.communityNote?.pendingCorrection
      ) {
        correctionSent = true
        await replyCommunityNoteInstances(postChangeSnap)
      }
    } // if either the text changed, or the primaryCategory changed, rerun rationalisation
    else if (
      messageData.isAssessed &&
      preChangeSnap.data().primaryCategory !== primaryCategory &&
      preChangeSnap.data().primaryCategory !== null
    ) {
      sendVotingUpdate({
        messageId: postChangeSnap.get("adminGroupSentMessageId"),
        previousCategory: preChangeSnap.data().primaryCategory,
        currentCategory: primaryCategory,
      })
    }

    if (
      !preChangeSnap.data().communityNote?.downvoted &&
      messageData?.communityNote?.downvoted
    ) {
      if (!correctionSent) {
        if (messageData.isAssessed) {
          await replyCommunityNoteInstances(postChangeSnap)
        } else {
          postChangeSnap.ref.update({
            "communityNote.pendingCorrection": true,
          })
        }
      }
      sendVotingUpdate({
        messageId: postChangeSnap.get(
          "communityNote.adminGroupCommunityNoteSentMessageId"
        ),
        downvoted: true,
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
  try {
    await Promise.all(
      pendingSnapshot.docs.map(async (instanceSnap) => {
        await respondToInstance(instanceSnap)
      })
    )
  } catch (error) {
    logger.error(`Error in replyPendingInstances: ${error}`)
  }
}

async function replyCommunityNoteInstances(
  docSnap: functions.firestore.QueryDocumentSnapshot
) {
  const pendingSnapshot = await docSnap.ref
    .collection("instances")
    .where("isCommunityNoteSent", "==", true)
    .where("isCommunityNoteCorrected", "==", false)
    .get()
  try {
    await Promise.all(
      pendingSnapshot.docs.map(async (instanceSnap) => {
        await correctCommunityNote(instanceSnap)
      })
    )
  } catch (error) {
    logger.error(`Error in replyCommunityNoteInstances: ${error}`)
  }
  await docSnap.ref.update({
    "communityNote.pendingCorrection": false,
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

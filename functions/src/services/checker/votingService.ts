import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { VoteRequest } from "../../types"
import { Timestamp } from "firebase-admin/firestore"
import { sendWhatsappTemplateMessage } from "../../definitions/common/sendWhatsappMessage"
import { sendTelegramTextMessage } from "../../definitions/common/sendTelegramMessage"

const checkerAppHost = process.env.CHECKER_APP_HOST

export async function despatchPoll(
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  const db = admin.firestore()
  const factCheckersSnapshot = await db
    .collection("checkers")
    .where("type", "==", "human")
    .where("isActive", "==", true)
    .get()
  const messageSnap = await messageRef.get()
  const latestInstanceRef = messageSnap.get("latestInstance")
  let previewText = ""
  if (!latestInstanceRef) {
    logger.error(`Parent message ${messageSnap.id} has no latest instance`)
  } else {
    const latestInstanceSnap = await latestInstanceRef.get()
    const type = latestInstanceSnap.get("type") ?? null
    if (type === "text") {
      const text = messageSnap.get("text")
      if (text) {
        if (text.length > 50) {
          previewText = text.substring(0, 50) + "..."
        } else {
          previewText = text
        }
      } else {
        logger.error(`Latest instance ${latestInstanceRef.id} has no text`)
      }
    } else if (type === "image") {
      previewText = "<Image 🖼️>"
    }
  }

  // get preview text if message exists, else get image
  if (!factCheckersSnapshot.empty) {
    const despatchPromises = factCheckersSnapshot.docs.map(
      (factCheckerDocSnap) =>
        sendTemplateMessageAndCreateVoteRequest(
          factCheckerDocSnap,
          messageRef,
          previewText
        )
    )
    await Promise.all(despatchPromises)
  }
}

async function sendTemplateMessageAndCreateVoteRequest(
  factCheckerDocSnap: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  previewText: string | null
) {
  const voteAlreadyExistsQuery = await messageRef
    .collection("voteRequests")
    .where("factCheckerDocRef", "==", factCheckerDocSnap.ref)
    .get()
  if (!voteAlreadyExistsQuery.empty) {
    logger.log(
      `Vote request already exists for factChecker ${factCheckerDocSnap.id} for message ${messageRef.id}`
    )
    return Promise.resolve()
  }
  const factChecker = factCheckerDocSnap.data()
  const preferredPlatform = factChecker?.preferredPlatform
  const newVoteRequest: VoteRequest = {
    factCheckerDocRef: factCheckerDocSnap.ref,
    platformId:
      preferredPlatform === "whatsapp"
        ? factChecker.whatsappId
        : factChecker.telegramId,
    hasAgreed: false,
    triggerL2Vote: null,
    triggerL2Others: null,
    platform: preferredPlatform,
    sentMessageId: null,
    category: null,
    isAutoPassed: false,
    truthScore: null,
    numberPointScale: 6,
    reasoning: null,
    tags: {},
    createdTimestamp: Timestamp.fromDate(new Date()),
    acceptedTimestamp: null,
    votedTimestamp: null,
    isCorrect: null,
    score: null,
    duration: null,
  }
  if (preferredPlatform === "whatsapp") {
    // First, add the voteRequest object to the "voteRequests" sub-collection
    return messageRef
      .collection("voteRequests")
      .add(newVoteRequest)
      .then((writeResult) => {
        // After the voteRequest object is added, send the WhatsApp template message with the additional voteRequestId parameter
        return sendWhatsappTemplateMessage(
          "factChecker",
          factChecker.whatsappId,
          "new_message_received",
          "en",
          [factChecker?.name || "CheckMate"],
          [`${writeResult.path}`, `${writeResult.path}`],
          "factChecker"
        )
      })
  } else if (preferredPlatform === "telegram") {
    //not yet implemented
    // First, add the voteRequest object to the "voteRequests" sub-collection
    return messageRef
      .collection("voteRequests")
      .add(newVoteRequest)
      .then((voteRequestRef) => {
        const voteRequestPath = voteRequestRef.path
        const voteRequestUrl = `${checkerAppHost}/${voteRequestPath}`
        // After the voteRequest object is added, send the Telegram template message with the additional voteRequestId parameter
        return sendTelegramTextMessage(
          "factChecker",
          factChecker.telegramId,
          `New message received! 📩\n\n${previewText}`,
          null,
          null,
          {
            inline_keyboard: [
              [{ text: "Vote 🗳️!", web_app: { url: voteRequestUrl } }],
            ],
          }
          //if it's telegram, add the message_id so we can change the replymarkup later
        ).then((response) => {
          if (response.data.result.message_id) {
            return voteRequestRef.update({
              sentMessageId: response.data.result.message_id,
            })
          }
        })
      })
  } else {
    return Promise.reject(
      new Error(
        `Preferred platform not supported for factChecker ${factChecker.id}`
      )
    )
  }
}

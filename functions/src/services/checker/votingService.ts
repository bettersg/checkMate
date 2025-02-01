import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { VoteRequest } from "../../types"
import { Timestamp } from "firebase-admin/firestore"
import { sendWhatsappTemplateMessage } from "../../definitions/common/sendWhatsappMessage"
import { sendTelegramTextMessage } from "../../definitions/common/sendTelegramMessage"
import { getShuffledDocsFromSnapshot } from "../../utils/shuffleUtils"
import { getThresholds } from "../../definitions/common/utils"
import { FieldValue } from "@google-cloud/firestore"
import { checkMachineCase } from "../../validators/common/checkMachineCase"

const checkerAppHost = process.env.CHECKER_APP_HOST

export async function despatchPoll(
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  const db = admin.firestore()
  const messageSnap = await messageRef.get()
  let query = db
    .collection("checkers")
    .where("type", "==", "human")
    .where("isActive", "==", true)
  //TODO: REMOVE BELOW SECTION AFTER TRIAL ENDS
  const isMachineCase = checkMachineCase(messageSnap)

  if (isMachineCase) {
    console.log("Machine case detected")
    query = query.where("isTester", "==", true)
  }
  //END SECTION TO REMOVE

  const factCheckersSnapshot = await query
    .orderBy("dailyAssignmentCount", "asc")
    .get()
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
    const thresholds = await getThresholds()
    //const numberToTrigger = thresholds.numberToTrigger ?? "all"
    const targetDailyVotes = thresholds.targetDailyVotes ?? 8
    const minVotesPerMessage = thresholds.minVotesPerMessage ?? 30
    const poolSize = factCheckersSnapshot.size
    const numVotesToday = (
      await db.collection("systemParameters").doc("counts").get()
    ).get("polls")
    const numberToTrigger = determineNumberOfVotes(
      minVotesPerMessage,
      numVotesToday,
      poolSize,
      targetDailyVotes
    )
    let docs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[]
    // check if numberToTrigger is string
    if (typeof numberToTrigger !== "number") {
      docs = factCheckersSnapshot.docs
    } else {
      docs = getShuffledDocsFromSnapshot(
        factCheckersSnapshot.docs,
        "dailyAssignmentCount",
        numberToTrigger
      )
    }
    const despatchPromises = docs.map((factCheckerDocSnap) =>
      sendTemplateMessageAndCreateVoteRequest(
        factCheckerDocSnap,
        messageRef,
        previewText
      )
    )
    try {
      await Promise.all(despatchPromises)
    } catch (error) {
      logger.error(
        `Error despatching poll for message ${messageRef.id}: ${error}`
      )
    }
    await db
      .collection("systemParameters")
      .doc("counts")
      .update({
        polls: FieldValue.increment(1),
      })
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
    communityNoteCategory: null,
    createdTimestamp: Timestamp.fromDate(new Date()),
    acceptedTimestamp: null,
    votedTimestamp: null,
    isCorrect: null,
    score: null,
    duration: null,
  }
  await factCheckerDocSnap.ref.update({
    dailyAssignmentCount: FieldValue.increment(1),
  })
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
          if (response && response.data.result.message_id) {
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

function determineNumberOfVotes(
  minVotesPerMessage: number,
  totalMessagesToday: number,
  poolSize: number,
  idealVotesPerChecker: number
) {
  if (totalMessagesToday <= idealVotesPerChecker) {
    return "all"
  } else {
    return Math.max(
      minVotesPerMessage,
      Math.ceil((poolSize / totalMessagesToday) * idealVotesPerChecker)
    )
  }
}

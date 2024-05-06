import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { anonymiseMessage } from "../common/genAI"
import { getThresholds } from "../common/utils"
import { respondToInstance } from "../common/responseUtils"
import { sendWhatsappTemplateMessage } from "../common/sendWhatsappMessage"
import {
  insertOne,
  CollectionTypes,
} from "../common/typesense/collectionOperations"
import { FieldValue } from "@google-cloud/firestore"
import { Timestamp } from "firebase-admin/firestore"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { publishToTopic } from "../common/pubsub"
import { VoteRequest } from "../../types"
import { onDocumentCreated } from "firebase-functions/v2/firestore"

interface MessageUpdate {
  [x: string]: any
}

if (!admin.apps.length) {
  admin.initializeApp()
}

const checkerAppHost = process.env.CHECKER_APP_HOST

const onInstanceCreateV2 = onDocumentCreated(
  {
    document: "messages/{messageId}/instances/{instanceId}",
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
      functions.logger.log("No data associated with the event")
      return Promise.resolve()
    }
    const data = snap.data()
    if (!data.from) {
      functions.logger.log("Missing 'from' field in instance data")
      return Promise.resolve()
    }
    const parentMessageRef = snap.ref.parent.parent
    if (!parentMessageRef) {
      functions.logger.error(`Instance ${snap.ref.path} has no parent message`)
      return
    }
    const instancesQuerySnap = await parentMessageRef
      .collection("instances")
      .orderBy("timestamp", "desc")
      .get()
    const lastInstanceDocSnap = instancesQuerySnap.docs[0]
    const messageUpdateObj: MessageUpdate = {
      instanceCount: instancesQuerySnap.size,
      lastTimestamp: lastInstanceDocSnap.get("timestamp"),
      latestInstance: snap.ref,
    }
    const parentMessageSnap = await parentMessageRef.get()

    try {
      const lastRefreshedDate = parentMessageSnap
        .get("lastRefreshedTimestamp")
        .toDate()
      const comparisonDate = new Date()
      comparisonDate.setDate(comparisonDate.getDate() - 30)
      //if lastRefreshedDate is more than 30 days ago
      if (lastRefreshedDate < comparisonDate) {
        messageUpdateObj.lastRefreshedTimestamp =
          Timestamp.fromDate(comparisonDate)
        if (
          data?.type === "text" &&
          data?.text != parentMessageSnap.get("originalText")
        ) {
          const strippedMessage = await anonymiseMessage(data.text, true)
          messageUpdateObj.originalText = data.text
          messageUpdateObj.text = strippedMessage
        } else if (data?.type === "image") {
          messageUpdateObj.caption = data.caption
          // Don't anonymise image captions for now, since OCR may be inaccurate
          // if (data?.text != parentMessageSnap.get("originalText")) {
          //   const strippedMessage = await anonymiseMessage(data.text)
          //   messageUpdateObj.originalText = data.text
          //   messageUpdateObj.text = strippedMessage
          // }
        }
      }
    } catch (e) {
      functions.logger.error("Error refreshing message: ", e)
    }

    await parentMessageRef.update(messageUpdateObj)

    await upsertUser(data.from, data.timestamp)

    if (data?.embedding && data?.text) {
      const updateObj = {
        id: snap.ref.path.replace(/\//g, "_"), //typesense id can't seem to take /
        message: data.text,
        captionHash: data.captionHash ? data.captionHash : "__NULL__",
        embedding: data.embedding,
      }
      try {
        await insertOne(updateObj, CollectionTypes.Instances)
      } catch (error) {
        functions.logger.error(
          `Error inserting instance ${snap.ref.path} into typesense: `,
          error
        )
      }
    }

    if (!data.isReplied) {
      await respondToInstance(snap, false, true)
    }
    if (!parentMessageSnap.get("isAssessed")) {
      const parentInstanceCount = instancesQuerySnap.size
      const thresholds = await getThresholds()
      if (
        parentInstanceCount >= thresholds.startVote &&
        !parentMessageSnap.get("isPollStarted")
      ) {
        await triggerAgents(snap)
        await despatchPoll(parentMessageRef)
        return parentMessageRef.update({ isPollStarted: true })
      }
      return Promise.resolve()
    }
  }
)

async function upsertUser(from: string, messageTimestamp: Timestamp) {
  const db = admin.firestore()
  const userRef = db.collection("users").doc(from)
  await userRef.set(
    {
      lastSent: messageTimestamp,
      instanceCount: FieldValue.increment(1),
    },
    { merge: true }
  )
}

async function triggerAgents(instanceSnap: admin.firestore.DocumentSnapshot) {
  const instanceData = {
    messageId: instanceSnap.ref.parent.parent?.id,
    type: instanceSnap.get("type"),
    text: instanceSnap.get("text"),
    caption: instanceSnap.get("caption"),
    storageUrl: instanceSnap.get("storageUrl"),
  }
  await publishToTopic("agentQueue", instanceData)
}

async function despatchPoll(
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  const db = admin.firestore()
  const factCheckersSnapshot = await db
    .collection("checkers")
    .where("type", "==", "human")
    .where("isActive", "==", true)
    .get()
  if (!factCheckersSnapshot.empty) {
    const despatchPromises = factCheckersSnapshot.docs.map(
      (factCheckerDocSnap) =>
        sendTemplateMessageAndCreateVoteRequest(factCheckerDocSnap, messageRef)
    )
    await Promise.all(despatchPromises)
  }
}

async function sendTemplateMessageAndCreateVoteRequest(
  factCheckerDocSnap: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
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
    truthScore: null,
    reasoning: null,
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
          "New message received! Would you like to help assess it?",
          null,
          {
            inline_keyboard: [
              [{ text: "Yes!", web_app: { url: voteRequestUrl } }],
            ],
          }
        )
      })
  } else {
    return Promise.reject(
      new Error(
        `Preferred platform not supported for factChecker ${factChecker.id}`
      )
    )
  }
}

export { onInstanceCreateV2 }

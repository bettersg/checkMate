import * as admin from "firebase-admin"
import { anonymiseMessage } from "../common/genAI"
import { getThresholds } from "../common/utils"
import { respondToInstance } from "../common/responseUtils"
import {
  insertOne,
  CollectionTypes,
} from "../common/typesense/collectionOperations"
import { despatchPoll } from "../../services/checker/votingService"
import { FieldValue } from "@google-cloud/firestore"
import { Timestamp } from "firebase-admin/firestore"
import { publishToTopic } from "../common/pubsub"
import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { logger } from "firebase-functions/v2"

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
      logger.log("No data associated with the event")
      return Promise.resolve()
    }
    const data = snap.data()
    if (!data.from) {
      logger.log("Missing 'from' field in instance data")
      return Promise.resolve()
    }
    if (!data.source) {
      logger.log("Missing 'source' field in instance data")
      return Promise.resolve()
    }
    const parentMessageRef = snap.ref.parent.parent
    if (!parentMessageRef) {
      logger.error(`Instance ${snap.ref.path} has no parent message`)
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
      logger.error("Error refreshing message: ", e)
    }

    await parentMessageRef.update(messageUpdateObj)

    await upsertUser(data.from, data.source, data.timestamp)

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
        logger.error(
          `Error inserting instance ${snap.ref.path} into typesense: `,
          error
        )
      }
    }

    if (!data.isReplied) {
      await respondToInstance(snap, false, true)
    }
    if (
      !parentMessageSnap.get("isAssessed") &&
      parentMessageSnap.get("machineCategory") !== "irrelevant"
    ) {
      const parentInstanceCount = instancesQuerySnap.size
      const thresholds = await getThresholds()
      if (
        parentInstanceCount >= thresholds.startVote &&
        !parentMessageSnap.get("isPollStarted")
      ) {
        //await triggerAgents(snap)
        await parentMessageRef.update({ isPollStarted: true })
        try {
          await despatchPoll(parentMessageRef)
        } catch (error) {
          logger.error(
            `Error despatching poll for message ${parentMessageRef.id}: `,
            error
          )
          await parentMessageRef.update({ isPollStarted: false })
        }
        return Promise.resolve()
      }
      return Promise.resolve()
    }
  }
)

async function upsertUser(
  from: string,
  source: string,
  messageTimestamp: Timestamp
) {
  const db = admin.firestore()
  let idField
  if (source === "whatsapp") {
    idField = "whatsappId"
  } else if (source === "telegram") {
    idField = "telegramId"
  } else {
    logger.error(`Invalid source: ${source}`)
    return
  }
  const userSnap = await db
    .collection("users")
    .where(idField, "==", from)
    .limit(1)
    .get()
  if (userSnap.empty) {
    logger.log("No user found in database")
    return
  }
  const userRef = userSnap.docs[0].ref
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

export { onInstanceCreateV2 }

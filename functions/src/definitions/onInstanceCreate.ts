import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { getCount } from "./common/counters"
import { getThresholds } from "./common/utils"
import { respondToInstance } from "./common/responseUtils"
import { sendWhatsappTemplateMessage } from "./common/sendWhatsappMessage"
import {
  insertOne,
  CollectionTypes,
} from "./common/typesense/collectionOperations"
import { FieldValue } from "@google-cloud/firestore"
import { defineInt } from "firebase-functions/params"
import { Timestamp } from "firebase-admin/firestore"

// Define some parameters
const numInstanceShards = defineInt("NUM_SHARDS_INSTANCE_COUNT")

if (!admin.apps.length) {
  admin.initializeApp()
}

const onInstanceCreate = functions
  .region("asia-southeast1")
  .runWith({
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "TYPESENSE_TOKEN",
      "ML_SERVER_TOKEN",
    ],
  })
  .firestore.document("/messages/{messageId}/instances/{instanceId}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore.
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
    await parentMessageRef.update({
      instanceCount: instancesQuerySnap.size,
      lastTimestamp: lastInstanceDocSnap.get("timestamp"),
    })

    await upsertUser(data.from, data.timestamp)

    if (data?.type === "text") {
      parentMessageRef.update({ text: data.text, latestInstance: snap.ref })
    } else if (data?.type === "image") {
      parentMessageRef.update({
        latestInstance: snap.ref,
        caption: data.caption,
      })
    }

    if (data?.embedding && data?.text) {
      const updateObj = {
        id: snap.ref.path.replace(/\//g, "_"), //typesense id can't seem to take /
        message: data.originalText,
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

    const parentMessageSnap = await parentMessageRef.get()
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
        await despatchPoll(parentMessageRef)
        return parentMessageRef.update({ isPollStarted: true })
      }
      return Promise.resolve()
    }
  })

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

async function despatchPoll(
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  const db = admin.firestore()
  const factCheckersSnapshot = await db
    .collection("factCheckers")
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

function sendTemplateMessageAndCreateVoteRequest(
  factCheckerDocSnap: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  const factChecker = factCheckerDocSnap.data()
  if (factChecker?.preferredPlatform === "whatsapp") {
    // First, add the voteRequest object to the "voteRequests" sub-collection
    return messageRef
      .collection("voteRequests")
      .add({
        factCheckerDocRef: factCheckerDocSnap.ref,
        platformId: factChecker.platformId,
        hasAgreed: false,
        triggerL2Vote: null,
        triggerL2Others: null,
        platform: "whatsapp",
        sentMessageId: null,
        category: null,
        vote: null,
        createdTimestamp: Timestamp.fromDate(new Date()),
        acceptedTimestamp: null,
        votedTimestamp: null,
      })
      .then((writeResult) => {
        // After the voteRequest object is added, send the WhatsApp template message with the additional voteRequestId parameter
        return sendWhatsappTemplateMessage(
          "factChecker",
          factChecker.platformId,
          "new_message_received",
          "en",
          [factChecker?.name || "CheckMate"],
          [`${writeResult.path}`, `${writeResult.path}`],
          "factChecker"
        )
      })
  } else if (factChecker?.preferredPlatform === "telegram") {
    //not yet implemented
  } else {
    return Promise.reject(
      new Error(
        `Preferred platform not supported for factChecker ${factChecker.id}`
      )
    )
  }
}

export { onInstanceCreate }

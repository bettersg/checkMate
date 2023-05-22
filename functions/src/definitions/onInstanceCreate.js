const functions = require("firebase-functions")
const { incrementCounter, getCount } = require("./common/counters")
const { getThresholds } = require("./common/utils")
const { respondToInstance } = require("./common/responseUtils")
const { sendWhatsappTemplateMessage } = require("./common/sendWhatsappMessage")
const admin = require("firebase-admin")
const { FieldValue } = require("@google-cloud/firestore")
const { defineInt } = require("firebase-functions/params")
const { Timestamp } = require("firebase-admin/firestore")

// Define some parameters
const numInstanceShards = defineInt("NUM_SHARDS_INSTANCE_COUNT")

if (!admin.apps.length) {
  admin.initializeApp()
}

exports.onInstanceCreate = functions
  .region("asia-southeast1")
  .runWith({
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
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
    await incrementCounter(
      parentMessageRef,
      "instance",
      numInstanceShards.value()
    )

    await upsertUser(data.from, data.timestamp)

    if (data?.type === "text") {
      parentMessageRef.update({ "text": data.text })
    }

    const parentMessageSnap = await parentMessageRef.get()
    if (!data.isReplied) {
      await respondToInstance(snap)
    }
    if (!parentMessageSnap.get("isAssessed")) {
      const parentInstanceCount = await getCount(parentMessageRef, "instance")
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

async function upsertUser(from, messageTimestamp) {
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

async function despatchPoll(messageRef) {
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
  factCheckerDocSnap,
  messageRef
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

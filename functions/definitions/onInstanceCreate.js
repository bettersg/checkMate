const functions = require('firebase-functions');
const { incrementCounter, getCount } = require('./common/counters');
const { getThresholds } = require('./common/utils');
const { respondToInstance } = require('./common/responseUtils')
const { sendWhatsappTextMessage, sendWhatsappTemplateMessage } = require('./common/sendWhatsappMessage');
const admin = require('firebase-admin');
const { FieldValue } = require('@google-cloud/firestore');
const { defineInt } = require('firebase-functions/params');
const { Timestamp } = require('firebase-admin/firestore');

// Define some parameters
const numInstanceShards = defineInt('NUM_SHARDS_INSTANCE_COUNT');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.onInstanceCreate = functions.region('asia-southeast1').runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] }).firestore.document('/messages/{messageId}/instances/{instanceId}')
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore.
    const data = snap.data();
    if (!data.from) {
      functions.logger.log("Missing 'from' field in instance data");
      return Promise.resolve()
    }
    const parentMessageRef = snap.ref.parent.parent;
    await incrementCounter(parentMessageRef, "instance", numInstanceShards.value())

    await upsertUser(data.from, data.timestamp, snap.ref);

    const parentMessageSnap = await parentMessageRef.get();
    await respondToInstance(snap);
    if (parentMessageSnap.get("isAssessed")) {
      return snap.ref.update({ isReplied: true, replyTimeStamp: Timestamp.fromDate(new Date()) });
    }
    const parentInstanceCount = await getCount(parentMessageRef, "instance")
    const thresholds = await getThresholds();
    if (parentInstanceCount >= thresholds.startVote && !parentMessageSnap.get("isPollStarted")) {
      await despatchPoll(parentMessageRef);
      return parentMessageRef.update({ isPollStarted: true });
    }
    return Promise.resolve();
  });

async function upsertUser(from, messageTimestamp, instanceRef) {
  const db = admin.firestore();
  const batch = db.batch()
  const userRef = db.collection("users").doc(from);
  const userInstanceRef = userRef.collection("instances").doc();
  batch.set(userRef, {
    lastSent: messageTimestamp,
    instanceCount: FieldValue.increment(1),
  }, { merge: true })
  batch.set(userInstanceRef, {
    instanceDocRef: instanceRef
  })
  await batch.commit()
}

async function despatchPoll(messageRef) {
  const messageId = messageRef.id
  const db = admin.firestore();
  const factCheckersSnapshot = await db.collection('factCheckers').where('isActive', '==', true).get();
  if (!factCheckersSnapshot.empty) {
    const despatchPromises = factCheckersSnapshot.docs.map(factCheckerDoc => sendTemplateMessageAndCreateVoteRequest(factCheckerDoc.data(), messageId, factCheckerDoc, messageRef));
    await Promise.all(despatchPromises);
  }
}

function sendTemplateMessageAndCreateVoteRequest(factChecker, messageId, doc, messageRef) {
  if (factChecker?.preferredPlatform === "whatsapp") {
    return sendWhatsappTemplateMessage("factChecker", factChecker.platformId, "new_message_received", "en", [factChecker?.name || "CheckMate"], [messageId, messageId], "factChecker")
      .then(() => {
        return messageRef.collection("voteRequests").add({
          factCheckerDocRef: doc.ref,
          platformId: factChecker.platformId,
          hasAgreed: false,
          triggerVote: null,
          triggerL2: null,
          platform: "whatsapp",
          sentMessageId: null,
          vote: null,
        });
      });
  } else if (factChecker?.preferredPlatform === "telegram") {
    //not yet implemented
  } else {
    return Promise.reject(new Error(`Preferred platform not supported for factChecker ${factChecker.id}`));
  }
}
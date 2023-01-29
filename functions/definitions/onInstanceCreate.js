/*
Assigned: Yong En

NOTES:

On update to any messages instance count:

1. if instance count above thresholdToStartVote in system_parameters collection
    1. Loop through fact checkers in the factCheckers collection
        1. if factCheckers are active
            1. send them telegram message with inline keyboard with callback buttons for voting

*/

const functions = require('firebase-functions');
const { incrementCounter, getCount } = require('./common/counters');
const { getResponseToMessage, getReponsesObj, getThresholds } = require('./common/utils');
const { sendWhatsappTextMessage, sendWhatsappTemplateMessage } = require('./common/sendWhatsappMessage');
const admin = require('firebase-admin');
const { defineInt } = require('firebase-functions/params');

// Define some parameters
const numInstanceShards = defineInt('NUM_SHARDS_INSTANCE_COUNT');
//const whatsappUserBotPhoneNumberId = defineSecret('WHATSAPP_USER_BOT_PHONE_NUMBER_ID');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.onInstanceCreate = functions.region('asia-southeast1').runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] }).firestore.document('/messages/{messageId}/instances/{instanceId}')
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore.
    const data = snap.data();
    const parentMessageRef = snap.ref.parent.parent;
    incrementCounter(parentMessageRef, "instance", numInstanceShards.value())
    const parentMessageSnap = await parentMessageRef.get();
    const responses = await getReponsesObj();
    if (!data.from) {
      functions.logger.log("Missing 'from' field in instance data");
    } else {
      const response = getResponseToMessage(parentMessageSnap, responses)
      await sendWhatsappTextMessage("user", data.from, response, data.id)
      if (parentMessageSnap.get("isAssessed")) {
        return snap.ref.update({ isReplied: true });
      }
    }
    const parentInstanceCount = await getCount(parentMessageRef, "instance")
    const thresholds = await getThresholds();
    if (parentInstanceCount >= thresholds.startVote && !parentMessageSnap.get("isPollStarted")) {
      await despatchPoll(parentMessageRef);
      return parentMessageRef.update({ isPollStarted: true });
    }
    return Promise.resolve();
  });

async function despatchPoll(messageRef) {
  const messageId = messageRef.id
  const db = admin.firestore();
  const factCheckersSnapshot = await db.collection('factCheckers').where('isActive', '==', true).get();
  if (!factCheckersSnapshot.empty) {
    factCheckersSnapshot.forEach(async doc => {
      const factChecker = doc.data();
      if (factChecker?.preferredChannel == "whatsapp") {
        await sendWhatsappTemplateMessage("user", factChecker.whatsappNumber, "sample_issue_resolution", "en_US", [factChecker?.name ?? ""], [messageId, messageId], "factChecker");
        await messageRef.collection("voteRequests").add({
          factCheckerDocRef: doc.ref,
          whatsappNumber: factChecker.whatsappNumber,
          hasAgreed: false,
          isScam: null,
          platform: "whatsapp",
          sentMessageId: null,
          vote: null,
        });
      } else if (factChecker?.preferredChannel == "telegram") {
        await messageRef.collection("voteRequests").add({
          factCheckerDocRef: doc.ref,
          whatsappNumber: factChecker.whatsappNumber,
          hasAgreed: false,
          isScam: null,
          platform: "telegram",
          sentMessageId: null,
          vote: null,
        });
      }
    })
  }
}
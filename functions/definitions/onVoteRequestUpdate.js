const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getThresholds } = require("./common/utils");
const { sendVotingMessage, sendL2OthersCategorisationMessage, sendReminderMessage } = require("./common/sendFactCheckerMessages")
const { sendWhatsappTextMessage } = require('./common/sendWhatsappMessage');
const { incrementCounter, getCount } = require("./common/counters");
const { FieldValue } = require('@google-cloud/firestore');
const { defineInt } = require('firebase-functions/params');
// Define some parameters
const numVoteShards = defineInt('NUM_SHARDS_VOTE_COUNT');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.onVoteRequestUpdate = functions.region("asia-southeast1").runWith({ secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] }).firestore.document("/messages/{messageId}/voteRequests/{voteRequestId}")
  .onUpdate(async (change, context) => {
    // Grab the current value of what was written to Firestore.
    const before = change.before.data();
    const docSnap = change.after;
    const after = docSnap.data();
    const messageRef = docSnap.ref.parent.parent;

    if (before.triggerL2Vote !== true && after.triggerL2Vote === true) {
      functions.logger.log(`L2 vote message sent for ${after.platformId}`)
      await sendVotingMessage(change.after, messageRef);
    } else if (before.triggerL2Others !== true && after.triggerL2Others === true) {
      functions.logger.log(`L2 others message sent for ${after.platformId}`)
      await sendL2OthersCategorisationMessage(change.after, messageRef);
    } else if ((before.vote != after.vote) || (before.category != after.category)) {
      await updateCounts(messageRef, before, after);
      await updateCheckerVoteCount(before, after);
      const db = admin.firestore();
      const factCheckersSnapshot = await db.collection("factCheckers").where("isActive", "==", true).get();
      const numFactCheckers = factCheckersSnapshot.size;
      const responseCount = await getCount(messageRef, "responses");
      const irrelevantCount = await getCount(messageRef, "irrelevant");
      const scamCount = await getCount(messageRef, "scam");
      const illicitCount = await getCount(messageRef, "illicit");
      const infoCount = await getCount(messageRef, "info");
      const spamCount = await getCount(messageRef, "spam");
      const legitimateCount = await getCount(messageRef, "legitimate")
      const unsureCount = await getCount(messageRef, "unsure");
      const susCount = scamCount + illicitCount;
      const voteTotal = await getCount(messageRef, "totalVoteScore");
      const truthScore = (infoCount > 0) ? (voteTotal / infoCount) : null;
      const thresholds = await getThresholds();
      const isSus = (susCount > parseInt(thresholds.isSus * responseCount));
      const isScam = isSus && (scamCount >= illicitCount);
      const isIllicit = isSus && !isScam;
      const isInfo = infoCount > parseInt(thresholds.isInfo * responseCount);
      const isSpam = spamCount > parseInt(thresholds.isSpam * responseCount);
      const isLegitimate = legitimateCount > parseInt(thresholds.isLegitimate * responseCount);
      const isIrrelevant = (irrelevantCount > parseInt(thresholds.isIrrelevant * responseCount));
      const isUnsure = (!isSus && !isInfo && !isSpam && !isLegitimate && !isIrrelevant) || unsureCount > parseInt(thresholds.inUnsure * responseCount);
      const isAssessed = (isUnsure && responseCount > parseInt(thresholds.endVoteUnsure * numFactCheckers)) || (!isUnsure && responseCount > parseInt(thresholds.endVote * numFactCheckers)) || (isSus && responseCount > parseInt(thresholds.endVoteSus * numFactCheckers));
      await messageRef.update({
        truthScore: truthScore,
        isSus: isSus,
        isScam: isScam,
        isIllicit: isIllicit,
        isInfo: isInfo,
        isSpam: isSpam,
        isLegitimate: isLegitimate,
        isIrrelevant: isIrrelevant,
        isUnsure: isUnsure,
        isAssessed: isAssessed,
      });
      if (after.category !== null) { //vote has ended
        await sendRemainingReminder(after.factCheckerDocRef.id, after.platform);
      }
    }
    return Promise.resolve();
  });

async function updateCounts(messageRef, before, after) {
  const previousCategory = before.category;
  const currentCategory = after.category;
  const previousVote = before.vote;
  const currentVote = after.vote;
  if (previousCategory === null) {
    if (currentCategory !== null) {
      await incrementCounter(messageRef, "responses", numVoteShards.value());
    }
  } else {
    if (currentCategory === null) {
      await incrementCounter(messageRef, "responses", numVoteShards.value(), -1); //if previous category is not null and current category is, reduce the response count
    }
    await incrementCounter(messageRef, previousCategory, numVoteShards.value(), -1); //if previous category is not null and current category also not now, reduce the count of the previous category
    if (previousCategory === "info") {
      await incrementCounter(messageRef, "totalVoteScore", numVoteShards.value(), -previousVote); //if previous category is info, reduce the total vote score
    }
  }
  if (currentCategory !== null) {
    await incrementCounter(messageRef, currentCategory, numVoteShards.value());
    if (currentCategory === "info") {
      await incrementCounter(messageRef, "totalVoteScore", numVoteShards.value(), currentVote);
    }
  }
}

async function updateCheckerVoteCount(before, after) {
  let factCheckerRef
  if (before.vote === null && after.vote !== null) {
    factCheckerRef = after.factCheckerDocRef
    factCheckerRef.update({
      numVoted: FieldValue.increment(1),
    })
  }
  else if (before.vote !== null && after.vote === null) {
    factCheckerRef = after.factCheckerDocRef
    factCheckerRef.update({
      numVoted: FieldValue.increment(-1),
    })
  }
}

async function sendRemainingReminder(factCheckerId, platform) {
  const db = admin.firestore();
  try {
    const outstandingVoteRequestsQuerySnap = await db.collectionGroup('voteRequests').where('platformId', '==', factCheckerId).where("category", "==", null).get();
    const remainingCount = outstandingVoteRequestsQuerySnap.size;
    if (remainingCount == 0) {
      await sendWhatsappTextMessage("factChecker", factCheckerId, "Great, you have no further messages to assess. Keep it up!💪");
      return;
    }
    const unassessedMessagesQuerySnap = await db.collection("messages").where("isAssessed", "==", false).get();
    const unassessedMessageIdList = unassessedMessagesQuerySnap.docs.map((docSnap) => docSnap.id);
    //sort outstandingVoteRequestsQuerySnap by whether the parent message is assessed
    const sortedVoteRequestDocs = outstandingVoteRequestsQuerySnap.docs.sort((a, b) => {
      const aIsAssessed = unassessedMessageIdList.includes(a.ref.parent.parent.id);
      const bIsAssessed = unassessedMessageIdList.includes(b.ref.parent.parent.id);
      if (aIsAssessed && !bIsAssessed) {
        return -1;
      }
      if (!aIsAssessed && bIsAssessed) {
        return 1;
      }
      return 0;
    });
    const nextVoteRequestPath = sortedVoteRequestDocs[0].ref.path;
    await sendReminderMessage(factCheckerId, remainingCount, nextVoteRequestPath);
  } catch (error) {
    functions.logger.error("Error sending remaining reminder", error);
  }
};
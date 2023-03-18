const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getThresholds } = require("./common/utils");
const { sendVotingMessage, sendL2ScamAssessmentMessage } = require("./common/sendFactCheckerMessages")
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

    if (before.triggerVote !== true && after.triggerVote === true) {
      await sendVotingMessage(change.after, messageRef);
    } else if (before.triggerL2 !== true && after.triggerL2 === true) {
      await sendL2ScamAssessmentMessage(change.after, messageRef);
    }
    else if (before.vote != after.vote) {
      await updateCounts(messageRef, before.vote, after.vote);
      await updateCheckerVoteCount(before, after);
      const db = admin.firestore();
      const factCheckersSnapshot = await db.collection("factCheckers").where("isActive", "==", true).get();
      const numFactCheckers = factCheckersSnapshot.size;
      const voteCount = await getCount(messageRef, "vote");
      const irrelevantCount = await getCount(messageRef, "irrelevant");
      const scamCount = await getCount(messageRef, "scam");
      const illicitCount = await getCount(messageRef, "illicit");
      const susCount = scamCount + illicitCount;
      const voteTotal = await getCount(messageRef, "totalVoteScore");
      const truthScore = ((voteCount - irrelevantCount - susCount) > 0) ? voteTotal / (voteCount - irrelevantCount - susCount) : null;
      const thresholds = await getThresholds();
      const isSus = (susCount > parseInt(thresholds.isSus * voteCount));
      const isScam = isSus && (scamCount >= illicitCount);
      const isIllicit = isSus && !isScam;
      const isIrrelevant = (irrelevantCount > parseInt(thresholds.isIrrelevant * voteCount));
      const isAssessed = (voteCount > parseInt(thresholds.endVote * numFactCheckers)) || (isSus && voteCount > parseInt(thresholds.endVoteSus * numFactCheckers));
      return messageRef.update({
        truthScore: truthScore,
        isSus: isSus,
        isScam: isScam,
        isIllicit: isIllicit,
        isIrrelevant: isIrrelevant,
        isAssessed: isAssessed,
      });

    }
    return Promise.resolve();
  });

async function updateCounts(messageRef, previousVote, currentVote) {
  if (previousVote === null) {
    if (currentVote != null) {
      await incrementCounter(messageRef, "vote", numVoteShards.value());
    }
  } else {
    if (currentVote === null) {
      await incrementCounter(messageRef, "vote", numVoteShards.value(), -1);
    }
    if (isNaN(previousVote)) {
      await incrementCounter(messageRef, previousVote, numVoteShards.value(), -1)
    } else {
      await incrementCounter(messageRef, "totalVoteScore", numVoteShards.value(), -parseInt(previousVote));
    }
  }
  if (currentVote != null) {
    if (isNaN(currentVote)) {
      await incrementCounter(messageRef, currentVote, numVoteShards.value());
    } else {
      await incrementCounter(messageRef, "totalVoteScore", numVoteShards.value(), parseInt(currentVote));
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
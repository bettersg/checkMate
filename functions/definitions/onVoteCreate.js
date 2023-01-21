const functions = require("firebase-functions");
const { incrementCounter, getCount } = require("./common/counters");
const { getThresholds } = require("./common/utils");
const admin = require("firebase-admin");
const { defineInt } = require('firebase-functions/params');
// Define some parameters
const numVoteShards = defineInt('NUM_SHARDS_VOTE_COUNT');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.onVoteCreate = functions.region("asia-southeast1").runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID"] }).firestore.document("/messages/{messageId}/votes/{voteId}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore.
    const data = snap.data();
    const parentMessageRef = snap.ref.parent.parent;
    incrementCounter(parentMessageRef, "vote", numVoteShards.value());
    if (data.vote === "irrelevant") {
      incrementCounter(parentMessageRef, "irrelevant", numVoteShards.value());
    } else if (!isNaN(data.vote)) {
      incrementCounter(parentMessageRef, "totalVoteScore", numVoteShards.value(), parseInt(data.vote));
    }
    const db = admin.firestore();
    const factCheckersSnapshot = await db.collection("factCheckers").where("isActive", "==", true).get();
    const numFactCheckers = factCheckersSnapshot.size;
    const parentMessageSnap = await parentMessageRef.get();
    const voteCount = await getCount(parentMessageRef, "vote");
    const irrelevantCount = await getCount(parentMessageRef, "irrelevant");
    const voteTotal = await getCount(parentMessageRef, "totalVoteScore");
    const truthScore = voteTotal / voteCount;
    const thresholds = await getThresholds();
    const isIrrelevant = (irrelevantCount >= parseInt(thresholds.isIrrelevant * voteCount));
    const isAssessed = (voteCount >= parseInt(thresholds.endVote * numFactCheckers));
    return parentMessageRef.update({
      truthScore: truthScore,
      isIrrelevant: isIrrelevant,
      isAssessed: isAssessed,
    });
  });

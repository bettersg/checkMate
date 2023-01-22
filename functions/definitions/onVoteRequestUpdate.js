const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getReponsesObj, getThresholds } = require("./common/utils");
const { sendWhatsappTextListMessage, sendWhatsappButtonMessage } = require("./common/sendWhatsappMessage");
const { incrementCounter, getCount } = require("./common/counters");
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

    // if (!before.hasAgreed && after.hasAgreed && !!after?.sentMessageId) {
    //   sendScamAssessmentMessage(change.after, messageRef);
    // } else 
    if (before.isScam !== false && after.isScam === false) {
      sendVotingMessage(change.after, messageRef);
    } else if (before.vote != after.vote) {
      await updateCounts(messageRef, before.vote, after.vote)
      const db = admin.firestore();
      const factCheckersSnapshot = await db.collection("factCheckers").where("isActive", "==", true).get();
      const numFactCheckers = factCheckersSnapshot.size;
      const voteCount = await getCount(messageRef, "vote");
      const irrelevantCount = await getCount(messageRef, "irrelevant");
      const scamCount = await getCount(messageRef, "scam")
      const voteTotal = await getCount(messageRef, "totalVoteScore");
      const truthScore = voteTotal / voteCount;
      const thresholds = await getThresholds();
      const isScam = (scamCount > parseInt(thresholds.isScam * voteCount));
      const isIrrelevant = (irrelevantCount > parseInt(thresholds.isIrrelevant * voteCount));
      const isAssessed = (voteCount > parseInt(thresholds.endVote * numFactCheckers)) || (isScam && voteCount > parseInt(thresholds.endVoteScam * numFactCheckers));
      console.log(`scamCount:${scamCount}, voteCount:${voteCount}, isScam:${isScam}, isIrrelevant:${isIrrelevant}, isAssessed:${isAssessed}`);
      return messageRef.update({
        truthScore: truthScore,
        isScam: isScam,
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

async function sendScamAssessmentMessage(voteRequestSnap, messageRef) {
  const voteRequestData = voteRequestSnap.data();
  const responses = await getReponsesObj("factCheckers");
  switch (voteRequestData.platform) {
    case "Whatsapp":
      const buttons = [{
        type: "reply",
        reply: {
          id: `${messageRef.id}_${voteRequestSnap.id}_scam`,
          title: "It's a scam",
        },
      }, {
        type: "reply",
        reply: {
          id: `${messageRef.id}_${voteRequestSnap.id}_notscam`,
          title: "It's something else",
        }
      }];
      await sendWhatsappButtonMessage("factChecker", voteRequestData.whatsappNumber, responses.SCAM_ASSESSMENT_PROMPT, buttons, voteRequestData.sentMessageId)
      break;
    case "Telegram":
      break
  }
}

async function sendVotingMessage(voteRequestSnap, messageRef) {
  const messageSnap = await messageRef.get();
  const message = messageSnap.data();
  const voteRequestData = voteRequestSnap.data();
  const responses = await getReponsesObj("factCheckers");
  switch (voteRequestData.platform) {
    case "Whatsapp":
      const rows = [];
      const max_score = 5;
      for (let i = 0; i <= max_score; i++) {
        rows.push({
          id: `${messageRef.id}_${voteRequestSnap.id}_${i}`,
          title: `${i}`,
        });
      }
      rows[0].description = "Totally false";
      rows[max_score].description = "Totally true";
      rows.push({
        id: `${messageRef.id}_${voteRequestSnap.id}_irrelevant`,
        title: "No Claim Made",
        description: "The message contains no claims",
      });
      sections = [{
        rows: rows,
      }];
      switch (message.type) {
        case "text":
          setTimeout(async () => {
            await sendWhatsappTextListMessage("factChecker", voteRequestData.whatsappNumber, responses.FACTCHECK_PROMPT, "Vote here", sections, voteRequestData.sentMessageId);
          }, 3000); // seem like we need to wait some time for this because for some reason it will have error 500 otherwise.
          break;
        case "image":
          setTimeout(async () => {
            await sendWhatsappTextListMessage("factChecker", voteRequestData.whatsappNumber, responses.FACTCHECK_PROMPT, "Vote here", sections, voteRequestData.sentMessageId);
          }, 3000); // seem like we need to wait some time for this because for some reason it will have error 500 otherwise.
          break;
      }
      break;
    case "Telegram":
      break;
  }
}
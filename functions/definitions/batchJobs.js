const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendWhatsappTemplateMessage } = require("./common/sendWhatsappMessage");
const { respondToInstance } = require("./common/responseUtils");
const { Timestamp } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp();
}

async function deactivateAndRemind(context) {
  try {
    const db = admin.firestore();
    const cutoffHours = 72;
    const activeCheckMatesSnap = await db.collection("factCheckers").where("isActive", "==", true).get();
    const promisesArr = activeCheckMatesSnap.docs.map(async (doc) => {
      const lastVotedTimestamp = doc.get("lastVotedTimestamp") ?? Timestamp.fromDate(new Date(0));
      const factCheckerId = doc.id;
      const lastVotedDate = lastVotedTimestamp.toDate();
      //set cutoff to 72 hours ago
      const cutoffDate = new Date(Date.now() - cutoffHours * 60 * 60 * 1000)
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
      const voteRequestsQuerySnap = await db.collectionGroup('voteRequests')
        .where('platformId', '==', factCheckerId)
        .where('createdTimestamp', '<', cutoffTimestamp)
        .where('category', '==', null)
        .get();
      if (!voteRequestsQuerySnap.empty && lastVotedDate < cutoffDate) {
        functions.logger.log(`${factCheckerId}, ${doc.get('name')} set to inactive`);
        await doc.ref.update({ isActive: false });
        return sendWhatsappTemplateMessage("factChecker", factCheckerId, "deactivation_notification", "en", [doc.get("name") || "CheckMate", `${cutoffHours}`], [`${factCheckerId}`])
      }
    });
    await Promise.all(promisesArr);
  }
  catch (error) {
    functions.logger.error('Error in deactivateAndRemind:', error);
  }
}

async function checkConversationSessionExpiring(context) {
  try {
    const db = admin.firestore();
    const hoursAgo = 23;
    const windowStart = Timestamp.fromDate(new Date(Date.now() - hoursAgo * 60 * 60 * 1000));
    const windowEnd = Timestamp.fromDate(new Date(Date.now() - (hoursAgo + 1) * 60 * 60 * 1000));
    const unrepliedInstances = await db.collectionGroup('instances')
      .where('isReplied', '==', false)
      .where('timestamp', '<=', windowStart) //match all those earlier than 23 hours ago
      .where('timestamp', '>', windowEnd) //and all those later than 24 hours ago
      .get();
    const promisesArr = unrepliedInstances.docs.map(async (doc) => {
      await respondToInstance(doc, true);
    });
    await Promise.all(promisesArr);
  } catch (error) {
    functions.logger.error('Error in checkConversationSessionExpiring:', error);
  }
}

exports.checkSessionExpiring = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] })
  .pubsub.schedule("1 * * * *")
  .timeZone('Asia/Singapore')
  .onRun(checkConversationSessionExpiring);

exports.scheduledDeactivation = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] })
  .pubsub.schedule("11 20 * * *")
  .timeZone('Asia/Singapore')
  .onRun(deactivateAndRemind);
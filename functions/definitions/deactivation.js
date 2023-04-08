const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendWhatsappTemplateMessage } = require("./common/sendWhatsappMessage");
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
        await sendWhatsappTemplateMessage("factChecker", factCheckerId, "deactivation_notification", "en", [doc.get("name") || "CheckMate", `${cutoffHours}`], [`${factCheckerId}`])
        return doc.ref.update({ isActive: false });
      }
    });
    await Promise.all(promisesArr);
  }
  catch (error) {
    functions.logger.error('Error in deactivateAndRemind:', error);
  }
}

exports.scheduledDeactivation = functions
  .region("asia-southeast1")
  .pubsub.schedule("11 20 * * *")
  .timeZone('Asia/Singapore')
  .onRun(deactivateAndRemind);
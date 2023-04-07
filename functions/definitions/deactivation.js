const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.scheduledFunction = functions
  .region("asia-southeast1")
  .pubsub.schedule("11 20 * * *")
  .timeZone('Asia/Singapore')
  .onRun(async (context) => {
    const db = admin.firestore();
    const activeCheckMatesSnap = await db.collection("factCheckers").where("isActive", "==", true).get();
    const promisesArr = activeCheckMatesSnap.docs.map(async (doc) => {
      const id = doc.id;
      const voteRequestsQuerySnap = await db.collectionGroup('voteRequests').where('platformId', '==', factCheckerId).get();

    });
  });
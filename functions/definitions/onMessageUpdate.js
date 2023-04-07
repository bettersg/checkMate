const functions = require("firebase-functions");
const { respondToInstance } = require("./common/responseUtils");
const { Timestamp } = require('firebase-admin/firestore');

exports.onMessageUpdate = functions.region("asia-southeast1").runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"] }).firestore.document("/messages/{messageId}")
    .onUpdate(async (change, context) => {
        // Grab the current value of what was written to Firestore.
        const before = change.before;
        const after = change.after;
        if (!before.data().isAssessed && after.data().isAssessed) {
            await after.ref.update({ assessedTimestamp: Timestamp.fromDate(new Date()) });
            await replyPendingInstances(after);
        }
        return Promise.resolve();
    });

async function replyPendingInstances(docSnap) {
    const pendingSnapshot = await docSnap.ref.collection("instances").where("isReplied", "==", false).get();
    pendingSnapshot.forEach(async (instanceSnap) => {
        await respondToInstance(instanceSnap);
        await instanceSnap.ref.update({ isReplied: true, replyTimestamp: Timestamp.fromDate(new Date()) });
    });
}

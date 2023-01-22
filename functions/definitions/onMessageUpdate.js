const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getResponseToMessage, getReponsesObj } = require("./common/utils");
const { sendWhatsappTextMessage } = require("./common/sendWhatsappMessage");

exports.onMessageUpdate = functions.region("asia-southeast1").runWith({ secrets: ["WHATSAPP_TOKEN"] }).firestore.document("/messages/{messageId}")
    .onUpdate(async (change, context) => {
        // Grab the current value of what was written to Firestore.
        const before = change.before;
        const after = change.after;
        if (!before.data().isAssessed && after.data().isAssessed) {
            replyPendingInstances(after);
        }
        return Promise.resolve();
    });

async function replyPendingInstances(docRef) {
    const responses = await getReponsesObj();
    const pendingSnapshot = await docRef.ref.collection("instances").where("isReplied", "==", false).get();
    const response = getResponseToMessage(docRef, responses);
    pendingSnapshot.forEach(async (doc) => {
        const data = doc.data();
        await sendWhatsappTextMessage("user", data.from, response, data.id);
        await doc.ref.update({ isReplied: true });
    });
}

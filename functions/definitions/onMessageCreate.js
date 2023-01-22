const functions = require("firebase-functions");
const { downloadWhatsappMedia } = require("./common/downloadWhatsappMedia");
exports.onMessageCreate = functions.region("asia-southeast1").runWith({ secrets: ["WHATSAPP_TOKEN"] }).firestore.document("/messages/{messageId}")
    .onCreate(async (snap, context) => {
        // Grab the current value of what was written to Firestore.
        const data = snap.data();
        if (data.type === "image") {
            const filename = await downloadWhatsappMedia(data.mediaId, data.mimeType);
            if (filename) {
                return snap.ref.update({ storageUrl: filename });
            }
        }
        return Promise.resolve();
    });

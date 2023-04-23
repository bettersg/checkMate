const axios = require('axios');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');
const util = require('util');
const { imageHash } = require('image-hash');

const graphApiVersion = defineString("GRAPH_API_VERSION")
const imageHashSync = util.promisify(imageHash);

if (!admin.apps.length) {
    admin.initializeApp();
}

async function downloadWhatsappMedia(mediaId) {
    const token = process.env.WHATSAPP_TOKEN;
    //get download URL
    const response = await axios({
        method: "GET", // Required, HTTP method, a string, e.g. POST, GET
        url: `https://graph.facebook.com/${graphApiVersion.value()}/${mediaId}`,
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });
    let url = response?.data?.url;
    let responseBuffer;
    if (url) {
        try {
            //download image and upload to cloud storage
            responseBuffer = await axios({
                method: "GET",
                url: url,
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                responseType: "arraybuffer",
            });
        } catch (err) {
            functions.logger.log(err);
            throw new Error("Error occured while downloading and calculating hash of image");
        }
    } else {
        throw new Error("Error occured while fetching image url from Facebook");
    }
    return Buffer.from(responseBuffer.data);
}

async function getHash(buffer) {
    const result = await imageHashSync({
        data: buffer
    }, 8, true);
    return result;
};

async function getSignedUrl(storageUrl) {
    try {
        const storage = admin.storage();
        const [temporaryUrl] = await storage.bucket().file(storageUrl).getSignedUrl({
            action: "read",
            expires: Date.now() + 60 * 60 * 1000,
        });
        return temporaryUrl;
    } catch (error) {
        functions.logger.error(error);
        // You can also log the error to an external monitoring service or send an alert to the developers
        return null;
    }
}

exports.downloadWhatsappMedia = downloadWhatsappMedia;
exports.getHash = getHash;
exports.getSignedUrl = getSignedUrl;
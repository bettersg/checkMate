const axios = require('axios');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');
const crypto = require('crypto');

const graphApiVersion = defineString("GRAPH_API_VERSION")

if (!admin.apps.length) {
    admin.initializeApp();
}


async function downloadWhatsappMedia(mediaId) {
    const token = process.env.WHATSAPP_TOKEN;
    //get download URL
    response = await axios({
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

function getHash(buffer) {
    const hash = crypto.createHash('sha256')
        .update(buffer)
        .digest('hex');
    return hash;
}

exports.downloadWhatsappMedia = downloadWhatsappMedia;
exports.getHash = getHash;
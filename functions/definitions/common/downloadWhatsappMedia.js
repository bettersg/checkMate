const axios = require('axios');
const admin = require('firebase-admin');
const { defineString } = require('firebase-functions/params');

const graphApiVersion = defineString("GRAPH_API_VERSION")

if (!admin.apps.length) {
    admin.initializeApp();
}

async function downloadWhatsappMedia(mediaId, mimeType) {
    const token = process.env.WHATSAPP_TOKEN;
    let filename;
    //get download URL
    response = await axios({
        method: "GET", // Required, HTTP method, a string, e.g. POST, GET
        url: `https://graph.facebook.com/${graphApiVersion.value()}/${mediaId}`,
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });
    let url = response?.data?.url;
    if (url) {
        //download image and upload to cloud storage
        const storageBucket = admin.storage().bucket();
        filename = `images/${mediaId}.${mimeType.split('/')[1]}`
        const file = storageBucket.file(filename);
        const stream = file.createWriteStream();
        response = await axios({
            method: "GET",
            url: url,
            headers: {
                "Authorization": `Bearer ${token}`,
            },
            responseType: "stream",
        }).then(response => {
            response.data.pipe(stream);
        });
        return filename;
    }
}

exports.downloadWhatsappMedia = downloadWhatsappMedia;
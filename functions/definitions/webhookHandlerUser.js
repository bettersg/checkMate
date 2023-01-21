/*

Assigned: Elston

NOTES:

When a user sends in a msg to the fake news bot in whatsapp
    1. compare the incoming message to the existing messages in the messages collection
    2. if there is a match
        1. Add to the respective instance subcollection
    3. if no match
        1. Create new message in the messages collection and add first instance (and increment instance count)
        2. if it’s an image
            1. Download the image from whatsapp servers and put it in our cloud store
            2. Update the URL in message object

RESOURCES:

combine express with functions - https://firebase.google.com/docs/functions/http-events#using_existing_express_apps

*/
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const express = require('express');
const { sendWhatsappTextMessage } = require('./common/sendWhatsappMessage');
const { USER_BOT_RESPONSES } = require('./common/constants');
const { whatsappVerificationHandler } = require('./common/whatsappVerificationHandler');
const { mockDb } = require('./common/utils');

// if (process.env.NODE_ENV !== 'production') {
//     require('dotenv').config();
// }
if (!admin.apps.length) {
    admin.initializeApp();
}
const app = express();

// Accepts POST requests at /webhook endpoint
app.post("/whatsapp", async (req, res) => {
    if (req.body.object) {
        // console.log(JSON.stringify(req.body, null, 2));
        if (
            req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value.messages &&
            req.body.entry[0].changes[0].value.messages[0]
        ) {
            console.log(process.env.ENVIRONMENT);
            let value = req.body.entry[0].changes[0].value
            let phoneNumberId = value.metadata.phone_number_id;
            let message = value.messages[0];
            let from = message.from; // extract the phone number from the webhook payload
            let type = message.type;

            //remove later!!
            if (type == "button" || phoneNumberId != process.env.WHATSAPP_USER_BOT_PHONE_NUMBER_ID) {
                res.sendStatus(200);
                return;
            }

            const db = admin.firestore()

            const responsesRef = db.doc('systemParameters/userBotResponses');
            const supportedTypesRef = db.doc('systemParameters/supportedTypes');
            const [responsesSnapshot, supportedTypesSnapshot] = await db.getAll(responsesRef, supportedTypesRef);

            const responses = responsesSnapshot.data();



            // check that message type is supported, otherwise respond with appropriate message
            const supportedTypes = supportedTypesSnapshot.get('whatsapp') ?? ["text", "image"];
            if (!supportedTypes.includes(type)) {
                sendWhatsappTextMessage(phoneNumberId, from, responses?.UNSUPPORTED_TYPE ?? USER_BOT_RESPONSES.UNSUPPORTED_TYPE, message.id)
                res.sendStatus(200);
                return
            }
            const messageTimestamp = new Timestamp(parseInt(message.timestamp), 0);
            switch (type) {
                case "text":
                    // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
                    if (!message.text || !message.text.body) {
                        res.sendStatus(200);
                        return
                    }
                    if (message.text.body.startsWith("/")) {
                        handleSpecialCommands(message);
                        res.sendStatus(200);
                        return
                    }

                    await newTextInstanceHandler(db, {
                        text: message.text.body,
                        timestamp: messageTimestamp,
                        id: message.id || null,
                        from: from || null,
                        fromName: value.contacts[0]?.profile?.name || null,
                        isForwarded: message?.context?.forwarded || null,
                        isFrequentlyForwarded: message?.context?.frequently_forwarded || null
                    });
                    break;

                case "image":
                    await newImageInstanceHandler(db, {
                        text: message?.image?.caption || null,
                        timestamp: messageTimestamp,
                        id: message.id || null,
                        mediaId: message?.image?.id || null,
                        hash: message?.image?.sha256 || null,
                        mimeType: message?.image?.mime_type || null,
                        from: from || null,
                        fromName: value.contacts[0]?.profile?.name || null,
                        isForwarded: message?.context?.forwarded || null,
                        isFrequentlyForwarded: message?.context?.frequently_forwarded || null
                    })
                    break;
            }
        }
        res.sendStatus(200);
    } else {
        // Return a '404 Not Found' if event is not from a WhatsApp API
        res.sendStatus(404);
    }
});

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests 
app.get("/whatsapp", whatsappVerificationHandler);

async function newTextInstanceHandler(db, {
    text: text,
    timestamp: timestamp,
    id: id,
    from: from,
    fromName: fromName,
    isForwarded: isForwarded,
    isFrequentlyForwarded: isFrequentlyForwarded
}) {
    let textMatchSnapshot = await db.collection('messages').where('type', '==', 'text').where('text', '==', text).get();
    let messageId;
    if (textMatchSnapshot.empty) {
        let writeResult = await db.collection('messages').add({
            type: "text", //Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'. But as a start only support text and image
            category: "fake news", //Can be "fake news" or "scam"
            text: text, //text or caption
            firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
            isPollStarted: false, //boolean, whether or not polling has started
            isAssessed: false, //boolean, whether or not we have concluded the voting
            truthScore: null, //float, the mean truth score
            isIrrelevant: null, //bool, if majority voted irrelevant then update this
            custom_reply: null, //string
        });
        messageId = writeResult.id;
    } else {
        if (textMatchSnapshot.size > 1) {
            functions.logger.log(`strangely, more than 1 device matches the query ${message.text.body}`);
        }
        messageId = textMatchSnapshot.docs[0].id;
    }
    const _ = await db.collection('messages').doc(messageId).collection('instances').add({
        from: "whatsapp",
        id: id || null, //taken from webhook object, needed to reply
        timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
        type: "text", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
        text: text, //text or caption, taken from webhook object 
        from: from, //sender phone number, taken from webhook object 
        fromName: fromName, //sender phone number, taken from webhook object 
        isForwarded: isForwarded, //boolean, taken from webhook object
        isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
        isReplied: false,
    });
}

async function newImageInstanceHandler(db, {
    text: text,
    timestamp: timestamp,
    id: id,
    mediaId: mediaId,
    hash: hash,
    mimeType: mimeType,
    from: from,
    fromName: fromName,
    isForwarded: isForwarded,
    isFrequentlyForwarded: isFrequentlyForwarded
}) {
    let imageMatchSnapshot = await db.collection('messages').where('type', '==', 'image').where('hash', '==', hash).get();
    let messageId;
    if (imageMatchSnapshot.empty) {
        let writeResult = await db.collection('messages').add({
            type: "image", //Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'. But as a start only support text and image
            category: "fake news",
            text: text, //text or caption
            hash: hash,
            mediaId: mediaId,
            mimeType: mimeType,
            storageUrl: null,
            firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
            isPollStarted: false, //boolean, whether or not polling has started
            isAssessed: false, //boolean, whether or not we have concluded the voting
            truthScore: null, //float, the mean truth score
            isIrrelevant: null, //bool, if majority voted irrelevant then update this
            custom_reply: null, //string
        });
        messageId = writeResult.id;
    } else {
        if (imageMatchSnapshot.size > 1) {
            functions.logger.log(`strangely, more than 1 device matches the query ${message.text.body}`);
        }
        messageId = imageMatchSnapshot.docs[0].id;
    }
    const _ = await db.collection('messages').doc(messageId).collection('instances').add({
        from: "whatsapp",
        id: id || null, //taken from webhook object, needed to reply
        timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
        type: "image", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
        text: text, //text or caption, taken from webhook object 
        from: from, //sender phone number, taken from webhook object 
        fromName: fromName, //sender phone number, taken from webhook object 
        hash: hash,
        mediaId: mediaId,
        mimeType: mimeType,
        isForwarded: isForwarded, //boolean, taken from webhook object
        isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
        isReplied: false,
    });
}

function handleSpecialCommands(messageObj) {
    const command = messageObj.text.body.toLowerCase();
    if (command.startsWith('/')) {
        switch (command) {
            case '/mockdb':
                mockDb();
                return
            case '/getid':
                console.log(process.env.ENVIRONMENT);
                sendWhatsappTextMessage(process.env.WHATSAPP_USER_BOT_PHONE_NUMBER_ID, messageObj.from, `${messageObj.id}`, messageObj.id)
                return

        }
    }
}

exports.webhookHandlerUser = functions
    .region('asia-southeast1')
    .runWith({ secrets: ["WHATSAPP_USER_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN", "VERIFY_TOKEN"] })
    .https.onRequest(app);


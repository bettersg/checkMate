const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const { sendWhatsappTextMessage, markWhatsappMessageAsRead } = require('./common/sendWhatsappMessage');
const { mockDb, sleep, getReponsesObj } = require('./common/utils');
const { downloadWhatsappMedia, getHash } = require('./common/mediaUtils');
const calculateSimilarity = require('./calculateSimilarity')
const { defineString } = require('firebase-functions/params');
const runtimeEnvironment = defineString("ENVIRONMENT")

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.userHandlerWhatsapp = async function (message) {
  let from = message.from; // extract the phone number from the webhook payload
  let type = message.type;
  const db = admin.firestore()

  const supportedTypesRef = db.doc('systemParameters/supportedTypes');
  const supportedTypesSnap = await supportedTypesRef.get()
  const supportedTypes = supportedTypesSnap.get("whatsapp") || ["image", "text"]

  // check that message type is supported, otherwise respond with appropriate message
  if (!supportedTypes.includes(type)) {
    const responses = await getReponsesObj("users")
    sendWhatsappTextMessage("user", from, responses?.UNSUPPORTED_TYPE, message.id)
    markWhatsappMessageAsRead("user", message.id);
    return
  }
  const messageTimestamp = new Timestamp(parseInt(message.timestamp), 0);
  switch (type) {
    case "text":
      // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
      if (!message.text || !message.text.body) {
        break;
      }
      if (message.text.body === "Show me how CheckMate works!") {
        await handleNewUser(message);
        break;
      }
      if (message.text.body === "<Demo Scam Message>") {
        await respondToDemoScam(message);
        break;
      }

      await newTextInstanceHandler(db, {
        text: message.text.body,
        timestamp: messageTimestamp,
        id: message.id || null,
        from: from || null,
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
        mimeType: message?.image?.mime_type || null,
        from: from || null,
        isForwarded: message?.context?.forwarded || null,
        isFrequentlyForwarded: message?.context?.frequently_forwarded || null
      })
      break;
  }
  markWhatsappMessageAsRead("user", message.id);
}

async function newTextInstanceHandler(db, {
  text: text,
  timestamp: timestamp,
  id: id,
  from: from,
  isForwarded: isForwarded,
  isFrequentlyForwarded: isFrequentlyForwarded
}) {
  // 1 - check if the exact same message exists in database
  let textMatchSnapshot = await db.collection('messages').where('type', '==', 'text').where('text', '==', text).get();
  let messageId;
  if (textMatchSnapshot.empty) {
    // 2 - if there is no exact match, then perform a cosine similarity calculation
    let similarity = calculateSimilarity(text)
    if (similarity != {}) {
      const bestMatchingDocument = similarity.message
      const similarityScore = similarity.score
      console.log(bestMatchingDocument)
      console.log(similarityScore)
    }
    let writeResult = await db.collection('messages').add({
      type: "text", //Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'. But as a start only support text and image
      category: "fake news", //Can be "fake news" or "scam"
      text: text, //text or caption
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: false, //boolean, whether or not we have concluded the voting
      truthScore: null, //float, the mean truth score
      isIrrelevant: null, //bool, if majority voted irrelevant then update this
      isScam: null,
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
    source: "whatsapp",
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "text", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: text, //text or caption, taken from webhook object 
    from: from, //sender phone number, taken from webhook object 
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
  mimeType: mimeType,
  from: from,
  isForwarded: isForwarded,
  isFrequentlyForwarded: isFrequentlyForwarded
}) {
  let filename;
  //get response buffer
  let buffer = await downloadWhatsappMedia(mediaId, mimeType);
  const hash = await getHash(buffer);
  let imageMatchSnapshot = await db.collection('messages').where('type', '==', 'image').where('hash', '==', hash).get();
  let messageId;
  if (imageMatchSnapshot.empty) {
    const storageBucket = admin.storage().bucket();
    filename = `images/${mediaId}.${mimeType.split('/')[1]}`
    const file = storageBucket.file(filename);
    const stream = file.createWriteStream();
    stream.on('error', (err) => {
      functions.logger.log(err);
    });

    stream.on('finish', () => {
      functions.logger.log(`${filename} has been uploaded`);
    });

    stream.end(buffer);
    let writeResult = await db.collection('messages').add({
      type: "image", //Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'. But as a start only support text and image
      category: "fake news",
      text: text, //text or caption
      hash: hash,
      mediaId: mediaId,
      mimeType: mimeType,
      storageUrl: filename,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: false, //boolean, whether or not we have concluded the voting
      truthScore: null, //float, the mean truth score
      isScam: null,
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
    source: "whatsapp",
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "image", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: text, //text or caption, taken from webhook object 
    from: from, //sender phone number, taken from webhook object 
    hash: hash,
    mediaId: mediaId,
    mimeType: mimeType,
    isForwarded: isForwarded, //boolean, taken from webhook object
    isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
    isReplied: false,
  });
}

async function handleNewUser(messageObj) {
  const db = admin.firestore();
  const responses = await getReponsesObj("users");
  const userRef = db.collection('users').doc(messageObj.from);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    const messageTimestamp = new Timestamp(parseInt(messageObj.timestamp), 0);
    await userRef.set({
      instanceCount: 0,
      onboardMessageReceiptTime: messageTimestamp,
    })
  };
  let res = await sendWhatsappTextMessage("user", messageObj.from, responses.DEMO_SCAM_MESSAGE);
  await sleep(2000);
  await sendWhatsappTextMessage("user", messageObj.from, responses?.DEMO_SCAM_PROMPT, res.data.messages[0].id);
}

async function respondToDemoScam(messageObj) {
  const responses = await getReponsesObj("users")
  await sendWhatsappTextMessage("user", messageObj.from, responses?.SCAM, messageObj.id);
  await sleep(2000);
  await sendWhatsappTextMessage("user", messageObj.from, responses?.ONBOARDING_END);
}
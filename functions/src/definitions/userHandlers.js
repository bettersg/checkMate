const functions = require("firebase-functions")
const admin = require("firebase-admin")
const { Timestamp } = require("firebase-admin/firestore")
const {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
  sendWhatsappButtonMessage,
} = require("./common/sendWhatsappMessage")
const {
  mockDb,
  sleep,
  stripPhone,
  stripUrl,
  hashMessage,
} = require("./common/utils")
const { getResponsesObj } = require("./common/responseUtils")
const { downloadWhatsappMedia, getHash } = require("./common/mediaUtils")
const { calculateSimilarity } = require("./calculateSimilarity")
const { getEmbedding } = require("./common/machineLearningServer/operations")
const { defineString } = require("firebase-functions/params")
const runtimeEnvironment = defineString("ENVIRONMENT")
const similarityThreshold = defineString("SIMILARITY_THRESHOLD")
const { classifyText } = require("./common/classifier")

if (!admin.apps.length) {
  admin.initializeApp()
}

exports.userHandlerWhatsapp = async function (message) {
  let from = message.from // extract the phone number from the webhook payload
  let type = message.type
  const db = admin.firestore()

  const responses = await getResponsesObj("user")

  //check whether new user
  const userRef = db.collection("users").doc(from)
  const userSnap = await userRef.get()
  const messageTimestamp = new Timestamp(parseInt(message.timestamp), 0)
  const isFirstTimeUser = !userSnap.exists
  let triggerOnboarding = isFirstTimeUser
  if (isFirstTimeUser) {
    await userRef.set({
      instanceCount: 0,
      firstMessageReceiptTime: messageTimestamp,
      firstMessageType: "normal",
      lastSent: null,
    })
  }

  switch (type) {
    case "text":
      // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
      if (!message.text || !message.text.body) {
        break
      }
      if (
        message.text.body.toLowerCase() ===
        "Show me how CheckMate works!".toLowerCase()
      ) {
        if (isFirstTimeUser) {
          await userRef.update({
            firstMessageType: "prepopulated",
          })
        } else {
          triggerOnboarding = true //we still want to show him the onboarding message.
        }
        break
      }

      await newTextInstanceHandler(
        {
          text: message.text.body,
          timestamp: messageTimestamp,
          id: message.id || null,
          from: from || null,
          isForwarded: message?.context?.forwarded || null,
          isFrequentlyForwarded: message?.context?.frequently_forwarded || null,
        },
        isFirstTimeUser
      )
      break

    case "image":
      await newImageInstanceHandler(
        {
          text: message?.image?.caption || null,
          timestamp: messageTimestamp,
          id: message.id || null,
          mediaId: message?.image?.id || null,
          mimeType: message?.image?.mime_type || null,
          from: from || null,
          isForwarded: message?.context?.forwarded || null,
          isFrequentlyForwarded: message?.context?.frequently_forwarded || null,
        },
        isFirstTimeUser
      )
      break

    case "interactive":
      // handle consent here
      const interactive = message.interactive
      switch (interactive.type) {
        case "button_reply":
          await onButtonReply(interactive.button_reply.id, message)
          break
      }
      break

    default:
      sendWhatsappTextMessage(
        "user",
        from,
        responses?.UNSUPPORTED_TYPE,
        message.id
      )
      break
  }
  if (triggerOnboarding) {
    await newUserHandler(from)
  }
  markWhatsappMessageAsRead("user", message.id)
}

async function newTextInstanceHandler(
  {
    text: text,
    timestamp: timestamp,
    id: id,
    from: from,
    isForwarded: isForwarded,
    isFrequentlyForwarded: isFrequentlyForwarded,
  },
  isFirstTimeUser
) {
  const db = admin.firestore()
  let hasMatch = false
  let messageRef
  const machineCategory = await classifyText(text)
  if (isFirstTimeUser && machineCategory === "irrelevant") {
    await db.collection("users").doc(from).update({
      firstMessageType: "irrelevant",
    })
    return
  }
  let matchType = "none" // will be set to either "exact", "stripped", or "similarity"
  let similarity
  let embedding
  // 1 - check if the exact same message exists in database
  try {
    embedding = await getEmbedding(text)
    similarity = await calculateSimilarity(embedding)
  } catch (error) {
    functions.logger.error("Error in calculateSimilarity:", error)
    similarity = {}
  }
  let bestMatchingDocumentRef
  let bestMatchingText
  let similarityScore = 0
  let matchedParentMessageRef

  if (similarity != {}) {
    bestMatchingDocumentRef = similarity.ref
    bestMatchingText = similarity.message
    similarityScore = similarity.score
    matchedParentMessageRef = similarity.parent
  }
  hasMatch = similarityScore > parseFloat(similarityThreshold.value())

  if (!hasMatch) {
    let writeResult = await db.collection("messages").add({
      type: "text", //Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'. But as a start only support text and image
      machineCategory: machineCategory, //Can be "fake news" or "scam"
      isMachineCategorised: machineCategory === "irrelevant" ? true : false,
      text: text, //text or caption
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: machineCategory === "irrelevant" ? true : false, //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      isIrrelevant: machineCategory === "irrelevant" ? true : null, //bool, if majority voted irrelevant then update this
      isSus: null,
      isScam: null,
      isSpam: null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: null,
      primaryCategory: machineCategory === "irrelevant" ? "irrelevant" : null,
      custom_reply: null, //string
      instanceCount: 0,
    })
    messageRef = writeResult
  } else {
    messageRef = matchedParentMessageRef
  }
  const _ = await messageRef.collection("instances").add({
    source: "whatsapp",
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "text", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: text, //text or caption, taken from webhook object
    from: from, //sender phone number, taken from webhook object
    isForwarded: isForwarded, //boolean, taken from webhook object
    isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
    isReplied: false,
    isReplyForced: null,
    replyCategory: null,
    replyTimestamp: null,
    matchType: matchType,
    scamShieldConsent: null,
    embedding: embedding,
    closestMatch: {
      instanceRef: bestMatchingDocumentRef ?? null,
      text: bestMatchingText ?? null,
      score: similarityScore ?? null,
      parentRef: matchedParentMessageRef ?? null,
      algorithm: "all-MiniLM-L6-v2",
    },
  })
}

async function newImageInstanceHandler({
  text: text,
  timestamp: timestamp,
  id: id,
  mediaId: mediaId,
  mimeType: mimeType,
  from: from,
  isForwarded: isForwarded,
  isFrequentlyForwarded: isFrequentlyForwarded,
  isFirstTimeUser,
}) {
  const db = admin.firestore()
  let filename
  //get response buffer
  let buffer = await downloadWhatsappMedia(mediaId, mimeType)
  const hash = await getHash(buffer)
  let imageMatchSnapshot = await db
    .collection("messages")
    .where("type", "==", "image")
    .where("hash", "==", hash)
    .where("assessmentExpired", "==", false)
    .get()
  let messageId
  if (imageMatchSnapshot.empty) {
    const storageBucket = admin.storage().bucket()
    filename = `images/${mediaId}.${mimeType.split("/")[1]}`
    const file = storageBucket.file(filename)
    const stream = file.createWriteStream()
    await new Promise((resolve, reject) => {
      stream.on("error", reject)
      stream.on("finish", resolve)
      stream.end(buffer)
    })
    let writeResult = await db.collection("messages").add({
      type: "image", //Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'. But as a start only support text and image
      machineCategory: null,
      isMachineCategorised: false,
      text: text, //text or caption
      hash: hash,
      mediaId: mediaId,
      mimeType: mimeType,
      storageUrl: filename,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: false, //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      isSus: null,
      isScam: null,
      isSpam: null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: null,
      isIrrelevant: null, //bool, if majority voted irrelevant then update this
      primaryCategory: null,
      custom_reply: null, //string
      instanceCount: 0,
    })
    messageId = writeResult.id
  } else {
    if (imageMatchSnapshot.size > 1) {
      functions.logger.log(
        `strangely, more than 1 device matches the image query ${hash}`
      )
    }
    messageId = imageMatchSnapshot.docs[0].id
  }
  const _ = await db
    .collection("messages")
    .doc(messageId)
    .collection("instances")
    .add({
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
      isReplyForced: null,
      replyCategory: null,
      replyTimestamp: null,
      scamShieldConsent: null,
    })
}

async function onboardNewUser(from) {
  const responses = await getResponsesObj("user")
  await sendWhatsappTextMessage("user", from, responses.ONBOARDING, null, true)
}

async function newUserHandler(from) {
  const responses = await getResponsesObj("user")
  const buttons = [
    {
      type: "reply",
      reply: {
        id: "newUser_onboardingYes",
        title: "Yes, show me!",
      },
    },
    {
      type: "reply",
      reply: {
        id: "newUser_onboardingNo",
        title: "No, I'm good",
      },
    },
  ]
  await sendWhatsappButtonMessage("user", from, responses?.NEW_USER, buttons)
}

async function onButtonReply(buttonId, messageObj, platform = "whatsapp") {
  const db = admin.firestore()
  const from = messageObj.from
  const responses = await getResponsesObj("user")
  const [type, ...rest] = buttonId.split("_")
  let instancePath, selection
  switch (type) {
    case "scamshieldConsent":
      ;[instancePath, selection] = rest
      const instanceRef = db.doc(instancePath)
      const updateObj = {}
      let replyText
      if (selection === "consent") {
        updateObj.scamShieldConsent = true
        replyText = responses?.SCAMSHIELD_ON_CONSENT
      } else if (selection === "decline") {
        updateObj.scamShieldConsent = false
        replyText = responses?.SCAMSHIELD_ON_DECLINE
      }
      await instanceRef.update(updateObj)
      await sendWhatsappTextMessage("user", from, replyText)
      break
    case "scamshieldExplain":
      let messageId
      ;[instancePath, messageId] = rest
      await sendWhatsappTextMessage(
        "user",
        from,
        responses?.SCAMSHIELD_EXPLAINER,
        null,
        true
      )
      const buttons = [
        {
          type: "reply",
          reply: {
            id: `scamshieldConsent_${instancePath}_consent`,
            title: "Yes",
          },
        },
        {
          type: "reply",
          reply: {
            id: `scamshieldConsent_${instancePath}_decline`,
            title: "No",
          },
        },
      ]
      await sleep(2000)
      await sendWhatsappButtonMessage(
        "user",
        from,
        responses.SCAMSHIELD_SEEK_CONSENT,
        buttons,
        messageId
      )
      break

    case "newUser":
      ;[selection] = rest
      switch (selection) {
        case "onboardingYes":
          await onboardNewUser(from)
          break
        case "onboardingNo":
          await sendWhatsappTextMessage("user", from, responses?.GET_STARTED)
          break
      }
      break
  }
}

const functions = require("firebase-functions")
const admin = require("firebase-admin")
const { Timestamp } = require("firebase-admin/firestore")
const {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
  sendWhatsappButtonMessage,
} = require("./common/sendWhatsappMessage")
const { sendDisputeNotification } = require("./common/sendMessage")
const { sleep, hashMessage } = require("./common/utils")
const { getCount } = require("./common/counters")
const {
  getResponsesObj,
  sendMenuMessage,
  sendInterimUpdate,
  sendVotingStats,
  respondToInterimFeedback,
} = require("./common/responseUtils")
const { downloadWhatsappMedia, getHash } = require("./common/mediaUtils")
const { calculateSimilarity } = require("./calculateSimilarity")
const {
  getEmbedding,
  performOCR,
} = require("./common/machineLearningServer/operations")
const { defineString } = require("firebase-functions/params")
const runtimeEnvironment = defineString("ENVIRONMENT")
const similarityThreshold = defineString("SIMILARITY_THRESHOLD")
const { classifyText } = require("./common/classifier")
const { getSignedUrl } = require("./common/mediaUtils")

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
  let step
  if (isFirstTimeUser) {
    await userRef.set({
      instanceCount: 0,
      firstMessageReceiptTime: messageTimestamp,
      firstMessageType: "normal",
      lastSent: null,
      satisfactionSurveyLastSent: null,
      initialJourney: {},
    })
  }
  const firstMessageReceiptTime = isFirstTimeUser
    ? messageTimestamp
    : userSnap.get("firstMessageReceiptTime")
  const isNewlyJoined =
    messageTimestamp.seconds - firstMessageReceiptTime.seconds < 86400

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
        step = "text_prepopulated"
        if (isFirstTimeUser) {
          await userRef.update({
            firstMessageType: "prepopulated",
          })
        } else {
          triggerOnboarding = true //we still want to show him the onboarding message.
        }
        break
      }

      if (message.text.body.toLowerCase() === "menu") {
        step = "text_menu"
        await sendMenuMessage(from, "MENU_PREFIX", "whatsapp", null, null)
        break
      }
      step = await newTextInstanceHandler(
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
      step = await newImageInstanceHandler(
        {
          caption: message?.image?.caption || null,
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
          step = await onButtonReply(message)
          break
        case "list_reply":
          step = await onTextListReceipt(message)
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
  if (isNewlyJoined && step) {
    const timestampKey =
      messageTimestamp.toDate().toISOString().slice(0, -5) + "Z"
    await userRef.update({
      [`initialJourney.${timestampKey}`]: step,
    })
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
  const machineCategory = (await classifyText(text)) ?? "error"
  if (isFirstTimeUser && machineCategory.includes("irrelevant")) {
    await db.collection("users").doc(from).update({
      firstMessageType: "irrelevant",
    })
    return Promise.resolve(`text_machine_${machineCategory}`)
  }
  let matchType = "none" // will be set to either "similarity" or "none"
  let similarity
  let embedding
  // 1 - check if the exact same message exists in database
  try {
    embedding = await getEmbedding(text)
    similarity = await calculateSimilarity(embedding, null)
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

  if (
    similarityScore > parseFloat(similarityThreshold.value()) &&
    similarity?.caption == null //prevent matching to images with caption
  ) {
    hasMatch = true
    matchType = "similarity"
  }

  if (!hasMatch) {
    let writeResult = await db.collection("messages").add({
      machineCategory: machineCategory, //Can be "fake news" or "scam"
      isMachineCategorised:
        machineCategory !== "unsure" && machineCategory !== "info",
      text: text, //text
      caption: null,
      latestInstance: null,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: machineCategory !== "unsure" && machineCategory !== "info", //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      isIrrelevant:
        !!machineCategory && machineCategory.includes("irrelevant")
          ? true
          : null, //bool, if majority voted irrelevant then update this
      isScam: machineCategory === "scam" ? true : null,
      isIllicit: machineCategory === "illicit" ? true : null,
      isSpam: machineCategory === "spam" ? true : null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: machineCategory === "info" ? true : null,
      primaryCategory:
        machineCategory !== "unsure" && machineCategory !== "info"
          ? machineCategory.split("_")[0] //in case of irrelevant_length, we want to store irrelevant
          : null,
      customReply: null, //string
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
    caption: null,
    captionHash: null,
    from: from, //sender phone number, taken from webhook object
    isForwarded: isForwarded, //boolean, taken from webhook object
    isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
    isReplied: false,
    isInterimPromptSent: null,
    isInterimUseful: null,
    isInterimReplySent: null,
    isMeaningfulInterimReplySent: null,
    isReplyForced: null,
    isMatched: hasMatch,
    isReplyImmediate: null,
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
    isSatisfactionSurveySent: null,
    satisfactionScore: null,
  })
  return Promise.resolve(`text_machine_${machineCategory}`)
}

async function newImageInstanceHandler({
  caption: caption,
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
  let messageRef
  let hasMatch = false
  let captionHash = caption ? hashMessage(caption) : null

  //get response buffer
  let buffer = await downloadWhatsappMedia(mediaId, mimeType)
  const hash = await getHash(buffer)

  //upload to storage
  const storageBucket = admin.storage().bucket()
  filename = `images/${mediaId}.${mimeType.split("/")[1]}`
  const file = storageBucket.file(filename)
  const stream = file.createWriteStream()
  await new Promise((resolve, reject) => {
    stream.on("error", reject)
    stream.on("finish", resolve)
    stream.end(buffer)
  })
  let matchType = "none" // will be set to either "similarity" or "image" or "none"
  //check if identical image exists among instances
  let imageMatchSnapshot = await db
    .collectionGroup("instances")
    .where("hash", "==", hash)
    .where("captionHash", "==", captionHash)
    .get()
  if (!imageMatchSnapshot.empty) {
    hasMatch = true
    matchType = "image"
  }
  //do OCR

  let ocrSuccess
  let sender
  let isConvo
  let extractedMessage
  let machineCategory
  if (!hasMatch) {
    const temporaryUrl = await getSignedUrl(filename)
    if (temporaryUrl) {
      try {
        const ocrOutput = await performOCR(temporaryUrl)
        sender = ocrOutput?.sender ?? null
        isConvo = ocrOutput?.is_convo ?? null

        //extractedMessage = ocrOutput?.extracted_message ?? null
        const textMessages = ocrOutput?.output?.text_messages ?? []
        const longestLHSMessage = textMessages
          .filter((message) => message.is_left)
          .reduce(
            (longest, current) => {
              return current.text.length > longest.text.length
                ? current
                : longest
            },
            { text: "" }
          ) // Initial value with an empty text property
        extractedMessage = longestLHSMessage.text || null
        machineCategory = ocrOutput?.prediction ?? null
        ocrSuccess = true
      } catch (error) {
        functions.logger.error("Error in performOCR:", error)
      }
    } else {
      functions.logger.warn("Problem creating URL")
    }
  } else {
    //this is so that we don't do an unnecessary OCR which is more compute intensive.
    const matchedInstanceSnap = imageMatchSnapshot.docs[0]
    sender = matchedInstanceSnap.get("sender") ?? null
    isConvo = matchedInstanceSnap.get("isConvo") ?? null
    extractedMessage = matchedInstanceSnap.get("text") ?? null
    machineCategory = matchedInstanceSnap.get("machineCategory") ?? null
  }

  let similarity
  let embedding
  let bestMatchingDocumentRef
  let bestMatchingText
  let similarityScore = 0
  let matchedParentMessageRef

  if (ocrSuccess && isConvo && !!extractedMessage && !hasMatch) {
    try {
      embedding = await getEmbedding(extractedMessage)
      similarity = await calculateSimilarity(embedding, captionHash)
    } catch (error) {
      functions.logger.error("Error in calculateSimilarity:", error)
      embedding = null
      similarity = {}
    }
    if (similarity != {}) {
      bestMatchingDocumentRef = similarity.ref
      bestMatchingText = similarity.message
      similarityScore = similarity.score
      matchedParentMessageRef = similarity.parent
    }
    if (similarityScore > parseFloat(similarityThreshold.value())) {
      hasMatch = true
      matchType = "similarity"
    }
  }

  if (!hasMatch) {
    let writeResult = await db.collection("messages").add({
      machineCategory: machineCategory, //Can be "fake news" or "scam"
      isMachineCategorised:
        machineCategory !== "unsure" && machineCategory !== "info",
      text: extractedMessage ?? null, //text
      caption: caption ?? null,
      latestInstance: null,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: machineCategory !== "unsure" && machineCategory !== "info", //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      isIrrelevant:
        !!machineCategory && machineCategory.includes("irrelevant")
          ? true
          : null, //bool, if majority voted irrelevant then update this
      isScam: machineCategory === "scam" ? true : null,
      isIllicit: machineCategory === "illicit" ? true : null,
      isSpam: machineCategory === "spam" ? true : null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: machineCategory === "info" ? true : null,
      primaryCategory:
        machineCategory !== "unsure" && machineCategory !== "info"
          ? machineCategory.split("_")[0] //in case of irrelevant_length, we want to store irrelevant
          : null,
      customReply: null, //string
      instanceCount: 0,
    })
    messageRef = writeResult
  } else {
    if (matchType === "image") {
      if (imageMatchSnapshot.size > 1) {
        functions.logger.log(
          `strangely, more than 1 device matches the image query ${hash}`
        )
      }
      messageRef = imageMatchSnapshot.docs[0].ref.parent.parent
    } else if (matchType === "similarity") {
      messageRef = matchedParentMessageRef
    }
  }
  const _ = await messageRef.collection("instances").add({
    source: "whatsapp",
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "image", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: extractedMessage ?? null, //text extracted from OCR if relevant
    caption: caption ?? null,
    captionHash: captionHash,
    sender: sender, //sender name or number extracted from OCR
    isConvo: isConvo, //boolean, whether or not the image is that of a conversation
    from: from, //sender phone number, taken from webhook object
    hash: hash,
    mediaId: mediaId,
    mimeType: mimeType,
    storageUrl: filename,
    isForwarded: isForwarded, //boolean, taken from webhook object
    isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
    isReplied: false,
    isInterimPromptSent: null,
    isInterimUseful: null,
    isInterimReplySent: null,
    isMeaningfulInterimReplySent: null,
    isReplyForced: null,
    isMatched: hasMatch,
    isReplyImmediate: null,
    replyCategory: null,
    replyTimestamp: null,
    matchType: matchType,
    scamShieldConsent: null,
    embedding: embedding ?? null,
    closestMatch: {
      instanceRef: bestMatchingDocumentRef ?? null,
      text: bestMatchingText ?? null,
      score: similarityScore ?? null,
      parentRef: matchedParentMessageRef ?? null,
      algorithm: "all-MiniLM-L6-v2",
    },
    isSatisfactionSurveySent: null,
    satisfactionScore: null,
  })
  return Promise.resolve("image")
}

async function newUserHandler(from) {
  await sendMenuMessage(from, "NEW_USER_MENU_PREFIX", "whatsapp", null, null)
}

async function onButtonReply(messageObj, platform = "whatsapp") {
  const db = admin.firestore()
  const buttonId = messageObj.interactive.button_reply.id
  const from = messageObj.from
  const responses = await getResponsesObj("user")
  const [type, ...rest] = buttonId.split("_")
  let instancePath, selection, instanceRef, updateObj
  switch (type) {
    case "scamshieldConsent":
      ;[instancePath, selection] = rest
      instanceRef = db.doc(instancePath)
      updateObj = {}
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
    case "votingResults":
      let scamShield
      ;[instancePath, ...scamShield] = rest
      const triggerScamShieldConsent =
        scamShield.length > 0 && scamShield[0] === "scamshield"
      await sendVotingStats(instancePath, triggerScamShieldConsent)
      break
    case "sendInterim":
      ;[instancePath] = rest
      await sendInterimUpdate(instancePath)
      break
    case "feedbackInterim":
      ;[instancePath, selection] = rest
      await respondToInterimFeedback(instancePath, selection)
      break
  }
  const step = type + (selection ? `_${selection}` : "")
  return Promise.resolve(step)
}

async function onTextListReceipt(messageObj, platform = "whatsapp") {
  const listId = messageObj.interactive.list_reply.id
  const from = messageObj.from
  const db = admin.firestore()
  const responses = await getResponsesObj("user")
  const [type, selection, ...rest] = listId.split("_")
  let response, instancePath
  const step = `${type}_${selection}`
  switch (type) {
    case "menu":
      switch (selection) {
        case "check":
          response = responses.PROCEED_TO_SEND
          break
        case "help":
          response = responses.HOW_TO
          break

        case "about":
          response = responses.LEARN_MORE
          break

        case "feedback":
          response = responses.FEEDBACK
          break

        case "contact":
          const nameObj = { formatted_name: "CheckMate", suffix: "CheckMate" }
          response = responses.CONTACT
          await sendWhatsappContactMessage(
            "user",
            from,
            runtimeEnvironment.value() === "PROD"
              ? "+65 80432188"
              : "+1 555-093-3685",
            nameObj,
            "https://checkmate.sg"
          )
          await sleep(3000)
          break
        case "dispute":
          ;[instancePath] = rest
          const instanceRef = db.doc(instancePath)
          const parentMessageRef = instanceRef.parent.parent
          const instanceSnap = await instanceRef.get()
          const parentMessageSnapshot = await parentMessageRef.get()
          const instanceType = instanceSnap.get("type")
          const text = instanceSnap.get("text")
          const category = parentMessageSnapshot.get("primaryCategory")
          await sendDisputeNotification(
            from,
            instancePath,
            instanceType,
            text,
            category
          )
          response = responses.DISPUTE
          break
      }
      break
    case "satisfactionSurvey":
      ;[instancePath] = rest
      const instanceRef = db.doc(instancePath)
      //check if selection is number
      if (!isNaN(selection)) {
        const selectionNumber = parseInt(selection)
        await instanceRef.update({
          satisfactionScore: selectionNumber,
        })
      } else {
        functions.logger.warn(
          `invalid selection for satisfaction survey: ${selection}`
        )
      }
      response = responses.SATISFACTION_SURVEY_THANKS
      break
  }
  await sendWhatsappTextMessage("user", from, response, null, true)
  return Promise.resolve(step)
}

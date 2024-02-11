import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { Timestamp } from "firebase-admin/firestore"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
} from "../common/sendWhatsappMessage"
import { sendDisputeNotification } from "../common/sendMessage"
import {
  sleep,
  hashMessage,
  normalizeSpaces,
  checkMessageId,
} from "../common/utils"
import {
  getResponsesObj,
  sendMenuMessage,
  sendInterimUpdate,
  sendVotingStats,
  sendReferralMessage,
  sendRationalisation,
  respondToRationalisationFeedback,
  updateLanguageAndSendMenu,
  sendLanguageSelection,
  sendBlast,
  respondToBlastFeedback,
} from "../common/responseUtils"
import {
  downloadWhatsappMedia,
  getHash,
  getSignedUrl,
  getCloudStorageUrl,
} from "../common/mediaUtils"
import { anonymiseMessage, rationaliseMessage } from "../common/genAI"
import { calculateSimilarity } from "../common/calculateSimilarity"
import { performOCR } from "../common/machineLearningServer/operations"
import { defineString } from "firebase-functions/params"
import { classifyText } from "../common/classifier"
import { FieldValue } from "@google-cloud/firestore"
import Hashids from "hashids"
import { Message } from "../../types"

const runtimeEnvironment = defineString("ENVIRONMENT")
const similarityThreshold = defineString("SIMILARITY_THRESHOLD")

if (!admin.apps.length) {
  admin.initializeApp()
}

const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)

const db = admin.firestore()

const userHandlerWhatsapp = async function (message: Message) {
  if (!message?.id) {
    functions.logger.error("No message id")
    return
  }
  if (await checkMessageId(message.id)) {
    functions.logger.warn(`Message ${message.id} already exists`)
    return
  }

  let from = message.from // extract the phone number from the webhook payload
  let type = message.type
  const responses = await getResponsesObj("user", from)

  //check whether new user
  const userRef = db.collection("users").doc(from)
  const userSnap = await userRef.get()
  const messageTimestamp = new Timestamp(Number(message.timestamp), 0)
  const isFirstTimeUser = !userSnap.exists
  let triggerOnboarding = isFirstTimeUser
  let step
  if (isFirstTimeUser) {
    await createNewUser(userRef, messageTimestamp)
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
      const textNormalised = normalizeSpaces(message.text.body).toLowerCase() //normalise spaces needed cos of potential &nbsp when copying message on desktop whatsapp
      if (
        textNormalised.startsWith(
          responses?.REFERRAL_PREPOPULATED_PREFIX.split(
            "{{code}}"
          )[0].toLowerCase()
        ) &&
        textNormalised.endsWith(
          responses?.REFERRAL_PREPOPULATED_PREFIX.split("{{code}}")
            .slice(-1)[0]
            .toLowerCase()
        )
      ) {
        step = "text_prepopulated"
        if (isFirstTimeUser) {
          await referralHandler(message.text.body, from)
        } else {
          await sendMenuMessage(from, "MENU_PREFIX", "whatsapp", null, null)
        }
        break
      }
      if (checkMenu(message.text.body)) {
        step = "text_menu"
        await sendMenuMessage(from, "MENU_PREFIX", "whatsapp", null, null)
        break
      }
      step = await newTextInstanceHandler({
        text: message.text.body,
        timestamp: messageTimestamp,
        id: message.id,
        from: from || null,
        isForwarded: message?.context?.forwarded || null,
        isFrequentlyForwarded: message?.context?.frequently_forwarded || null,
        isFirstTimeUser,
      })
      break

    case "image":
      step = await newImageInstanceHandler({
        caption: message?.image?.caption || null,
        timestamp: messageTimestamp,
        id: message.id,
        mediaId: message?.image?.id || null,
        mimeType: message?.image?.mime_type || null,
        from: from || null,
        isForwarded: message?.context?.forwarded || null,
        isFrequentlyForwarded: message?.context?.frequently_forwarded || null,
        isFirstTimeUser,
      })
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

    case "button":
      const button = message.button
      switch (button.text) {
        case "Get Latest Update":
          await sendBlast(from)
          break
        case "Unsubscribe":
          await toggleUserSubscription(from, false)
          break
        case "Get Referral Message":
          await sendReferralMessage(from)
          break
        default:
          functions.logger.error("Unsupported button type:", button.text)
          await sendWhatsappTextMessage(
            "user",
            from,
            responses.GENERIC_ERROR,
            null,
            true
          )
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

async function newTextInstanceHandler({
  text,
  timestamp,
  id,
  from,
  isForwarded,
  isFrequentlyForwarded,
  isFirstTimeUser,
}: {
  text: string
  timestamp: Timestamp
  id: string
  from: string | null
  isForwarded: boolean | null
  isFrequentlyForwarded: boolean | null
  isFirstTimeUser: boolean
}) {
  let hasMatch = false
  let messageRef: FirebaseFirestore.DocumentReference | null = null
  let messageUpdateObj: Object | null = null
  const machineCategory = (await classifyText(text)) ?? "error"
  if (from && isFirstTimeUser && machineCategory.includes("irrelevant")) {
    await db.collection("users").doc(from).update({
      firstMessageType: "irrelevant",
    })
    return Promise.resolve(`text_machine_${machineCategory}`)
  }
  let matchType = "none" // will be set to either "similarity" or "none"
  let similarity
  let embedding
  let textHash = hashMessage(text)
  // 1 - check if the exact same message exists in database
  try {
    ;({ embedding, similarity } = await calculateSimilarity(
      text,
      textHash,
      null
    ))
  } catch (error) {
    functions.logger.error("Error in calculateSimilarity:", error)
    similarity = {}
  }
  let bestMatchingDocumentRef
  let bestMatchingText
  let similarityScore = 0
  let matchedParentMessageRef = null

  if (
    similarity.ref &&
    similarity.message &&
    similarity.score &&
    similarity.parent
  ) {
    bestMatchingDocumentRef = similarity.ref
    bestMatchingText = similarity.message
    similarityScore = similarity.score
    matchedParentMessageRef = similarity.parent
  }

  if (similarityScore > parseFloat(similarityThreshold.value())) {
    hasMatch = true
    matchType = similarityScore == 1 ? "exact" : "similarity"
  }

  if (!hasMatch) {
    const isMachineAssessed = !!(
      machineCategory &&
      machineCategory !== "error" &&
      machineCategory !== "unsure" &&
      machineCategory !== "info"
    )

    let strippedMessage = await anonymiseMessage(text, true)

    if (strippedMessage && machineCategory === "legitimate") {
      strippedMessage = await anonymiseMessage(strippedMessage, false) //won't run for now till machineCategory returns legitimate
    }

    let rationalisation: null | string = null
    if (
      isMachineAssessed &&
      strippedMessage &&
      !machineCategory.includes("irrelevant")
    ) {
      rationalisation = await rationaliseMessage(text, machineCategory)
    }
    messageRef = db.collection("messages").doc()
    messageUpdateObj = {
      machineCategory: machineCategory, //Can be "fake news" or "scam"
      isMachineCategorised: isMachineAssessed,
      originalText: text,
      text: strippedMessage, //text
      caption: null,
      latestInstance: null,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      lastRefreshedTimestamp: timestamp,
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: isMachineAssessed, //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      isIrrelevant:
        isMachineAssessed && machineCategory.includes("irrelevant")
          ? true
          : null, //bool, if majority voted irrelevant then update this
      isScam: isMachineAssessed && machineCategory === "scam" ? true : null,
      isIllicit:
        isMachineAssessed && machineCategory === "illicit" ? true : null,
      isSpam: isMachineAssessed && machineCategory === "spam" ? true : null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: machineCategory === "info" ? true : null,
      primaryCategory: isMachineAssessed
        ? machineCategory.split("_")[0] //in case of irrelevant_length, we want to store irrelevant
        : null,
      customReply: null, //string
      instanceCount: 0,
      rationalisation: rationalisation,
    }
  } else {
    messageRef = matchedParentMessageRef
  }
  if (!messageRef) {
    functions.logger.error(
      `No messageRef created or matched for whatsapp message with id ${id}`
    )
    return
  }
  const instanceRef = messageRef.collection("instances").doc()
  const instanceUpdateObj = {
    source: "whatsapp",
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "text", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: text,
    textHash: textHash ?? null,
    caption: null,
    captionHash: null,
    sender: null, //sender name or number (for now not collected)
    imageType: null, //either "convo", "email", "letter" or "others"
    ocrVersion: null,
    from: from, //sender phone number, taken from webhook object
    subject: null,
    isForwarded: isForwarded, //boolean, taken from webhook object
    isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
    isReplied: false,
    isInterimPromptSent: null,
    isInterimReplySent: null,
    isMeaningfulInterimReplySent: null,
    isRationalisationSent: null,
    isRationalisationUseful: null,
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
  }
  await addInstanceToDb(
    id,
    hasMatch,
    messageRef,
    messageUpdateObj,
    instanceRef,
    instanceUpdateObj
  )
  return Promise.resolve(`text_machine_${machineCategory}`)
}

async function newImageInstanceHandler({
  caption,
  timestamp,
  id,
  mediaId,
  mimeType,
  from,
  isForwarded,
  isFrequentlyForwarded,
  isFirstTimeUser,
}: {
  caption: string | null
  mediaId: string | null
  mimeType: string | null
  timestamp: Timestamp
  id: string
  from: string | null
  isForwarded: boolean | null
  isFrequentlyForwarded: boolean | null
  isFirstTimeUser: boolean
}) {
  let filename
  let messageRef: FirebaseFirestore.DocumentReference | null = null
  let messageUpdateObj: Object | null = null
  let hasMatch = false
  let matchType = "none" // will be set to either "similarity" or "image" or "none"
  let matchedInstanceSnap
  let captionHash = caption ? hashMessage(caption) : null

  if (!mediaId) {
    throw new Error(`No mediaId for whatsapp message with id ${id}`)
  }
  if (!mimeType) {
    throw new Error(`No mimeType for whatsapp message with id ${id}`)
  }
  //get response buffer
  const buffer = await downloadWhatsappMedia(mediaId)
  const hash = await getHash(buffer)
  //check if same image already exists
  let imageMatchSnapshot = await db
    .collectionGroup("instances")
    .where("hash", "==", hash)
    .get()
  if (!imageMatchSnapshot.empty) {
    filename = imageMatchSnapshot.docs[0].data().storageUrl
    //loop through instances till we find the one with the same captionHash
    for (let instance of imageMatchSnapshot.docs) {
      let instanceCaptionHash = instance.get("captionHash")
      if (instanceCaptionHash === captionHash) {
        hasMatch = true
        matchType = "image"
        matchedInstanceSnap = instance
        break
      }
    }
  } else {
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
  }

  //do OCR
  let ocrSuccess = false
  let sender = null
  let subject = null
  let imageType = null
  let extractedMessage = null
  let strippedMessage = null
  let machineCategory = null
  if (!hasMatch || !matchedInstanceSnap) {
    const cloudStorageUrl = getCloudStorageUrl(filename)
    if (cloudStorageUrl) {
      try {
        const ocrOutput = await performOCR(cloudStorageUrl)
        sender = ocrOutput?.sender ?? null
        imageType = ocrOutput?.imageType ?? null
        extractedMessage = ocrOutput?.extractedMessage ?? null
        machineCategory = ocrOutput?.prediction ?? null //changed 11 Feb to predict on everything
        subject = ocrOutput?.subject ?? null
        ocrSuccess = true
      } catch (error) {
        functions.logger.error("Error in performOCR:", error)
      }
    } else {
      functions.logger.warn("Problem creating URL")
    }
  } else {
    //this is so that we don't do an unnecessary OCR which is more compute intensive.
    sender = matchedInstanceSnap.get("sender") ?? null
    imageType = matchedInstanceSnap.get("imageType") ?? null
    extractedMessage = matchedInstanceSnap.get("text") ?? null
    machineCategory = matchedInstanceSnap.get("machineCategory") ?? null
  }

  let similarity
  let embedding
  let bestMatchingDocumentRef
  let bestMatchingText
  let similarityScore = 0
  let matchedParentMessageRef = null
  let textHash = null

  if (ocrSuccess && !!extractedMessage && !hasMatch) {
    try {
      textHash = hashMessage(extractedMessage)
      ;({ embedding, similarity } = await calculateSimilarity(
        extractedMessage,
        textHash,
        captionHash
      ))
    } catch (error) {
      functions.logger.error("Error in calculateSimilarity:", error)
      embedding = null
      similarity = {}
    }

    if (
      similarity.ref &&
      similarity.message &&
      similarity.score &&
      similarity.parent
    ) {
      bestMatchingDocumentRef = similarity.ref
      bestMatchingText = similarity.message
      similarityScore = similarity.score
      matchedParentMessageRef = similarity.parent
    }
    if (similarityScore > parseFloat(similarityThreshold.value())) {
      hasMatch = true
      matchType = similarityScore == 1 ? "exact" : "similarity"
    }
  }

  if (!hasMatch || (!matchedInstanceSnap && !matchedParentMessageRef)) {
    let rationalisation: null | string = null
    if (extractedMessage) {
      strippedMessage = await anonymiseMessage(extractedMessage)
    }
    const isMachineAssessed = !!(
      machineCategory &&
      !caption &&
      machineCategory !== "error" &&
      machineCategory !== "unsure" &&
      machineCategory !== "info"
    )
    if (
      extractedMessage &&
      isMachineAssessed &&
      strippedMessage &&
      !machineCategory.includes("irrelevant")
    ) {
      rationalisation = await rationaliseMessage(
        strippedMessage,
        machineCategory
      )
    }
    messageRef = db.collection("messages").doc()
    messageUpdateObj = {
      machineCategory: machineCategory, //Can be "fake news" or "scam"
      isMachineCategorised: isMachineAssessed,
      originalText: extractedMessage ?? null,
      text: strippedMessage ?? null, //text
      caption: caption ?? null,
      latestInstance: null,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      lastRefreshedTimestamp: timestamp,
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: isMachineAssessed, //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      isIrrelevant:
        isMachineAssessed && machineCategory.includes("irrelevant")
          ? true
          : null, //bool, if majority voted irrelevant then update this
      isScam: isMachineAssessed && machineCategory === "scam" ? true : null,
      isIllicit:
        isMachineAssessed && machineCategory === "illicit" ? true : null,
      isSpam: isMachineAssessed && machineCategory === "spam" ? true : null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: !caption && machineCategory === "info" ? true : null,
      primaryCategory: isMachineAssessed
        ? machineCategory.split("_")[0] //in case of irrelevant_length, we want to store irrelevant
        : null,
      customReply: null, //string
      instanceCount: 0,
      rationalisation: rationalisation,
    }
  } else {
    if (matchType === "image" && matchedInstanceSnap) {
      messageRef = matchedInstanceSnap.ref.parent.parent
    } else if (
      (matchType === "similarity" || matchType === "exact") &&
      matchedParentMessageRef
    ) {
      messageRef = matchedParentMessageRef
    }
  }
  if (!messageRef) {
    functions.logger.error(
      `No messageRef created or matched for whatsapp message with id ${id}`
    )
    return
  }
  const instanceRef = messageRef.collection("instances").doc()
  const instanceUpdateObj = {
    source: "whatsapp",
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "image", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: extractedMessage ?? null, //text extracted from OCR if relevant
    textHash: textHash ?? null,
    caption: caption ?? null,
    captionHash: captionHash,
    sender: sender ?? null, //sender name or number extracted from OCR
    imageType: imageType, //either "convo", "email", "letter" or "others"
    ocrVersion: "2",
    from: from, //sender phone number, taken from webhook object
    subject: subject,
    hash: hash,
    mediaId: mediaId,
    mimeType: mimeType,
    storageUrl: filename,
    isForwarded: isForwarded, //boolean, taken from webhook object
    isFrequentlyForwarded: isFrequentlyForwarded, //boolean, taken from webhook object
    isReplied: false,
    isInterimPromptSent: null,
    isInterimReplySent: null,
    isMeaningfulInterimReplySent: null,
    isRationalisationSent: null,
    isRationalisationUseful: null,
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
  }
  await addInstanceToDb(
    id,
    hasMatch,
    messageRef,
    messageUpdateObj,
    instanceRef,
    instanceUpdateObj
  )
  return Promise.resolve("image")
}

async function newUserHandler(from: string) {
  await sendLanguageSelection(from, true)
}

async function onButtonReply(messageObj: Message, platform = "whatsapp") {
  const buttonId = messageObj.interactive.button_reply.id
  const from = messageObj.from
  const responses = await getResponsesObj("user", from)
  const [type, ...rest] = buttonId.split("_")
  let instancePath, selection, instanceRef, blastPath
  switch (type) {
    case "scamshieldDecline":
      ;[instancePath] = rest
      instanceRef = db.doc(instancePath)
      const replyText = responses?.SCAMSHIELD_ON_DECLINE
      await instanceRef.update({
        scamShieldConsent: false,
      })
      if (!replyText) {
        functions.logger.error("No replyText for scamshieldConsent")
        break
      }
      await sendWhatsappTextMessage("user", from, replyText)
      break
    case "votingResults":
      let scamShield
      ;[instancePath, ...scamShield] = rest
      const triggerScamShieldConsent =
        scamShield.length > 0 && scamShield[0] === "scamshield"
      //await sendVotingStats(instancePath, triggerScamShieldConsent)
      await sendVotingStats(instancePath)
      break
    case "sendInterim":
      ;[instancePath] = rest
      await sendInterimUpdate(instancePath)
      break
    case "rationalisation":
      ;[instancePath] = rest
      await sendRationalisation(instancePath)
      break
    case "feedbackRationalisation":
      ;[instancePath, selection] = rest
      await respondToRationalisationFeedback(instancePath, selection)
      break
    case "feedbackBlast":
      ;[blastPath, selection] = rest
      await respondToBlastFeedback(blastPath, selection, from)
      break
    case "languageSelection":
      ;[selection] = rest
      await updateLanguageAndSendMenu(from, selection)
      break
  }
  const step = type + (selection ? `_${selection}` : "")
  return Promise.resolve(step)
}

async function onTextListReceipt(messageObj: Message, platform = "whatsapp") {
  const listId = messageObj.interactive.list_reply.id
  const from = messageObj.from
  const responses = await getResponsesObj("user", from)
  const [type, selection, ...rest] = listId.split("_")
  let response, instancePath
  const step = `${type}_${selection}`
  let hasReplied = false
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

        case "language":
          await sendLanguageSelection(from, false)
          hasReplied = true
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

        case "referral":
          await sendReferralMessage(from)
          hasReplied = true
          break

        case "dispute":
          ;[instancePath] = rest
          const instanceRef = db.doc(instancePath)
          const parentMessageRef = instanceRef.parent.parent
          if (!parentMessageRef) {
            throw new Error(
              `parentMessageRef is null for instance ${instancePath}`
            )
          }
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
        case "unsubscribeUpdates":
          await toggleUserSubscription(from, false)
          response = responses.UNSUBSCRIBE
          break
        case "subscribeUpdates":
          await toggleUserSubscription(from, true)
          response = responses.SUBSCRIBE
          break
      }
      break
    case "satisfactionSurvey":
      ;[instancePath] = rest
      const instanceRef = db.doc(instancePath)
      //check if selection is number
      if (!isNaN(Number(selection))) {
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
  if (!hasReplied && response) {
    await sendWhatsappTextMessage("user", from, response, null, true)
  }
  return Promise.resolve(step)
}

async function addInstanceToDb(
  id: string,
  hasMatch: boolean,
  messageRef: FirebaseFirestore.DocumentReference | null,
  messageUpdateObj: Object | null = null,
  instanceRef: FirebaseFirestore.DocumentReference,
  instanceUpdateObj: Object
) {
  const messageIdRef = db.collection("messageIds").doc(id)
  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(messageIdRef)
      if (doc.exists) {
        return
      }
      if (!hasMatch && !!messageRef && !!messageUpdateObj) {
        t.set(messageRef, messageUpdateObj)
      }
      t.set(instanceRef, instanceUpdateObj)
      t.set(messageIdRef, { instanceRef: instanceRef })
    })
    functions.logger.log(`Transaction success for messageId ${id}!`)
  } catch (e) {
    functions.logger.error(`Transaction failure for messageId ${id}!`, e)
  }
}

function checkMenu(text: string) {
  const menuKeywords = ["menu", "菜单", "菜單"]
  return menuKeywords.includes(text.toLowerCase())
}

async function toggleUserSubscription(userId: string, toSubscribe: boolean) {
  db.collection("users").doc(userId).update({
    isSubscribedUpdates: toSubscribe,
  })
}

async function referralHandler(message: string, from: string) {
  const code = message.split("\n")[0].split(": ")[1]
  const userRef = db.collection("users").doc(from)
  let tryGeneric = true
  if (code.length > 0) {
    let referrer
    try {
      referrer = String(hashids.decode(code)[0])
    } catch (error) {
      functions.logger.error(
        `Error decoding referral code ${code}, sent by ${from}: ${error}`
      )
    }
    try {
      if (referrer) {
        const referralSourceSnap = await db
          .collection("users")
          .doc(`${referrer}`) //convert to string cos firestore doesn't accept numbers as doc ids
          .get()
        if (referralSourceSnap.exists) {
          tryGeneric = false
          await referralSourceSnap.ref.update({
            referralCount: FieldValue.increment(1),
          })
          await userRef.update({
            firstMessageType: "prepopulated",
            utm: {
              source: referrer,
              medium: "uniqueLink",
              content: "none",
              campaign: "none",
              term: "none",
            },
          })
          return
        }
      }

      if (tryGeneric) {
        const referralClickSnap = await db
          .collection("referralClicks")
          .doc(code)
          .get()
        if (referralClickSnap.exists) {
          await userRef.update({
            firstMessageType: "prepopulated",
            utm: {
              source: referralClickSnap.get("utmSource") ?? "none",
              medium: referralClickSnap.get("utmMedium") ?? "none",
              content: referralClickSnap.get("utmContent") ?? "none",
              campaign: referralClickSnap.get("utmCampaign") ?? "none",
              term: referralClickSnap.get("utmTerm") ?? "none",
            },
          })
        } else {
          functions.logger.warn(
            "Referral code not found in either users or referralClicks collection"
          )
        }
      }
    } catch (error) {
      functions.logger.error(
        `Error processing referral code ${code}, sent by ${from}: ${error}`
      )
    }
  }
}

async function createNewUser(
  userRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  messageTimestamp: Timestamp
) {
  const id = userRef.id
  const referralId = hashids.encode(id)
  await userRef.set({
    instanceCount: 0,
    firstMessageReceiptTime: messageTimestamp,
    firstMessageType: "normal",
    lastSent: null,
    satisfactionSurveyLastSent: null,
    initialJourney: {},
    referralId: referralId,
    referralCount: 0,
    language: "en",
    isSubscribedUpdates: true,
  })
}

const onUserPublish = onMessagePublished(
  {
    topic: "userEvents",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "VERIFY_TOKEN",
      "TYPESENSE_TOKEN",
      "ML_SERVER_TOKEN",
      "TELEGRAM_REPORT_BOT_TOKEN",
      "OPENAI_API_KEY",
    ],
    timeoutSeconds: 120,
  },
  async (event) => {
    if (event.data.message.json) {
      functions.logger.log(`Processing ${event.data.message.messageId}`)
      await userHandlerWhatsapp(event.data.message.json)
    } else {
      functions.logger.warn(
        `Unknown message type for messageId ${event.data.message.messageId})`
      )
    }
  }
)
export { onUserPublish }

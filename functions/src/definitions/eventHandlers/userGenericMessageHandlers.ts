import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { Timestamp } from "firebase-admin/firestore"
import { checkNewlyJoined } from "../../validators/common/checkNewlyJoined"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
} from "../common/sendWhatsappMessage"
import { hashMessage, normalizeSpaces, checkMessageId } from "../common/utils"
import { checkTemplate } from "../../validators/whatsapp/checkWhatsappText"
import { getUserSnapshot } from "../../services/common/userManagement"
import { sendMenuMessage, getResponsesObj } from "../common/responseUtils"
import {
  downloadWhatsappMedia,
  downloadTelegramMedia,
  getHash,
  getCloudStorageUrl,
} from "../common/mediaUtils"
import { incrementCheckerCounts } from "../common/counters"
import { anonymiseMessage, rationaliseMessage } from "../common/genAI"
import { calculateSimilarity } from "../common/calculateSimilarity"
import { performOCR } from "../common/machineLearningServer/operations"
import { defineString } from "firebase-functions/params"
import { classifyText } from "../common/classifier"
import { FieldValue } from "@google-cloud/firestore"
import Hashids from "hashids"
import { GeneralMessage, MessageData, InstanceData } from "../../types"
import { AppEnv } from "../../appEnv"
import { logger } from "firebase-functions"

const similarityThreshold = defineString(AppEnv.SIMILARITY_THRESHOLD)

if (!admin.apps.length) {
  admin.initializeApp()
}
const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)

const db = admin.firestore()

//not whatsapp specific anymore
const userGenericMessageHandlerWhatsapp = async function (
  message: GeneralMessage
) {
  if (!message?.id) {
    functions.logger.error("No message id")
    return
  }
  if (await checkMessageId(message.id)) {
    functions.logger.warn(`Message ${message.id} already exists`)
    return
  }

  const from = message.userId // extract the userid (wa phone no./tele userid etc.)
  const type = message.type // image/text
  const source = message.source
  const messageTimestamp = new Timestamp(Number(message.timestamp), 0)
  let isFirstTimeUser = message.isFirstTimeUser
  let userSnap = await getUserSnapshot(from, source)
  if (userSnap == null) {
    logger.error(`User ${from} not found in userHandler`)
    return
  }
  const language = userSnap.get("language") ?? "en"

  const responses = await getResponsesObj("user", language)

  let step

  const isNewlyJoined = checkNewlyJoined(userSnap, messageTimestamp)

  switch (type) {
    //only two types: text or image
    case "text":
      // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
      if (!message.text) {
        break
      }
      const textNormalised = normalizeSpaces(message.text).toLowerCase() //normalise spaces needed cos of potential &nbsp when copying message on desktop whatsapp
      if (
        checkTemplate(
          textNormalised,
          responses?.REFERRAL_PREPOPULATED_PREFIX.toLowerCase()
        ) ||
        checkTemplate(
          textNormalised,
          responses?.REFERRAL_PREPOPULATED_PREFIX_1.toLowerCase()
        )
      ) {
        step = "text_prepopulated"
        if (isFirstTimeUser) {
          await referralHandler(userSnap, message.text, from)
        } else {
          await sendMenuMessage(userSnap, "MENU_PREFIX", "whatsapp", null, null)
        }
        break
      }

      step = await newTextInstanceHandler({
        userSnap,
        source: message.source,
        text: message.text,
        timestamp: messageTimestamp,
        id: message.id,
        from: from,
        isForwarded: message?.isForwarded || null,
        isFrequentlyForwarded: message?.frequently_forwarded || null,
        isFirstTimeUser,
      })
      break

    case "image":
      step = await newImageInstanceHandler({
        userSnap,
        source: message.source,
        caption: message?.media?.caption || null,
        timestamp: messageTimestamp,
        id: message.id,
        mediaId: message?.media?.fileId || null,
        mimeType: message?.media?.mimeType || null,
        from: from,
        isForwarded: message?.isForwarded || null,
        isFrequentlyForwarded: message?.frequently_forwarded || null,
        isFirstTimeUser,
      })
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
  if (isNewlyJoined && step) {
    const timestampKey =
      messageTimestamp.toDate().toISOString().slice(0, -5) + "Z"
    userSnap.ref.update({
      [`initialJourney.${timestampKey}`]: step,
    })
  }
  markWhatsappMessageAsRead("user", message.id)
}

async function newTextInstanceHandler({
  userSnap,
  source,
  text,
  timestamp,
  id,
  from,
  isForwarded,
  isFrequentlyForwarded,
  isFirstTimeUser,
}: {
  userSnap: admin.firestore.DocumentSnapshot
  source: string
  text: string
  timestamp: Timestamp
  id: string
  from: string
  isForwarded: boolean | null
  isFrequentlyForwarded: boolean | null
  isFirstTimeUser: boolean
}) {
  let hasMatch = false
  let messageRef: FirebaseFirestore.DocumentReference | null = null
  let messageUpdateObj: MessageData | null = null
  console.log(`isFirstTimeUser: ${isFirstTimeUser}`)
  const machineCategory = (await classifyText(text)) ?? "error"
  if (from && isFirstTimeUser && machineCategory.includes("irrelevant")) {
    await userSnap.ref.update({
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
      numberPointScale: 6,
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
      isSatire: null,
      isHarmful: null,
      isHarmless: null,
      tags: {},
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
    source: source,
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
  userSnap,
  source,
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
  userSnap: admin.firestore.DocumentSnapshot
  source: string
  caption: string | null
  mediaId: string | null
  mimeType: string | null
  timestamp: Timestamp
  id: string
  from: string
  isForwarded: boolean | null
  isFrequentlyForwarded: boolean | null
  isFirstTimeUser: boolean
}) {
  let filename
  let messageRef: FirebaseFirestore.DocumentReference | null = null
  let messageUpdateObj: MessageData | null = null
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
  let buffer
  if (source === "whatsapp") {
    buffer = await downloadWhatsappMedia(mediaId)
  } else if (source === "telegram") {
    buffer = await downloadTelegramMedia(mediaId)
  } else {
    throw new Error(`Unsupported platform ${source}`)
  }
  // const buffer = await downloadWhatsappMedia(mediaId)
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
        machineCategory =
          imageType !== "others" ? ocrOutput?.prediction ?? null : null //don't make a prediction if it's under others.
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
  let embedding: number[] | null = null
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
      machineCategory: machineCategory,
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
      numberPointScale: 6,
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
      isSatire: null,
      isHarmful: null,
      isHarmless: null,
      tags: {},
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
  const instanceUpdateObj: InstanceData = {
    source: source,
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
    from: from, //sender id, taken from webhook object
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

async function referralHandler(
  userSnap: admin.firestore.DocumentData,
  message: string,
  from: string
) {
  const code = message.split("\n")[0].split(": ")[1].split(" ")[0]
  const userRef = userSnap.ref
  if (code.length > 0) {
    const referralClickRef = db.collection("referralClicks").doc(code)
    const referralClickSnap = await referralClickRef.get()
    if (referralClickSnap.exists) {
      const referralId = referralClickSnap.get("referralId")
      if (referralId === "add") {
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
        //try to get the userId from the referralId
        let referrer
        try {
          referrer = String(hashids.decode(referralId)[0])
        } catch (error) {
          functions.logger.error(
            `Error decoding referral code ${code}, sent by ${from}: ${error}`
          )
        }
        if (referrer) {
          // const referralSourceSnap = await db
          //   .collection("users")
          //   .doc(`${referrer}`) //convert to string cos firestore doesn't accept numbers as doc ids
          //   .get()
          const referralSourceSnap = await getUserSnapshot(referrer)
          if (referralSourceSnap !== null) {
            await referralSourceSnap.ref.update({
              referralCount: FieldValue.increment(1),
            })
            //check if referrer is a checker
            await incrementCheckerCounts(referrer, "numReferred", 1)
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
          } else {
            functions.logger.error(
              `Referrer ${referrer} not found in users collection`
            )
          }
        }
      }
      await referralClickRef.update({
        isConverted: true,
      })
    } else {
      functions.logger.error(
        "Referral code not found in referralClicks collection"
      )
    }
  }
}

const onUserGenericMessagePublish = onMessagePublished(
  {
    topic: "userEvents",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "VERIFY_TOKEN",
      "TYPESENSE_TOKEN",
      "TELEGRAM_REPORT_BOT_TOKEN",
      "OPENAI_API_KEY",
    ],
    timeoutSeconds: 120,
  },
  async (event) => {
    if (event.data.message.json) {
      functions.logger.log(`Processing ${event.data.message.messageId}`)
      await userGenericMessageHandlerWhatsapp(event.data.message.json)
    } else {
      functions.logger.warn(
        `Unknown message type for messageId ${event.data.message.messageId})`
      )
    }
  }
)
export { onUserGenericMessagePublish }

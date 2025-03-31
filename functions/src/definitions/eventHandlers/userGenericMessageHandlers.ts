import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { Timestamp } from "firebase-admin/firestore"
import { checkNewlyJoined } from "../../validators/common/checkNewlyJoined"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
} from "../common/sendWhatsappMessage"
import { hashMessage, checkMessageId } from "../common/utils"
import {
  checkPrepopulatedMessage,
  checkBetaMessage,
} from "../../services/user/referrals"
import { getUserSnapshot } from "../../services/user/userManagement"
import {
  sendMenuMessage,
  getResponsesObj,
  sendOutOfSubmissionsMessage,
  sendWaitingMessage,
} from "../common/responseUtils"
import {
  downloadWhatsappMedia,
  downloadTelegramMedia,
  getHash,
  getCloudStorageUrl,
} from "../common/mediaUtils"
import { incrementCheckerCounts } from "../common/counters"
import { anonymiseMessage } from "../common/genAI"
import { calculateSimilarity } from "../common/calculateSimilarity"
import {
  performOCR,
  getCommunityNote,
  determineNeedsChecking,
  determineControversial,
} from "../common/machineLearningServer/operations"
import { defineString } from "firebase-functions/params"
import { classifyText } from "../common/classifier"
import { FieldValue } from "@google-cloud/firestore"
import Hashids from "hashids"
import { GeneralMessage, MessageData, InstanceData } from "../../types"
import { AppEnv } from "../../appEnv"
import { getSignedUrl } from "../common/mediaUtils"
import { logger } from "firebase-functions"
import { stripTemplate } from "../../validators/whatsapp/checkWhatsappText"
import { sendNewMessageNotification } from "../../services/admin/notificationService"

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
  const isUserOnboarded = message.isUserOnboarded
  let userSnap = await getUserSnapshot(from, source)
  if (userSnap == null) {
    logger.error(`User ${from} not found in userHandler`)
    return
  }
  const language = userSnap.get("language") ?? "en"

  const responses = await getResponsesObj("user", language)

  if (userSnap.get("numSubmissionsRemaining") <= 0) {
    await sendOutOfSubmissionsMessage(userSnap)
    markWhatsappMessageAsRead("user", message.id)
    return
  }
  if (isUserOnboarded) {
    await userSnap.ref.update({
      numSubmissionsRemaining: FieldValue.increment(-1),
    })
  } else {
    await userSnap.ref.update({
      numPreOnboardSubmissionsRemaining: FieldValue.increment(-1),
    })
  }

  let step

  const isNewlyJoined = checkNewlyJoined(userSnap, messageTimestamp)

  switch (type) {
    //only two types: text or image
    case "text":
      // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
      if (!message.text) {
        break
      }
      if (checkPrepopulatedMessage(responses, message.text)) {
        await sendMenuMessage(userSnap, "MENU_PREFIX", "whatsapp", null, null)
        break
      } else if (checkBetaMessage(responses, message.text)) {
        //TODO: Remove after BETA
        await userSnap.ref.update({
          isTester: true,
          numSubmissionsRemaining: FieldValue.increment(1),
        })
        break
      } else {
        //replace prepopulated prefix if any in the text
        const cleanedMessage = stripTemplate(
          stripTemplate(message.text, responses?.REFERRAL_PREPOPULATED_PREFIX),
          responses?.REFERRAL_PREPOPULATED_PREFIX_1
        )
        if (cleanedMessage) {
          message.text = cleanedMessage
        }
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
}: {
  userSnap: admin.firestore.DocumentSnapshot
  source: string
  text: string
  timestamp: Timestamp
  id: string
  from: string
  isForwarded: boolean | null
  isFrequentlyForwarded: boolean | null
}) {
  let hasMatch = false
  let messageRef: FirebaseFirestore.DocumentReference | null = null
  let messageUpdateObj: MessageData | null = null
  const needsChecking = await determineNeedsChecking({
    text: text,
  })
  const machineCategory = (await classifyText(text)) ?? "error"
  // if (from && isFirstTimeUser && !needsChecking) {
  //   await userSnap.ref.update({
  //     firstMessageType: "irrelevant",
  //   })
  //   return Promise.resolve(`text_machine_irrelevant`)
  // }
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
    let communityNoteData
    let isCommunityNoteGenerated = false
    let isCommunityNoteUsable = false
    let communityNoteStatus = "not-generated"
    // const isControversial = await determineControversial({
    //   text: text,
    // })
    let isControversial = false
    messageRef = db.collection("messages").doc()
    if (needsChecking) {
      await sendWaitingMessage(userSnap, id)
      try {
        communityNoteData = await getCommunityNote({
          text: text,
          requestId: messageRef !== null ? messageRef.id : null,
        })
        isCommunityNoteGenerated = true
        isControversial = communityNoteData.isControversial
        isCommunityNoteUsable = !(
          communityNoteData.isVideo || communityNoteData.isAccessBlocked
        )
        communityNoteStatus = isCommunityNoteUsable ? "generated" : "unusable"
      } catch (error) {
        functions.logger.error("Error in getCommunityNote:", error)
        communityNoteStatus = "error"
      }
    }
    let strippedMessage = await anonymiseMessage(text, true)

    const adminMessageId = (await sendNewMessageNotification(text)) ?? null

    messageUpdateObj = {
      machineCategory: needsChecking
        ? machineCategory.split("_")[0]
        : "irrelevant",
      isMachineCategorised: isMachineAssessed || !needsChecking,
      isWronglyCategorisedIrrelevant: false,
      originalText: text,
      text: strippedMessage, //text
      caption: null,
      latestInstance: null,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      lastRefreshedTimestamp: timestamp,
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: false, //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      numberPointScale: 6,
      isControversial: isControversial,
      isIrrelevant: !needsChecking,
      isScam: null,
      isIllicit: null,
      isSpam: null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: null,
      isSatire: null,
      isHarmful: null,
      isHarmless: null,
      tags: {},
      primaryCategory: needsChecking ? null : "irrelevant",
      customReply: null,
      communityNoteStatus: communityNoteStatus,
      communityNote:
        isCommunityNoteGenerated && communityNoteData && isCommunityNoteUsable
          ? {
              en: communityNoteData?.en || "Apologies, an error occurred.",
              cn: communityNoteData?.cn || "Apologies, an error occurred.",
              links: communityNoteData?.links || [],
              downvoted: false,
              pendingCorrection: false,
              adminGroupCommunityNoteSentMessageId: null,
              timestamp: Timestamp.now(),
            }
          : null,
      instanceCount: 0,
      adminGroupSentMessageId: adminMessageId,
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
  const instanceUpdateObj: InstanceData = {
    source: source,
    id: id || null, //taken from webhook object, needed to reply
    timestamp: timestamp, //timestamp, taken from webhook object (firestore timestamp data type)
    type: "text", //message type, taken from webhook object. Can be 'audio', 'button', 'document', 'text', 'image', 'interactive', 'order', 'sticker', 'system', 'unknown', 'video'.
    text: text,
    textHash: textHash ?? null,
    caption: null,
    captionHash: null,
    hash: null,
    mediaId: null,
    mimeType: null,
    storageUrl: null,
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
    isCommunityNoteSent: null,
    isCommunityNoteCorrected: false,
    isCommunityNoteUseful: null,
    isCommunityNoteReviewRequested: null,
    isReplyForced: null,
    isMatched: hasMatch,
    isReplyImmediate: null,
    isIrrelevantAppealed: false,
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
    flowId: null,
    disclaimerSentTimestamp: null,
    disclaimerAcceptanceTimestamp: null,
    communityNoteMessageId: null,
    userClickedSupportUs: false,
  }
  await addInstanceToDb(
    id,
    hasMatch,
    messageRef,
    messageUpdateObj,
    instanceRef,
    instanceUpdateObj
  )
  return Promise.resolve(`text_normal`)
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
}) {
  let filename
  let messageRef: FirebaseFirestore.DocumentReference | null = null
  let messageUpdateObj: MessageData | null = null
  let hasMatch = false
  let matchType = "none" // will be set to either "similarity" or "image" or "none"
  let matchedInstanceSnap
  let captionHash = caption ? hashMessage(caption) : null

  await sendWaitingMessage(userSnap, id)

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
    let communityNoteData
    let isCommunityNoteGenerated = false
    let isCommunityNoteUsable = false
    let isControversial = false
    let communityNoteStatus = "not-generated"
    messageRef = db.collection("messages").doc()
    const signedUrl = (await getSignedUrl(filename)) ?? null
    if (signedUrl) {
      // isControversial = await determineControversial({
      //   url: signedUrl,
      //   caption: caption ?? null,
      // })
      try {
        communityNoteData = await getCommunityNote({
          url: signedUrl,
          caption: caption ?? null,
          requestId: messageRef !== null ? messageRef.id : null,
        })
        isCommunityNoteGenerated = true
        isControversial = communityNoteData.isControversial
        isCommunityNoteUsable = !(
          communityNoteData.isVideo || communityNoteData.isAccessBlocked
        )
        communityNoteStatus = isCommunityNoteUsable ? "generated" : "unusable"
      } catch (error) {
        functions.logger.error("Error in getCommunityNote:", error)
        communityNoteStatus = "error"
      }
    }

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

    let adminMessageId = null
    if (signedUrl) {
      adminMessageId =
        (await sendNewMessageNotification(null, signedUrl, caption)) ?? null
    }

    messageUpdateObj = {
      machineCategory: machineCategory,
      isMachineCategorised: isMachineAssessed,
      isWronglyCategorisedIrrelevant: false,
      originalText: extractedMessage ?? null,
      text: strippedMessage ?? null, //text
      caption: caption ?? null,
      latestInstance: null,
      firstTimestamp: timestamp, //timestamp of first instance (firestore timestamp data type)
      lastTimestamp: timestamp, //timestamp of latest instance (firestore timestamp data type)
      lastRefreshedTimestamp: timestamp,
      isPollStarted: false, //boolean, whether or not polling has started
      isAssessed: false, //boolean, whether or not we have concluded the voting
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null, //float, the mean truth score
      numberPointScale: 6,
      isControversial: isControversial,
      isIrrelevant: false,
      isScam: null,
      isIllicit: null,
      isSpam: null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: null,
      isSatire: null,
      isHarmful: null,
      isHarmless: null,
      tags: {},
      primaryCategory: null,
      customReply: null, //string
      communityNoteStatus: communityNoteStatus,
      communityNote:
        isCommunityNoteGenerated && communityNoteData && isCommunityNoteUsable
          ? {
              en: communityNoteData?.en || "Apologies, an error occurred",
              cn: communityNoteData?.cn || "Apologies, an error occurred",
              links: communityNoteData?.links || [],
              downvoted: false,
              pendingCorrection: false,
              adminGroupCommunityNoteSentMessageId: null,
              timestamp: Timestamp.now(),
            }
          : null,
      instanceCount: 0,
      adminGroupSentMessageId: adminMessageId,
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
    isCommunityNoteSent: null,
    isCommunityNoteCorrected: false,
    isCommunityNoteUseful: null,
    isCommunityNoteReviewRequested: null,
    isReplyForced: null,
    isMatched: hasMatch,
    isReplyImmediate: null,
    isIrrelevantAppealed: false,
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
    flowId: null,
    disclaimerSentTimestamp: null,
    disclaimerAcceptanceTimestamp: null,
    communityNoteMessageId: null,
    userClickedSupportUs: false,
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

const onUserGenericMessagePublish = onMessagePublished(
  {
    topic: "userGenericMessages",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "VERIFY_TOKEN",
      "TYPESENSE_TOKEN",
      "OPENAI_API_KEY",
      "TELEGRAM_ADMIN_BOT_TOKEN",
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

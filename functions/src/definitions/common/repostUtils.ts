import { defineString } from "firebase-functions/params"
import { AppEnv } from "../../appEnv"
import {
  sendTelegramImageMessage,
  sendTelegramTextMessage,
} from "./sendTelegramMessage"
import * as admin from "firebase-admin"
import { getSignedUrl } from "./mediaUtils"

const db = admin.firestore()
const repostChannelId = process.env[AppEnv.TELEGRAM_REPOST_CHANNEL_ID] || ""

// Creates a messageId: replyId key-val pair in the DB
export async function createMessageId(messageId: string, replyId: string) {
  try {
    const repostIdRef = db.collection("repostIds").doc(messageId)
    await repostIdRef.set({ replyId: replyId })
  } catch (error) {
    console.error("repostUtils > Error adding document: ", error)
    return false
  }
  return true
}

// Queries the DB for the replyId of a messageId
export async function getReplyId(messageId: string) {
  try {
    const repostIdRef = db.collection("repostIds").doc(messageId)
    const repostIdSnap = await repostIdRef.get()

    if (!repostIdSnap.exists) {
      throw new Error(`Repost ID for messageId ${messageId} not found`)
    }

    const data = repostIdSnap.data()
    return data?.replyId || null
  } catch (error) {
    console.error("Error getting repost ID", error)
    throw error
  }
}

// Sends a text message to the repost bot
export async function repostText(messageId: string, instance: any) {
  // Send message to repost channel
  const instanceText =
    "< New Text Message > \n\n ID: " +
    messageId.slice(37, 42) +
    "... \n\n" +
    instance?.text
  const response = await sendTelegramTextMessage(
    "repost",
    repostChannelId,
    instanceText,
    null
  )

  // Add messageId: replyId to the db
  const replyId = response.data.result.message_id
  await createMessageId(messageId, replyId)
}

// Sends an image message to the repost bot
export async function repostImage(messageId: string, instance: any) {
  const instanceText =
    "< New Image Message > \n\n ID: " +
    messageId.slice(37, 42) +
    "... \n\n" +
    (instance?.caption || "")

  const instanceImage = (await getSignedUrl(instance.storageUrl)) || ""
  console.log("IMAGE")
  console.log(instanceImage)

  try {
    const response = await sendTelegramImageMessage(
      "repost",
      repostChannelId,
      instanceImage,
      instanceText,
      null
    )

    // Add messageId: replyId to the db
    const replyId = response.data.result.message_id
    await createMessageId(messageId, replyId)
  } catch (error) {
    console.error("Error getting image URL", error)
    throw error
  }
}

// Sends a text message to the repost bot to update
export async function repostUpdate(
  id: string,
  instanceText: string,
  responseText: string
) {
  const updateText =
    "< Assessment Update > \n\nCategory: [" + responseText + "]"

  const replyId = await getReplyId(id)
  sendTelegramTextMessage("repost", repostChannelId, updateText, replyId)
  return
}

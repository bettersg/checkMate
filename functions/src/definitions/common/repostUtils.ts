// Imports and setup (unchanged)
import { defineString } from "firebase-functions/params"
import { AppEnv } from "../../appEnv"
import {
  sendTelegramImageMessage,
  sendTelegramTextMessage,
  updateTelegramTextMessage,
  updateTelegramImageMessage,
} from "./sendTelegramMessage"
import * as admin from "firebase-admin"
import { getSignedUrl } from "./mediaUtils"

const db = admin.firestore()
const repostChannelId = process.env[AppEnv.TELEGRAM_REPOST_CHANNEL_ID] || ""

// Modified createMessageId function to store replyId and instanceText
export async function createMessageId(
  messageId: string,
  replyId: string,
  instanceText: string
) {
  try {
    const repostIdRef = db.collection("repostIds").doc(messageId)
    await repostIdRef.set({ replyId: replyId, instanceText: instanceText })
  } catch (error) {
    console.error("repostUtils > Error adding document: ", error)
    return false
  }
  return true
}

// Modified getReplyId function to also retrieve instanceText
export async function getReplyId(messageId: string) {
  try {
    const repostIdRef = db.collection("repostIds").doc(messageId)
    const repostIdSnap = await repostIdRef.get()

    if (!repostIdSnap.exists) {
      throw new Error(`Repost ID for messageId ${messageId} not found`)
    }

    const data = repostIdSnap.data()
    return {
      replyId: data?.replyId || null,
      instanceText: data?.instanceText || null,
    }
  } catch (error) {
    console.error("Error getting repost ID", error)
    throw error
  }
}

// Modified repostText function to include instanceText in createMessageId call
export async function repostText(messageId: string, instance: any) {
  const instanceText =
    "< New Text Message > \n\n ID: " +
    messageId +
    "\n\nText:\n" +
    instance?.text +
    "\n\nCurrent Category: [?]"
  const response = await sendTelegramTextMessage(
    "repost",
    repostChannelId,
    instanceText,
    null
  )

  const replyId = response.data.result.message_id
  await createMessageId(messageId, replyId, instanceText)
}

// Modified repostImage function to include instanceText in createMessageId call
export async function repostImage(messageId: string, instance: any) {
  const instanceText =
    "< New Image Message > \n\n ID: " +
    messageId +
    "\n\n" +
    (instance?.caption ? "Caption:\n" + instance?.caption : "") +
    "\n\nCurrent Category: [?]"

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

    const replyId = response.data.result.message_id
    await createMessageId(messageId, replyId, instanceText)
  } catch (error) {
    console.error("Error getting image URL", error)
    throw error
  }
}

// Repost update function (unchanged for now)
export async function repostUpdate(id: string, responseText: string) {
  const { replyId, instanceText } = await getReplyId(id)

  const replyText = "< Assessment Update > \n\nCategory: [" + responseText + "]"

  const updateText = instanceText.replace(/\[.*?\]/, `[${responseText}]`)

  sendTelegramTextMessage("repost", repostChannelId, replyText, replyId)

  let res
  if (instanceText.startsWith("< New Text Message >")) {
    res = await updateTelegramTextMessage(
      "repost",
      repostChannelId,
      updateText,
      replyId
    )
  } else {
    res = await updateTelegramImageMessage(
      "repost",
      repostChannelId,
      updateText,
      replyId
    )
  }

  return
}

import * as functions from "firebase-functions"
import {
  sendWhatsappTextMessage,
  sendWhatsappImageMessage,
} from "./sendWhatsappMessage"
import {
  sendTelegramTextMessage,
  sendTelegramImageMessage,
} from "./sendTelegramMessage"
import { checkUrl } from "./utils"
import { defineString } from "firebase-functions/params"

const reportChannelId = defineString("TELEGRAM_REPORT_CHANNEL_ID")
const runtimeEnvironment = defineString("ENVIRONMENT")

const sendTextMessage = async function (
  bot: string,
  to: string,
  text: string,
  replyId: string | null = null,
  platform = "whatsapp",
  previewUrl = false
) {
  let res
  switch (platform) {
    case "telegram":
      res = await sendTelegramTextMessage(bot, to, text, replyId)
      break
    case "whatsapp":
      res = await sendWhatsappTextMessage(bot, to, text, replyId, previewUrl)
      break
  }
  return res
}

const sendImageMessage = async function (
  bot: string,
  to: string,
  urlOrId: string | null = null,
  caption = null,
  replyId = null,
  platform = "whatsapp"
) {
  if (urlOrId === null) {
    functions.logger.warn("urlOrId was null in sendImageMessage")
    return
  }
  let res
  switch (platform) {
    case "telegram":
      if (checkUrl(urlOrId)) {
        res = await sendTelegramImageMessage(bot, to, urlOrId, caption, replyId)
      }
      break
    case "whatsapp":
      if (checkUrl(urlOrId)) {
        res = await sendWhatsappImageMessage(
          bot,
          to,
          null,
          urlOrId,
          caption,
          replyId
        )
      } else {
        res = await sendWhatsappImageMessage(
          bot,
          to,
          urlOrId,
          null,
          caption,
          replyId
        )
      }
      break
  }
  return res
}

const sendDisputeNotification = async function (
  phoneNumber: string,
  instancePath: string,
  type: string,
  text: string,
  finalCategory: string
) {
  const messageText = `<${runtimeEnvironment.value()}>${phoneNumber} has disputed the assessment of a message sent by them.
  
message/instance path: ${instancePath}

type: ${type}

text: ${text ?? "<none>"}

category: ${finalCategory}`

  await sendTelegramTextMessage(
    "report",
    reportChannelId.value(),
    messageText,
    null
  )
}

export { sendTextMessage, sendImageMessage, sendDisputeNotification }

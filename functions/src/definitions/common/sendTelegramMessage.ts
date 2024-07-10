import axios from "axios"
import * as functions from "firebase-functions"
import FormData from "form-data"
import {
  Update,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ForceReply,
  Message,
} from "node-telegram-bot-api"

const telegramHost =
  process.env["TEST_SERVER_URL"] || "https://api.telegram.org" //only exists in integration test environment

const sendTelegramTextMessage = async function (
  bot: string,
  to: string | number,
  text: string,
  replyId: string | null = null,
  reply_markup: InlineKeyboardMarkup | ReplyKeyboardMarkup | null = null
) {
  let token
  let data: {
    chat_id: string | number
    text: string
    reply_to_message_id?: string
    reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup
  }
  if (bot == "factChecker") {
    token = process.env.TELEGRAM_CHECKER_BOT_TOKEN
  } else if (bot === "report") {
    token = process.env.TELEGRAM_REPORT_BOT_TOKEN
  } else if (bot === "repost") {
    token = process.env.TELEGRAM_REPOST_BOT_TOKEN
  } else {
    token = process.env.TELEGRAM_USER_BOT_TOKEN
  }
  data = {
    chat_id: to,
    text: text,
  }
  if (replyId) {
    data.reply_to_message_id = replyId
  }
  if (reply_markup) {
    data.reply_markup = reply_markup
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url: `${telegramHost}/bot${token}/sendMessage`,
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response)
    throw "error with sending telegram message"
  })
  console.log(response)
  return response
}

const updateTelegramReplyMarkup = async function (
  bot: string,
  chat_id: string | number,
  message_id: number,
  reply_markup: InlineKeyboardMarkup | ForceReply | null
) {
  let token
  if (bot == "factChecker") {
    token = process.env.TELEGRAM_CHECKER_BOT_TOKEN
  } else if (bot === "report") {
    token = process.env.TELEGRAM_REPORT_BOT_TOKEN
  } else {
    token = process.env.TELEGRAM_USER_BOT_TOKEN
  }
  const data = {
    chat_id: chat_id,
    message_id: message_id,
    reply_markup: reply_markup,
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url: `${telegramHost}/bot${token}/editMessageReplyMarkup`,
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response)
    throw "error with updating telegram reply markup"
  })
  return response
}

const sendTelegramImageMessage = async function (
  bot: string,
  to: string,
  url: string,
  caption: string | null,
  replyId: string | null = null
) {
  let token
  let data: {
    chat_id: string
    photo: string
    caption?: string | null
    reply_to_message_id?: string
  }
  if (bot == "factChecker") {
    token = process.env.TELEGRAM_CHECKER_BOT_TOKEN
  } else {
    token = process.env.TELEGRAM_USER_BOT_TOKEN
  }
  data = {
    chat_id: to,
    photo: url,
  }
  if (caption) {
    data.caption = caption
  }
  if (replyId) {
    data.reply_to_message_id = replyId
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url: `https://api.telegram.org/bot${token}/sendMessage`,
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response)
    throw "error with sending telegram photo"
  })
  return response
}

const sendTelegramImageMessageImageStream = async function (
  bot: string,
  to: string,
  imageStream: string,
  caption: string,
  replyId = null
) {
  let token
  if (bot == "factChecker") {
    token = process.env.TELEGRAM_CHECKER_BOT_TOKEN
  } else {
    token = process.env.TELEGRAM_USER_BOT_TOKEN
  }
  const formData = new FormData()
  formData.append("chat_id", to)
  formData.append("photo", imageStream)
  if (caption) {
    formData.append("caption", caption)
  }
  if (replyId) {
    formData.append("reply_to_message_id", replyId)
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url: `https://api.telegram.org/bot${token}/sendPhoto`,
    data: formData,
    headers: formData.getHeaders(),
  }).catch((error) => {
    functions.logger.log(error.response)
    throw "error with sending telegram photo"
  })
  return response
}

export {
  sendTelegramImageMessageImageStream,
  sendTelegramTextMessage,
  sendTelegramImageMessage,
  updateTelegramReplyMarkup,
}

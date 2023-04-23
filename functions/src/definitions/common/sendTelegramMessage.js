const axios = require("axios");
const functions = require('firebase-functions');
const FormData = require('form-data');

exports.sendTelegramTextMessage = async function (bot, to, text, replyId = null) {
  let token;
  let data;
  if (bot == "factChecker") {
    token = process.env.TELEGRAM_CHECKER_BOT_TOKEN
  } else {
    token = process.env.TELEGRAM_USER_BOT_TOKEN
  }
  data = {
    chat_id: to,
    text: text,
  }
  if (replyId) {
    data.reply_to_message_id = replyId;
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url:
      `https://api.telegram.org/bot${token}/sendMessage`,
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response);
    throw ("error with sending telegram message");
  });
  return response;
}

exports.sendTelegramImageMessage = async function (bot, to, url, caption, replyId = null) {
  let token;
  let data;
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
    data.caption = caption;
  }
  if (replyId) {
    data.reply_to_message_id = replyId;
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url:
      `https://api.telegram.org/bot${token}/sendMessage`,
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response);
    throw ("error with sending telegram photo");
  });
  return response;
}

exports.sendTelegramImageMessageImageStream = async function (bot, to, imageStream, caption, replyId = null) {
  let token;
  if (bot == "factChecker") {
    token = process.env.TELEGRAM_CHECKER_BOT_TOKEN
  } else {
    token = process.env.TELEGRAM_USER_BOT_TOKEN
  }
  const formData = new FormData();
  formData.append('chat_id', to);
  formData.append('photo', imageStream);
  if (caption) {
    formData.append('caption', caption);
  }
  if (replyId) {
    formData.append('reply_to_message_id', replyId);
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url:
      `https://api.telegram.org/bot${token}/sendPhoto`,
    data: formData,
    headers: formData.getHeaders(),
  }).catch((error) => {
    functions.logger.log(error.response);
    throw ("error with sending telegram photo");
  });
  return response;
}
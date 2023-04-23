const {
  sendWhatsappTextMessage,
  sendWhatsappImageMessage,
} = require('./sendWhatsappMessage')
const {
  sendTelegramTextMessage,
  sendTelegramImageMessage,
} = require('./sendTelegramMessage')
const { checkUrl } = require('./utils')

exports.sendTextMessage = async function (
  bot,
  to,
  text,
  replyId,
  platform = 'whatsapp',
  previewUrl = false
) {
  let res
  switch (platform) {
    case 'telegram':
      res = await sendTelegramTextMessage(bot, to, text, replyId)
      break
    case 'whatsapp':
      res = await sendWhatsappTextMessage(bot, to, text, replyId, previewUrl)
      break
  }
  return res
}

exports.sendImageMessage = async function (
  bot,
  to,
  urlOrId = null,
  caption = null,
  replyId = null,
  platform = 'whatsapp'
) {
  let res
  switch (platform) {
    case 'telegram':
      if (checkUrl(urlOrId)) {
        res = await sendTelegramImageMessage(bot, to, urlOrId, caption, replyId)
      }
      break
    case 'whatsapp':
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

//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import TelegramBot, { Update } from "node-telegram-bot-api"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { logger } from "firebase-functions/v2"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const bot = new TelegramBot(TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
// More bot handlers can go here...

// General message handler
bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/") && !msg.reply_to_message) {
    // Ignore commands as they are handled separately
    const chatId = msg.chat.id
    // Echo the message text back to the same chat
    bot.sendMessage(chatId, "Don't talk to me, instead use the dashboard =)")
  }
})

bot.onText(/\/start/, async (msg) => {
  if (msg.from) {
    const userId = msg.from.id.toString()
    const chatId = msg.chat.id.toString()
    const userQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", userId)
      .get()

    //check if user exists in database
    if (userQuerySnap.size > 0) {
      bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Press the CheckMate's Portal button to access our dashboard. You'll also get notified when there are new messages to check.`
      )
      //add function to start receiving messsages
    } else {
      bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Press the CheckMate's Portal button to onboard and access our dashboard. Once onboarded, you'll get notified when there are new messages to check.`
      )
    }
  } else {
    logger.log("No user id found")
  }
})

bot.onText(/\/activate/, async (msg) => {
  if (msg.from) {
    const checkerId = msg.from.id.toString()
    const chatId = msg.chat.id.toString()
    const checkerQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    //check if user exists in database
    if (checkerQuerySnap.size > 0) {
      const checkerSnap = checkerQuerySnap.docs[0]
      checkerSnap.ref.update({ isActive: true })
      bot.sendMessage(
        chatId,
        `You've been reactivated! Go to the CheckMate's Portal to start voting on messages`
      )
      //add function to start receiving messsages
    } else if (checkerQuerySnap.size === 0) {
      logger.error(`Checker with TelegramID ${checkerId} not found`)
    } else {
      logger.error(`Multiple checkers with TelegramID ${checkerId} found`)
    }
  } else {
    functions.logger.log("No user id found")
  }
})

bot.onText(/\/deactivate/, async (msg) => {
  if (msg.from) {
    const checkerId = msg.from.id.toString()
    const chatId = msg.chat.id.toString()
    const checkerQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    //check if user exists in database
    if (checkerQuerySnap.size > 0) {
      const checkerSnap = checkerQuerySnap.docs[0]
      checkerSnap.ref.update({ isActive: false })
      bot.sendMessage(
        chatId,
        `Sorry to see you go! CheckMate will no longer send you messages to review. When you're ready to return, type /activate to start voting on messages again.`
      )
      //add function to start receiving messsages
    } else if (checkerQuerySnap.size === 0) {
      logger.error(`Checker with TelegramID ${checkerId} not found`)
    } else {
      logger.error(`Multiple checkers with TelegramID ${checkerId} found`)
    }
  } else {
    functions.logger.log("No user id found")
  }
})

const checkerHandlerTelegram = async function (body: Update) {
  bot.processUpdate(body)
  return
}

const onCheckerPublishTelegram = onMessagePublished(
  {
    topic: "checkerEvents",
    secrets: [
      "TYPESENSE_TOKEN",
      "TELEGRAM_REPORT_BOT_TOKEN",
      "TELEGRAM_CHECKER_BOT_TOKEN",
    ],
  },
  async (event) => {
    if (
      event.data.message.json &&
      event.data.message.attributes.source === "telegram"
    ) {
      functions.logger.log(`Processing ${event.data.message.messageId}`)
      await checkerHandlerTelegram(event.data.message.json)
    } else {
      if (!event.data.message.json) {
        functions.logger.warn(
          `Unknown message type for messageId ${event.data.message.messageId})`
        )
      }
    }
  }
)

export { onCheckerPublishTelegram }

//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import TelegramBot from "node-telegram-bot-api"
import { onRequest } from "firebase-functions/v2/https"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const bot = new TelegramBot(TOKEN)

const app = express()

bot.onText(/\/start/, (message) => {
  bot.sendMessage(message.chat.id, "Welcome to the bot!")
})

// More bot handlers can go here...

app.post("/", async (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

const telegramHandler = onRequest(
  {
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
  },
  app
)

export { telegramHandler }

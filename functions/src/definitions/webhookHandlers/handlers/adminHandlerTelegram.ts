import * as admin from "firebase-admin"
import { Telegraf } from "telegraf"
import { logger } from "firebase-functions/v2"
import { message, callbackQuery } from "telegraf/filters"

const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)
const CHECKERS_CHAT_ID = Number(process.env.CHECKERS_CHAT_ID)
const adminBot = new Telegraf(ADMIN_BOT_TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

// Handle callback queries from inline buttons
adminBot.on(callbackQuery("data"), async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery?.data

    if (callbackData && callbackData.startsWith("publish")) {
      // Extract message ID if needed
      const messageId = callbackData.split("_")[1]

      if (!messageId) {
        logger.error("No message ID found in callback data")
        await ctx.answerCbQuery("No message ID found in callback data")
        return
      }

      const messageRef = db.collection("messages").doc(messageId)
      const messageSnap = await messageRef.get()
      if (!messageSnap.exists) {
        logger.error("Message not found in database")
        await ctx.answerCbQuery("Message not found in database")
        return
      }

      await messageRef.update({
        approvedForPublishing: true,
        approvedBy: ctx.from?.id,
      })

      // TODO: Add logic to approve community note for publishing
      logger.log("Approval request received for message:", messageId)

      // Respond to the callback query
      await ctx.answerCbQuery("Published")

      // Update the message to remove only the second button, keeping the first one
      const message = ctx.callbackQuery.message
      if (
        message &&
        "reply_markup" in message &&
        message.reply_markup?.inline_keyboard
      ) {
        const currentMarkup = message.reply_markup.inline_keyboard
        if (currentMarkup.length > 0) {
          // Keep only the first button in each row
          const updatedKeyboard = currentMarkup
            .map((row: any[]) => row.slice(0, 1))
            .filter((row: any[]) => row.length > 0)
          await ctx.editMessageReplyMarkup({ inline_keyboard: updatedKeyboard })
        } else {
          await ctx.editMessageReplyMarkup({ inline_keyboard: [] })
        }
      } else {
        // Fallback to removing all buttons if we can't determine the current structure
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] })
      }
    }
  } catch (error) {
    logger.error("Error handling callback query:", error)
    await ctx.answerCbQuery("An error occurred while processing your request.")
  }
})

// FIREBASE FUNCTIONS
const adminBotHandlerTelegram = async function (body: any) {
  await adminBot.handleUpdate(body)
}

export { adminBotHandlerTelegram }

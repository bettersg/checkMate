import * as admin from "firebase-admin"
import { Telegraf } from "telegraf"
import { logger } from "firebase-functions/v2"
import { callbackQuery } from "telegraf/filters"

const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)
const adminBot = new Telegraf(ADMIN_BOT_TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

// Handle callback queries from inline buttons
adminBot.on(callbackQuery("data"), async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery?.data

    if (!callbackData) {
      logger.error("No callback data found")
      await ctx.answerCbQuery("No callback data found")
      return
    }

    const [action, messageId] = callbackData.split("_")
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

    let button: { text: string; callback_data: string } | undefined = undefined

    switch (action) {
      case "publish":
        await messageRef.update({
          approvedForPublishing: true,
          approvedBy: ctx.from?.id,
        })

        logger.log("Approval request received for message:", messageId)

        // Respond to the callback query
        await ctx.answerCbQuery("Published")
        button = {
          text: "Unpublish",
          callback_data: `unpublish_${messageRef.id}`,
        }
        break
      case "unpublish":
        await messageRef.update({
          approvedForPublishing: false,
          approvedBy: null,
        })
        await ctx.answerCbQuery("Unpublished")
        button = {
          text: "Approve for publishing",
          callback_data: `publish_${messageRef.id}`,
        }
        break
    }
    // Update the message to remove only the second button, keeping the first one
    const langfuseBaseURL = process.env.LANGFUSE_BASE_URL
    const langfuseProjectId = process.env.LANGFUSE_PROJECT_ID
    const updatedKeyboard: Array<
      { text: string } & ({ url: string } | { callback_data: string })
    > = [
      {
        text: "View on LangFuse",
        url: `${langfuseBaseURL}/project/${langfuseProjectId}/traces/${messageRef.id}`,
      },
    ]
    if (button) {
      updatedKeyboard.push(button)
    }

    await ctx.editMessageReplyMarkup({
      inline_keyboard: [updatedKeyboard],
    })
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

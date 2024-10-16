import * as admin from "firebase-admin"
import { Telegraf } from "telegraf"
import { logger } from "firebase-functions/v2"
import { message } from "telegraf/filters"

const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)
const NEW_CHECKERS_CHAT_ID = Number(process.env.NEW_CHECKERS_CHAT_ID)
const adminBot = new Telegraf(ADMIN_BOT_TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

//check when new user joins chat
adminBot.on(message("new_chat_members"), async (ctx) => {
  const chatId = ctx.chat.id
  if (chatId === NEW_CHECKERS_CHAT_ID) {
    //may want to check chatID in future
    const newMembers = ctx.message.new_chat_members
    const messagePromises = newMembers.map(async (member) => {
      const checkerQueryRef = db
        .collection("checkers")
        .where("telegramId", "==", member.id)
      const checkerQuerySnapshot = await checkerQueryRef.get()
      if (checkerQuerySnapshot.empty) {
        logger.log(
          `Telegram username ${member.id} not found in checkers collection`
        )
        return
      }
      const name = checkerQuerySnapshot.docs[0].get("name") ?? "Checker"
      const username = member.username ? ` @${member.username}` : ""
      const message = `Hi ${name}${username},
    
Thanks for joining CheckMate as a checker 🙏🏻 and welcome to the CheckMate Checker's groupchat 🎉! Do check out the pinned message above to get oriented.`

      return ctx.reply(message, {
        link_preview_options: {
          is_disabled: true,
        },
        parse_mode: "HTML",
        disable_notification: true,
      })
    })
    await Promise.all(messagePromises)
  }
})

// FIREBASE FUNCTIONS
const adminBotHandlerTelegram = async function (body: any) {
  await adminBot.handleUpdate(body)
}

export { adminBotHandlerTelegram }

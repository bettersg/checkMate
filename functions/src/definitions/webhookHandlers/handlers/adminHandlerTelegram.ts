import * as admin from "firebase-admin"
import { Telegraf } from "telegraf"
import { logger } from "firebase-functions/v2"
import { message } from "telegraf/filters"

const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)
const CHECKERS_CHAT_ID = Number(process.env.CHECKERS_CHAT_ID)
const adminBot = new Telegraf(ADMIN_BOT_TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

//check when new user joins chat
adminBot.on(message("new_chat_members"), async (ctx) => {
  const chatId = ctx.chat.id
  if (chatId === CHECKERS_CHAT_ID) {
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
    
Welcome to the CheckMate comms channel 👋

This channel will be used to:
1. Inform CheckMates when updates/improvements are deployed to the bots

2. Inform CheckMates of any downtime in the system

3. Share relevant links from reputable news sources to aid fact checking. Note: Beyond this, CheckMates should not discuss what scores to assign, as this may make the collective outcome of CheckMates' votes biased.

4. You can refer to <a href="https://bit.ly/checkmates-wiki">our fact-checking wiki</a> for more tips on safe checking 😊

5. To explore more resources, head to <a href="https://t.me/CheckMate_Checker_Bot">your personal Checker's bot</a> and type / resources

If you've any feedback or queries, you can share them in the chat too 🤗`

      return ctx.reply(message, {
        link_preview_options: {
          is_disabled: true,
        },
        parse_mode: "HTML",
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

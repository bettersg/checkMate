//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import TelegramBot, { Update } from "node-telegram-bot-api"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { logger } from "firebase-functions/v2"
import { postOTPHandler, checkOTPHandler } from "../common/otpWhatsapp"
import {
  DocumentReference,
  DocumentSnapshot,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const bot = new TelegramBot(TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
// More bot handlers can go here...

// General message handler
bot.on("message", async (msg) => {
  if (msg.text && !msg.text.startsWith("/") && !msg.reply_to_message) {
    // Ignore commands as they are handled separately
    const chatId = msg.chat.id
    // Echo the message text back to the same chat
    await bot.sendMessage(
      chatId,
      "Don't talk to me, instead use the dashboard =)"
    )
  }
})

bot.onText(/\/start/, async (msg) => {
  if (msg.from) {
    const checkerId = msg.from.id
    const chatId = msg.chat.id
    const userQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    //check if user exists in database
    if (userQuerySnap?.docs[0].data()?.isOnboardingComplete) {
      await bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Press the CheckMate's Portal button to access our dashboard. You'll also get notified when there are new messages to check.`
      )
      //add function to start receiving messsages
    } else {
      await bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Press the CheckMate's Portal button to onboard and access our dashboard. Once onboarded, you'll get notified when there are new messages to check.`
      )
    }
  } else {
    logger.log("No user id found")
  }
})

bot.onText(/\/onboard/, async (msg) => {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id || ""
  let currentStep = "name"

  // Check user onboarding state
  const checkerDocQuery = db
    .collection("checkers")
    .where("telegramId", "==", telegramId)
  const checkerQuerySnap = await checkerDocQuery.get()

  if (!checkerQuerySnap.empty) {
    const checkerData = checkerQuerySnap.docs[0]
    currentStep = checkerData.data().onboardingStatus
  }

  console.log(currentStep)

  switch (currentStep) {
    case "name":
      await sendNamePrompt(chatId, checkerQuerySnap)
      break
    case "number":
      await sendNumberPrompt(chatId, checkerQuerySnap)
      break
    case "otp":
      await sendOTPPrompt(chatId, checkerQuerySnap)
      break
    case "quiz":
      await sendQuizPrompt(chatId, checkerQuerySnap)
      break
    case "waGroup":
      await sendWAGroupPrompt(chatId, checkerQuerySnap)
      break
    case "tgGroup":
      await sendTGGroupPrompt(chatId, checkerQuerySnap)
      break
    case "completed":
      await bot.sendMessage(
        chatId,
        `You have successfully onboarded as a CheckMate Checker!`
      )
      break
  }
})

bot.onText(/\/activate/, async (msg) => {
  if (msg.from) {
    const checkerId = msg.from.id
    const chatId = msg.chat.id
    const checkerQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    //check if user exists in database
    if (checkerQuerySnap.size > 0) {
      const checkerSnap = checkerQuerySnap.docs[0]
      await checkerSnap.ref.update({ isActive: true })
      await bot.sendMessage(
        chatId,
        `You've been reactivated! Go to the CheckMate's Portal to start voting on messages`
      )
      return
      //add function to start receiving messsages
    } else if (checkerQuerySnap.size === 0) {
      logger.error(`Checker with TelegramID ${checkerId} not found`)
    } else {
      logger.error(`Multiple checkers with TelegramID ${checkerId} found`)
    }
    await bot.sendMessage(chatId, "An error happened, please try again later")
  } else {
    functions.logger.log("No user id found")
  }
})

bot.onText(/\/deactivate/, async (msg) => {
  if (msg.from) {
    const checkerId = msg.from.id
    const chatId = msg.chat.id
    const checkerQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    //check if user exists in database
    if (checkerQuerySnap.size > 0) {
      const checkerSnap = checkerQuerySnap.docs[0]
      await checkerSnap.ref.update({ isActive: false })
      await bot.sendMessage(
        chatId,
        `Sorry to see you go! CheckMate will no longer send you messages to review. When you're ready to return, type /activate to start voting on messages again.`
      )
      return
      //add function to start receiving messsages
    } else if (checkerQuerySnap.size === 0) {
      logger.error(`Checker with TelegramID ${checkerId} not found`)
    } else {
      logger.error(`Multiple checkers with TelegramID ${checkerId} found`)
    }
    await bot.sendMessage(chatId, "An error happened, please try again later")
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

const sendNamePrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  const namePrompt = await bot.sendMessage(
    chatId,
    "Hi, what's your full name?",
    {
      reply_markup: {
        force_reply: true,
      },
    }
  )

  bot.onReplyToMessage(chatId, namePrompt.message_id, async (nameMsg) => {
    const name = nameMsg.text

    //create checker entry in DB
    if (checkerQuerySnap.empty) {
      // postCheckerHandler({ name, type: "human", telegramId, "number" });  //create this as separate function
      sendNumberPrompt(chatId, checkerQuerySnap)
    } else if (checkerQuerySnap.size > 0) {
      await checkerQuerySnap.docs[0].ref.update({
        name,
        onboardingStatus: "number",
      })
      sendNumberPrompt(chatId, checkerQuerySnap)
    }
    // else {
    //   logger.error(
    //     `Multiple checkers with TelegramID ${
    //       checkerQuerySnap.docs[0].data().telegramId
    //     } found`
    //   )
    // }
  })
}

const sendNumberPrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  const numberPrompt = await bot.sendMessage(
    chatId,
    `What is your HP no. in +(country code) (HP no.) format e.g +65 12341234`,
    {
      reply_markup: {
        force_reply: true,
      },
    }
  )

  bot.onReplyToMessage(chatId, numberPrompt.message_id, async (numberMsg) => {
    const whatsappId = numberMsg.text
    await checkerQuerySnap.docs[0].ref.update({
      whatsappId,
      onboardingStatus: "otp",
    })

    sendOTPPrompt(chatId, checkerQuerySnap)
  })
}

const sendOTPPrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  const whatsappId = checkerQuerySnap.docs[0].data()?.whatsappId
  const telegramId = checkerQuerySnap.docs[0].data()?.telegramId

  await postOTPHandler(telegramId, whatsappId)
  await bot.sendMessage(
    chatId,
    `We have sent a 6-digit OTP to ${whatsappId}. Please check your Whatsapp for the OTP.`
  )
  const otpPrompt = await bot.sendMessage(chatId, `Verify your OTP:`, {
    reply_markup: {
      force_reply: true,
    },
  })

  bot.onReplyToMessage(chatId, otpPrompt.message_id, async (otpMsg) => {
    const otp = otpMsg?.text || ""
    await bot.sendMessage(chatId, "Verified OTP")

    // handle different check cases
    await checkOTPHandler(telegramId, otp)

    await checkerQuerySnap.docs[0].ref.update({
      whatsappId,
      onboardingStatus: "quiz",
    })

    sendQuizPrompt(chatId, checkerQuerySnap)
  })
}

const sendQuizPrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  await bot.sendMessage(
    chatId,
    `Thank you for verifying your Whatsapp number. Please proceed to complete the onboarding quiz: https://better-sg.typeform.com/to/MlihTUDx`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have finished the onboarding quiz",
              callback_data: "1",
            },
          ],
          [
            {
              text: "No, I will get to it",
              callback_data: "2",
            },
          ],
        ],
      },
    }
  )

  bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data
    const msg = callbackQuery.message

    console.log(checkerQuerySnap.docs[0].data()?.onboardingStatus === "quiz")
    console.log(checkerQuerySnap.docs[0].data()?.onboardingStatus === "waGroup")

    if (action === "1") {
      if (checkerQuerySnap.docs[0].data()?.onboardingStatus === "waGroup") {
        sendWAGroupPrompt(chatId, checkerQuerySnap)
      } else {
        await bot.sendMessage(chatId, `Please complete the Onboarding quiz.`)
      }
    }
  })
}

const sendWAGroupPrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  await bot.sendMessage(
    chatId,
    "Thank you for completing the quiz. Please add the CheckMate Whatsapp bot: https://wa.me/6580432188.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have added the WA bot",
              callback_data: "1",
            },
          ],
          [
            {
              text: "No, I will get to it",
              callback_data: "2",
            },
          ],
        ],
      },
    }
  )

  bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data
    const msg = callbackQuery.message

    if (action === "1") {
      // check WA bot completion

      await checkerQuerySnap.docs[0].ref.update({
        onboardingStatus: "tgGroup",
      })

      sendTGGroupPrompt(chatId, checkerQuerySnap)
    }
  })
}

const sendTGGroupPrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  await bot.sendMessage(
    chatId,
    "Thank you for adding the WA bot. Please add the CheckMate Checker's telegram bot: https://t.me/CheckMate_Checker_Bot.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have added the telegram bot",
              callback_data: "1",
            },
          ],
          [
            {
              text: "No, I will get to it",
              callback_data: "2",
            },
          ],
        ],
      },
    }
  )

  bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data
    const msg = callbackQuery.message

    if (action === "1") {
      // check tele bot completion
      await checkerQuerySnap.docs[0].ref.update({
        onboardingStatus: "completed",
        isOnboarding: true,
      })

      sendCompletionPrompt(chatId)
    }
  })
}

const sendCompletionPrompt = async (chatId: number) => {
  await bot.sendMessage(
    chatId,
    "Thank you for adding the telegram bot. Please refer to CheckMate wiki for more information: https://checkmate.sg/."
  )

  await bot.sendMessage(
    chatId,
    `You have successfully onboarded as a CheckMate Checker!`
  )
}

export { onCheckerPublishTelegram }

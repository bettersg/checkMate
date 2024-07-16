//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import TelegramBot, { Update } from "node-telegram-bot-api"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
import { postOTPHandler, checkOTPHandler } from "../common/otpWhatsapp"
import { QuerySnapshot } from "firebase-admin/firestore"
import { getThresholds } from "../common/utils"
import { CheckerData } from "../../types"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const CHECKERS_CHAT_ID = String(process.env.CHECKERS_CHAT_ID)
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
    if (!userQuerySnap.docs[0]) {
      await bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Type /onboard to begin your CheckMate Checker's journey.`
      )
    } else if (userQuerySnap.docs[0].data().isOnboardingComplete) {
      await bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Press the CheckMate's Portal button to access our dashboard. You'll also get notified when there are new messages to check.`
      )
      //add function to start receiving messsages
    } else {
      await bot.sendMessage(
        chatId,
        `Welcome back to the checker bot! Type /onboard to begin your CheckMate Checker's journey.`
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
      await sendQuizPrompt(chatId)
      break
    case "waGroup":
      await sendWAGroupPrompt(chatId)
      break
    case "tgGroup":
      await sendTGGroupPrompt(chatId)
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
    const telegramId = nameMsg.from?.id

    if (checkerQuerySnap.empty) {
      //create checker entry in DB
      if (name && telegramId) {
        await postCheckerHandler(name, telegramId)
        const checkerDocQuery = db
          .collection("checkers")
          .where("telegramId", "==", telegramId)
        const newCheckerQuerySnap = await checkerDocQuery.get()

        sendNumberPrompt(chatId, newCheckerQuerySnap)
      }
    } else if (checkerQuerySnap.size > 0) {
      await checkerQuerySnap.docs[0].ref.update({
        name,
        onboardingStatus: "number",
      })
      sendNumberPrompt(chatId, checkerQuerySnap)
    }
  })
}

const sendNumberPrompt = async (
  chatId: number,
  checkerQuerySnap: QuerySnapshot
) => {
  const numberPrompt = await bot.sendMessage(
    chatId,
    `What is your HP no. in (country code)(HP no.) format e.g 6512341234`,
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
  checkerQuerySnap: QuerySnapshot,
  otpSent: boolean = false
) => {
  const snapshot = await checkerQuerySnap.docs[0].ref.get()
  const whatsappId = snapshot.data()?.whatsappId
  const telegramId = snapshot.data()?.telegramId

  if (!otpSent) {
    const postOTPHandlerRes = await postOTPHandler(telegramId, whatsappId)

    if (postOTPHandlerRes) {
      await bot.sendMessage(
        chatId,
        `OTP request limit exceeded. Please try again in 24 hours.`
      )
      return
    }
    await bot.sendMessage(
      chatId,
      `We have sent a 6-digit OTP to ${whatsappId}. Please check your Whatsapp for the OTP.`
    )
  }
  const otpPrompt = await bot.sendMessage(
    chatId,
    !otpSent ? `Verify your OTP:` : `OTP Mismatch. Please reverify your OTP:`,
    {
      reply_markup: {
        force_reply: true,
      },
    }
  )

  bot.onReplyToMessage(chatId, otpPrompt.message_id, async (otpMsg) => {
    const otpAttempt = otpMsg?.text || ""

    const result = await checkOTPHandler(telegramId, otpAttempt, whatsappId)

    try {
      if (result === "OTP verified") {
        await checkerQuerySnap.docs[0].ref.update({
          whatsappId,
          onboardingStatus: "quiz",
        })
        sendQuizPrompt(chatId)
      } else if (result === "OTP mismatch") {
        sendOTPPrompt(chatId, checkerQuerySnap, true)
      } else if (result === "OTP max attempts") {
        await bot.sendMessage(
          chatId,
          `Maximum OTP attempts reached. We will send a new OTP.`
        )
        sendOTPPrompt(chatId, checkerQuerySnap)
      }
    } catch (error) {
      console.log("OTP error: " + error)
    }
  })
}

const sendQuizPrompt = async (chatId: number) => {
  await bot.sendMessage(
    chatId,
    `Thank you for verifying your Whatsapp number. Please proceed to complete the onboarding quiz: https://better-sg.typeform.com/to/MlihTUDx`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have finished the onboarding quiz",
              callback_data: "QUIZ_COMPLETED",
            },
          ],
        ],
      },
    }
  )
}

const sendWAGroupPrompt = async (chatId: number) => {
  await bot.sendMessage(
    chatId,
    "Thank you for completing the quiz. Please add the CheckMate Whatsapp bot: https://wa.me/6580432188.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have added the WA bot",
              callback_data: "WA_COMPLETED",
            },
          ],
        ],
      },
    }
  )
}

const sendTGGroupPrompt = async (chatId: number) => {
  await bot.sendMessage(
    chatId,
    "Thank you for adding the WA bot. Please add the CheckMate Checker's telegram bot: https://t.me/CheckMate_Checker_Bot.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have added the telegram bot",
              callback_data: "TG_COMPLETED",
            },
          ],
        ],
      },
    }
  )
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

bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data
  const chatId = callbackQuery.message?.chat.id
  if (chatId != undefined) {
    const checkerDocQuery = db
      .collection("checkers")
      .where("telegramId", "==", callbackQuery.from.id)
    const checkerQuerySnap = await checkerDocQuery.get()

    switch (action) {
      case "QUIZ_COMPLETED":
        if (checkerQuerySnap.docs[0].data()?.onboardingStatus === "waGroup") {
          sendWAGroupPrompt(chatId)
        } else {
          await bot.sendMessage(chatId, `Please complete the Onboarding quiz.`)
        }

        break
      case "WA_COMPLETED":
        // check WA bot completion
        const whatsappId = checkerQuerySnap.docs[0].data()?.whatsappId
        const userSnap = await db.collection("users").doc(whatsappId).get()

        if (userSnap.exists) {
          await checkerQuerySnap.docs[0].ref.update({
            onboardingStatus: "tgGroup",
          })

          sendTGGroupPrompt(chatId)
        } else {
          await bot.sendMessage(
            chatId,
            `Please add the CheckMate Whatsapp bot: https://wa.me/6580432188.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Yes, I have added the WA bot",
                      callback_data: "WA_COMPLETED",
                    },
                  ],
                ],
              },
            }
          )
        }
        break
      case "TG_COMPLETED":
        // check tele bot completion
        const member = await bot.getChatMember(
          CHECKERS_CHAT_ID,
          callbackQuery.from.id
        )
        if (member.status == "member") {
          await checkerQuerySnap.docs[0].ref.update({
            onboardingStatus: "completed",
            isOnboardingComplete: true,
          })

          sendCompletionPrompt(chatId)
        } else {
          await bot.sendMessage(
            chatId,
            `Please add the CheckMate Checker's telegram bot: https://t.me/CheckMate_Checker_Bot.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Yes, I have added the telegram bot",
                      callback_data: "TG_COMPLETED",
                    },
                  ],
                ],
              },
            }
          )
        }
        break
      default:
        console.log("Unhandled callback data:", action)
    }
  }
})

const postCheckerHandler = async (name: string, telegramId: number) => {
  logger.info("ENTERED")

  if (!name || (!telegramId && telegramId !== null)) {
    logger.error("Name and telegramId are required")
  }

  const thresholds = await getThresholds()
  const newChecker: CheckerData = {
    name,
    type: "human",
    isActive: false,
    isOnboardingComplete: false,
    onboardingStatus: "number",
    isAdmin: false,
    singpassOpenId: null,
    telegramId,
    whatsappId: null,
    voteWeight: 1,
    level: 0,
    experience: 0,
    tier: "beginner",
    numVoted: 0,
    numReferred: 0,
    numReported: 0,
    numCorrectVotes: 0,
    numNonUnsureVotes: 0,
    numVerifiedLinks: 0,
    preferredPlatform: "telegram",
    lastVotedTimestamp: null,
    getNameMessageId: null,
    leaderboardStats: {
      numVoted: 0,
      numCorrectVotes: 0,
      totalTimeTaken: 0,
      score: 0,
    },
    programData: {
      isOnProgram: true,
      programStart: Timestamp.fromDate(new Date()),
      programEnd: null,
      numVotesTarget: thresholds.volunteerProgramVotesRequirement ?? 0, //target number of messages voted on to complete program
      numReferralTarget: thresholds.volunteerProgramReferralRequirement ?? 0, //target number of referrals made to complete program
      numReportTarget: thresholds.volunteerProgramReportRequirement ?? 0, //number of non-trivial messages sent in to complete program
      accuracyTarget: thresholds.volunteerProgramAccuracyRequirement ?? 0, //target accuracy of non-unsure votes
      numVotesAtProgramStart: 0,
      numReferralsAtProgramStart: 0,
      numReportsAtProgramStart: 0,
      numCorrectVotesAtProgramStart: 0,
      numNonUnsureVotesAtProgramStart: 0,
      numVotesAtProgramEnd: null,
      numReferralsAtProgramEnd: null,
      numReportsAtProgramEnd: null,
      numCorrectVotesAtProgramEnd: null,
      numNonUnsureVotesAtProgramEnd: null,
    },
  }

  logger.info("Creating new checker", newChecker)

  await db.collection("checkers").add(newChecker)
}

export { onCheckerPublishTelegram }

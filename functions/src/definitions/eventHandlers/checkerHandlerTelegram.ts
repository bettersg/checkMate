//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import TelegramBot, { Update } from "node-telegram-bot-api"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { logger } from "firebase-functions/v2"
import { DocumentSnapshot, Timestamp } from "firebase-admin/firestore"
import { sendOTP, checkOTP } from "../common/otp"
import { getThresholds } from "../common/utils"
import { CheckerData } from "../../types"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)
const CHECKERS_CHAT_ID = String(process.env.CHECKERS_CHAT_ID)
const bot = new TelegramBot(TOKEN)
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN)
const CHECKERS_GROUP_LINK = String(process.env.CHECKERS_GROUP_LINK)
const USERS_WHATSAPP_NUMBER = String(process.env.USERS_WHATSAPP_NUMBER)
const CHECKER_APP_HOST = process.env.CHECKER_APP_HOST
const TYPEFORM_URL = process.env.TYPEFORM_URL
const WHATSAPP_BOT_LINK =
  process.env.ENVRIONMENT === "PROD"
    ? "https://ref.checkmate.sg/add"
    : `https://wa.me/${USERS_WHATSAPP_NUMBER}`
const NLB_SURE_IMAGE =
  "AgACAgUAAxkBAAMGZrcIvuTv2tYdacTaByMTdwGvhswAArm-MRsZZrlVOQUHfLk2PKkBAAMCAANzAAM1BA"
const resources = `Here are some resources 📚 you might find useful:
1) <a href="https://checkmate.sg">Our official CheckMate website</a>
2) <a href="https://bit.ly/checkmates-wiki">Our fact-checking wiki</a>
3) <a href="https://bit.ly/checkmates-quiz">The Typeform quiz you just took</a>`

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
      "Don't send me messages freely, use the options provided or interact with the dashboard instead"
    )
  } else if (msg.text && msg.reply_to_message) {
    const checkerId = msg.from?.id
    const chatId = msg.chat.id

    const userQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    const userSnap = userQuerySnap.docs[0]

    // check if replied message hits either onboarding case 1) name 2) HP number 3) otp
    if (
      userSnap.data().lastTrackedMessageId == msg.reply_to_message.message_id
    ) {
      let currentStep = userSnap.data().onboardingStatus
      let whatsappId = ""

      switch (currentStep) {
        case "name":
          const name = msg.text
          await userSnap.ref.update({
            name,
          })
          await sendNumberPrompt(chatId, userSnap)
          break
        case "number":
          whatsappId = msg.text.replace("+", "").replace(" ", "")

          //check if its a number with 8 digits and starts with 9 or 8
          if (
            whatsappId.length === 8 &&
            (whatsappId.startsWith("9") || whatsappId.startsWith("8"))
          ) {
            whatsappId = `65${whatsappId}`
          }

          await userSnap.ref.update({
            whatsappId,
          })

          await sendOTPPrompt(chatId, userSnap, whatsappId)
          break
        case "verify":
          const otpAttempt = msg?.text || ""
          whatsappId = userSnap.data().whatsappId

          const result = await checkOTP(otpAttempt, whatsappId, userSnap.id)

          const status = result.status
          const message = result.message
          try {
            if (status === "success") {
              await userSnap.ref.update({
                whatsappId,
                onboardingStatus: "quiz",
                lastTrackedMessageId: null,
              })
              await sendQuizPrompt(chatId, userSnap, true)
            } else {
              if (message === "OTP mismatch") {
                await sendVerificationPrompt(chatId, userSnap, true)
              } else if (message === "OTP max attempts") {
                await bot.sendMessage(
                  chatId,
                  `Maximum OTP attempts reached. We will send a new OTP.`
                )
                await sendOTPPrompt(chatId, userSnap, whatsappId)
              } else {
                console.error(`OTP error with ${chatId}: ${message}`)
                await bot.sendMessage(
                  chatId,
                  "Apologies - an error occured, please try again later."
                )
              }
            }
            break
          } catch (error) {
            logger.log("Error in OTP verification", error)
          }
        default:
          logger.log("Unhandled onboarding stage: ", currentStep)
      }
    } else {
      await bot.sendMessage(chatId, "Please reply to the right message :-)")
    }
  }
})

bot.onText(/\/start$/, async (msg) => {
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

bot.onText(/\/onboard$/, async (msg) => {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id
  let currentStep = "name"

  // Check user onboarding state
  const checkerDocQuery = db
    .collection("checkers")
    .where("telegramId", "==", telegramId)
  let checkerQuerySnap = await checkerDocQuery.get()
  let checkerSnap: DocumentSnapshot

  if (checkerQuerySnap.empty) {
    //create checker here
    if (telegramId) {
      const checkerRef = await createChecker(telegramId)
      checkerSnap = await checkerRef.get()
    } else {
      logger.log("No user id found")
      await bot.sendMessage(chatId, "An error happened, please try again later")
      return
    }
  } else {
    checkerSnap = checkerQuerySnap.docs[0]
    currentStep = checkerSnap.data()?.onboardingStatus
    if (checkerQuerySnap.size > 1) {
      logger.error(`Multiple checkers with TelegramID ${telegramId} found`)
    }
  }

  const whatsappId = checkerSnap.data()?.whatsappId

  switch (currentStep) {
    case "name":
      await sendNamePrompt(chatId, checkerSnap)
      break
    case "number":
      await sendNumberPrompt(chatId, checkerSnap)
      break
    case "otpSent":
      await sendOTPPrompt(chatId, checkerSnap, whatsappId)
      break
    case "verify":
      await sendOTPPrompt(chatId, checkerSnap, whatsappId)
      break
    case "quiz":
      await sendQuizPrompt(chatId, checkerSnap, true)
      break
    case "onboardWhatsapp":
      await sendWAGroupPrompt(chatId, checkerSnap, true)
      break
    case "joinGroupChat":
      await sendTGGroupPrompt(chatId, checkerSnap, true)
      break
    case "completed":
      await bot.sendMessage(
        chatId,
        `Hi there! You have already onboarded as a CheckMate Checker. Do explore the CheckMates' Portal to check out what you can do. Otherwise if you would like to go through onboarding again, click on the respective button below.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "CheckMates' Portal",
                  web_app: { url: `${CHECKER_APP_HOST}/` },
                },
                {
                  text: "Go through onboarding again",
                  callback_data: "ONBOARD_AGAIN",
                },
              ],
            ],
          },
        }
      )
      break
  }
})

bot.onText(/\/activate$/, async (msg) => {
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

bot.onText(/\/deactivate$/, async (msg) => {
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

bot.onText(/\/resources$/, async (msg) => {
  if (msg.from) {
    const checkerId = msg.from.id
    await bot.sendMessage(checkerId, resources, { parse_mode: "HTML" })
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
      "TELEGRAM_ADMIN_BOT_TOKEN",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
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
  checkerSnap: DocumentSnapshot
) => {
  const namePrompt = await bot.sendMessage(
    chatId,
    "Welcome to CheckMate! How shall we address you?",
    {
      reply_markup: {
        force_reply: true,
      },
    }
  )

  await checkerSnap.ref.update({
    lastTrackedMessageId: namePrompt.message_id,
  })
}

const sendNumberPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot
) => {
  const numberPrompt = await bot.sendMessage(
    chatId,
    `What is your WhatsApp phone number? Please include the country code, but omit the "+", e.g 6591234567`,
    {
      reply_markup: {
        force_reply: true,
      },
    }
  )
  await checkerSnap.ref.update({
    onboardingStatus: "number",
    lastTrackedMessageId: numberPrompt.message_id,
  })
}

const sendOTPPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot,
  whatsappId: string
) => {
  const inlineButtons = {
    rekey: {
      text: "Re-enter phone number",
      callback_data: "REQUEST_NUMBER",
    },
    resendOTP: {
      text: "Get a new OTP",
      callback_data: "SEND_OTP",
    },
    verifyOTP: {
      text: "Verify OTP",
      callback_data: "VERIFY_OTP",
    },
  }

  logger.log(`sending OTP to ${whatsappId}`)
  const postOTPHandlerRes = await sendOTP(whatsappId, checkerSnap.id)
  if (postOTPHandlerRes.status === "success") {
    await bot.sendMessage(
      chatId,
      `We have sent a 6-digit OTP to your WhatsApp at +${whatsappId}. Please check your WhatsApp for the OTP, and hit "Verify OTP" below.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              inlineButtons.verifyOTP,
              inlineButtons.resendOTP,
              inlineButtons.rekey,
            ],
          ],
        },
      }
    )
    await checkerSnap.ref.update({
      onboardingStatus: "otpSent",
    })
  } else {
    switch (postOTPHandlerRes.message) {
      case "OTP request limit exceeded":
        await bot.sendMessage(
          chatId,
          `An error occured, likely because too many OTPs were requested. Please try again in 10 minutes.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  inlineButtons.verifyOTP,
                  inlineButtons.resendOTP,
                  inlineButtons.rekey,
                ],
              ],
            },
          }
        )
        break
      default:
        await bot.sendMessage(
          chatId,
          `An error occured, likely because the phone number was keyed in wrongly.`,
          {
            reply_markup: {
              inline_keyboard: [[inlineButtons.rekey]],
            },
          }
        )
        break
    }
    return
  }
}

const sendVerificationPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot,
  rePrompt: boolean = true
) => {
  const otpPrompt = await bot.sendMessage(
    chatId,
    !rePrompt
      ? `Verify your OTP:`
      : `The OTP you provided doesn't match that in our records. Please key it in again:`,
    {
      reply_markup: {
        force_reply: true,
      },
    }
  )

  await checkerSnap.ref.update({
    lastTrackedMessageId: otpPrompt.message_id,
    onboardingStatus: "verify",
  })
}

const sendQuizPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot,
  isFirstPrompt: boolean
) => {
  const whatsappId = checkerSnap.data()?.whatsappId
  const name = checkerSnap.data()?.name
  await bot.sendMessage(
    chatId,
    `${
      isFirstPrompt
        ? "Thank you for verifying your WhatsApp number"
        : "We noticed you have not completed the quiz yet"
    }. Please proceed to complete the onboarding quiz <a href="${TYPEFORM_URL}#name=${name}&phone=${whatsappId}">here</a>. This will equip you with the skills and knowledge to be a better checker!`,
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
      parse_mode: "HTML",
    }
  )
}

const sendWAGroupPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot,
  isFirstPrompt: boolean
) => {
  if (isFirstPrompt) {
    await checkerSnap.ref.update({
      onboardingStatus: "onboardWhatsapp",
    })
  }
  await bot.sendMessage(
    chatId,
    `${
      isFirstPrompt
        ? "Thank you for completing the quiz! We hope you found it useful. Next, if you've not already done so, p"
        : "We noticed you have not added the WhatApp service yet. P"
    }lease onboard to our CheckMate WhatsApp service <a href="${WHATSAPP_BOT_LINK}?utm_source=checkersonboarding&utm_medium=telegram&utm_campaign=${chatId}">here</a>, by sending in the pre-populated message to our WhatsApp number. This is where you can report messages to CheckMate, and is where the messages you vote on are sent in from!`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have added the WA service",
              callback_data: "WA_COMPLETED",
            },
          ],
        ],
      },
      parse_mode: "HTML",
    }
  )
}

const sendTGGroupPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot,
  isFirstPrompt: boolean
) => {
  if (isFirstPrompt) {
    await checkerSnap.ref.update({
      onboardingStatus: "joinGroupChat",
    })
  }
  await bot.sendMessage(
    chatId,
    `${
      isFirstPrompt
        ? "Thank you for onboarding to the WhatsApp service. Next, p"
        : "We noticed you have not joined the groupchat yet. P"
    }lease join the <a href="${CHECKERS_GROUP_LINK}">CheckMate Checker's groupchat</a>. This group chat is important as it will be used to:

1) Inform CheckMates of any downtime in the system, updates/improvements being deployed to the bots

2) Share relevant links from reputable news sources to aid fact-checking. Do note that beyond this, CheckMates should not discuss what to vote, as this may make the collective outcome of CheckMates' votes biased.`, //UPDATE the groupchat link here
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have joined the Telegram Chat Group",
              callback_data: "TG_COMPLETED",
            },
          ],
        ],
      },
      parse_mode: "HTML",
    }
  )
}

const sendNLBPrompt = async (chatId: number, checkerSnap: DocumentSnapshot) => {
  await checkerSnap.ref.update({
    onboardingStatus: "nlb",
  })
  await bot.sendPhoto(chatId, NLB_SURE_IMAGE, {
    caption: `One last thing - CheckMate is partnering with the National Library Board to grow a vibrant learning community aimed at safeguarding the community from scams and misinformation.

If you'd like to get better at fact-checking, or if you're keen to meet fellow CheckMates' in person, do check out and join the <a href="https://www.nlb.gov.sg/main/site/learnx/explore-communities/explore-communities-content/sure-learning-community">SURE Learning Community</a>. It'll be fun!`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Complete Onboarding",
            callback_data: "COMPLETED",
          },
        ],
      ],
    },
  })
}

const sendCompletionPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot
) => {
  await checkerSnap.ref.update({
    onboardingStatus: "nlb",
    isOnboardingComplete: true,
    isActive: true,
  })
  await bot.sendMessage(
    chatId,
    `You have now successfully onboarded as a CheckMate Checker! You will now receive notifications when there are new messages to check.

${resources}

You may view these resources with the command /resources.
    
Do explore the CheckMates' Portal below, or by pressing the button at the bottom left of the screen.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "CheckMates' Portal",
              web_app: { url: `${CHECKER_APP_HOST}/` },
            },
          ],
        ],
      },
      parse_mode: "HTML",
    }
  )
}

//checks for sendWAGroupPrompt / sendTGGroupPrompt / sendCompletionPrompt responses + FUA
bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data
  const chatId = callbackQuery.message?.chat.id
  if (chatId != undefined) {
    const checkerDocQuery = db
      .collection("checkers")
      .where("telegramId", "==", callbackQuery.from.id)
    const checkerQuerySnap = await checkerDocQuery.get()
    const checkerDocSnap = checkerQuerySnap.docs[0]
    const whatsappId = checkerDocSnap.data()?.whatsappId
    switch (action) {
      case "QUIZ_COMPLETED":
        if (checkerDocSnap.data()?.isQuizComplete) {
          sendWAGroupPrompt(chatId, checkerDocSnap, true)
        } else {
          sendQuizPrompt(chatId, checkerDocSnap, false)
        }
        break
      case "WA_COMPLETED":
        // check WA bot completion
        const userSnap = await db.collection("users").doc(whatsappId).get()
        if (userSnap.exists) {
          sendTGGroupPrompt(chatId, checkerDocSnap, true)
        } else {
          sendWAGroupPrompt(chatId, checkerDocSnap, false)
        }
        break
      case "TG_COMPLETED":
        // check tele bot completion
        try {
          const member = await adminBot.getChatMember(
            CHECKERS_CHAT_ID,
            callbackQuery.from.id
          )
          if (member.status) {
            sendNLBPrompt(chatId, checkerDocSnap)
          } else {
            sendTGGroupPrompt(chatId, checkerDocSnap, false)
          }
        } catch (error) {
          logger.log(error)
          sendTGGroupPrompt(chatId, checkerDocSnap, false)
        }
        break
      case "COMPLETED":
        sendCompletionPrompt(chatId, checkerDocSnap)
        break
      case "REQUEST_NUMBER":
        await sendNumberPrompt(chatId, checkerDocSnap)
        break
      case "SEND_OTP":
        await sendOTPPrompt(chatId, checkerDocSnap, whatsappId)
        break
      case "VERIFY_OTP":
        await sendVerificationPrompt(chatId, checkerDocSnap, false)
        break
      case "ONBOARD_AGAIN":
        await checkerDocSnap.ref.update({
          onboardingStatus: "name",
          lastTrackedMessageId: null,
        })
        await sendNamePrompt(chatId, checkerDocSnap)
        break
      default:
        logger.log("Unhandled callback data: ", action)
    }
  }
})

const createChecker = async (telegramId: number) => {
  const thresholds = await getThresholds()
  const checkerRef = await db.runTransaction(async (transaction) => {
    //transaction so wont have race conditions assuming the user might hit /onboard twice
    const checkerDocQuery = db
      .collection("checkers")
      .where("telegramId", "==", telegramId)
    const checkerQuerySnap = await transaction.get(checkerDocQuery)

    if (checkerQuerySnap.empty) {
      // Create a new checker only if it doesn't exist
      const newCheckerRef = db.collection("checkers").doc()
      const newChecker: CheckerData = {
        name: null,
        type: "human",
        isActive: false,
        isOnboardingComplete: false,
        isQuizComplete: false,
        quizScore: null,
        onboardingStatus: "name",
        lastTrackedMessageId: null,
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
          numReferralTarget:
            thresholds.volunteerProgramReferralRequirement ?? 0, //target number of referrals made to complete program
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
      transaction.set(newCheckerRef, newChecker)
      return newCheckerRef
    } else {
      // Checker already exists
      throw new Error("Checker already exists")
    }
  })
  //return checker document reference
  return checkerRef
}

export { onCheckerPublishTelegram }

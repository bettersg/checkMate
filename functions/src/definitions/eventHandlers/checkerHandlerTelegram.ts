import * as admin from "firebase-admin"
import { Telegraf } from "telegraf"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { logger } from "firebase-functions/v2"
import { DocumentSnapshot, Timestamp } from "firebase-admin/firestore"
import { sendOTP, checkOTP } from "../common/otp"
import { getThresholds } from "../common/utils"
import { CheckerData } from "../../types"
import { message, callbackQuery } from "telegraf/filters"
import { isNumeric } from "../common/utils"
import { updateNudge } from "../../services/checker/nudgeService"
import { reactivateChecker } from "../../services/checker/managementService"
import { enqueueTask } from "../common/cloudTasks"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const ADMIN_BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN)
const CHECKERS_CHAT_ID = String(process.env.CHECKERS_CHAT_ID)
const bot = new Telegraf(TOKEN)
const adminBot = new Telegraf(ADMIN_BOT_TOKEN)
const CHECKERS_GROUP_LINK = String(process.env.CHECKERS_GROUP_LINK)
const USERS_WHATSAPP_NUMBER = String(process.env.USERS_WHATSAPP_NUMBER)
const CHECKER_APP_HOST = process.env.CHECKER_APP_HOST
const TYPEFORM_URL = process.env.TYPEFORM_URL
const WHATSAPP_BOT_LINK =
  process.env.ENVIRONMENT === "PROD"
    ? "https://ref.checkmate.sg/add"
    : `https://wa.me/${USERS_WHATSAPP_NUMBER}`
const NLB_SURE_IMAGE =
  "https://storage.googleapis.com/checkmate-static-assets/SURE%20Learning%20Community%20Logo%202024.png"
const resources = `Here are some resources 📚 you might find useful:
1) <a href="https://checkmate.sg">Our official CheckMate website</a>
2) <a href="https://bit.ly/checkmates-wiki">Our fact-checking wiki</a>
3) <a href="https://bit.ly/checkmates-quiz">The Typeform quiz you just took</a>
4) <a href="https://www.nlb.gov.sg/main/site/learnx/explore-communities/explore-communities-content/sure-learning-community">The S.U.R.E Learning Community</a> that we're partnering the National Library Board on
5) <a href="https://facticity.ai/">Facticity</a>, which is useful for video links (just put them into facticity)
6) <a href="https://www.virustotal.com/gui/home/url">Virustotal</a>, which you can use for scanning suspicious URL links
7) <a href="https://onelink.to/scamshield">The ScamShield app</a>, which you can use for checking phone numbers`

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

function progressBars(currentStep: number) {
  const totalSteps = 6
  let progress = "Onboarding Progress: "
  for (let i = 0; i < totalSteps; i++) {
    if (i < currentStep) {
      progress += "🟩"
    } else {
      progress += "⬜"
    }
  }
  return progress
}

// COMMAND HANDLERS

bot.command("start", async (ctx) => {
  const msg = ctx.message
  if (msg.from) {
    const checkerId = msg.from.id
    const userQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    if (!userQuerySnap.docs[0]) {
      await ctx.reply(
        `Welcome to your personal CheckMate Checker's bot! This is where you'll review messages, view your statistics etc. Type /onboard to begin your journey as a CheckMate Checker.`
      )
    } else if (userQuerySnap.docs[0].data().isOnboardingComplete) {
      await ctx.reply(
        `Welcome to your personal CheckMate Checker's bot! Click "Checker's Portal" to access the dashboard. Here, you'll review messages, view your statistics etc.`
      )
    } else {
      await ctx.reply(
        `Welcome back to your personal CheckMate Checker's bot! Type /onboard to continue your journey as a CheckMate Checker.`
      )
    }
  } else {
    logger.log("No user id found")
  }
})

bot.command("onboard", async (ctx) => {
  const chatId = ctx.chat?.id
  const telegramId = ctx.from?.id
  const telegramUsername = ctx.from?.username ?? null
  let currentStep = "name"
  const checkerDocQuery = db
    .collection("checkers")
    .where("telegramId", "==", telegramId)
  let checkerQuerySnap = await checkerDocQuery.get()
  let checkerSnap: DocumentSnapshot

  if (checkerQuerySnap.empty) {
    if (telegramId) {
      const checkerRef = await createChecker(telegramId, telegramUsername)
      checkerSnap = await checkerRef.get()
    } else {
      logger.log("No user id found")
      await ctx.reply("An error happened, please try again later")
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
      await sendNamePrompt(chatId!, checkerSnap)
      break
    case "number":
      await sendNumberPrompt(chatId!, checkerSnap)
      break
    case "otpSent":
      await sendOTPPrompt(chatId!, checkerSnap, whatsappId)
      break
    case "verify":
      await sendOTPPrompt(chatId!, checkerSnap, whatsappId)
      break
    case "quiz":
      await sendQuizPrompt(chatId!, checkerSnap, true)
      break
    case "onboardWhatsapp":
      await sendWABotPrompt(chatId!, checkerSnap, true)
      break
    case "joinGroupChat":
      await sendTGGroupPrompt(chatId!, checkerSnap, true)
      break
    case "nlb":
      await sendNLBPrompt(chatId!, checkerSnap)
      break
    case "completed":
      await ctx.reply(
        `Hi there! You have already onboarded as a CheckMate Checker. Do explore the Checker's Portal to check out what you can do. Otherwise if you would like to go through onboarding again, click on the respective button below.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Checker's Portal",
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

bot.command("activate", async (ctx) => {
  try {
    const msg = ctx.message
    if (msg.from) {
      const telegramId = msg.from.id
      const checkerQuerySnap = await db
        .collection("checkers")
        .where("telegramId", "==", telegramId)
        .get()
      if (checkerQuerySnap.empty) {
        logger.error(
          `Checker with TelegramID ${telegramId} trying to /activate but not found`
        )
        return
      }
      const checkerSnap = checkerQuerySnap.docs[0]
      await reactivateChecker(checkerSnap)
    } else {
      logger.error("No user id found")
    }
  } catch (error) {
    logger.error("Error in activate command", error)
    await ctx.reply("An error happened, please try again later")
  }
})

bot.command("deactivate", async (ctx) => {
  try {
    const msg = ctx.message
    if (msg.from) {
      const checkerId = msg.from.id
      const checkerQuerySnap = await db
        .collection("checkers")
        .where("telegramId", "==", checkerId)
        .get()

      if (checkerQuerySnap.size > 0) {
        const checkerSnap = checkerQuerySnap.docs[0]
        await checkerSnap.ref.update({ isActive: false })
        await ctx.reply(
          `Sorry to see you go! CheckMate will no longer send you messages to review. When you're ready to return, type /activate to start voting on messages again.`
        )
      } else if (checkerQuerySnap.size === 0) {
        logger.error(`Checker with TelegramID ${checkerId} not found`)
      } else {
        logger.error(`Multiple checkers with TelegramID ${checkerId} found`)
      }
    } else {
      logger.log("No user id found")
    }
  } catch (error) {
    logger.error("Error in deactivate command", error)
    await ctx.reply("An error happened, please try again later")
  }
})

bot.command("resources", async (ctx) => {
  const checkerId = ctx.from?.id
  if (checkerId) {
    await ctx.reply(resources, { parse_mode: "HTML" })
  } else {
    logger.log("No user id found")
  }
})

// General message handler
bot.on(message("text"), async (ctx) => {
  try {
    const msg = ctx.message
    if (!msg.text) {
      throw new Error("No text found in message")
    }
    if (msg.text.startsWith("/")) {
      await ctx.reply("Sorry, this command is not supported.")
      return
    }
    const checkerId = msg.from?.id
    const chatId = msg.chat.id

    const userQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    if (userQuerySnap.empty) {
      await ctx.reply(
        `You have not onboarded as a CheckMate Checker yet. Type /onboard to begin your journey.`
      )
      return
    }

    const userSnap = userQuerySnap.docs[0]
    let currentStep = userSnap.data().onboardingStatus
    const expectingRepliesTo = ["name", "number", "verify"]
    if (!expectingRepliesTo.includes(currentStep)) {
      await ctx.reply(
        "Sorry, this bot is unable to respond to free-form messages."
      )
    } else if (msg.text) {
      let whatsappId = ""

      switch (currentStep) {
        case "name":
          const name = msg.text
          if (name.replace(/\s+/g, "").length === 0) {
            await ctx.reply(
              "Name cannot be just spaces. Please enter a valid name."
            )
            await sendNamePrompt(chatId, userSnap)
            return
          }
          await userSnap.ref.update({
            name,
          })
          await sendNumberPrompt(chatId, userSnap)
          break
        case "number":
          whatsappId = msg.text.replace("+", "").replace(" ", "")

          if (
            whatsappId.length === 8 &&
            (whatsappId.startsWith("9") || whatsappId.startsWith("8"))
          ) {
            whatsappId = `65${whatsappId}`
          }
          //check if whatsappId is numeric
          if (!isNumeric(whatsappId)) {
            await ctx.reply(
              `The phone number you entered is invalid. Please enter a valid phone number.`
            )
            return
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
                await ctx.reply(
                  `Maximum OTP attempts reached. We will send a new OTP.`
                )
                await sendOTPPrompt(chatId, userSnap, whatsappId)
              } else {
                logger.error(`OTP error with ${chatId}: ${message}`)
                await ctx.reply(
                  "Apologies - an error occurred, please try again later."
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
    }
  } catch (error) {
    logger.error("Error in message handler", error)
    await ctx.reply("An error happened, please try again later")
  }
})

bot.on(callbackQuery("data"), async (ctx) => {
  const callbackQuery = ctx.callbackQuery
  const callbackAction = callbackQuery?.data
  //split action by "|" to get the action and the nudge ID if any
  const action = callbackAction.split("|")[0]
  const nudgeId = callbackAction.split("|")[1]

  const chatId = callbackQuery?.message?.chat.id
  let isUser = false

  if (chatId != undefined) {
    const checkerDocQuery = db
      .collection("checkers")
      .where("telegramId", "==", callbackQuery.from.id)
    const checkerQuerySnap = await checkerDocQuery.get()

    if (checkerQuerySnap.empty) {
      logger.error(
        `Checker with TelegramID ${callbackQuery.from.id} triggered callback but not found`
      )
      return
    }
    const checkerDocSnap = checkerQuerySnap.docs[0]
    const whatsappId = checkerDocSnap.data()?.whatsappId

    switch (action) {
      case "QUIZ_COMPLETED":
        if (checkerDocSnap.data()?.isQuizComplete) {
          isUser = await checkCheckerIsUser(whatsappId)
          ctx.reply(
            `Thank you for completing the quiz!💪🎉 We hope you found it useful.

${progressBars(3)}`
          )
          if (isUser) {
            await sendTGGroupPrompt(chatId, checkerDocSnap, true)
          } else {
            await sendWABotPrompt(chatId, checkerDocSnap, true)
          }
        } else {
          await sendQuizPrompt(chatId, checkerDocSnap, false)
        }
        break
      case "WA_COMPLETED":
        isUser = await checkCheckerIsUser(whatsappId)
        if (isUser) {
          ctx.reply(`Thank you for onboarding to the WhatsApp service! 🙌
            
${progressBars(4)}`)
          await sendTGGroupPrompt(chatId, checkerDocSnap, true)
        } else {
          await sendWABotPrompt(chatId, checkerDocSnap, false)
        }
        break
      case "TG_COMPLETED":
        try {
          const member = await adminBot.telegram.getChatMember(
            CHECKERS_CHAT_ID,
            callbackQuery.from.id
          )
          if (
            member.status &&
            member.status !== "left" &&
            member.status !== "kicked"
          ) {
            await sendNLBPrompt(chatId, checkerDocSnap)
          } else {
            await sendTGGroupPrompt(chatId, checkerDocSnap, false)
          }
        } catch (error) {
          logger.log(error)
          await sendTGGroupPrompt(chatId, checkerDocSnap, false)
        }
        break
      case "COMPLETED":
        await sendCompletionPrompt(chatId, checkerDocSnap)
        break
      case "REQUEST_NUMBER":
        await sendNumberPrompt(chatId, checkerDocSnap)
        break
      case "SEND_OTP":
        await sendOTPPrompt(chatId, checkerDocSnap, whatsappId)
        break
      // case "VERIFY_OTP":
      //   await sendVerificationPrompt(chatId, checkerDocSnap, false)
      //   break
      case "ONBOARD_AGAIN":
        await checkerDocSnap.ref.update({
          onboardingStatus: "name",
          lastTrackedMessageId: null,
        })
        await sendNamePrompt(chatId, checkerDocSnap)
        break
      case "REACTIVATE":
        await reactivateChecker(checkerDocSnap)
        break
      case "RESOURCES":
        await ctx.reply(resources, { parse_mode: "HTML" })
        break
      default:
        logger.log("Unhandled callback data: ", action)
    }
    if (nudgeId) {
      await updateNudge(checkerDocSnap, nudgeId, "clicked")
    }
  }
})

//HANDLERS

const sendNamePrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot
) => {
  const namePrompt = await bot.telegram.sendMessage(
    chatId,
    `First up, how shall we address you?`,
    {
      reply_markup: { force_reply: true },
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
  const numberPrompt = await bot.telegram.sendMessage(
    chatId,
    `What is your WhatsApp phone number? Please include the country code, but omit the "+", e.g 6591234567
    
${progressBars(1)}`,
    {
      reply_markup: { force_reply: true },
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
    rekey: { text: "Re-enter phone number", callback_data: "REQUEST_NUMBER" },
    resendOTP: { text: "Get a new OTP", callback_data: "SEND_OTP" },
    verifyOTP: { text: "Verify OTP", callback_data: "VERIFY_OTP" },
  }

  logger.log(`sending OTP to ${whatsappId}`)
  const postOTPHandlerRes = await sendOTP(whatsappId, checkerSnap.id)
  if (postOTPHandlerRes.status === "success") {
    await bot.telegram.sendMessage(
      chatId,
      `We have sent a 6-digit OTP to your WhatsApp at +${whatsappId}. Please check your WhatsApp for the OTP.`,
      {
        reply_markup: {
          inline_keyboard: [[inlineButtons.resendOTP, inlineButtons.rekey]],
        },
      }
    )
    sendVerificationPrompt(chatId, checkerSnap, false)
  } else {
    switch (postOTPHandlerRes.message) {
      case "OTP request limit exceeded":
        await bot.telegram.sendMessage(
          chatId,
          `An error occurred, likely because too many OTPs were requested. Please try again in 10 minutes.`,
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
        await bot.telegram.sendMessage(
          chatId,
          `An error occurred, likely because the phone number was keyed in wrongly.`,
          {
            reply_markup: { inline_keyboard: [[inlineButtons.rekey]] },
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
  const otpPrompt = await bot.telegram.sendMessage(
    chatId,
    !rePrompt
      ? `Verify your OTP:`
      : `The OTP you provided doesn't match that in our records. Please key it in again:`,
    {
      reply_markup: { force_reply: true },
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
  const linkURL = `${TYPEFORM_URL}#name=${name}&phone=${whatsappId}`
  await bot.telegram.sendMessage(
    chatId,
    `${
      isFirstPrompt
        ? "Thank you for verifying your WhatsApp number"
        : "We noticed you have not completed the quiz yet"
    }. Please proceed to complete the onboarding quiz <a href="${linkURL}">here</a>. This will equip you with the skills and knowledge to be a better checker!
    
${progressBars(2)}`,
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
      link_preview_options: {
        is_disabled: true, //preview link doesn't show hashes, so we just disable it entirely
        url: linkURL,
      },
    }
  )
}

const sendWABotPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot,
  isFirstPrompt: boolean
) => {
  if (isFirstPrompt) {
    await checkerSnap.ref.update({ onboardingStatus: "onboardWhatsapp" })
  }
  await bot.telegram.sendMessage(
    chatId,
    `${
      isFirstPrompt
        ? "Next, try out our CheckMate WhatsApp service"
        : "We noticed you haven't tried out the WhatsApp service yet. Please try out the CheckMate WhatsApp service"
    } as a user <a href="${WHATSAPP_BOT_LINK}?utm_source=checkersonboarding&utm_medium=telegram&utm_campaign=${chatId}">here</a>, and send in the pre-populated message.
    
This Whatsapp service is where people send in the messages that you'll be checking. Part of your role will also be to report suspicious messages here!

Once you're done, come back to continue the onboarding.`,
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
    await checkerSnap.ref.update({ onboardingStatus: "joinGroupChat" })
  }
  await bot.telegram.sendMessage(
    chatId,
    `${
      isFirstPrompt
        ? "Next, p"
        : "We noticed you have not joined the groupchat yet. P"
    }lease join the <a href="${CHECKERS_GROUP_LINK}">CheckMate Checker's groupchat</a>. This group chat is important as it will be used to:

1) Inform checkers of any downtime in the system, updates/improvements being deployed to the bots

2) Share relevant links from reputable news sources to aid fact-checking. Do note that beyond this, checkers should not discuss what to vote, as this may make the collective outcome biased.`,
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
  await checkerSnap.ref.update({ onboardingStatus: "nlb" })
  await bot.telegram.sendPhoto(chatId, NLB_SURE_IMAGE, {
    caption: `One last thing - CheckMate is partnering with the National Library Board to grow a vibrant learning community aimed at safeguarding the community from scams and misinformation.

If you'd like to get better at fact-checking, or if you're keen to meet fellow checkers in person, do check out and join the <a href="https://www.nlb.gov.sg/main/site/learnx/explore-communities/explore-communities-content/sure-learning-community">SURE Learning Community</a>. It'll be fun!

${progressBars(5)}`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Complete Onboarding", callback_data: "COMPLETED" }],
      ],
    },
  })
}

const sendCompletionPrompt = async (
  chatId: number,
  checkerSnap: DocumentSnapshot
) => {
  await checkerSnap.ref.update({
    onboardingStatus: "completed",
    isOnboardingComplete: true,
    onboardingTime: Timestamp.now(),
    isActive: true,
    lastActivatedDate: Timestamp.now(),
  })
  await bot.telegram.sendMessage(
    chatId,
    `Finally, check out the Checker's Portal below, which is where you will vote on messages, and see the leaderboard and your statistics.

${resources}

You may view these resources with the command /resources.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Checker's Portal",
              web_app: { url: `${CHECKER_APP_HOST}/` },
            },
          ],
        ],
      },
      parse_mode: "HTML",
    }
  )
  await bot.telegram.sendMessage(
    chatId,
    `Hooray! You've now successfully onboarded as a Checker! 🥳 You can chill for now, but stay tuned - you'll receive notifications in this chat when users submit messages for checking. You'll then do the fact-checks on the Checkers' Portal.`
  )
  // Queue up program completion checks
  const payload = {
    checkerId: checkerSnap.id,
  }
  const thresholds = await getThresholds()
  const daysToFirstCompletionCheck =
    thresholds.daysBeforeFirstCompletionCheck ?? 60
  const daysToSecondCompletionCheck =
    thresholds.daysBeforeSecondCompletionCheck ?? 90
  logger.log(`Enqueuing completion checks for checker ${checkerSnap.id}`)
  await enqueueTask(
    payload,
    "firstCompletionCheck",
    daysToFirstCompletionCheck * 24 * 60 * 60 + 300
  ) //first completion check 60 days later. Add 300 so that we can test in UAT
  await enqueueTask(
    payload,
    "secondCompletionCheck",
    daysToSecondCompletionCheck * 24 * 60 * 60 + 600
  ) //second completion check 90 days later. Add 600 so that we can test in UAT
}
//TODO: edit this to allow checking against diff idfields
const checkCheckerIsUser = async (whatsappId: string) => {
  const userSnap = await db
    .collection("users")
    .where("whatsappId", "==", whatsappId)
    .get()
  return !userSnap.empty
}

const createChecker = async (
  telegramId: number,
  telegramUsername: string | null
) => {
  const thresholds = await getThresholds()
  const checkerRef = await db.runTransaction(async (transaction) => {
    const checkerDocQuery = db
      .collection("checkers")
      .where("telegramId", "==", telegramId)
    const checkerQuerySnap = await transaction.get(checkerDocQuery)

    if (checkerQuerySnap.empty) {
      const newCheckerRef = db.collection("checkers").doc()
      const newChecker: CheckerData = {
        name: null,
        telegramUsername: telegramUsername,
        type: "human",
        isActive: false,
        lastActivatedDate: null,
        isOnboardingComplete: false,
        onboardingTime: null,
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
        hasCompletedProgram: false,
        certificateUrl: null,
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
          numVotesTarget: thresholds.volunteerProgramVotesRequirement ?? 0,
          numReferralTarget:
            thresholds.volunteerProgramReferralRequirement ?? 0,
          numReportTarget: thresholds.volunteerProgramReportRequirement ?? 0,
          accuracyTarget: thresholds.volunteerProgramAccuracyRequirement ?? 0,
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
        offboardingTime: null,
      }
      transaction.set(newCheckerRef, newChecker)
      return newCheckerRef
    } else {
      throw new Error("Checker already exists")
    }
  })

  return checkerRef
}

// FIREBASE FUNCTIONS
const checkerHandlerTelegram = async function (body: any) {
  await bot.handleUpdate(body)
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
      logger.log(`Processing ${event.data.message.messageId}`)
      await checkerHandlerTelegram(event.data.message.json)
    } else {
      if (!event.data.message.json) {
        logger.warn(
          `Unknown message type for messageId ${event.data.message.messageId})`
        )
      }
    }
  }
)

export { onCheckerPublishTelegram }

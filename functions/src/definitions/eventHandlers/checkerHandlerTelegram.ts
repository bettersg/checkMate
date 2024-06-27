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
    if (userQuerySnap?.data()?.isOnboardingComplete) {
      await bot.sendMessage(
        chatId,
        `Welcome to the checker bot! Press the CheckMate's Portal button to access our dashboard. You'll also get notified when there are new messages to check.`
      )
      //add function to start receiving messsages
    } else {
      // await bot.sendMessage(
      //   chatId,
      //   `Welcome to the checker bot! Press the CheckMate's Portal button to onboard and access our dashboard. Once onboarded, you'll get notified when there are new messages to check.`
      // )
      bot.onText(/\/onboard/, async (msg) => {
        const chatId = msg.chat.id
        const namePrompt = await bot.sendMessage(
          msg.chat.id,
          "Hi, what's your full name?",
          {
            reply_markup: {
              force_reply: true,
            },
          }
        )
        bot.onReplyToMessage(chatId, namePrompt.message_id, async (nameMsg) => {
          const name = nameMsg.text
          const telegramId = nameMsg.from.id

          const numberPrompt = await bot.sendMessage(
            chatId,
            `Hello ${name}! What is your HP no. in +(country code) (HP no.) format e.g +65 12341234`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          bot.onReplyToMessage(
            chatId,
            numberPrompt.message_id,
            async (numberMsg) => {
              const whatsappId = numberMsg.text

              //create checker entry in DB
              await bot.sendMessage(chatId, "Create checker")
              //   const checkerQuerySnap = await db
              //     .collection("checkers")
              //     .where("telegramId", "==", telegramId)
              //     .get();
              //   if (checkerQuerySnap.size > 0) {
              //     const checkerSnap = checkerQuerySnap.docs[0];
              //     console.log(checkerSnap);
              //   } else if (checkerQuerySnap.size === 0) {
              //     postCheckerHandler({ name, type: "human", telegramId });
              //   } else {
              //     logger.error(
              //       `Multiple checkers with TelegramID ${telegramId} found`
              //     );
              //   }

              while (true) {
                await bot.sendMessage(chatId, "Sent OTP")
                // postOTPHandler({ checkerId: telegramId, whatsappId });

                await bot.sendMessage(
                  chatId,
                  `We have sent a 6-digit OTP to ${whatsappId}. Please check your Whatsapp for the OTP.`
                )
                const otpPrompt = await bot.sendMessage(
                  msg.chat.id,
                  `Verify your OTP:`,
                  {
                    reply_markup: {
                      force_reply: true,
                    },
                  }
                )
                bot.onReplyToMessage(
                  chatId,
                  otpPrompt.message_id,
                  async (otpMsg) => {
                    const otp = otpMsg.text

                    // call postOTP to check matching OTP
                    await bot.sendMessage(chatId, "Verified OTP")

                    //   res = await checkOTPHandler({ checkerId: telegramId, otp });

                    //   if (
                    //     res.message == "OTP verified successfully" ||
                    //     res.message == "Existing checker found"
                    //   ) {

                    await bot.sendMessage(
                      chatId,
                      `Thank you for verifying your Whatsapp number. Please proceed to complete the onboarding quiz: https://better-sg.typeform.com/to/MlihTUDx`,
                      {
                        reply_markup: JSON.stringify({
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
                        }),
                      }
                    )

                    bot.on(
                      "callback_query",
                      async function onCallbackQuery(callbackQuery) {
                        const action = callbackQuery.data
                        const msg = callbackQuery.message
                        let text

                        if (action === "1") {
                          // check quiz completion
                          // const checkerQuerySnap = await db
                          //   .collection("checkers")
                          //   .where("telegramId", "==", telegramId)
                          //   .get();

                          // if (checkerSnap.data().isOnboardingComplete) {
                          //might need to open new field for typeform completion
                          text =
                            "Thank you for completing the quiz. Please add the CheckMate Whatsapp bot: https://wa.me/6580432188."
                          bot.editMessageText(text, {
                            chat_id: chatId,
                            message_id: msg.message_id,
                            reply_markup: JSON.stringify({
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
                            }),
                          })

                          bot.on(
                            "callback_query",
                            async function onCallbackQuery(callbackQuery) {
                              const action = callbackQuery.data
                              const msg = callbackQuery.message
                              let text

                              if (action === "1") {
                                // check WA bot completion

                                text =
                                  "Thank you for adding the WA bot. Please add the CheckMate Checker's telegram bot: https://t.me/CheckMate_Checker_Bot."
                                bot.editMessageText(text, {
                                  chat_id: chatId,
                                  message_id: msg.message_id,
                                  reply_markup: JSON.stringify({
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
                                  }),
                                })

                                bot.on(
                                  "callback_query",
                                  async function onCallbackQuery(
                                    callbackQuery
                                  ) {
                                    const action = callbackQuery.data
                                    const msg = callbackQuery.message
                                    let text

                                    if (action === "1") {
                                      // check tele bot completion

                                      text =
                                        "Thank you for adding the telegram bot. Please refer to CheckMate wiki for more information: https://checkmate.sg/."
                                      await bot.editMessageText(text, {
                                        chat_id: chatId,
                                        message_id: msg.message_id,
                                      })

                                      // await checkerSnap.ref.update({ isOnboardingComplete: true })

                                      await bot.sendMessage(
                                        chatId,
                                        `You have successfully onboarded as a CheckMate Checker!`
                                      )
                                    }
                                  }
                                )
                              }
                            }
                          )
                          // }
                        }
                      }
                    )

                    //   }

                    // cycle back to otpPrompt above
                  }
                )
                return
              }
            }
          )
        })
      })
    }
  } else {
    logger.log("No user id found")
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

export { onCheckerPublishTelegram }

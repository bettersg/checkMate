//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import TelegramBot, { Update, InlineKeyboardMarkup, ForceReply, Message } from "node-telegram-bot-api"
import { onMessagePublished } from "firebase-functions/v2/pubsub"

const TOKEN = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN)
const bot = new TelegramBot(TOKEN)

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
// More bot handlers can go here...
const responsesSnap = db.collection("systemParameters").doc("factCheckerBotResponses").get()

let name : string ="";
const ONBOARDING_4 : string ="Awesome! Now that you know how to identify misinformation and scams, you are ready to help us combat them! Use the '/info' command for more resources. Thanks again for joining our community of CheckMates!";

// General message handler
bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/") && !msg.reply_to_message) {
    // Ignore commands as they are handled separately
    const chatId = msg.chat.id
    // Echo the message text back to the same chat
    bot.sendMessage(chatId, "Please use the commands to interact with me!")
  }
})

// '/start' command should check if the chatId is in database, if not, start onboarding process
bot.onText(/\/start/, async (msg) => {
  if (msg.from){
    const userId = (msg.from.id).toString()
    const chatId = msg.chat.id.toString();
    const userSnap = db
        .collection("factCheckers")
        .doc(userId)
        .get() 
    //check if user exists in database
    if ((await userSnap).exists) {
      bot.sendMessage(chatId, "Welcome to the checker bot! You will receive messages for fact checking soon!")
      //add function to start receiving messsages
    }
    else{
      onboardingFlow(chatId);
    }
  }
  else {
    console.log('No user id found');
  }
})

async function onboardingFlow(chatId: string) {
  // Send the initial onboarding message and await the response
  const msgToReply = await bot.sendMessage(
    chatId,
    (await responsesSnap).get("ONBOARDING_1"),
    { reply_markup: { force_reply: true } }
  );
  
  bot.on("message", async (msg) => {
    if (msg.reply_to_message && msg.reply_to_message.message_id == msgToReply.message_id) {
      if (msg.from && msg.text) {
        name = msg.text;
        // Send the second onboarding message
        await bot.sendMessage(
          chatId,
          (await responsesSnap).get("ONBOARDING_2"),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Private Policy", url: "https://bit.ly/checkmate-privacy" }],
                [{ text: "Got it!", callback_data: "Got it!" }],
              ],
            },
          }
      )}
    }
  });
}

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
  // increment counter when everytime the button is pressed
  if (callbackQuery.data == "Got it!" && callbackQuery.message) {
    bot.sendMessage(callbackQuery.message.chat.id, (await responsesSnap).get("ONBOARDING_3"), 
    {reply_markup: {inline_keyboard:[
      [{ text: "Take me to quiz!", url: "https://bit.ly/checkmates-quiz" }], 
      [{text: "Finished the quiz!", callback_data:"Quiz done!"}]]}
    });
  }
  else if (callbackQuery.data =="Quiz done!" && callbackQuery.message){
    bot.sendMessage(callbackQuery.message.chat.id, ONBOARDING_4);
    const userId = (callbackQuery.from.id).toString();
    // Store the user's name in Firebase Firestore
    const userRef = db.collection("factCheckers").doc(userId);
    userRef.set({ name: name,
      isActive: true,
      isOnboardingComplete: true,
      level: 1,
      experience: 0,
      numVoted: 0,
      numCorrectVotes: 0,
      numVerifiedLinks: 0,
      preferredPlatform: "telegram",
      lastVotedTimestamp: null,})
    .then(() => {
    console.log("User stored in Firebase");
    //add function to begin receiving messages
  });
  }
});

//info command
bot.onText(/\/info/, async (msg) => {
  bot.sendMessage(msg.chat.id, "Check out more resources here!", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Private Policy", url: "https://bit.ly/checkmate-privacy" },
        ],
        [{ text: "Wiki!", url:"https://bit.ly/checkmates-wiki" }],
      ],
    },
  });
});

const checkerHandlerTelegram = async function (body: Update) {
  bot.processUpdate(body)
  return
}

const onCheckerPublishTelegram = onMessagePublished(
  {
    topic: "checkerEvents",
    secrets: [
      "TYPESENSE_TOKEN",
      "ML_SERVER_TOKEN",
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

/*
Assigned: Yong En

NOTES:

Needs to handle 3 scenarios, all of which hit the same http webhook handler:

1. fact_checkers signup (rmb to handle duplicates, cos factCheckers can just type that message again)
  a. Get the details needed to populate the user object
  b. Create fact_checker in factCheckers collection

2. Voting on new message (inline keyboard callback button handler for telegram )
  a. Add votes to votes subcollection
  b. Increment vote count

3. Replies to new message with verification link url
  a. Check if its a link to official news agencies (we may have to create a whitelist of cna etc)
  b. If yes
    i. Update verification links subcollection (fact checkers array and count)

RESOURCES:

combine express with functions - https://firebase.google.com/docs/functions/http-events#using_existing_express_apps

*/

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const { sendWhatsappTextMessage, sendWhatsappImageMessage, sendWhatsappTextListMessage } = require("./common/sendWhatsappMessage");
const { getReponsesObj } = require("./common/utils");
const { whatsappVerificationHandler } = require("./common/whatsappVerificationHandler");

if (!admin.apps.length) {
  admin.initializeApp();
}
const app = express();

app.post("/whatsapp", async (req, res) => {
  const db = admin.firestore();
  if (req.body.object) {
    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0] &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      const value = req.body.entry[0].changes[0].value;
      const phoneNumberId = value.metadata.phone_number_id;
      const message = value.messages[0];
      const from = message.from; // extract the phone number from the webhook payload
      const type = message.type;

      if (phoneNumberId != process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID) {
        res.sendStatus(200);
        return;
      }
      const responses = await getReponsesObj("factCheckers");

      switch (type) {
        case "button":
          const button = value.messages[0].button;
          switch (button.text) {
            case "Yes":
              await sendVotingMessage(db, button.payload, from, responses);
              break;
            case "No":
              sendWhatsappTextMessage(process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID, from, responses.VOTE_NO, message.id);
              break;
          }
          res.sendStatus(200);
          return;
        case "interactive":
          // handle voting here
          const interactive = value.messages[0].interactive;
          if (interactive.type == "list_reply") {
            const [messageId, vote] = interactive.list_reply.id.split("_");
            const factCheckersSnapshot = await db.collection("factCheckers").where("whatsappNumber", "==", from).where("preferredChannel", "==", "Whatsapp").get();
            if (factCheckersSnapshot.empty) {
              functions.logger.log(`No corresponding fact checker with whatsapp number ${from} found`);
              break;
            } else {
              if (factCheckersSnapshot.size > 1) {
                functions.logger.log(`More than 1 factChecker with whatsAppNumber ${from} found`);
              }
              await db.collection("messages").doc(messageId).collection("votes").add({
                factCheckerDocRef: factCheckersSnapshot.docs[0].ref,
                whatsAppNumber: factCheckersSnapshot.docs[0].get("whatsappNumber"),
                vote: vote,
              });
              break;
            }
          }

        case "text":
          // handle URL evidence here
          break;
        default:
          res.sendStatus(200);
          return;
      }
    }
    res.sendStatus(200);
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

async function sendVotingMessage(db, messageId, from, responses) {
  const messageSnapshot = await db.collection("messages").doc(messageId).get();
  const message = messageSnapshot.data();

  const rows = [];
  const max_score = 5;
  for (let i = 0; i <= max_score; i++) {
    rows.push({
      id: `${messageId}_${i}`,
      title: `${i}`,
    });
  }
  rows[0].description = "Totally false";
  rows[max_score].description = "Totally true";
  rows.push({
    id: `${messageId}_irrelevant`,
    title: "No Claim Made",
    description: "The message contains no claims",
  });
  sections = [{
    rows: rows,
  }];
  let res;
  switch (message.type) {
    case "text":
      res = await sendWhatsappTextMessage(process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID, from, message.text);
      setTimeout(async () => {
        await sendWhatsappTextListMessage(process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID, from, responses.FACTCHECK_PROMPT, "Vote here", sections, res.data.messages[0].id);
      }, 3000); // seem like we need to wait some time for this because for some reason it will have error 500 otherwise.
      break;
    case "image":
      res = await sendWhatsappImageMessage(process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID, from, message.mediaId, null, message.text);
      setTimeout(async () => {
        await sendWhatsappTextListMessage(process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID, from, responses.FACTCHECK_PROMPT, "Vote here", sections, res.data.messages[0].id);
      }, 3000); // seem like we need to wait some time for this because for some reason it will have error 500 otherwise.
      break;
  }
}

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/whatsapp", whatsappVerificationHandler);

exports.webhookHandlerFactChecker = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN", "VERIFY_TOKEN"] })
  .https.onRequest(app);


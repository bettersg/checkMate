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
const { sendWhatsappTextMessage, sendWhatsappImageMessage, markWhatsappMessageAsRead } = require("./common/sendWhatsappMessage");
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
        res.sendStatus(403);
        return;
      }
      const responses = await getReponsesObj("factCheckers");

      switch (type) {
        case "button":
          const button = value.messages[0].button;
          switch (button.text) {
            case "Yes":
              await onFactCheckerYes(db, button.payload, from)
              break;
            case "No":
              sendWhatsappTextMessage("factChecker", from, responses.VOTE_NO, message.id);
              break;
          }
          break;
        case "interactive":
          // handle voting here
          const interactive = value.messages[0].interactive;
          switch (interactive.type) {
            case "list_reply":
              await onVoteReceipt(db, interactive.list_reply.id)
              break;
            case "button_reply":
              await onScamAssessmentReply(db, interactive.button_reply.id);
              break;
          }
          break;

        case "text":
          // handle URL evidence here
          break;
      }
      markWhatsappMessageAsRead("factChecker", message.id);
    }
    res.sendStatus(200);
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

async function onFactCheckerYes(db, messageId, from) {
  const messageRef = db.collection("messages").doc(messageId);
  const messageSnap = await messageRef.get();
  const message = messageSnap.data();
  const voteRequestSnap = await messageRef.collection("voteRequests").where("whatsappNumber", "==", from).where("platform", "==", "Whatsapp").get();
  if (voteRequestSnap.empty) {
    functions.logger.log(`No corresponding voteRequest for message ${messageId} with whatsapp number ${from} found`);
  } else {
    if (voteRequestSnap.size > 1) {
      functions.logger.log(`More than 1 voteRequest with whatsAppNumber ${from} found`);
    }

    switch (message.type) {
      case "text":
        res = await sendWhatsappTextMessage("factChecker", from, message.text);
        break;
      case "image":
        res = await sendWhatsappImageMessage("factChecker", from, message.mediaId, null, message.text);
        break;
    }

    await voteRequestSnap.docs[0].ref.update({
      hasAgreed: true,
      sentMessageId: res.data.messages[0].id,
    })

  }
}

async function onScamAssessmentReply(db, buttonId) {
  const [messageId, voteRequestId, type] = buttonId.split("_");
  const voteRequestRef = db.collection("messages").doc(messageId).collection("voteRequests").doc(voteRequestId);
  const updateObj = {}
  if (type === "scam") {
    updateObj.isScam = true;
    updateObj.vote = "scam";
  } else if (type === "notscam") {
    updateObj.isScam = false;
    updateObj.vote = null;
  }
  await voteRequestRef.update(updateObj);
}

async function onVoteReceipt(db, listId) {
  const [messageId, voteRequestId, vote] = listId.split("_");
  const voteRequestRef = db.collection("messages").doc(messageId).collection("voteRequests").doc(voteRequestId);
  await voteRequestRef.update({
    vote: vote,
  })
}


// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/whatsapp", whatsappVerificationHandler);

exports.webhookHandlerFactChecker = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN", "VERIFY_TOKEN"] })
  .https.onRequest(app);


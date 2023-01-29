const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendWhatsappTextMessage, sendWhatsappImageMessage, markWhatsappMessageAsRead } = require("./common/sendWhatsappMessage");
const { getReponsesObj } = require("./common/utils");
const { sendScamAssessmentMessage } = require("./common/sendFactCheckerMessages")

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.checkerHandler = async function (message) {
  const from = message.from; // extract the phone number from the webhook payload
  const type = message.type;
  const db = admin.firestore()
  let responses

  switch (type) {
    case "button":
      const button = message.button;
      switch (button.text) {
        case "Yes":
          await onFactCheckerYes(db, button.payload, from)
          break;
        case "No":
          responses = await getReponsesObj("factCheckers");
          sendWhatsappTextMessage("factChecker", from, responses.VOTE_NO, message.id);
          break;
      }
      break;
    case "interactive":
      // handle voting here
      const interactive = message.interactive;
      switch (interactive.type) {
        case "list_reply":
          await onVoteReceipt(db, interactive.list_reply.id, from, message.id)
          break;
        case "button_reply":
          await onScamAssessmentReply(db, interactive.button_reply.id, from, message.id);
          break;
      }
      break;

    case "text":
      // handle URL evidence here
      break;
  }
  markWhatsappMessageAsRead("factChecker", message.id);
}


async function onFactCheckerYes(db, messageId, from) {
  const messageRef = db.collection("messages").doc(messageId);
  const messageSnap = await messageRef.get();
  const message = messageSnap.data();
  const voteRequestSnap = await messageRef.collection("voteRequests").where("whatsappNumber", "==", from).where("platform", "==", "whatsapp").get();
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

    voteRequestSnap.docs[0].ref.update({
      hasAgreed: true,
      sentMessageId: res.data.messages[0].id,
    })
    setTimeout(() => {
      sendScamAssessmentMessage(voteRequestSnap.docs[0], messageRef, res.data.messages[0].id)
    }, 2000);
  }
}

async function onScamAssessmentReply(db, buttonId, from, replyId) {
  const responses = await getReponsesObj("factCheckers");
  const [messageId, voteRequestId, type] = buttonId.split("_");
  const voteRequestRef = db.collection("messages").doc(messageId).collection("voteRequests").doc(voteRequestId);
  const updateObj = {}
  if (type === "scam") {
    updateObj.isScam = true;
    updateObj.vote = "scam";
    sendWhatsappTextMessage("factChecker", from, responses.RESPONSE_RECORDED, replyId);
  } else if (type === "notscam") {
    updateObj.isScam = false;
    updateObj.vote = null;
    sendWhatsappTextMessage("factChecker", from, responses.HOLD_FOR_NEXT_POLL, replyId);
  }
  await voteRequestRef.update(updateObj);
}

async function onVoteReceipt(db, listId, from, replyId) {
  const responses = await getReponsesObj("factCheckers");
  const [messageId, voteRequestId, vote] = listId.split("_");
  const voteRequestRef = db.collection("messages").doc(messageId).collection("voteRequests").doc(voteRequestId);
  await voteRequestRef.update({
    vote: vote,
  })
  sendWhatsappTextMessage("factChecker", from, responses.RESPONSE_RECORDED, replyId);
}

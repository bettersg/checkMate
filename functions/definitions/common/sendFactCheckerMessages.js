const { sendWhatsappButtonMessage, sendWhatsappTextListMessage } = require("./sendWhatsappMessage");
const { getReponsesObj } = require("./utils");

exports.sendScamAssessmentMessage = async function (voteRequestSnap, messageRef, replyId) {
  const voteRequestData = voteRequestSnap.data();
  const responses = await getReponsesObj("factCheckers");
  switch (voteRequestData.platform) {
    case "whatsapp":
      const buttons = [{
        type: "reply",
        reply: {
          id: `${messageRef.id}_${voteRequestSnap.id}_scam`,
          title: "It's a scam",
        },
      }, {
        type: "reply",
        reply: {
          id: `${messageRef.id}_${voteRequestSnap.id}_notscam`,
          title: "It's something else",
        }
      }];
      await sendWhatsappButtonMessage("factChecker", voteRequestData.platformId, responses.SCAM_ASSESSMENT_PROMPT, buttons, replyId ?? voteRequestData.sentMessageId)
      break;
    case "telegram":
      break
  }
};

exports.sendVotingMessage = async function sendVotingMessage(voteRequestSnap, messageRef) {
  const messageSnap = await messageRef.get();
  const message = messageSnap.data();
  const voteRequestData = voteRequestSnap.data();
  const responses = await getReponsesObj("factCheckers");
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = [];
      const max_score = 5;
      for (let i = 0; i <= max_score; i++) {
        rows.push({
          id: `${messageRef.id}_${voteRequestSnap.id}_${i}`,
          title: `${i}`,
        });
      }
      rows[0].description = "Totally false";
      rows[max_score].description = "Totally true";
      rows.push({
        id: `${messageRef.id}_${voteRequestSnap.id}_irrelevant`,
        title: "No Claim Made",
        description: "The message contains no claims",
      });
      sections = [{
        rows: rows,
      }];
      switch (message.type) {
        case "text":
          setTimeout(async () => {
            await sendWhatsappTextListMessage("factChecker", voteRequestData.platformId, responses.FACTCHECK_PROMPT, "Vote here", sections, voteRequestData.sentMessageId);
          }, 3000); // seem like we need to wait some time for this because for some reason it will have error 500 otherwise.
          break;
        case "image":
          setTimeout(async () => {
            await sendWhatsappTextListMessage("factChecker", voteRequestData.platformId, responses.FACTCHECK_PROMPT, "Vote here", sections, voteRequestData.sentMessageId);
          }, 3000); // seem like we need to wait some time for this because for some reason it will have error 500 otherwise.
          break;
      }
      break;
    case "telegram":
      break;
  }
};
const { sendWhatsappButtonMessage, sendWhatsappTextListMessage } = require("./sendWhatsappMessage");
const { getResponsesObj } = require("./responseUtils");

exports.sendL1ScamAssessmentMessage = async function (voteRequestSnap, messageRef, replyId = null) {
  const voteRequestData = voteRequestSnap.data();
  const responses = await getResponsesObj("factChecker");
  switch (voteRequestData.platform) {
    case "whatsapp":
      const buttons = [{
        type: "reply",
        reply: {
          id: `checkers0_${messageRef.id}_${voteRequestSnap.id}_sus`,
          title: "Scam/Illicit",
        },
      }, {
        type: "reply",
        reply: {
          id: `checkers0_${messageRef.id}_${voteRequestSnap.id}_notsus`,
          title: "Misinfo/Others",
        }
      }];
      await sendWhatsappButtonMessage("factChecker", voteRequestData.platformId, responses.L1_SCAM_ASSESSMENT_PROMPT, buttons, replyId ?? voteRequestData.sentMessageId)
      break;
    case "telegram":
      break
  }
};

exports.sendL2ScamAssessmentMessage = async function (voteRequestSnap, messageRef, replyId = null) {
  const voteRequestData = voteRequestSnap.data();
  const responses = await getReponsesObj("factCheckers");
  switch (voteRequestData.platform) {
    case "whatsapp":
      const buttons = [{
        type: "reply",
        reply: {
          id: `checkers1_${messageRef.id}_${voteRequestSnap.id}_scam`,
          title: "Scam",
        },
      }, {
        type: "reply",
        reply: {
          id: `checkers1_${messageRef.id}_${voteRequestSnap.id}_illicit`,
          title: "Other Illicit",
        }
      }];
      await sendWhatsappButtonMessage("factChecker", voteRequestData.platformId, responses.L2_SCAM_ASSESSMENT_PROMPT, buttons, replyId ?? voteRequestData.sentMessageId)
      break;
    case "telegram":
      break
  }
};


exports.sendVotingMessage = async function sendVotingMessage(voteRequestSnap, messageRef) {
  const messageSnap = await messageRef.get();
  const message = messageSnap.data();
  const voteRequestData = voteRequestSnap.data();
  const responses = await getResponsesObj("factChecker");
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
          await sendWhatsappTextListMessage("factChecker", voteRequestData.platformId, responses.FACTCHECK_PROMPT, "Vote here", sections, voteRequestData.sentMessageId);
          break;
        case "image":
          await sendWhatsappTextListMessage("factChecker", voteRequestData.platformId, responses.FACTCHECK_PROMPT, "Vote here", sections, voteRequestData.sentMessageId);
          break;
      }
      break;
    case "telegram":
      break;
  }
};


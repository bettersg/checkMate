const { sendWhatsappTextListMessage } = require("./sendWhatsappMessage");
const { getResponsesObj } = require("./responseUtils");

exports.sendL1CategorisationMessage = async function (voteRequestSnap, messageRef, replyId = null) {
  const voteRequestData = voteRequestSnap.data();
  const responses = await getResponsesObj("factChecker");
  const type = "categorize"
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = [
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_scam`,
          title: "Scam",
          description: "Intent is to obtain money/personal information via trickery"
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_illicit`,
          title: "Illicit",
          description: "Other potential illicit activity, e.g. moneylending/prostitution"
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_info`,
          title: "News/Information/Opinion",
          description: "Messages intended to inform/convince a broad base of people"
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_others`,
          title: "It's something else",
          description: "Messages that don't fall into the other categories"
        }
      ]
      const sections = [{
        rows: rows,
      }];
      await sendWhatsappTextListMessage("factChecker", voteRequestData.platformId, responses.L1_SCAM_ASSESSMENT_PROMPT, "Make Selection", sections, voteRequestData.sentMessageId);
      break;
    case "telegram":
      break
  }
};

exports.sendL2OthersCategorisationMessage = async function (voteRequestSnap, messageRef, replyId = null) {
  const voteRequestData = voteRequestSnap.data();
  const responses = await getResponsesObj("factChecker");
  const type = "others"
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = [
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_spam`,
          title: "Spam",
          description: "Unsolicited spam, such as marketing messages"
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_legitimate`,
          title: "Legitimate",
          description: "Legitimate source but can't be assessed, e.g. transactional messages"
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_irrelevant`,
          title: "Trivial",
          description: "Trivial/banal messages with nothing to assess"
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_unsure`,
          title: "I'm Unsure",
          description: "Do try your best to categorize! But if really unsure, select this"
        }
      ]
      const sections = [{
        rows: rows,
      }];
      await sendWhatsappTextListMessage("factChecker", voteRequestData.platformId, responses.L2_OTHERS_ASSESSEMENT_PROMPT, "Make Selection", sections, voteRequestData.sentMessageId);
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
  const type = "vote"
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = [];
      const max_score = 5;
      for (let i = 0; i <= max_score; i++) {
        rows.push({
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_${i}`,
          title: `${i}`,
        });
      }
      rows[0].description = "Totally false";
      rows[max_score].description = "Totally true";
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


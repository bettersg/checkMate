const admin = require('firebase-admin');
const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } = require('./constants');
const { sleep } = require('./utils');
const { sendTextMessage } = require('./sendMessage')
const { sendWhatsappButtonMessage, sendWhatsappTemplateMessage } = require('./sendWhatsappMessage')
const functions = require('firebase-functions');

async function respondToInstance(instanceSnap) {
  const parentMessageRef = instanceSnap.ref.parent.parent;
  const parentMessageSnap = await parentMessageRef.get();
  const data = instanceSnap.data();
  if (!data.from) {
    functions.logger.log("Missing 'from' field in instance data");
    return Promise.resolve()
  }
  const responses = await getResponsesObj(botType = "user");
  const isAssessed = parentMessageSnap.get("isAssessed");
  const isIrrelevant = parentMessageSnap.get("isIrrelevant");
  const isScam = parentMessageSnap.get("isScam");
  const isIllicit = parentMessageSnap.get("isIllicit");
  const truthScore = parentMessageSnap.get("truthScore");
  const isSpam = parentMessageSnap.get("isSpam");
  const isUnsure = parentMessageSnap.get("isUnsure");
  const isInfo = parentMessageSnap.get("isInfo");
  const isLegitimate = parentMessageSnap.get("isLegitimate");
  const isMachineCategorised = parentMessageSnap.get("isMachineCategorised");

  if (!isAssessed) {
    await sendTextMessage("user", data.from, responses.MESSAGE_NOT_YET_ASSESSED, data.id)
    return;
  }
  if (isScam || isIllicit) {
    const payload = [`scamshieldConsent_${instanceSnap.ref.path}_consent`, `scamshieldConsent_${instanceSnap.ref.path}_decline`, `scamshieldExplain_${instanceSnap.ref.path}_${data.id}`]
    if (isScam) {
      await sendWhatsappTemplateMessage("user", data.from, "illicit_message_response", "en", [], payload, data.id); //TODO: Change to scams template
    } else {
      await sendWhatsappTemplateMessage("user", data.from, "illicit_message_response", "en", [], payload, data.id);
    }
    return;
  }
  if (isSpam) {
    await sendWhatsappTemplateMessage("user", data.from, "spam_message_response", "en", [], [], data.id);
    return
  }
  if (isLegitimate) {
    await sendWhatsappTemplateMessage("user", data.from, "legitimate_message_response", "en", [], [], data.id);
    return
  }
  if (isIrrelevant) {
    if (isMachineCategorised) {
      await sendWhatsappTemplateMessage("user", data.from, "irrelevant_message_auto_response", "en", [], [], data.id);
    } else {
      await sendWhatsappTemplateMessage("user", data.from, "irrelevant_message_response", "en", [], [], data.id);
    }
    return;
  }
  if (isInfo) {
    if (truthScore === null) {
      await sendWhatsappTemplateMessage("user", data.from, "error_response", "en", [], [], data.id);
      return;
    } else if (truthScore < 1.5) {
      await sendWhatsappTemplateMessage("user", data.from, "untrue_message_response", "en", [], [], data.id);
    } else if (truthScore < 3.5) {
      await sendWhatsappTemplateMessage("user", data.from, "misleading_message_response", "en", [], [], data.id);
    } else {
      await sendWhatsappTemplateMessage("user", data.from, "accurate_message_response", "en", [], [], data.id);
    }
    return
  }
  if (isUnsure) {
    await sendWhatsappTemplateMessage("user", data.from, "unsure_message_response", "en", [], [], data.id);
    return;
  }
  functions.logger.warn("did not return as expected");
  return;
}

async function getResponsesObj(botType = "user") {
  const db = admin.firestore()
  let path;
  let fallbackResponses;
  if (botType === "user") {
    path = 'systemParameters/userBotResponses';
    fallbackResponses = USER_BOT_RESPONSES;
  } else if (botType === "factChecker") {
    path = 'systemParameters/factCheckerBotResponses'
    fallbackResponses = FACTCHECKER_BOT_RESPONSES;
  }
  const defaultResponsesRef = db.doc(path);
  const defaultResponsesSnap = await defaultResponsesRef.get()
  return defaultResponsesSnap.data() ?? fallbackResponses
};

exports.getResponsesObj = getResponsesObj;
exports.respondToInstance = respondToInstance;
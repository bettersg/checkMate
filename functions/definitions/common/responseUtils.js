const admin = require('firebase-admin');
const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } = require('./constants');
const { sleep } = require('./utils');
const { sendTextMessage } = require('./sendMessage')
const { sendWhatsappButtonMessage } = require('./sendWhatsappMessage')
const functions = require('firebase-functions');
const { Timestamp } = require('firebase-admin/firestore');

async function respondToInstance(instanceSnap, forceReply = false) {
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

  if (!isAssessed && !forceReply) {
    await sendTextMessage("user", data.from, responses.MESSAGE_NOT_YET_ASSESSED, data.id)
    return;
  }
  if (isScam || isIllicit) {
    let responseText;
    if (isScam) {
      responseText = responses.SCAM;
    } else {
      responseText = responses.SUSPICIOUS;
    }
    const buttons = [{
      type: "reply",
      reply: {
        id: `scamshieldConsent_${instanceSnap.ref.path}_consent`,
        title: "Yes",
      },
    }, {
      type: "reply",
      reply: {
        id: `scamshieldConsent_${instanceSnap.ref.path}_decline`,
        title: "No",
      }
    }, {
      type: "reply",
      reply: {
        id: `scamshieldExplain_${instanceSnap.ref.path}_${data.id}`,
        title: "What is ScamShield?",
      }
    }];
    await sendWhatsappButtonMessage("user", data.from, responseText, buttons, data.id)
  }
  else if (isSpam) {
    await sendTextMessage("user", data.from, responses.SPAM, data.id);
  }
  else if (isLegitimate) {
    await sendTextMessage("user", data.from, responses.LEGITIMATE, data.id);
  }
  else if (isIrrelevant) {
    if (isMachineCategorised) {
      await sendTextMessage("user", data.from, responses.IRRELEVANT_AUTO, data.id)
    } else {
      await sendTextMessage("user", data.from, responses.IRRELEVANT, data.id)
    }
  }
  else if (isInfo) {
    if (truthScore === null) {
      await sendTextMessage("user", data.from, responses.ERROR, data.id)
    } else {
      await sendTextMessage("user", data.from, _getResponse(truthScore, responses), data.id)
    }
  }
  else if (isUnsure) {
    await sendTextMessage("user", data.from, responses.UNSURE, data.id)
  }
  else {
    functions.logger.warn("did not return as expected");
    return;
  }
  await instanceSnap.ref.update({ isReplied: true, replyTimestamp: Timestamp.fromDate(new Date()) });
  return;
}

function getResponseToMessage(docSnap, responses) {
  const isAssessed = docSnap.get("isAssessed");
  const isIrrelevant = docSnap.get("isIrrelevant");
  const isScam = docSnap.get("isScam");
  const truthScore = docSnap.get("truthScore");

  if (!isAssessed) {
    return responses.MESSAGE_NOT_YET_ASSESSED
  }
  if (isScam) {
    return responses.SCAM;
  }
  if (isIrrelevant) {
    return responses.IRRELEVANT;
  }
  if (truthScore === null) {
    return responses.NO_SCORE;
  }
  return _getResponse(truthScore, responses);
};

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

function _getResponse(key, responses) {
  if (isNaN(key)) { //means key is a string
    return responses.key;
  } else {
    const truthScore = key;
    let numericKeys = Object.keys(responses).filter((e) => !isNaN(e)).sort();
    for (let numericKey of numericKeys) {
      if (parseFloat(numericKey) >= truthScore) {
        return responses[`${numericKey}`];
      }
    }
  }
  return null;
};

exports.getResponsesObj = getResponsesObj;
exports.getResponseToMessage = getResponseToMessage;
exports.respondToInstance = respondToInstance;
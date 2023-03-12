
const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES, thresholds } = require('./constants');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { sendWhatsappTextMessage } = require('./sendWhatsappMessage')
const { defineString } = require('firebase-functions/params');
const { findPhoneNumbersInText } = require('libphonenumber-js');
const { createHash } = require('crypto');

const checker1PhoneNumber = defineString("CHECKER1_PHONE_NUMBER");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.sleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.handleSpecialCommands = async function (messageObj) {
  const command = messageObj.text.body.toLowerCase();
  if (command.startsWith('/')) {
    switch (command) {
      case '/mockdb':
        await mockDb();
        return
      case '/getid':
        await sendWhatsappTextMessage("user", messageObj.from, `${messageObj.id}`, messageObj.id)
        return
    }
  }
}

const mockDb = async function () {
  functions.logger.log("mocking...")
  const db = admin.firestore()
  const systemParametersRef = db.collection('systemParameters');
  await systemParametersRef.doc('userBotResponses').set(USER_BOT_RESPONSES);
  await systemParametersRef.doc('factCheckerBotResponses').set(FACTCHECKER_BOT_RESPONSES);
  await systemParametersRef.doc('supportedTypes').set({
    whatsapp: ["text", "image"]
  })
  await systemParametersRef.doc('thresholds').set(thresholds)
  const factCheckersRef = db.collection('factCheckers');
  await factCheckersRef.doc(checker1PhoneNumber.value()).set({
    name: "Bing Wen",
    isActive: true,
    platformId: checker1PhoneNumber.value(),
    level: 1,
    experience: 0,
    numVoted: 0,
    numCorrectVotes: 0,
    numVerifiedLinks: 0,
    preferredPlatform: "whatsapp",
  }, { merge: true })
  functions.logger.log("mocked")
}

exports.getThresholds = async function () {
  const db = admin.firestore()
  const theresholdsRef = db.doc('systemParameters/thresholds');
  const theresholdsSnap = await theresholdsRef.get()
  return theresholdsSnap.data() ?? thresholds;
}

exports.checkUrl = function (urlString) {
  let url;
  try {
    url = new URL(urlString)
  }
  catch (e) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

exports.getResponseToMessage = function (docSnap, responses) {
  const isAssessed = docSnap.get("isAssessed");
  const isIrrelevant = docSnap.get("isIrrelevant");
  const isScam = docSnap.get("isScam");
  const isIllicit = docSnap.get("isIllicit");
  const truthScore = docSnap.get("truthScore");

  if (!isAssessed) {
    return responses.MESSAGE_NOT_YET_ASSESSED
  }
  if (isScam) {
    return responses.SCAM;
  }
  if (isIllicit) {
    return responses.SUSPICIOUS;
  }
  if (isIrrelevant) {
    return responses.IRRELEVANT;
  }
  if (truthScore === null) {
    return responses.NO_SCORE;
  }
  return getResponse(truthScore, responses);
};

async function getReponsesObj(botType = "users") {
  const db = admin.firestore()
  let path;
  let fallbackResponses;
  if (botType === "users") {
    path = 'systemParameters/userBotResponses';
    fallbackResponses = USER_BOT_RESPONSES;
  } else if (botType === "factCheckers") {
    path = 'systemParameters/factCheckerBotResponses'
    fallbackResponses = FACTCHECKER_BOT_RESPONSES;
  }
  const defaultResponsesRef = db.doc(path);
  const defaultResponsesSnap = await defaultResponsesRef.get()
  return defaultResponsesSnap.data() ?? fallbackResponses
};

function getResponse(key, responses) {
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

function stripPhone(originalStr, includePlaceholder = false) {
  const phoneNumbers = findPhoneNumbersInText(originalStr)
  let newStr = originalStr;
  let offset = 0;
  const placeholder = includePlaceholder ? "<PHONE_NUM>" : ""
  phoneNumbers.forEach(phoneNumber => {
    const { startsAt, endsAt } = phoneNumber;
    const adjustedStartsAt = startsAt - offset;
    const adjustedEndsAt = endsAt - offset;
    newStr = newStr.slice(0, adjustedStartsAt) + placeholder + newStr.slice(adjustedEndsAt);
    offset += endsAt - startsAt;
  });
  newStr = newStr.replace(/[0-9]{7,}/g, placeholder)
  return newStr;
}

function stripUrl(originalStr, includePlaceholder = false) {
  const urlRegex = /\b((?:https?:\/\/)?(?:(?:www\.)?(?:[\da-z\.-]+)\.(?:[a-z]{2,6})|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])))(?::[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])?(?:\/[\w\.-]*)*\/?)\b/g
  const placeholder = includePlaceholder ? "<URL>" : "";
  const replacedString = originalStr.replace(urlRegex, placeholder);
  return replacedString;
}

function hashMessage(originalStr) {
  return createHash('md5').update(originalStr).digest('hex');
}

exports.getReponsesObj = getReponsesObj;
exports.getResponse = getResponse;
exports.stripPhone = stripPhone;
exports.stripUrl = stripUrl;
exports.hashMessage = hashMessage;



const { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES, thresholds } = require('./constants');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

exports.mockDb = async function () {
    functions.logger.log("mocking...")
    const db = admin.firestore()
    const systemParametersRef = db.collection('systemParameters');
    await systemParametersRef.doc('userBotResponses').set(USER_BOT_RESPONSES);
    await systemParametersRef.doc('factCheckerBotResponses').set(FACTCHECKER_BOT_RESPONSES);
    await systemParametersRef.doc('supportedTypes').set({
        whatsapp: ["text", "image"]
    })
    await systemParametersRef.doc('supportedTypes').set(thresholds)
    const factCheckersRef = db.collection('factCheckers');
    await factCheckersRef.add({
        name: "Bing Wen",
        isActive: true,
        whatsappNumber: "6591807628",
        telegramId: "",
        level: 1,
        experience: 0,
        numVoted: 0,
        numCorrectVotes: 0,
        numVerifiedLinks: 0,
        preferredChannel: "Whatsapp",
    })
    functions.logger.log("mocked")
}

exports.getThresholds = async function () {
    const db = admin.firestore()
    const theresholdsRef = db.doc('systemParameters/thresholds');
    const theresholdsSnap = await theresholdsRef.get()
    return theresholdsSnap.data() ?? thresholds;
}

exports.getResponseToMessage = function (docSnap, responses) {
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

exports.getReponsesObj = getReponsesObj;
exports.getResponse = getResponse;


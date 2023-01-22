const axios = require("axios");
const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');

const graphApiVersion = defineString("GRAPH_API_VERSION");
const runtimeEnvironment = defineString("ENVIRONMENT")

async function sendWhatsappTextMessage(bot, to, text, replyMessageId = null) {
    if (runtimeEnvironment.value() !== "PROD") {
        text = `*${bot.toUpperCase()}_BOT:* ${text}`
    }
    const data = {
        text: { body: text },
        to: to,
        messaging_product: "whatsapp",
    };
    if (replyMessageId) {
        data.context = {
            message_id: replyMessageId,
        };
    }
    const response = await callWhatsappSendMessageApi(data, bot);
    return response;
}

async function sendWhatsappImageMessage(bot, to, id, url = null, caption = null, replyMessageId = null) {
    if (runtimeEnvironment.value() !== "PROD") {
        caption = `*${bot.toUpperCase()}_BOT:* ${caption}`
    }
    const mediaObj = {};
    if (url) {
        mediaObj.link = url;
    } else {
        mediaObj.id = id;
    }
    if (caption) {
        mediaObj.caption = caption;
    }
    const data = {
        image: mediaObj,
        to: to,
        type: "image",
        messaging_product: "whatsapp",
    };
    if (replyMessageId) {
        data.context = {
            message_id: replyMessageId,
        };
    }
    const response = await callWhatsappSendMessageApi(data, bot);
    return response;
}

async function sendWhatsappTemplateMessage(bot, to, templateName, languageCode = "en", bodyTextVariables = [], buttonPayloads = []) {
    let token;
    token = process.env.WHATSAPP_TOKEN;
    const buttonComponentArr = buttonPayloads.map((payload, index) => {
        return {
            type: "button",
            sub_type: "quick_reply",
            index: index,
            parameters: [
                {
                    type: "payload",
                    payload: payload,
                },
            ],
        };
    });
    const bodyComponentArr = bodyTextVariables.map((variable) => {
        return {
            type: "body",
            parameters: [
                {
                    type: "text",
                    text: variable,
                }
            ]
        };
    });
    const componentsArr = buttonComponentArr.concat(bodyComponentArr);
    data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "template",
        template: {
            name: templateName,
            language: {
                policy: "deterministic",
                code: languageCode,
            },
            components: componentsArr,
        },
    };
    let response = await callWhatsappSendMessageApi(data, bot);
    return response;
}

async function sendWhatsappTextListMessage(bot, to, text, buttonText, sections, replyMessageId = null) {
    if (runtimeEnvironment.value() !== "PROD") {
        text = `*${bot.toUpperCase()}_BOT:* ${text}`
    }
    data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "list",
            body: {
                text: text,
            },
            action: {
                button: buttonText,
                sections: sections,
            },
        },
    };
    if (replyMessageId) {
        data.context = {
            message_id: replyMessageId,
        };
    }
    const response = await callWhatsappSendMessageApi(data, bot);
    return response;
}

async function sendWhatsappButtonMessage(bot, to, text, buttons, replyMessageId = null) {
    if (runtimeEnvironment.value() !== "PROD") {
        text = `*${bot.toUpperCase()}_BOT:* ${text}`
    }
    data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: text,
            },
            action: {
                buttons: buttons,
            },
        },
    };
    if (replyMessageId) {
        data.context = {
            message_id: replyMessageId,
        };
    }
    callWhatsappSendMessageApi(data, bot);
};

async function markWhatsappMessageAsRead(bot, messageId) {
    data = {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
    }
    callWhatsappSendMessageApi(data, bot);
}

async function callWhatsappSendMessageApi(data, bot) {
    const token = process.env.WHATSAPP_TOKEN;
    let phoneNumberId;
    if (bot == "factChecker") {
        phoneNumberId = process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID;
    } else {
        phoneNumberId = process.env.WHATSAPP_USER_BOT_PHONE_NUMBER_ID
    }
    const response = await axios({
        method: "POST", // Required, HTTP method, a string, e.g. POST, GET
        url:
            `https://graph.facebook.com/${graphApiVersion.value()}/` +
            phoneNumberId +
            "/messages",
        data: data,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    }).catch((error) => functions.logger.log(error.response));
    return response;
}

exports.sendWhatsappTextMessage = sendWhatsappTextMessage;
exports.sendWhatsappImageMessage = sendWhatsappImageMessage;
exports.sendWhatsappTemplateMessage = sendWhatsappTemplateMessage;
exports.sendWhatsappTextListMessage = sendWhatsappTextListMessage;
exports.sendWhatsappButtonMessage = sendWhatsappButtonMessage;
exports.markWhatsappMessageAsRead = markWhatsappMessageAsRead;

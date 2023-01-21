const axios = require("axios");
const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');

const graphApiVersion = defineString("GRAPH_API_VERSION")

async function sendWhatsappTextMessage(phoneNumberId, to, text, replyMessageId = null) {
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
    const response = await callWhatsappSendMessageApi(data, phoneNumberId);
    return response;
}

async function sendWhatsappImageMessage(phoneNumberId, to, id, url = null, caption = null, replyMessageId = null) {
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
    const response = await callWhatsappSendMessageApi(data, phoneNumberId);
    return response;
}

async function sendWhatsappTemplateMessage(phoneNumberId, to, templateName, languageCode = "en", bodyTextVariables = [], buttonPayloads = [], bot = "user") {
    let token;
    token = process.env.WHATSAPP_TOKEN;
    // if (bot === "factChecker") {
    //     token = process.env.WHATSAPP_TOKEN_FACT_CHECKERS;
    // } else {
    //     token = process.env.WHATSAPP_TOKEN;
    // }
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
    console.log(JSON.stringify(data, null, 2));
    let response = await callWhatsappSendMessageApi(data, phoneNumberId);
    return response;
}

async function sendWhatsappTextListMessage(phoneNumberId, to, text, buttonText, sections, replyMessageId = null) {
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
    const response = await callWhatsappSendMessageApi(data, phoneNumberId);
    return response;
}

// async function sendWhatsappImageListMessage(phoneNumberId, to, id, url = null, caption = null, replyMessageId = null) {
//     callWhatsappSendMessageApi(data, phoneNumberId);
// };

async function callWhatsappSendMessageApi(data, phoneNumberId) {
    const token = process.env.WHATSAPP_TOKEN;
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
    }).catch((error) => functions.log(error.response()));
    return response;
}

exports.sendWhatsappTextMessage = sendWhatsappTextMessage;
exports.sendWhatsappImageMessage = sendWhatsappImageMessage;
exports.sendWhatsappTemplateMessage = sendWhatsappTemplateMessage;
exports.sendWhatsappTextListMessage = sendWhatsappTextListMessage;

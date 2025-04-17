import axios from "axios"
import * as functions from "firebase-functions"
import { defineString } from "firebase-functions/params"
import { WhatsappButton, FlowData } from "../../types"
import { AppEnv } from "../../appEnv"

const graphApiVersion = defineString(AppEnv.GRAPH_API_VERSION)
const graphApiUrl =
  process.env["TEST_SERVER_URL"] || "https://graph.facebook.com" //only exists in integration test environment

async function sendWhatsappTextMessage(
  bot: string,
  to: string,
  text: string,
  replyMessageId: string | null = null,
  previewUrl: string | boolean = false
) {
  if (text.length > 4096) {
    text = `${text.slice(0, 4000)}...*[TRUNCATED, MSG TOO LONG FOR WHATSAPP]*`
  }
  const data: {
    text: { body: string; preview_url: string | boolean }
    to: string
    messaging_product: string
    context?: { message_id: string }
  } = {
    text: { body: text, preview_url: previewUrl },
    to: to,
    messaging_product: "whatsapp",
  }
  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappImageMessage(
  bot: string,
  to: string,
  id: string | null,
  url: string | null = null,
  caption: string | null = null,
  replyMessageId: string | null = null
) {
  if (caption && caption.length > 1024) {
    caption = `${caption.slice(
      0,
      950
    )}...*[TRUNCATED, MSG TOO LONG FOR WHATSAPP]*`
  }
  const mediaObj: {
    link?: string
    id?: string | null
    caption?: string
  } = {}
  if (url) {
    mediaObj.link = url
  } else {
    mediaObj.id = id
  }
  if (caption) {
    mediaObj.caption = caption
  }
  const data: {
    image: typeof mediaObj
    to: string
    type: string
    messaging_product: string
    context?: {
      message_id: string
    }
  } = {
    image: mediaObj,
    to: to,
    type: "image",
    messaging_product: "whatsapp",
  }
  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappVideoMessage(
  bot: string,
  to: string,
  id: string | null,
  url: string | null = null,
  caption: string | null = null,
  replyMessageId: string | null = null
) {
  if (caption && caption.length > 1024) {
    caption = `${caption.slice(
      0,
      950
    )}...*[TRUNCATED, MSG TOO LONG FOR WHATSAPP]*`
  }
  const mediaObj: {
    link?: string
    id?: string | null
    caption?: string
  } = {}
  if (url) {
    mediaObj.link = url
  } else {
    mediaObj.id = id
  }
  if (caption) {
    mediaObj.caption = caption
  }
  const data: {
    video: typeof mediaObj
    to: string
    type: string
    messaging_product: string
    context?: {
      message_id: string
    }
  } = {
    video: mediaObj,
    to: to,
    type: "video",
    messaging_product: "whatsapp",
  }
  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappTemplateMessage(
  bot: string,
  to: string,
  templateName: string,
  languageCode = "en",
  bodyTextVariables: string[] = [],
  buttonPayloads: string[] = [],
  replyMessageId: string | null = null
) {
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
    }
  })
  const bodyComponentArr = {
    type: "body",
    parameters: bodyTextVariables.map((variable) => {
      return {
        type: "text",
        text: variable,
      }
    }),
  }
  //@ts-ignore TODO: buttonComponentArr and bodyComponentArr have different properties
  const componentsArr = buttonComponentArr.concat(bodyComponentArr)
  const data: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    template: {
      name: string
      language: {
        policy: string
        code: string
      }
      components: typeof componentsArr
    }
    context?: {
      message_id: string
    }
  } = {
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
  }
  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappOTP(bot: string, to: string, otp: string) {
  const data: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    template: {
      name: string
      language: {
        code: string
      }
      components: {
        type: string
        sub_type?: string
        index?: string
        parameters: {
          type: string
          text: string
        }[]
      }[]
    }
  } = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "template",
    template: {
      name: "whatsapp_otp",
      language: {
        code: "en",
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otp,
            },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: otp,
            },
          ],
        },
      ],
    },
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappTextListMessage(
  bot: string,
  to: string,
  text: string,
  buttonText: string,
  sections: any,
  replyMessageId: string | null = null
) {
  const data: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    interactive: {
      type: string
      body: {
        text: string
      }
      action: {
        button: string
        sections: typeof sections
      }
    }
    context?: {
      message_id: string
    }
  } = {
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
  }
  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappButtonMessage(
  bot: string,
  to: string,
  text: string,
  buttons: WhatsappButton[],
  replyMessageId: string | null = null,
  headerText: string | null = null,
  footerText: string | null = null
) {
  const data: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    interactive: {
      type: string
      body: {
        text: string
      }
      header?: {
        type: string
        text: string
      }
      footer?: {
        text: string
      }
      action: {
        buttons: WhatsappButton[]
      }
    }
    context?: {
      message_id: string
    }
  } = {
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
  }

  if (headerText) {
    data.interactive.header = {
      type: "text",
      text: headerText,
    }
  }

  if (footerText) {
    data.interactive.footer = {
      text: footerText,
    }
  }

  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappFlowMessage(
  bot: string,
  to: string,
  flow_token: string,
  flow_id: string,
  cta: string,
  bodyText: string,
  headerText: string | null = null,
  footerText: string | null = null,
  isDraft: boolean = false
) {
  const interactive: any = {
    type: "flow",
    body: {
      text: bodyText,
    },
    action: {
      name: "flow",
      parameters: {
        flow_message_version: "3",
        flow_token: flow_token,
        flow_id: flow_id,
        flow_cta: cta,
        flow_action: "data_exchange",
      },
    },
  }

  if (headerText) {
    interactive.header = {
      type: "text",
      text: headerText,
    }
  }

  if (footerText) {
    interactive.footer = {
      text: footerText,
    }
  }

  if (isDraft) {
    interactive.action.parameters.mode = "draft"
  }

  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactive,
  }

  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function sendWhatsappContactMessage(
  bot: string,
  to: string,
  phoneNumber: string,
  name: { formatted_name: string; suffix: string },
  url: string,
  replyMessageId: string | null = null
) {
  const data: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    contacts: {
      name: { formatted_name: string; suffix: string }
      urls: { url: string }[]
      phones: { phone: string }[]
    }[]
    context?: {
      message_id: string
    }
  } = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "contacts",
    contacts: [
      {
        name,
        urls: [
          {
            url,
          },
        ],
        phones: [
          {
            phone: phoneNumber,
          },
        ],
      },
    ],
  }
  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }
  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function markWhatsappMessageAsRead(bot: string, messageId: string) {
  const data = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  }
  callWhatsappSendMessageApi(data, bot)
}

async function sendWhatsappCtaUrlMessage(
  bot: string,
  to: string,
  buttonText: string,
  buttonUrl: string,
  bodyText: string | null = null,
  headerText: string | null = null,
  footerText: string | null = null,
  replyMessageId: string | null = null
) {
  const interactive: any = {
    type: "cta_url",
    action: {
      name: "cta_url",
      parameters: {
        display_text: buttonText,
        url: buttonUrl,
      },
    },
  }

  if (bodyText) {
    interactive.body = {
      text: bodyText,
    }
  }

  if (headerText) {
    interactive.header = {
      type: "text",
      text: headerText,
    }
  }

  if (footerText) {
    interactive.footer = {
      text: footerText,
    }
  }

  const data: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    interactive: typeof interactive
    context?: {
      message_id: string
    }
  } = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: interactive,
  }

  if (replyMessageId) {
    data.context = {
      message_id: replyMessageId,
    }
  }

  const response = await callWhatsappSendMessageApi(data, bot)
  return response
}

async function callWhatsappSendMessageApi(data: any, bot: string) {
  const token = process.env.WHATSAPP_TOKEN
  let phoneNumberId
  if (bot == "factChecker") {
    phoneNumberId = process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID
  } else {
    phoneNumberId = process.env.WHATSAPP_USER_BOT_PHONE_NUMBER_ID
  }
  const response = await axios({
    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
    url:
      `${graphApiUrl}/${graphApiVersion.value()}/` +
      phoneNumberId +
      "/messages",
    data: data,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    functions.logger.log(error.response.data)
    throw new Error("An error occured calling the whatsapp API")
  })
  return response
}

export {
  sendWhatsappTextMessage,
  sendWhatsappImageMessage,
  sendWhatsappVideoMessage,
  sendWhatsappTemplateMessage,
  sendWhatsappTextListMessage,
  sendWhatsappButtonMessage,
  markWhatsappMessageAsRead,
  sendWhatsappContactMessage,
  sendWhatsappFlowMessage,
  sendWhatsappOTP,
  sendWhatsappCtaUrlMessage,
}

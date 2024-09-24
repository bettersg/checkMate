import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import crypto from "crypto"
import { defineString } from "firebase-functions/params"
import { handleSpecialCommands } from "./specialCommands"
import { publishToTopic } from "../common/pubsub"
import { onRequest } from "firebase-functions/v2/https"
import { checkMessageId } from "../common/utils"
import { referralHandler } from "../../services/whatsapp/referrals"
import { Request, Response } from "express"
import { adminBotHandlerTelegram } from "./handlers/adminHandlerTelegram"
import { AppEnv } from "../../appEnv"
import { GeneralMessage, WhatsappMessageObject } from "../../types"
import {
  createNewUser,
  getUserSnapshot,
} from "../../services/common/userManagement"
import { checkMenu } from "../../validators/whatsapp/checkWhatsappText"
import { Timestamp } from "firebase-admin/firestore"
import {
  sendLanguageSelection,
  sendUnsupportedTypeMessage,
} from "../common/responseUtils"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

const webhookPathWhatsapp = process.env.WEBHOOK_PATH_WHATSAPP
const webhookPathTelegram = process.env.WEBHOOK_PATH_TELEGRAM
const webhookPathTypeform = process.env.WEBHOOK_PATH_TYPEFORM
const webhookPathTelegramAdmin = process.env.WEBHOOK_PATH_TELEGRAM_ADMIN
const typeformSecretToken = process.env.TYPEFORM_SECRET_TOKEN
const typeformURL = process.env.TYPEFORM_URL
const ingressSetting =
  process.env.ENVIRONMENT === "PROD" ? "ALLOW_INTERNAL_AND_GCLB" : "ALLOW_ALL"

interface CustomRequest extends Request {
  rawBody?: string // Define your custom property here
}

if (!admin.apps.length) {
  admin.initializeApp()
}

const app = express()

const getHandlerWhatsapp = async (req: Request, res: Response) => {
  /**
   * UPDATE YOUR VERIFY TOKEN
   *This will be the Verify Token value when you set up webhook
   **/
  const verifyToken = process.env.VERIFY_TOKEN
  // Parse params from the webhook verification request
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === verifyToken) {
      // Respond with 200 OK and challenge token from the request
      functions.logger.log("WEBHOOK_VERIFIED")
      res.status(200).send(challenge)
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403)
    }
  } else {
    res.sendStatus(400)
  }
}

const postHandlerWhatsapp = async (req: Request, res: Response) => {
  try {
    console.log("req.body", req.body)
    if (req.body.object) {
      if (req?.body?.entry?.[0]?.changes?.[0]?.value) {
        let value = req.body.entry[0].changes[0].value
        let phoneNumberId = value.metadata.phone_number_id
        let wabaID = req.body.entry[0].id
        let checkerPhoneNumberId
        let userPhoneNumberId
        let checkerWabaId
        let userWabaId

        checkerPhoneNumberId = process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID
        userPhoneNumberId = process.env.WHATSAPP_USER_BOT_PHONE_NUMBER_ID
        checkerWabaId = process.env.WHATSAPP_CHECKERS_WABA_ID
        userWabaId = process.env.WHATSAPP_USERS_WABA_ID

        if (
          (phoneNumberId === checkerPhoneNumberId &&
            wabaID === checkerWabaId) ||
          (phoneNumberId === userPhoneNumberId && wabaID === userWabaId)
        ) {
          if (value?.messages?.[0]) {
            let message: WhatsappMessageObject = value.messages[0]
            let type = message.type
            if (
              type == "text" &&
              message.text.body.startsWith("/") &&
              runtimeEnvironment.value() !== "PROD"
            ) {
              //handle db commands
              await handleSpecialCommands(message)
            } else {
              if (message?.id) {
                //if message has been processed before, don't even put it in queue.
                if (await checkMessageId(message.id)) {
                  functions.logger.warn(
                    `message ${message.id} already processed`
                  )
                  res.sendStatus(200)
                  return
                }
              } else {
                functions.logger.error(`message ${message.id} has no id`)
                res.sendStatus(200)
                return
              }
              if (
                (type == "button" || type == "interactive" || type == "text") &&
                phoneNumberId === checkerPhoneNumberId
              ) {
                //put into checker queue
                await publishToTopic("checkerEvents", message, "whatsapp")
              }
              if (phoneNumberId === userPhoneNumberId) {
                //check for new user

                let isFirstTimeUser = false
                const whatsappId = message.from
                let userSnap = await getUserSnapshot(whatsappId, "whatsapp")
                if (userSnap === null) {
                  //new user
                  isFirstTimeUser = true

                  const messageTimestamp = new Timestamp(
                    Number(message.timestamp),
                    0
                  )
                  const userRef = await createNewUser(
                    whatsappId,
                    "whatsapp",
                    messageTimestamp
                  )
                  if (userRef === null) {
                    functions.logger.error(
                      `Error creating new user with whatsappId ${whatsappId}`
                    )
                    return res.sendStatus(400)
                  }
                  userSnap = await userRef.get()
                  if (type !== "request_welcome") {
                    functions.logger.warn(
                      `New user ${whatsappId}, but not due to request_welcome event`
                    )
                    await sendLanguageSelection(userSnap, true)
                  }
                } else if (userSnap.get("isIgnored")) {
                  //handle ban
                  functions.logger.warn(
                    `Message from banned user ${message.from}!, text: ${message?.text?.body}`
                  )
                  return res.sendStatus(200)
                }
                //check whether it's navigational or message
                const isNavigational = checkNavigational(message)
                if (isNavigational) {
                  await publishToTopic(
                    "userNavigationEvents",
                    message,
                    "whatsapp"
                  )
                } else {
                  switch (type) {
                    case "text":
                    case "image":
                      //convert message to general Message object for processing
                      let genericMessage: GeneralMessage = {
                        source: "whatsapp",
                        id: message.id,
                        userId: message.from,
                        type: message.type,
                        subject: null,
                        text: message.text?.body ?? null,
                        media: {
                          fileId: message.image?.id ?? null, //to download the media
                          caption: message.image?.caption ?? null,
                          mimeType: message.image?.mime_type ?? null, //determines if it is an image or video
                        },
                        timestamp: message.timestamp,
                        isForwarded: message.context?.forwarded,
                        frequently_forwarded:
                          message.context?.frequently_forwarded,
                        isFirstTimeUser: isFirstTimeUser,
                      }
                      await publishToTopic(
                        "userGenericMessages",
                        genericMessage,
                        "whatsapp"
                      )
                      break
                    case "interactive":
                    case "button":
                      functions.logger.warn(
                        `Message ${message.id} should have been handled by userNavigationEvents`
                      )
                      break
                    case "request_welcome":
                      console.log("requested welcome")
                      await sendLanguageSelection(userSnap, true)
                      break
                    default:
                      await sendUnsupportedTypeMessage(userSnap, message.id)
                      break
                  }
                }
              }
            }
            res.sendStatus(200)
          } else if (value?.statuses?.[0]) {
            let status = value.statuses[0]
            let bot =
              phoneNumberId === checkerPhoneNumberId ? "checker" : "user"
            if (status.status === "failed") {
              const errorObj = {
                messageId: status.id,
                timestamp: status.timestamp,
                recipientId: status.recipient_id,
                errors: status.errors,
                displayPhoneNumber: value.metadata.displayPhoneNumber,
                bot: bot,
              }
              functions.logger.error(
                `Error sending message ${status.id} to ${status.recipient_id} from ${bot} bot`,
                errorObj
              )
            }
            res.sendStatus(200)
          } else {
            functions.logger.log(`Not a message or status update`)
            res.sendStatus(200)
          }
        } else {
          functions.logger.warn(
            `Unexpected message source from phoneNumberId ${phoneNumberId}`
          )
          res.sendStatus(200)
        }
      } else {
        res.sendStatus(200) //unexpected message type, could be status update
      }
    } else {
      // Return a '404 Not Found' if event is not from a WhatsApp API
      functions.logger.warn("issue with req.body.obj")
      functions.logger.log(JSON.stringify(req.body, null, 2))
      res.sendStatus(404)
    }
  } catch (error) {
    functions.logger.error("Error in postHandlerWhatsapp", error)
    functions.logger.error(JSON.stringify(req.body, null, 2))
    res.sendStatus(200)
  }
}
//TODO: Check and do for tele users, not used now
const postUserHandlerTelegram = async (req: Request, res: Response) => {
  if (
    req.header("x-telegram-bot-api-secret-token") ===
    process.env.TELEGRAM_WEBHOOK_TOKEN
  ) {
    let message = req.body.message
    let type
    if (message.photo || message.video) {
      type = "image"
    } else {
      type = "text"
    }
    let media
    //if type is image
    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]
      media = {
        file_id: photo.file_id,
        caption: message.caption,
        mime_type: "image/jpeg",
      }
    } else if (message.video) {
      media = {
        file_id: message.video.file_id,
        caption: message.caption,
        mime_type: message.video.mime_type,
      }
    } else {
      media = null
    }
    let generalMessage = {
      source: "telegram",
      id: String(message?.message_id),
      userId: String(message?.from?.id),
      type: type,
      text: message?.text,
      media: media,
      timestamp: message?.date,
      isForwarded: null,
      frequently_forwarded: null,
      button: null,
      interactive: null,
    }
    await publishToTopic("userGenericMessages", generalMessage, "telegram")
  } else {
    functions.logger.warn(
      "Telegram handler endpoint was called from unexpected source"
    )
  }
  res.sendStatus(200)
}

const postHandlerTelegram = async (req: Request, res: Response) => {
  if (
    req.header("x-telegram-bot-api-secret-token") ===
    process.env.TELEGRAM_WEBHOOK_TOKEN
  ) {
    await publishToTopic("checkerEvents", req.body, "telegram")
  } else {
    functions.logger.warn(
      "Telegram handler endpoint was called from unexpected source"
    )
  }
  res.sendStatus(200)
}

const postHandlerTypeform = async (req: CustomRequest, res: Response) => {
  interface Answer {
    type: string
    phone_number?: string
    text?: string
    choices?: {
      ids: string[]
      labels: string[]
      refs: string[]
    }
    field: {
      id: string
      type: string
      ref: string
    }
  }
  const db = admin.firestore()

  try {
    const signature = req.headers["typeform-signature"]

    if (verifySignature(signature as string, req.rawBody?.toString() || "")) {
      let whatsappId = ""
      const formId = req?.body?.form_response?.form_id ?? ""
      if (formId !== typeformURL?.split("/").pop()) {
        functions.logger.warn(
          `Typeform response from unexpected form: ${formId}`
        )
        return res.sendStatus(200)
      }
      const answers: Answer[] = req?.body?.form_response?.answers ?? []
      if (req?.body?.form_response?.hidden?.phone) {
        whatsappId = req.body.form_response.hidden.phone
      } else if (answers && answers.length > 0) {
        const phoneAnswer = answers.find(
          (answer: any) => answer.type === "phone_number"
        )
        if (phoneAnswer && "phone_number" in phoneAnswer) {
          whatsappId = phoneAnswer.phone_number?.substring(1) || ""
        }
      }

      if (!whatsappId) {
        functions.logger.warn(
          "No whatsapp Id obtained in the typeform response"
        )
        return res.sendStatus(200)
      }
      const checkerQuery = await db
        .collection("checkers")
        .where("whatsappId", "==", `${whatsappId}`)
        .get()

      if (!checkerQuery.empty) {
        const checkerSnap = checkerQuery.docs[0]
        await checkerSnap.ref.update({
          isQuizComplete: true,
          quizScore: req?.body?.form_response?.calculated?.score ?? null,
        })
        functions.logger.log(
          `Checker document with whatsappId ${whatsappId} successfully updated! : quiz -> whatsappGroup`
        )
      } else {
        functions.logger.warn(
          `User ${whatsappId} did not onboard from telegram bot.`
        )
      }
    } else {
      functions.logger.warn("Typeform signature mismatch.")
    }

    res.sendStatus(200)
  } catch (error) {
    functions.logger.error("Error in postHandlerTypeform", error)
    functions.logger.error(JSON.stringify(req.body, null, 2))
    res.sendStatus(200)
  }
}

const postHandlerTelegramAdmin = async (req: Request, res: Response) => {
  if (
    req.header("x-telegram-bot-api-secret-token") ===
    process.env.TELEGRAM_WEBHOOK_TOKEN
  ) {
    await adminBotHandlerTelegram(req.body)
  } else {
    functions.logger.warn(
      "Telegram handler endpoint was called from unexpected source"
    )
  }
  res.sendStatus(200)
}

const verifySignature = function (receivedSignature: string, payload: string) {
  const hash = crypto
    .createHmac("sha256", typeformSecretToken as string)
    .update(payload)
    .digest("base64")

  return receivedSignature === `sha256=${hash}`
}

const checkNavigational = function (message: WhatsappMessageObject) {
  //TODO: implement
  const type = message.type
  if (type == "button" || type == "interactive") {
    return true
  } else if (type == "text") {
    const text = message.text.body
    if (checkMenu(text)) {
      return true
    }
  }
  return false
}

// Accepts POST requests at /{webhookPath} endpoint
app.post(`/${webhookPathWhatsapp}`, postHandlerWhatsapp)
app.get(`/${webhookPathWhatsapp}`, getHandlerWhatsapp)

app.post(`/${webhookPathTelegram}`, postHandlerTelegram)
app.post(`/${webhookPathTelegramAdmin}`, postHandlerTelegramAdmin)
app.post(`/${webhookPathTypeform}`, postHandlerTypeform)

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests

const webhookHandlerV2 = onRequest(
  {
    ingressSettings: ingressSetting,
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "VERIFY_TOKEN",
      "WHATSAPP_CHECKERS_WABA_ID",
      "WHATSAPP_USERS_WABA_ID",
      "TELEGRAM_WEBHOOK_TOKEN",
      "TYPEFORM_SECRET_TOKEN",
      "TELEGRAM_ADMIN_BOT_TOKEN",
    ],
  },
  app
)

export { app, webhookHandlerV2 }

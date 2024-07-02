import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import { defineString } from "firebase-functions/params"
import { handleSpecialCommands } from "./specialCommands"
import { publishToTopic } from "../common/pubsub"
import { onRequest } from "firebase-functions/v2/https"
import { checkMessageId } from "../common/utils"
import { Request, Response } from "express"
import { AppEnv } from "../../appEnv"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)

const webhookPathWhatsapp = process.env.WEBHOOK_PATH_WHATSAPP
const webhookPathTelegram = process.env.WEBHOOK_PATH_TELEGRAM
const webhookPathTypeform = process.env.WEBHOOK_PATH_TYPEFORM
const ingressSetting =
  process.env.ENVIRONMENT === "PROD" ? "ALLOW_INTERNAL_AND_GCLB" : "ALLOW_ALL"

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
            let message = value.messages[0]
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
                //put into user queue
                await publishToTopic("userEvents", message, "whatsapp")
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

const postHandlerTypeform = async (req: Request, res: Response) => {
  const db = admin.firestore()

  try {
    console.log(req.body)
    if (req?.body?.form_response?.answers?.[1]?.phone_number) {
      let whatsappId = req.body.form_response.answers[1].phone_number
      const checkerDocRef = db.collection("checkers").doc(whatsappId)
      // await checkerDocRef.update({
      //   onboardingStatus : "waGroup"
      // })
      functions.logger.log(
        `Checker document with whatsappId ${whatsappId} successfully updated! : quiz -> whatsappGroup`
      )
    } else {
      functions.logger.warn(
        "User did not answer Whatsapp phone number question in the Typeform"
      )
    }
    res.sendStatus(200)
  } catch (error) {
    functions.logger.error("Error in postHandlerTypeform", error)
    functions.logger.error(JSON.stringify(req.body, null, 2))
    res.sendStatus(200)
  }
}

// Accepts POST requests at /{webhookPath} endpoint
app.post(`/${webhookPathWhatsapp}`, postHandlerWhatsapp)
app.get(`/${webhookPathWhatsapp}`, getHandlerWhatsapp)

app.post(`/${webhookPathTelegram}`, postHandlerTelegram)

app.post(`/typeformtest`, postHandlerTypeform)

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
    ],
  },
  app
)

export { app, webhookHandlerV2 }

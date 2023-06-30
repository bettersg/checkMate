import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as express from "express"

import { userHandlerWhatsapp } from "./userHandlers"
import { checkerHandlerWhatsapp } from "./checkerHandlers"
import { defineString } from "firebase-functions/params"
import { handleSpecialCommands } from "./common/utils"
import {
  FirebaseRequest,
  FirebaseResponse,
  RequestWithWhatsappWebhookMessage,
} from "../types"

const runtimeEnvironment = defineString("ENVIRONMENT")
const testUserPhoneNumberId = defineString(
  "WHATSAPP_TEST_USER_BOT_PHONE_NUMBER_ID"
)
const testCheckerPhoneNumberId = defineString(
  "WHATSAPP_TEST_CHECKER_BOT_PHONE_NUMBER_ID"
)

if (!admin.apps.length) {
  admin.initializeApp()
}
export const app = express()

// Accepts POST requests at /webhook endpoint
app.post(
  "/whatsapp",
  async (req: RequestWithWhatsappWebhookMessage, res: FirebaseResponse) => {
    if (req.body.object) {
      if (req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        let value = req.body.entry[0].changes[0].value
        let phoneNumberId = value.metadata.phone_number_id
        let message = value.messages[0]
        let from = message.from // extract the phone number from the webhook payload
        let type = message.type

        let checkerPhoneNumberId
        let userPhoneNumberId

        if (runtimeEnvironment.value() === "PROD") {
          checkerPhoneNumberId =
            process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID
          userPhoneNumberId = process.env.WHATSAPP_USER_BOT_PHONE_NUMBER_ID
        } else {
          checkerPhoneNumberId = testCheckerPhoneNumberId.value()
          userPhoneNumberId = testUserPhoneNumberId.value()
        }

        if (
          phoneNumberId === checkerPhoneNumberId ||
          phoneNumberId === userPhoneNumberId
        ) {
          if (
            phoneNumberId !== userPhoneNumberId &&
            phoneNumberId !== checkerPhoneNumberId
          ) {
            functions.logger.log("unexpected message source")
            res.sendStatus(200)
            return
          }
          if (
            type == "text" &&
            message.text.body.startsWith("/") &&
            runtimeEnvironment.value() !== "PROD"
          ) {
            //handle db commands
            await handleSpecialCommands(message)
          } else {
            if (
              (type == "button" || type == "interactive" || type == "text") &&
              phoneNumberId === checkerPhoneNumberId
            ) {
              //when live, can check against WABA id instead
              await checkerHandlerWhatsapp(message)
            }
            if (phoneNumberId === userPhoneNumberId) {
              await userHandlerWhatsapp(message)
            }
          }
          res.sendStatus(200)
        } else {
          functions.logger.warn(`Issue with phoneNumberId ${phoneNumberId}`)
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
  }
)

app.post("/telegram", async (req: FirebaseRequest, res: FirebaseResponse) => {
  const db = admin.firestore()
  console.log(JSON.stringify(req.body))
  res.sendStatus(200)
})

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/whatsapp", (req: FirebaseRequest, res: FirebaseResponse) => {
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
})

export const webhookHandler = functions
  .region("asia-southeast1")
  .runWith({
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "VERIFY_TOKEN",
      "TYPESENSE_TOKEN",
      "ML_SERVER_TOKEN",
      "TELEGRAM_REPORT_BOT_TOKEN",
    ],
  })
  .https.onRequest(app)
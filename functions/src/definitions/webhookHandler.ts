import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import { defineString } from "firebase-functions/params"
import { handleSpecialCommands } from "./specialCommands"
import { publishToTopic } from "./common/pubsub"
import { onRequest } from "firebase-functions/v2/https"
import { checkMessageId } from "./common/utils"

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
const app = express()

// Accepts POST requests at /webhook endpoint
app.post("/whatsapp", async (req, res) => {
  if (req.body.object) {
    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0] &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      let value = req.body.entry[0].changes[0].value
      let phoneNumberId = value.metadata.phone_number_id
      let message = value.messages[0]
      let type = message.type

      let checkerPhoneNumberId
      let userPhoneNumberId

      if (runtimeEnvironment.value() === "PROD") {
        checkerPhoneNumberId = process.env.WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID
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
              functions.logger.warn(`message ${message.id} already processed`)
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
            await publishToTopic("checkerEvents", message)
          }
          if (phoneNumberId === userPhoneNumberId) {
            //put into user queue
            await publishToTopic("userEvents", message)
          }
        }
        res.sendStatus(200)
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
})

app.post("/telegram", async (req, res) => {
  const db = admin.firestore()
  console.log(JSON.stringify(req.body))
  res.sendStatus(200)
})

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/whatsapp", (req, res) => {
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

const webhookHandlerV2 = onRequest(
  {
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "VERIFY_TOKEN",
    ],
  },
  app
)

export { app, webhookHandlerV2 }

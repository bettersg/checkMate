import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { respondToInstance } from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { logger } from "firebase-functions/v2"
import { getSignedUrl } from "../common/mediaUtils"
import { machine } from "os"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID)

const onMessageCreate = onDocumentUpdated(
  {
    document: "messages/{messageId}",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "OPENAI_API_KEY",
    ],
  },
  async (event) => {
    const beforeData = event?.data?.before.data()
    const afterData = event?.data?.after.data()

    // Check if `latestInstance` transitioned from null to non-null
    if (
      beforeData?.latestInstance === null &&
      afterData?.latestInstance !== null
    ) {
      const instanceRef = afterData?.latestInstance.path

      console.log(
        `Message ${event.params.messageId} with instanceRef:`,
        instanceRef
      )

      if (instanceRef) {
        try {
          const instanceDocRef = db.doc(instanceRef)
          const instanceDocSnap = await instanceDocRef.get()

          if (instanceDocSnap.exists) {
            const instanceData = instanceDocSnap.data()

            const type = instanceData?.type

            //Send new created instance in admin feed
            let message = ""

            if (type === "text") {
              message = instanceData?.text
            } else if (type == "image") {
              const storageBucketUrl = instanceDocSnap.get("storageUrl")
              let signedUrl =
                type === "image" ? await getSignedUrl(storageBucketUrl) : null

              if (!signedUrl) {
                signedUrl = "<Image not available 🖼️>"
              }

              const caption = instanceData?.caption
              if (caption) {
                message = signedUrl + "\n" + caption
              } else {
                message = signedUrl
              }
            }

            // Check if machine categorised after isAssessed is True
            let updatedMessage = ""
            const machineCategorised = afterData?.isMachineCategorised
            if (machineCategorised === false) {
              updatedMessage = `🗳️ The message is currently being voted by Checkers... \n\n`
            } else {
              let result = afterData?.machineCategory
              let harmful = afterData?.isHarmful
              let harmless = afterData?.isHarmless

              updatedMessage = `🤖 The message is categorised by machine. 
                Category: ${result}
                Harmful: ${harmful}
                Harmless: ${harmless}`

              // Do not send message if the result is irrelevant or irrelevant length
              if (result === "irrelevant" || result === "irrelevant_length") {
                return console.log(
                  "The message is irrelevant or has irrelevant length."
                )
              }
            }

            // Send message to Telegram admin feed
            const sendMessage = `New message received! 📩\n\n${message}`
            return sendTelegramTextMessage(
              "admin",
              ADMIN_CHAT_ID,
              sendMessage
            ).then((response) => {
              if (response.data.result.message_id) {
                console.log(
                  "TELEGRAM MESSAGE ID",
                  response.data.result.message_id
                )

                const messageDocRef = db.doc(
                  `messages/${event.params.messageId}`
                )

                // Update with the message ID
                return messageDocRef
                  .update({
                    sentMessageId: response.data.result.message_id,
                  })
                  .then(async () => {
                    // Fetch the updated document
                    const updatedDocSnap = await messageDocRef.get()
                    if (updatedDocSnap.exists) {
                      const updatedData = updatedDocSnap.data()

                      // Call replyMessage with the updated data
                      await sendTelegramTextMessage(
                        "admin",
                        ADMIN_CHAT_ID,
                        updatedMessage,
                        updatedData?.sentMessageId
                      )
                    } else {
                      console.error("Updated document not found.")
                    }
                  })
              } else {
                console.log("NO MESSAGE", response.data.result.message_id)
              }
            })
          } else {
            console.log("No document found at", instanceRef)
          }
        } catch (error) {
          console.error("Error fetching the instance document:", error)
        }
      }
    }

    // Check if it is machine categorised

    return Promise.resolve()
  }
)

export { onMessageCreate }

import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { CheckerData } from "../../types"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { getResponsesObj } from "../common/responseUtils"
import { logger } from "firebase-functions/v2"
import { generateAndUploadCertificate } from "../certificates/generateCertificate"
import * as admin from "firebase-admin"

const checkerAppHost = process.env.CHECKER_APP_HOST

const onCheckerUpdateV2 = onDocumentUpdated(
  {
    document: "checkers/{checkerId}",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "TYPESENSE_TOKEN",
      "TELEGRAM_CHECKER_BOT_TOKEN",
      "OPENAI_API_KEY",
    ],
  },
  async (event) => {
    const preChangeSnap = event?.data?.before
    const postChangeSnap = event?.data?.after
    if (!preChangeSnap || !postChangeSnap) {
      return Promise.resolve()
    }

    const preChangeData = preChangeSnap.data() as CheckerData
    const postChangeData = postChangeSnap.data() as CheckerData

    // Trigger only when programEnd has changed
    const preProgramEnd = preChangeData.programData?.programEnd
    const postProgramEnd = postChangeData.programData?.programEnd

    // Check if programEnd has changed or been newly added
    if (postProgramEnd && preProgramEnd !== postProgramEnd) {
      try {
        // Get user ID and user name
        const userId = postChangeSnap.id
        const userName = postChangeData.name

        // Check if userName is valid
        if (!userName) {
          logger.error(
            `User name is missing for user ID ${userId}. Certificate generation aborted.`
          )
          return Promise.resolve() // Exit early if userName is null or empty
        }

        // Check if certificate already exists in the Firebase Storage bucket
        const certificateBucketName =
          process.env.ENVIRONMENT === "UAT"
            ? "checkmate-certificates-uat"
            : "checkmate-certificates"

        const storageBucket = admin.storage().bucket(certificateBucketName)
        const certificateFile = storageBucket.file(`${userId}.html`)
        const [exists] = await certificateFile.exists()

        if (!exists) {
          // Generate and upload the certificate if it doesn't already exist
          logger.info(
            `Entering generateAndUploadCertificate for user ID: ${userId}, userName: ${userName}, programEnd: ${postProgramEnd}`
          )

          const certificateUrl = await generateAndUploadCertificate(
            userId,
            userName,
            postProgramEnd
          )

          // Optionally, notify via Telegram if needed
          if (
            postChangeData.preferredPlatform === "telegram" &&
            postChangeData.telegramId
          ) {
            const telegramId = postChangeData.telegramId
            const checkerResponses = await getResponsesObj("factChecker")
            const baseMessage = checkerResponses.PROGRAM_COMPLETED
            if (!baseMessage) {
              logger.error("No base message found for program completion.")
              throw new Error("No base message found")
            }

            const message = baseMessage.concat(
              "\n\nYour certificate is ready! Click below to view it."
            )
            await sendTelegramTextMessage(
              "factChecker",
              telegramId,
              message,
              null,
              {
                inline_keyboard: [
                  [
                    {
                      text: "Get your certificate!",
                      url: certificateUrl, // Include the certificate URL
                    },
                  ],
                ],
              }
            )
          }

          // Update Firestore with the certificate URL
          await postChangeSnap.ref.update({
            certificateUrl: certificateUrl,
          })
        } else {
          logger.info(
            `Certificate already exists in bucket for user ID: ${userId}. Skipping generation.`
          )
        }
      } catch (error) {
        logger.error(
          `Error on checker update for ${postChangeSnap.id}: ${error}`
        )
      }
    }

    return Promise.resolve()
  }
)

export { onCheckerUpdateV2 }

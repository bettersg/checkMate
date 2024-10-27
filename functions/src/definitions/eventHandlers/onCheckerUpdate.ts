import {
  DocumentSnapshot,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore"
import { CheckerData } from "../../types"
import { computeProgramStats } from "../common/statistics"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { getResponsesObj } from "../common/responseUtils"
import { logger } from "firebase-functions/v2"
import { storage } from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { generateAndUploadCertificate } from "../certificates/generateCertificate"
import { nudgeForAccuracy } from "../../services/checker/nudgeService"

const checkerAppHost = process.env.CHECKER_APP_HOST
const linkedInOrgID = process.env.LINKEDIN_ORG_ID

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
    // Grab the current value of what was written to Firestore.
    const preChangeSnap = event?.data?.before
    const postChangeSnap = event?.data?.after
    if (!preChangeSnap || !postChangeSnap) {
      return Promise.resolve()
    }
    const preChangeData = preChangeSnap.data() as CheckerData
    const postChangeData = postChangeSnap.data() as CheckerData

    if (
      postChangeData.type === "ai" ||
      !postChangeData.programData.isOnProgram ||
      postChangeData.programData.programEnd != null
    ) {
      return Promise.resolve()
    }

    if (
      preChangeData.numReferred !== postChangeData.numReferred ||
      preChangeData.numVoted !== postChangeData.numVoted ||
      preChangeData.numReported !== postChangeData.numReported ||
      preChangeData.numCorrectVotes !== postChangeData.numCorrectVotes ||
      preChangeData.numNonUnsureVotes !== postChangeData.numNonUnsureVotes
    ) {
      const checkerProgramStats = await computeProgramStats(
        postChangeSnap,
        true
      )
      const {
        numVotes,
        numReferrals,
        numReports,
        accuracy,
        isNewlyCompleted,
        completionTimestamp,
      } = checkerProgramStats
      if (
        isNewlyCompleted &&
        postChangeData.preferredPlatform === "telegram" &&
        postChangeData.telegramId &&
        completionTimestamp !== null
      ) {
        try {
          const telegramId = postChangeData.telegramId

          // Generate the certificate and get the URL
          const certificateUrl = await generateCertificate(
            postChangeSnap,
            completionTimestamp
          )

          if (!certificateUrl) {
            logger.error(
              `Error generating certificate for ${postChangeSnap.id}`
            )
            return
          }

          // Update the checker document with the certificate URL
          await postChangeSnap.ref.update({
            certificateUrl,
          })

          // Prepare the issue date components
          const issueDate = completionTimestamp.toDate()
          const issueYear = issueDate.getFullYear()
          const issueMonth = issueDate.getMonth() + 1 // Months are zero-indexed in JavaScript

          // Get the certificate URL and encode it for use in a URL
          const certificateUrlEncoded = encodeURIComponent(certificateUrl)

          // Get the checker ID
          const checkerId = postChangeSnap.id

          // Define query parameters
          const params: Record<string, string> = {
            startTask: "CERTIFICATION_NAME",
            name: "CheckMate Practitioner",
            organizationId: linkedInOrgID ?? "", // Use empty string if undefined
            issueYear: String(issueYear),
            issueMonth: String(issueMonth),
            certId: checkerId,
          }

          // Construct the query string
          const queryString = new URLSearchParams(params).toString()

          // Append certUrl manually without encoding
          const linkedInUrl = `https://www.linkedin.com/profile/add?${queryString}&certUrl=${certificateUrlEncoded}`
          // Existing code to get the checker app host URL
          const url = `${checkerAppHost}/`

          // Fetch the base message template
          const checkerResponses = await getResponsesObj("factChecker")
          const baseMessage = checkerResponses.PROGRAM_COMPLETED
          if (!baseMessage) {
            logger.error(
              "No base message found when trying to handle program conclusion completed"
            )
            throw new Error("No base message found")
          }

          // Replace placeholders in the message template
          const message = baseMessage
            .replace("{{num_messages}}", numVotes.toString())
            .replace("{{num_referred}}", numReferrals.toString())
            .replace("{{num_reported}}", numReports.toString())
            .replace(
              "{{accuracy}}",
              accuracy === null ? "N/A" : accuracy.toFixed(1)
            )

          // Send the Telegram message with the updated inline keyboard
          await sendTelegramTextMessage(
            "factChecker",
            telegramId,
            message,
            null,
            "HTML",
            {
              inline_keyboard: [
                [
                  {
                    text: "Get your certificate!",
                    web_app: { url: url },
                  },
                  {
                    text: "Add certificate to LinkedIn",
                    url: linkedInUrl,
                  },
                ],
              ],
            }
          )
        } catch (error) {
          logger.error(
            `Error on checker update for ${postChangeSnap.id}: ${error}`
          )
        }
      }
      await nudgeForAccuracy(postChangeSnap, checkerProgramStats)
    }
    return Promise.resolve()
  }
)

async function generateCertificate(
  postChangeSnap: DocumentSnapshot,
  programEndTime: Timestamp
) {
  const userId = postChangeSnap.id
  const userName = postChangeSnap.get("name")
  const numVotesTarget = postChangeSnap.get("programData.numVotesTarget")
  const numReportTarget = postChangeSnap.get("programData.numReportTarget")
  const accuracyTarget = postChangeSnap.get("programData.accuracyTarget")
  try {
    // Check if userName is valid
    if (!userName) {
      logger.error(
        `User name is missing for user ID ${userId}. Certificate generation aborted.`
      )
      return Promise.resolve() // Exit early if userName is null or empty
    }

    if (
      numReportTarget == undefined ||
      numVotesTarget == undefined ||
      accuracyTarget == undefined
    ) {
      logger.error(
        `Program targets are missing for user ID ${userId}. Certificate generation aborted.`
      )
      return Promise.resolve() // Exit early if userName is null or empty
    }

    // Check if certificate already exists in the Firebase Storage bucket
    const certificateBucketName =
      process.env.ENVIRONMENT === "UAT"
        ? "checkmate-certificates-uat"
        : "checkmate-certificates"

    const storageBucket = storage().bucket(certificateBucketName)
    const certificateFile = storageBucket.file(`${userId}.html`)
    const [exists] = await certificateFile.exists()

    if (!exists) {
      // Generate and upload the certificate if it doesn't already exist
      logger.info(
        `Entering generateAndUploadCertificate for user ID: ${userId}, userName: ${userName}, programEnd: ${programEndTime}`
      )

      const certificateUrl = await generateAndUploadCertificate(
        userId,
        userName,
        programEndTime,
        numVotesTarget,
        numReportTarget,
        accuracyTarget
      )
      return certificateUrl
    } else {
      logger.warn(
        `Certificate already exists for user ID ${userId}. Certificate generation aborted.`
      )
      return null
    }
  } catch (error) {
    logger.error(`Error generating certificate for ${userId}: ${error}`)
    return null
  }
}

export { onCheckerUpdateV2 }

import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { CheckerData } from "../../types"
import { computeProgramStats } from "../common/statistics"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { getResponsesObj } from "../common/responseUtils"
import { logger } from "firebase-functions/v2"

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
    // Grab the current value of what was written to Firestore.
    const preChangeSnap = event?.data?.before
    const postChangeSnap = event?.data?.after
    if (!preChangeSnap || !postChangeSnap) {
      return Promise.resolve()
    }
    const preChangeData = preChangeSnap.data() as CheckerData
    const postChangeData = postChangeSnap.data() as CheckerData

    if (
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
      try {
        const {
          numVotes,
          numReferrals,
          numReports,
          accuracy,
          isNewlyCompleted,
        } = await computeProgramStats(postChangeSnap)
        if (
          isNewlyCompleted &&
          postChangeData.preferredPlatform === "telegram" &&
          postChangeData.telegramId
        ) {
          const telegramId = postChangeData.telegramId

          const url = `${checkerAppHost}/`
          const checkerResponses = await getResponsesObj("factChecker")
          const baseMessage = checkerResponses.PROGRAM_COMPLETED
          if (!baseMessage) {
            logger.error(
              "No base message found when trying to handle program conclusion completed"
            )
            throw new Error("No base message found")
          }
          const message = checkerResponses.PROGRAM_COMPLETED.replace(
            "{{num_messages}}",
            numVotes.toString()
          )
            .replace("{{num_referred}}", numReferrals.toString())
            .replace("{{num_reported}}", numReports.toString())
            .replace(
              "{{accuracy}}",
              accuracy === null ? "N/A" : accuracy.toFixed(1)
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
                    web_app: { url: url },
                  },
                ],
              ],
            }
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

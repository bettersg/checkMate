import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { CheckerData } from "../../types"
import { sendTelegramTextMessage } from "../common/sendTelegramMessage"
import { logger } from "firebase-functions/v2"
import * as admin from "firebase-admin"

const db = admin.firestore()

const onCheckerWhitelist = onDocumentUpdated(
  {
    document: "checkers/{checkerId}",
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
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

    const preChangeIsTester = preChangeData?.isTester
    const postChangeIsTester = postChangeData?.isTester

    if (!preChangeIsTester && postChangeIsTester) {
      const whatsappId = postChangeData?.whatsappId
      const telegramId = postChangeData?.telegramId
      if (!whatsappId) {
        logger.error(`No whatsappId found for checker ${postChangeSnap.id}`)
        return Promise.resolve()
      }
      if (!telegramId) {
        logger.error(`No telegramId found for checker ${postChangeSnap.id}`)
        return Promise.resolve()
      }
      const userSnap = await db
        .collection("users")
        .where("whatsappId", "==", whatsappId)
        .get()
      if (userSnap.empty) {
        logger.error(
          `No user found for whatsappId ${whatsappId} in checker ${postChangeSnap.id}`
        )
        return Promise.resolve()
      }
      const userDoc = userSnap.docs[0]
      //update userDoc isTester to true
      await userDoc.ref.update({ isTester: true })
      const checkerGroupReplyMarkup = {
        inline_keyboard: [
          [
            {
              text: "Join Telegram Group",
              url: process.env.BETA_CHECKERS_GROUP_LINK ?? "",
            },
          ],
        ],
      }
      await sendTelegramTextMessage(
        "factChecker",
        telegramId,
        `<strong>🚀 Welcome to the CheckMate V2 Beta 🎉</strong>

Hi ${postChangeData?.name},

Great news! You have been whitelisted to test out CheckMate's brand new features. 🧐🔎

🔹 <b>What's New?</b>

- GenAI-generated responses with sources for quicker and more informative checks
- UI improvements for a smoother experience

🔹 <b>What you have to do?</b>

- Join the telegram group below to for coordination and to discuss.
- 🗳️ Vote on the responses to assess their quality.

Your feedback is invaluable—let us know what you think! Thanks for being part of this exciting next step. 🚀

- The CheckMate Team`,
        null,
        "HTML",
        checkerGroupReplyMarkup
      )
    }
    return Promise.resolve()
  }
)

export { onCheckerWhitelist }

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
      await sendTelegramTextMessage(
        "factChecker",
        telegramId,
        "You've been successfully onboarded as a checker tester! In addition to the current voting, you will now receive GenAI-generated responses to review."
      )
    }
    return Promise.resolve()
  }
)

export { onCheckerWhitelist }

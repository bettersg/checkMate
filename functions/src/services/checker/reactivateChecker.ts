import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"
import { sendTelegramTextMessage } from "../../messaging/telegram/sendTelegramMessages"
import { send } from "process"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

export async function reactivateChecker(checkerId: number) {
  const checkerQuerySnap = await db
    .collection("checkers")
    .where("telegramId", "==", checkerId)
    .get()

  if (checkerQuerySnap.size > 0) {
    const checkerSnap = checkerQuerySnap.docs[0]
    const message = `Welcome back! 💪 You'll now start receiving messages to vote on again.`
    await sendTelegramTextMessage("factChecker", checkerId, message)
    await checkerSnap.ref.update({ isActive: true })
    return ServiceResponse.success({
      message: "Checker reactivated",
    })
  } else if (checkerQuerySnap.size === 0) {
    logger.error(`Checker with TelegramID ${checkerId} not found`)
    return ServiceResponse.error("Checker not found")
  } else {
    logger.error(`Multiple checkers with TelegramID ${checkerId} found`)
    return ServiceResponse.error("Multiple checkers found")
  }
}

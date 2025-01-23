// records that the checker blocked us
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

export async function recordBlockedStatus(telegramId: string | number) {
  logger.info(
    `Recording blocked status for checker with telegramId: ${telegramId}`
  )
  const checkerQuery = db
    .collection("checkers")
    .where("telegramId", "==", Number(telegramId))
    .limit(1)
  const checkerQuerySnap = await checkerQuery.get()
  if (checkerQuerySnap.empty) {
    return ServiceResponse.error("Checker not found")
  } else {
    const checkerDoc = checkerQuerySnap.docs[0]
    const checkerRef = checkerDoc.ref
    await checkerRef.update({
      hasBlockedTelegramMessages: true,
    })
    return ServiceResponse.success({
      message: "Checker blocking recorded",
    })
  }
}

import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"
import { sendTelegramTextMessage } from "../../messaging/telegram/sendTelegramMessages"
import { CheckerProgramStats, CheckerData } from "../../types"
import { getThresholds } from "../../definitions/common/utils"
import { getResponsesObj } from "../../definitions/common/responseUtils"

if (!admin.apps.length) {
  admin.initializeApp()
}
const CHECKERS_GROUP_LINK = String(process.env.CHECKERS_GROUP_LINK)
const db = admin.firestore()

export async function reactivateChecker(telegramId: number) {
  const checkerQuerySnap = await db
    .collection("checkers")
    .where("telegramId", "==", telegramId)
    .get()

  if (checkerQuerySnap.size > 0) {
    const checkerSnap = checkerQuerySnap.docs[0]
    const message = `Welcome back! 💪 You'll now start receiving messages to vote on again.`
    await sendTelegramTextMessage("factChecker", telegramId, message)
    await checkerSnap.ref.update({ isActive: true })
    return ServiceResponse.success({
      message: "Checker reactivated",
    })
  } else if (checkerQuerySnap.size === 0) {
    logger.error(`Checker with TelegramID ${telegramId} not found`)
    return ServiceResponse.error("Checker not found")
  } else {
    logger.error(`Multiple checkers with TelegramID ${telegramId} found`)
    return ServiceResponse.error("Multiple checkers found")
  }
}

async function checkNudgeStatus(
  docRef: admin.firestore.DocumentReference,
  type: string
) {
  // const querySnapshot = await docRef
  //   .collection("nudges")
  //   .where("type", "==", type)
  //   .count()
  //   .get()
  // if (querySnapshot.data().count > 0) {
  //   return true
  // }
  //TODO: IMPLEMENT NUDGES SUBCOLLECTION
  return ServiceResponse.success({
    message: "OK",
    hasBeenNudged: false,
  })
}

export async function nudgeForAccuracy(
  checkerDocSnap: admin.firestore.DocumentSnapshot,
  checkerProgramStats: CheckerProgramStats
) {
  const thresholds = await getThresholds()
  const number = checkerProgramStats.numReports
  const accuracy = checkerProgramStats.accuracy ?? 1
  const numberThreshold = thresholds.numberBeforeAccuracyNudge ?? 20
  const accuracyThreshold = thresholds.accuracyNudgeThreshold ?? 0.5
  const nudgeResponse = await checkNudgeStatus(checkerDocSnap.ref, "accuracy")
  const hasBeenNudged = nudgeResponse.data?.hasBeenNudged ?? true
  if (
    number == numberThreshold && //TODO: change to >= and implement nudges subcollection
    accuracy < accuracyThreshold &&
    !hasBeenNudged
  ) {
    const responses = await getResponsesObj("factChecker")
    const name = checkerDocSnap.get("name")
    const message = responses.ACCURACY_NUDGE.replace(
      "{{accuracy}}",
      `${(accuracy * 100).toFixed(0)}%`
    )
      .replace("{{num_reports}}", number.toString())
      .replace("{{name}}", name)
      .replace("{{checkers_group_link}}", CHECKERS_GROUP_LINK)
    await sendTelegramTextMessage(
      "factChecker",
      checkerDocSnap.get("telegramId"),
      message
    )
    //TODO send resources too
    return ServiceResponse.success({
      message: "Nudge sent",
    })
  }
}

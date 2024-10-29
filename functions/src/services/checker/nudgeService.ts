import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"
import { sendTelegramTextMessage } from "../../messaging/telegram/sendTelegramMessages"
import { CheckerProgramStats, NudgeData } from "../../types"
import { getThresholds } from "../../definitions/common/utils"
import { getResponsesObj } from "../../definitions/common/responseUtils"
import { replaceTemplatePlaceholders } from "../../utils/messageUtils"
import { Timestamp } from "firebase-admin/firestore"
import NUDGES from "../../definitions/common/parameters/nudges.json"

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
  const nudgeType = type.toUpperCase()
  const querySnapshot = await docRef
    .collection("nudges")
    .where("type", "==", nudgeType)
    .count()
    .get()
  if (querySnapshot.data().count > 0) {
    return ServiceResponse.success({
      message: "OK",
      hasBeenNudged: true,
    })
  } else {
    return ServiceResponse.success({
      message: "OK",
      hasBeenNudged: false,
    })
  }
}

export async function sendNudge(
  docSnap: admin.firestore.DocumentSnapshot,
  type: string,
  replaceParams: { [key: string]: string },
  ctaButtonText: string | null = null,
  callbackDataText: string | null = null
): Promise<ServiceResponse> {
  const nudges = await getNudges()
  const nudgeType = type.toUpperCase()
  const response = selectNudge(nudgeType, nudges)
  if (!response.success) {
    return ServiceResponse.error("Error obtaining nudge")
  }

  const nudgeData = response.data
  if (!nudgeData) {
    return ServiceResponse.error("Nudge data not found")
  }

  let message
  try {
    message = replaceTemplatePlaceholders(nudgeData.text, replaceParams)
  } catch (error) {
    return ServiceResponse.error("Error processing message template")
  }

  const variant = nudgeData.variant
  const timestamp = Timestamp.now()

  let nudgeRef
  try {
    nudgeRef = await docSnap.ref.collection("nudges").add({
      type: nudgeType,
      variant: variant,
      sentTimestamp: timestamp,
      outcomeTimestamp: null,
      outcome: null,
    } as NudgeData)
  } catch (error) {
    return ServiceResponse.error("Error saving nudge to database")
  }

  const ctaReplyMarkup =
    ctaButtonText !== null
      ? {
          inline_keyboard: [
            [
              {
                text: ctaButtonText,
                callback_data: `${callbackDataText ?? ""}|${nudgeRef.id}`,
              },
            ],
          ],
        }
      : null

  try {
    await sendTelegramTextMessage(
      "factChecker",
      docSnap.get("telegramId"),
      message,
      null,
      "HTML",
      ctaReplyMarkup
    )
  } catch (error) {
    return ServiceResponse.error("Error sending message to Telegram")
  }

  return ServiceResponse.success("Nudge sent successfully")
}
async function getNudges() {
  const path = "systemParameters/nudges"
  const nudgesSnap = await db.doc(path).get()
  return nudgesSnap.data() ?? NUDGES
}

function selectNudge(
  type: string,
  nudges: {
    [type: string]: {
      [variant: string]: string
    }
  }
) {
  const nudgeOptions = nudges[type]

  if (!nudgeOptions) {
    return ServiceResponse.error("Nudge not found")
  }

  // Get keys (variants) from the nudge type and select one at random
  const variants = Object.keys(nudgeOptions)
  const randomVariant = variants[Math.floor(Math.random() * variants.length)]
  const text = nudgeOptions[randomVariant]

  return ServiceResponse.success({
    message: "Nudge selected",
    variant: randomVariant,
    text: text,
  })
}

export async function updateNudge(
  docSnap: admin.firestore.DocumentSnapshot,
  nudgeId: string,
  outcome: string = "clicked"
) {
  const nudgeRef = docSnap.ref.collection("nudges").doc(nudgeId)
  try {
    await nudgeRef.update({
      outcome: outcome,
      outcomeTimestamp: Timestamp.now(),
    } as Partial<NudgeData>)
    return ServiceResponse.success({
      message: "Nudge updated",
    })
  } catch (error) {
    logger.error(
      `Error updating nudge ${nudgeId} for checker ${docSnap.id}: ${error}`
    )
    return ServiceResponse.error("Error updating nudge")
  }
}

export async function nudgeForAccuracy(
  checkerDocSnap: admin.firestore.DocumentSnapshot,
  checkerProgramStats: CheckerProgramStats
) {
  const thresholds = await getThresholds()
  const number = checkerProgramStats.numVotes
  const accuracy = checkerProgramStats.accuracy ?? 1
  const numberThreshold = thresholds.numberBeforeAccuracyNudge ?? 20
  const accuracyThreshold = thresholds.accuracyNudgeThreshold ?? 0.5
  const nudgeResponse = await checkNudgeStatus(checkerDocSnap.ref, "ACCURACY")
  const hasBeenNudged = nudgeResponse.data?.hasBeenNudged ?? true
  if (
    number >= numberThreshold &&
    accuracy < accuracyThreshold &&
    !hasBeenNudged
  ) {
    const name = checkerDocSnap.get("name")
    const replaceParams = {
      name: name,
      accuracy_threshold: `${((1 - accuracyThreshold) * 100).toFixed(0)}%`,
      num_messages: number.toString(),
      checkers_group_link: CHECKERS_GROUP_LINK,
    }
    const response = await sendNudge(
      checkerDocSnap,
      "ACCURACY",
      replaceParams,
      "View Resources",
      "RESOURCES"
    )
    if (!response.success) {
      return response
    }
    //TODO send resources too
    return ServiceResponse.success({
      message: "Nudge sent",
    })
  }
}

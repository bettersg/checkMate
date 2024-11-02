import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"
import { sendTelegramTextMessage } from "../../messaging/telegram/sendTelegramMessages"
import { replaceTemplatePlaceholders } from "../../utils/messageUtils"
import { DocumentSnapshot } from "firebase-admin/firestore"
import { getResponsesObj } from "../../definitions/common/responseUtils"
import { adminBot } from "../../infrastructure/telegram/botInstances"

if (!admin.apps.length) {
  admin.initializeApp()
}

const CHECKERS_CHAT_ID = String(process.env.CHECKERS_CHAT_ID)

const db = admin.firestore()
export async function reactivateChecker(checkerSnap: DocumentSnapshot) {
  const telegramId = checkerSnap.get("telegramId")
  const message = `Welcome back! 💪 You'll now start receiving messages to vote on again.`
  await sendTelegramTextMessage("factChecker", telegramId, message)
  await checkerSnap.ref.update({ isActive: true })
  return ServiceResponse.success({
    message: "Checker reactivated",
  })
}

export async function offboardChecker(checkerDocSnap: DocumentSnapshot) {
  const replaceParams = {
    name: checkerDocSnap.get("name"),
    survey_link: "", //TODO
  }
  const telegramId = checkerDocSnap.get("telegramId")
  if (!telegramId) {
    logger.error("No telegramId found")
    return ServiceResponse.error(
      `No telegramId found when offboarding checker ${checkerDocSnap.id}`
    )
  }
  const responses = await getResponsesObj("factChecker")
  const hydratedMessage = replaceTemplatePlaceholders(
    responses["MANAGE_OUT"] ?? "",
    replaceParams
  )
  if (!hydratedMessage) {
    logger.error("No message found")
    return ServiceResponse.error("No message found")
  }
  //send message in personal group
  await sendTelegramTextMessage(
    "factChecker",
    telegramId,
    hydratedMessage,
    null,
    "HTML",
    null
  )
  //call Telegram API to kick checker from group
  await adminBot.telegram.unbanChatMember(CHECKERS_CHAT_ID, telegramId)
  return ServiceResponse.success({
    message: "Checker expelled",
  })
}

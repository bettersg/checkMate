import admin from "firebase-admin"
import functions from "firebase-functions"
import { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES } from "./constants"
import { sendWhatsappButtonMessage } from "./sendWhatsappMessage"

function getInfoLiner(truthScore: null | number) {
  return `, with an average score of ${
    typeof truthScore === "number" ? truthScore.toFixed(2) : "NA"
  } on a scale of 0-5 (5 = completely true)`
}

async function respondToInterimFeedback(
  instancePath: string,
  isUseful: string
) {
  const db = admin.firestore()
  const instanceRef = db.doc(instancePath)
  const instanceSnap = await instanceRef.get()
  const responses = await getResponsesObj("user")
  const data = instanceSnap.data()
  if (!data) {
    functions.logger.log("Missing data in respondToInterimFeedback")
    return
  }
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `sendInterim_${instancePath}`,
        title: "Get another update",
      },
    },
  ]
  let response
  switch (isUseful) {
    case "yes":
      response = responses?.INTERIM_USEFUL
      await instanceRef.update({ isInterimUseful: true })
      break
    default:
      response = responses?.INTERIM_NOT_USEFUL
      await instanceRef.update({ isInterimUseful: false })
      break
  }

  await sendWhatsappButtonMessage("user", data.from, response, buttons, data.id)
}

async function getResponsesObj(
  botType: "factChecker"
): Promise<typeof FACTCHECKER_BOT_RESPONSES>
async function getResponsesObj(
  botType: "user"
): Promise<typeof USER_BOT_RESPONSES>
async function getResponsesObj(botType: "user" | "factChecker" = "user") {
  const db = admin.firestore()
  let path
  let fallbackResponses
  if (botType === "factChecker") {
    path = "systemParameters/factCheckerBotResponses"
    fallbackResponses = FACTCHECKER_BOT_RESPONSES
  } else {
    path = "systemParameters/userBotResponses"
    fallbackResponses = USER_BOT_RESPONSES
  }
  const defaultResponsesRef = db.doc(path)
  const defaultResponsesSnap = await defaultResponsesRef.get()
  return defaultResponsesSnap.data() ?? fallbackResponses
}

export { getInfoLiner, respondToInterimFeedback, getResponsesObj }

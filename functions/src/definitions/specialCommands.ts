import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { defineString } from "firebase-functions/params"
import { WhatsappMessage } from "../types"
import { sendWhatsappTextMessage } from "./common/sendWhatsappMessage"
import {
  USER_BOT_RESPONSES,
  FACTCHECKER_BOT_RESPONSES,
  thresholds,
} from "./common/constants"
import { interimPromptHandler } from "./batchJobs"

const runtimeEnvironment = defineString("ENVIRONMENT")
const checker1PhoneNumber = defineString("CHECKER1_PHONE_NUMBER")

const handleSpecialCommands = async function (messageObj: WhatsappMessage) {
  const command = messageObj.text.body.toLowerCase()
  if (command.startsWith("/")) {
    switch (command) {
      case "/mockdb":
        await mockDb()
        return
      case "/getid":
        await sendWhatsappTextMessage(
          "user",
          messageObj.from,
          `${messageObj.id}`,
          messageObj.id
        )
        return
      case "/getmessages":
        await archiveMessages()
        return
      case "/interim":
        await interimPromptHandler()
    }
  }
}

const archiveMessages = async function () {
  const db = admin.firestore()
  const messagesRef = db.collection("messages")
  const messagesSnap = await messagesRef.get()
  const json = JSON.stringify(messagesSnap.docs, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const storageBucket = admin.storage().bucket()
  const filename = "archive/messages.json"
  const file = storageBucket.file(filename)
  const stream = file.createWriteStream()
  await new Promise((resolve, reject) => {
    stream.on("error", reject)
    stream.on("finish", resolve)
    stream.end(buffer)
  })
  functions.logger.log("finished")
}

const mockDb = async function () {
  functions.logger.log("mocking...")
  const db = admin.firestore()
  const systemParametersRef = db.collection("systemParameters")
  await systemParametersRef.doc("userBotResponses").set(USER_BOT_RESPONSES)
  await systemParametersRef
    .doc("factCheckerBotResponses")
    .set(FACTCHECKER_BOT_RESPONSES)
  await systemParametersRef.doc("supportedTypes").set({
    whatsapp: ["text", "image"],
  })
  await systemParametersRef.doc("thresholds").set(thresholds)
  const factCheckersRef = db.collection("factCheckers")
  if (runtimeEnvironment.value() !== "PROD") {
    await factCheckersRef.doc(checker1PhoneNumber.value()).set(
      {
        name: "CHECKER1",
        isActive: true,
        isOnboardingComplete: true,
        platformId: checker1PhoneNumber.value(),
        level: 1,
        experience: 0,
        numVoted: 0,
        numCorrectVotes: 0,
        numVerifiedLinks: 0,
        preferredPlatform: "whatsapp",
        lastVotedTimestamp: null,
        getNameMessageId: null,
      },
      { merge: true }
    )
  }
  functions.logger.log("mocked")
}

export { handleSpecialCommands }

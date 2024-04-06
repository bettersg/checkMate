import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { defineString } from "firebase-functions/params"
import { WhatsappMessage, Checker } from "../../types"
import { sendWhatsappTextMessage } from "../common/sendWhatsappMessage"
import USER_BOT_RESPONSES from "../common/parameters/userResponses.json"
import CHECKER_BOT_RESPONSES from "../common/parameters/checkerResponses.json"
import thresholds from "../common/parameters/thresholds.json"
import { interimPromptHandler } from "../batchJobs/batchJobs"
import { sendBlast } from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"
import { AppEnv } from "../../appEnv"

const runtimeEnvironment = defineString(AppEnv.ENVIRONMENT)
const checker1PhoneNumber = defineString(AppEnv.CHECKER1_PHONE_NUMBER)
const checker1TelegramId = defineString(AppEnv.CHECKER1_TELEGRAM_ID)

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
        return
      case "/blast":
        await sendBlast(messageObj.from)
        return
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
  if (runtimeEnvironment.value() === "PROD") {
    return
  }
  functions.logger.log("mocking...")
  const db = admin.firestore()
  const systemParametersRef = db.collection("systemParameters")
  await systemParametersRef.doc("userBotResponses").set(USER_BOT_RESPONSES)
  await systemParametersRef
    .doc("factCheckerBotResponses")
    .set(CHECKER_BOT_RESPONSES)
  await systemParametersRef.doc("supportedTypes").set({
    whatsapp: ["text", "image"],
  })
  await systemParametersRef.doc("thresholds").set(thresholds)
  const checkersCollectionRef = db.collection("checkers")
  const querySnap = await checkersCollectionRef
    .where("whatsappId", "==", checker1PhoneNumber.value())
    .limit(1)
    .get()
  const checkerObj: Checker = {
    name: "CHECKER1",
    type: "human",
    isActive: true,
    isOnboardingComplete: true,
    singpassOpenId: null,
    telegramId: parseInt(checker1TelegramId.value()),
    whatsappId: checker1PhoneNumber.value(),
    voteWeight: 1,
    level: 1,
    experience: 0,
    numVoted: 0,
    numCorrectVotes: 0,
    numVerifiedLinks: 0,
    preferredPlatform: "whatsapp",
    lastVotedTimestamp: null,
    getNameMessageId: null,
  }
  if (querySnap.empty) {
    await checkersCollectionRef.add(checkerObj)
  } else {
    await querySnap.docs[0].ref.set(checkerObj, { merge: true })
  }
  {
    await db
      .collection("blasts")
      .doc()
      .set(
        {
          type: "text",
          text: "This is a test blast",
          storageUrl: null,
          isActive: true,
          createdDate: Timestamp.fromDate(new Date()),
          blastDate: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      )
  }
  functions.logger.log("mocked")
}

export { handleSpecialCommands }

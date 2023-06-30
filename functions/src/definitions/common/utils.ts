import {
  USER_BOT_RESPONSES,
  FACTCHECKER_BOT_RESPONSES,
  thresholds,
} from "./constants"
import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { sendWhatsappTextMessage } from "./sendWhatsappMessage"
import { defineString } from "firebase-functions/params"
import { findPhoneNumbersInText } from "libphonenumber-js"

import { createHash } from "crypto"
import { Blob } from "buffer"
import { Thresholds, WhatsappMessage } from "../../types"

const runtimeEnvironment = defineString("ENVIRONMENT")
const checker1PhoneNumber = defineString("CHECKER1_PHONE_NUMBER")

if (!admin.apps.length) {
  admin.initializeApp()
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const handleSpecialCommands = async function (
  messageObj: WhatsappMessage
) {
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

export const getThresholds = async function () {
  const db = admin.firestore()
  const theresholdsRef = db.doc("systemParameters/thresholds")
  const theresholdsSnap = await theresholdsRef.get()
  return (theresholdsSnap.data() as Thresholds) ?? thresholds
}

export const checkUrl = function (urlString: string) {
  let url
  try {
    url = new URL(urlString)
  } catch (e) {
    return false
  }
  return url.protocol === "http:" || url.protocol === "https:"
}

export function stripPhone(originalStr: string, includePlaceholder = false) {
  const phoneNumbers = findPhoneNumbersInText(originalStr)
  let newStr = originalStr
  let offset = 0
  const placeholder = includePlaceholder ? "<PHONE_NUM>" : ""
  phoneNumbers.forEach((phoneNumber) => {
    const { startsAt, endsAt } = phoneNumber
    const adjustedStartsAt = startsAt - offset
    const adjustedEndsAt = endsAt - offset
    newStr =
      newStr.slice(0, adjustedStartsAt) +
      placeholder +
      newStr.slice(adjustedEndsAt)
    offset += endsAt - startsAt
  })
  newStr = newStr.replace(/[0-9]{7,}/g, placeholder)
  return newStr
}

export function stripUrl(originalStr: string, includePlaceholder = false) {
  const urlRegex =
    /\b((?:https?:\/\/)?(?:(?:www\.)?(?:[\da-z\.-]+)\.(?:[a-z]{2,6})|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])))(?::[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])?(?:\/[\w\.-]*)*\/?)\b/g
  const placeholder = includePlaceholder ? "<URL>" : ""
  const replacedString = originalStr.replace(urlRegex, placeholder)
  return replacedString
}

export function firestoreTimestampToYYYYMM(timestamp: Timestamp) {
  // Convert Firestore timestamp to a JavaScript Date object
  let date = timestamp.toDate()

  // Get the year and the month
  let year = date.getFullYear()
  let month: string | number = date.getMonth() + 1 // JavaScript months range from 0 - 11

  // Pad the month with a 0 if it's less than 10
  if (month < 10) {
    month = "0" + month
  }

  // Return the formatted string
  return `${year}${month}`
}

export function hashMessage(originalStr: string) {
  return createHash("md5").update(originalStr).digest("hex")
}

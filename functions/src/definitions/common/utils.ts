import { thresholds } from "./constants"
import * as admin from "firebase-admin"
import { findPhoneNumbersInText } from "libphonenumber-js"
import { createHash } from "crypto"
//import RE2 from "re2"
import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

const env = process.env.ENVIRONMENT

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const getThresholds = async function () {
  const db = admin.firestore()
  const theresholdsRef = db.doc("systemParameters/thresholds")
  const theresholdsSnap = await theresholdsRef.get()
  const returnThresholds =
    (theresholdsSnap.data() as typeof thresholds | undefined) ?? thresholds
  if (env !== "PROD") {
    returnThresholds.surveyLikelihood = 1
  }
  return returnThresholds
}

function normalizeSpaces(str: string) {
  return str.replace(/\u00A0/g, " ")
}

const checkUrl = function (urlString: string) {
  let url
  try {
    url = new URL(urlString)
  } catch (e) {
    return false
  }
  return url.protocol === "http:" || url.protocol === "https:"
}

async function checkMessageId(messageId: string) {
  const db = admin.firestore()
  const messageRef = db.collection("messageIds").doc(messageId)
  const messageSnap = await messageRef.get()
  return messageSnap.exists
}

function stripPhone(originalStr: string, includePlaceholder = false) {
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

function checkUrlPresence(originalStr: string): boolean {
  const urlRegex = new RegExp(
    "\\b(?:https?:\\/\\/)?(?:www\\.)?[^ \\n\\r]+?\\.[a-z]{2,}(?:[^\\s]*)?",
    "gi"
  )
  return urlRegex.test(originalStr)
}

function stripUrl(originalStr: string, includePlaceholder = false) {
  const urlRegex = new RegExp(
    "\\b(?:https?:\\/\\/)?(?:www\\.)?[^ \\n\\r]+?\\.[a-z]{2,}(?:[^\\s]*)?",
    "gi"
  )
  const placeholder = includePlaceholder ? "<URL>" : ""
  const replacedString = originalStr.replace(urlRegex, placeholder)
  return replacedString
}

function firestoreTimestampToYYYYMM(timestamp: Timestamp) {
  // Convert Firestore timestamp to a JavaScript Date object
  let date = timestamp.toDate()

  // Get the year and the month
  let year = date.getFullYear()
  let monthNum = date.getMonth() + 1 // JavaScript months range from 0 - 11

  let month = String(monthNum)
  // Pad the month with a 0 if it's less than 10
  if (monthNum < 10) {
    month = `0${monthNum}`
  }

  // Return the formatted string
  return `${year}${month}`
}

function hashMessage(originalStr: string) {
  return createHash("md5").update(originalStr).digest("hex")
}

export {
  stripPhone,
  stripUrl,
  hashMessage,
  sleep,
  firestoreTimestampToYYYYMM,
  getThresholds,
  checkUrl,
  normalizeSpaces,
  checkMessageId,
  checkUrlPresence,
}

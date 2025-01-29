import thresholds from "./parameters/thresholds.json"
import others from "./parameters/others.json"
import * as admin from "firebase-admin"
import { findPhoneNumbersInText } from "libphonenumber-js"
import { createHash } from "crypto"
//import RE2 from "re2"
import { Timestamp } from "firebase-admin/firestore"
import { Thresholds } from "../../types"
if (!admin.apps.length) {
  admin.initializeApp()
}

const env = process.env.ENVIRONMENT

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isNumeric(str: string) {
  return !isNaN(Number(str))
}

async function getThresholds(is5point: boolean = false): Promise<Thresholds> {
  const db = admin.firestore()
  const theresholdsRef = db.doc("systemParameters/thresholds")
  const theresholdsSnap = await theresholdsRef.get()
  const returnThresholds: Thresholds =
    (theresholdsSnap.data() as Thresholds | undefined) ?? thresholds
  if (env !== "PROD") {
    returnThresholds.surveyLikelihood = 1
  }
  if (is5point) {
    returnThresholds.falseUpperBound = 2.5
    returnThresholds.misleadingUpperBound = 4.0
  }
  return returnThresholds
}

async function getTags() {
  const db = admin.firestore()
  const tagsRef = db.doc("systemParameters/tags")
  const tagsSnap = await tagsRef.get()
  const returnTags = tagsSnap.get("tags") ?? others.tags
  //return array of keys
  return returnTags
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

function stripPhone(text: string, includePlaceholder = false): string {
  if (findPhoneNumbersInText(text).length === 0) {
    return text.replace(/[0-9]{7,}/g, includePlaceholder ? "<PHONE_NUM>" : "")
  }

  const currentModification = findPhoneNumbersInText(text)[0]
  const { startsAt, endsAt } = currentModification

  const placeholder = includePlaceholder ? "<PHONE_NUM>" : ""

  text = text.slice(0, startsAt) + placeholder + text.slice(endsAt)

  return stripPhone(text, includePlaceholder)
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

function translateFrequency(en: string) {
  switch (en) {
    case "daily":
      return "每日"
    case "weekly":
      return "每周"
    case "monthly":
      return "每月"
    default:
      return "每日"
  }
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
  isNumeric,
  getTags,
  translateFrequency,
}

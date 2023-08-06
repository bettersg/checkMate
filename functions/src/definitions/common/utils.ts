import { thresholds } from "./constants"
import admin from "firebase-admin"
import { findPhoneNumbersInText } from "libphonenumber-js"
import { createHash } from "crypto"
import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const getThresholds = async function () {
  const db = admin.firestore()
  const theresholdsRef = db.doc("systemParameters/thresholds")
  const theresholdsSnap = await theresholdsRef.get()
  return theresholdsSnap.data() ?? thresholds
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

function stripUrl(originalStr: string, includePlaceholder = false) {
  const urlRegex =
    /\b((?:https?:\/\/)?(?:(?:www\.)?(?:[\da-z\.-]+)\.(?:[a-z]{2,6})|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])))(?::[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])?(?:\/[\w\.-]*)*\/?)\b/g
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
}

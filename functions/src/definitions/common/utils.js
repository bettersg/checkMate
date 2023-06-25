const { thresholds } = require("./constants")
const functions = require("firebase-functions")
const admin = require("firebase-admin")
const { defineString } = require("firebase-functions/params")
const { findPhoneNumbersInText } = require("libphonenumber-js")
const { createHash } = require("crypto")
const { Blob } = require("buffer")

const runtimeEnvironment = defineString("ENVIRONMENT")
const checker1PhoneNumber = defineString("CHECKER1_PHONE_NUMBER")

if (!admin.apps.length) {
  admin.initializeApp()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

exports.getThresholds = async function () {
  const db = admin.firestore()
  const theresholdsRef = db.doc("systemParameters/thresholds")
  const theresholdsSnap = await theresholdsRef.get()
  return theresholdsSnap.data() ?? thresholds
}

exports.checkUrl = function (urlString) {
  let url
  try {
    url = new URL(urlString)
  } catch (e) {
    return false
  }
  return url.protocol === "http:" || url.protocol === "https:"
}

function stripPhone(originalStr, includePlaceholder = false) {
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

function stripUrl(originalStr, includePlaceholder = false) {
  const urlRegex =
    /\b((?:https?:\/\/)?(?:(?:www\.)?(?:[\da-z\.-]+)\.(?:[a-z]{2,6})|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:(?:[0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])))(?::[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])?(?:\/[\w\.-]*)*\/?)\b/g
  const placeholder = includePlaceholder ? "<URL>" : ""
  const replacedString = originalStr.replace(urlRegex, placeholder)
  return replacedString
}

function firestoreTimestampToYYYYMM(timestamp) {
  // Convert Firestore timestamp to a JavaScript Date object
  let date = timestamp.toDate()

  // Get the year and the month
  let year = date.getFullYear()
  let month = date.getMonth() + 1 // JavaScript months range from 0 - 11

  // Pad the month with a 0 if it's less than 10
  if (month < 10) {
    month = "0" + month
  }

  // Return the formatted string
  return `${year}${month}`
}

function hashMessage(originalStr) {
  return createHash("md5").update(originalStr).digest("hex")
}

exports.stripPhone = stripPhone
exports.stripUrl = stripUrl
exports.hashMessage = hashMessage
exports.sleep = sleep
exports.firestoreTimestampToYYYYMM = firestoreTimestampToYYYYMM

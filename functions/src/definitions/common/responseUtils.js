const { getThresholds } = require("./utils")
const { sendTextMessage } = require("./sendMessage")
const { sendWhatsappButtonMessage } = require("./sendWhatsappMessage")
const functions = require("firebase-functions")
const { Timestamp } = require("firebase-admin/firestore")
const {
  respondToInterimFeedback,
  getResponsesObj,
  sendMenuMessage,
  sendVotingStats,
  sendInterimUpdate,
  sendInterimPrompt,
  respondToInstance,
} = require("./responseUtilsTs")

exports.getResponsesObj = getResponsesObj
exports.respondToInstance = respondToInstance
exports.sendMenuMessage = sendMenuMessage
exports.sendInterimPrompt = sendInterimPrompt
exports.sendInterimUpdate = sendInterimUpdate
exports.sendVotingStats = sendVotingStats
exports.respondToInterimFeedback = respondToInterimFeedback

const admin = require("firebase-admin")
const {
  sendWhatsappTextListMessage,
  sendWhatsappTextMessage,
  sendWhatsappButtonMessage,
} = require("./sendWhatsappMessage")
const { getResponsesObj } = require("./responseUtils")
const functions = require("firebase-functions")

exports.sendL1CategorisationMessage = async function (
  voteRequestSnap,
  messageRef,
  replyId = null
) {
  const voteRequestData = voteRequestSnap.data()
  const responses = await getResponsesObj("factChecker")
  const type = "categorize"
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = [
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_scam`,
          title: "Scam",
          description:
            "Intended to obtain money/personal information via deception",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_illicit`,
          title: "Illicit",
          description:
            "Other potential illicit activity, e.g. moneylending/prostitution",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_info`,
          title: "News/Information/Opinion",
          description:
            "Messages intended to inform/convince/mislead a broad base of people",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_others`,
          title: "It's something else",
          description: "Messages that don't fall into the other categories",
        },
      ]
      const sections = [
        {
          rows: rows,
        },
      ]
      await sendWhatsappTextListMessage(
        "factChecker",
        voteRequestData.platformId,
        responses.L1_ASSESSMENT_PROMPT,
        "Make Selection",
        sections,
        replyId ?? voteRequestData.sentMessageId
      )
      break
    case "telegram":
      break
  }
}

exports.sendL2OthersCategorisationMessage = async function (
  voteRequestSnap,
  messageRef,
  replyId = null
) {
  const voteRequestData = voteRequestSnap.data()
  const responses = await getResponsesObj("factChecker")
  const type = "others"
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = [
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_spam`,
          title: "Spam",
          description: "Unsolicited spam, such as marketing messages",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_legitimate`,
          title: "Legitimate",
          description:
            "Legitimate source but can't be assessed, e.g. transactional messages",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_irrelevant`,
          title: "Trivial",
          description: "Trivial/banal messages with nothing to assess",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_unsure`,
          title: "I'm Unsure",
          description:
            "Do try your best to categorize! But if really unsure, select this",
        },
      ]
      const sections = [
        {
          rows: rows,
        },
      ]
      await sendWhatsappTextListMessage(
        "factChecker",
        voteRequestData.platformId,
        responses.L2_OTHERS_ASSESSEMENT_PROMPT,
        "Make Selection",
        sections,
        replyId ?? voteRequestData.sentMessageId
      )
      functions.logger.log(
        `L2 others message sent for ${voteRequestData.platformId}`
      )
      break
    case "telegram":
      break
  }
}

exports.sendVotingMessage = async function sendVotingMessage(
  voteRequestSnap,
  messageRef
) {
  const messageSnap = await messageRef.get()
  const message = messageSnap.data()
  const voteRequestData = voteRequestSnap.data()
  const responses = await getResponsesObj("factChecker")
  const type = "vote"
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows = []
      const max_score = 5
      for (let i = 0; i <= max_score; i++) {
        rows.push({
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_${i}`,
          title: `${i}`,
        })
      }
      rows[0].description = "Totally false"
      rows[max_score].description = "Totally true"
      const sections = [
        {
          rows: rows,
        },
      ]
      await sendWhatsappTextListMessage(
        "factChecker",
        voteRequestData.platformId,
        responses.FACTCHECK_PROMPT,
        "Vote here",
        sections,
        voteRequestData.sentMessageId
      )
      functions.logger.log(
        `Vote message sent for ${voteRequestData.platformId}`
      )
      break
    case "telegram":
      break
  }
}

async function _sendReminderMessage(to, numOutstanding, voteRequestPath) {
  const responses = await getResponsesObj("factChecker")
  const buttons = [
    {
      type: "reply",
      reply: {
        id: `continueOutstanding_${voteRequestPath}`,
        title: "Yes, send the next!",
      },
    },
  ]
  await sendWhatsappButtonMessage(
    "factChecker",
    to,
    responses.OUTSTANDING_REMINDER.replace(
      "{{num_outstanding}}",
      `${numOutstanding}`
    ),
    buttons
  )
}

exports.sendRemainingReminder = async function (factCheckerId, platform) {
  const db = admin.firestore()
  try {
    const outstandingVoteRequestsQuerySnap = await db
      .collectionGroup("voteRequests")
      .where("platformId", "==", factCheckerId)
      .where("category", "==", null)
      .get()
    const remainingCount = outstandingVoteRequestsQuerySnap.size
    if (remainingCount == 0) {
      const responses = await getResponsesObj("factChecker")
      await sendWhatsappTextMessage(
        "factChecker",
        factCheckerId,
        responses.NO_OUTSTANDING
      )
      return
    }
    const unassessedMessagesQuerySnap = await db
      .collection("messages")
      .where("isAssessed", "==", false)
      .get()
    const unassessedMessageIdList = unassessedMessagesQuerySnap.docs.map(
      (docSnap) => docSnap.id
    )
    /*
    sort outstandingVoteRequestsQuerySnap for unassessed messages to come before assessed ones. 
    if both are unassessed, the one created earlier, or the one where the createdTimestamp is not null, 
    should come first.
    */
    const sortedVoteRequestDocs = outstandingVoteRequestsQuerySnap.docs.sort(
      (a, b) => {
        const aIsNotAssessed = unassessedMessageIdList.includes(
          a.ref.parent.parent.id
        )
        const bIsNotAssessed = unassessedMessageIdList.includes(
          b.ref.parent.parent.id
        )
        if (aIsNotAssessed && !bIsNotAssessed) {
          return -1
        }
        if (!aIsNotAssessed && bIsNotAssessed) {
          return 1
        }
        if (aIsNotAssessed && bIsNotAssessed) {
          const aCreatedTimestamp = a.get("createdTimestamp").toMillis() ?? 0
          const bCreatedTimestamp = b.get("createdTimestamp").toMillis() ?? 0
          return aCreatedTimestamp - bCreatedTimestamp
        }
        return 0
      }
    )
    const nextVoteRequestPath = sortedVoteRequestDocs[0].ref.path
    await _sendReminderMessage(
      factCheckerId,
      remainingCount,
      nextVoteRequestPath
    )
  } catch (error) {
    functions.logger.error("Error sending remaining reminder", error)
  }
}

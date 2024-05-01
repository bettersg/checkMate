import {
  sendWhatsappTextListMessage,
  sendWhatsappTextMessage,
  sendWhatsappButtonMessage,
} from "./sendWhatsappMessage"
import { getResponsesObj } from "./responseUtils"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"

const sendL1CategorisationMessage = async function (
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  replyId: string | null = null
) {
  const voteRequestData = voteRequestSnap.data()
  const responses = await getResponsesObj("factChecker")
  const type = "categorize"
  if (!voteRequestData) {
    functions.logger.error(
      `No vote request data for ${voteRequestSnap.ref.path}`
    )
    return
  }
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
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_satire`,
          title: "Satire",
          description: "Content clearly satirical in nature",
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

const sendL2OthersCategorisationMessage = async function (
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  replyId: string | null = null
) {
  const voteRequestData = voteRequestSnap.data()
  const responses = await getResponsesObj("factChecker")
  const type = "others"
  if (!voteRequestData) {
    functions.logger.error(
      `No vote request data for ${voteRequestSnap.ref.path}`
    )
    return
  }
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
          description: "Insufficient information to determine",
        },
        {
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_pass`,
          title: "I'm Passing",
          description: "Skip assessing this message, if you must",
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

const sendVotingMessage = async function sendVotingMessage(
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  const messageSnap = await messageRef.get()
  const message = messageSnap.data()
  const voteRequestData = voteRequestSnap.data()
  const responses = await getResponsesObj("factChecker")
  const type = "vote"
  if (!voteRequestData) {
    functions.logger.error(
      `No vote request data for ${voteRequestSnap.ref.path}`
    )
    return
  }
  switch (voteRequestData.platform) {
    case "whatsapp":
      const rows: {
        id: string
        title: string
        description?: string
      }[] = []
      const max_score = 5
      for (let i = 1; i <= max_score; i++) {
        rows.push({
          id: `${type}_${messageRef.id}_${voteRequestSnap.id}_${i}`,
          title: `${i}`,
        })
      }
      rows[0].description = "Totally false"
      rows[max_score - 1].description = "Totally true"
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

async function _sendReminderMessage(
  to: string,
  numOutstanding: number,
  voteRequestPath: string
) {
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

const sendRemainingReminder = async function (
  factCheckerId: string,
  platform: string
) {
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
        if (!a.ref.parent.parent || !b.ref.parent.parent) {
          functions.logger.error(
            `No parent found for either vote request ${a.ref.path} or ${b.ref.path}`
          )
          return 0
        }
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
export {
  sendL1CategorisationMessage,
  sendL2OthersCategorisationMessage,
  sendVotingMessage,
  sendRemainingReminder,
}

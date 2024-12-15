import { logger } from "firebase-functions/v2"
import {
  sendTelegramImageMessage,
  sendTelegramTextMessage,
} from "../../definitions/common/sendTelegramMessage"
import { DocumentReference } from "firebase-admin/firestore"
import { CommunityNote } from "../../types"

const topicId = process.env.VOTING_TOPIC_MESSAGE_ID
const adminChatId = process.env.ADMIN_CHAT_ID
const environment = process.env.ENVIRONMENT

export async function sendNewMessageNotification(
  text?: string | null,
  imageUrl?: string,
  caption?: string | null
) {
  try {
    if (environment === "SIT") {
      logger.info("sendVotingUpdate is disabled in SIT environment.")
      return
    }
    if (!topicId || !adminChatId) {
      logger.error(
        "Missing required environment variables VOTING_TOPIC_MESSAGE_ID or ADMIN_CHAT_ID"
      )
      return
    }
    let response
    if (text) {
      response = await sendTelegramTextMessage(
        "admin",
        adminChatId,
        text,
        topicId
      )
    } else if (imageUrl) {
      response = await sendTelegramImageMessage(
        "admin",
        adminChatId,
        imageUrl,
        caption || null,
        topicId
      )
    }
    const messageId = response?.data.result.message_id
    return messageId
  } catch (error) {
    logger.error("Error in sendNewMessageNotification: ", error)
    return null
  }
}

export async function sendCommunityNoteNotification(
  communityNote: CommunityNote | null,
  replyId: string | null,
  messageRef: DocumentReference
) {
  try {
    if (environment === "SIT") {
      logger.info("sendVotingUpdate is disabled in SIT environment.")
      return
    }
    let updateText
    if (!topicId || !adminChatId) {
      logger.error(
        "Missing required environment variables VOTING_TOPIC_MESSAGE_ID or ADMIN_CHAT_ID"
      )
      return
    }
    if (communityNote === null) {
      updateText =
        "Community Note not generated. Either message deemed irrelevant or an error occured."
    } else {
      updateText = `Community Note:\n\n${
        communityNote.en
      }\n\nLinks:\n${communityNote.links.join("\n")}`
    }
    const response = await sendTelegramTextMessage(
      "admin",
      adminChatId,
      updateText,
      replyId ?? topicId
    )
    const messageId = response?.data.result.message_id
    if (messageId) {
      await messageRef.update({
        "communityNote.adminGroupCommunityNoteSentMessageId": messageId,
      })
    }
  } catch (error) {
    logger.error("Error in sendCommunityNoteNotification: ", error)
  }
}

type MessageUpdateParams = {
  messageId: string
  previousCategory?: string | null
  currentCategory?: string
  machineCategory?: string
  downvoted?: boolean
}

export async function sendVotingUpdate(params: MessageUpdateParams) {
  // Function implementation
  try {
    if (environment === "SIT") {
      logger.info("sendVotingUpdate is disabled in SIT environment.")
      return
    }
    let updateText = ""
    if (!topicId || !adminChatId) {
      logger.error(
        "Missing required environment variables VOTING_TOPIC_MESSAGE_ID or ADMIN_CHAT_ID"
      )
      return
    }

    const messageId = params.messageId
    if (params.previousCategory && params.currentCategory) {
      updateText = `Change in Category:\n\nPrevious Category: ${renameCategory(
        params.previousCategory
      )}\nCurrent Category: ${renameCategory(params.currentCategory)}`
    } else if (params.currentCategory) {
      updateText = `Message assessed as: ${renameCategory(
        params.currentCategory
      )}`
    } else if (params.downvoted) {
      updateText = "Community Note was downvoted"
    } else if (params.machineCategory) {
      updateText = `Machine Category: ${params.machineCategory}`
    }
    await sendTelegramTextMessage(
      "admin",
      adminChatId,
      updateText,
      messageId || topicId
    )
  } catch (error) {
    logger.error("Error in sendVotingUpdate: ", error)
  }
}

function renameCategory(category: string) {
  if (category === "irrelevant") {
    return "nvc-cant-tell"
  } else if (category === "trivial") {
    return "nvc-credible"
  } else {
    return category
  }
}

export async function sendTicketNotification(text: string) {
  try {
    if (!topicId || !adminChatId) {
      logger.error(
        "Missing required environment variables VOTING_TOPIC_MESSAGE_ID or ADMIN_CHAT_ID"
      )
      return
    }
    await sendTelegramTextMessage("admin", adminChatId, text, topicId)
  } catch (error) {
    logger.error("Error in sendTicketNotification: ", error)
  }
}

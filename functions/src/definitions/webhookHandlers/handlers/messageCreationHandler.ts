import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { downloadUrlMedia } from "../../common/mediaUtils"
import { logger } from "firebase-functions/v2"
import { MessageData, CommunityNote } from "../../../types"
import { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"

interface PartialCommunityNote {
  en: string
  cn: string
  links: string[]
}

interface MessageCreationRequest {
  machineCategory: string
  isMachineCategorised: boolean
  text?: string | null
  caption?: string | null
  imageUrl?: string | null
  isControversial: boolean
  communityNoteStatus: string
  communityNote?: PartialCommunityNote | null
  isCommunityNoteUsable: boolean
  isIrrelevant: boolean
  title?: string | null
  slug?: string | null
  id?: string | null
  messageNotificationId: string | null
  communityNoteNotificationId: string | null
}

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const messageCreationHandler = async (req: Request, res: Response) => {
  try {
    // Validate API key
    const apiKey = req.headers["x-api-key"]
    const expectedApiKey = process.env.INTERNAL_API_KEY

    if (!apiKey || apiKey !== expectedApiKey) {
      logger.warn("Unauthorized access attempt to messageCreationHandler", {
        hasApiKey: !!apiKey,
        ip: req.ip,
      })
      return res.status(401).json({ error: "Unauthorized" })
    }

    const messageData: MessageCreationRequest = req.body

    if (!messageData) {
      logger.error("Invalid message data received", { body: req.body })
      return res.status(400).json({ error: "Invalid message data" })
    }

    const messageRef = db.collection("messages").doc()
    let filename = null
    if (messageData.imageUrl) {
      const buffer = await downloadUrlMedia(messageData.imageUrl)
      const storageBucket = admin.storage().bucket()
      const imageId = uuidv4()
      filename = `images/${imageId}.jpeg`
      const file = storageBucket.file(filename)
      const stream = file.createWriteStream()
      await new Promise((resolve, reject) => {
        stream.on("error", reject)
        stream.on("finish", resolve)
        stream.end(buffer)
      })
    }
    let fullCommunityNote: CommunityNote | null = null
    if (messageData.communityNote) {
      fullCommunityNote = {
        en: messageData.communityNote.en,
        cn: messageData.communityNote.cn,
        links: messageData.communityNote.links,
        downvoted: false,
        pendingCorrection: false,
        adminGroupCommunityNoteSentMessageId:
          messageData.communityNoteNotificationId ?? null,
        timestamp: Timestamp.now(),
      }
    }

    const messageToStore: MessageData = {
      machineCategory: messageData.machineCategory || "unsure",
      isMachineCategorised: messageData.isMachineCategorised || false,
      isWronglyCategorisedIrrelevant: false,
      originalText: messageData.text ?? null,
      text: messageData.text ?? null,
      storageUrl: filename ?? null,
      caption: messageData.caption ?? null,
      latestInstance: null,
      firstTimestamp: Timestamp.now(),
      lastTimestamp: Timestamp.now(),
      lastRefreshedTimestamp: Timestamp.now(),
      isPollStarted: false,
      isAssessed: false,
      assessedTimestamp: null,
      assessmentExpiry: null,
      assessmentExpired: false,
      truthScore: null,
      numberPointScale: 6,
      isControversial: messageData.isControversial ?? false,
      isIrrelevant: messageData.isIrrelevant ?? false,
      isScam: null,
      isIllicit: null,
      isSpam: null,
      isLegitimate: null,
      isUnsure: null,
      isInfo: null,
      isSatire: null,
      isHarmful: null,
      isHarmless: null,
      tags: {},
      primaryCategory: null,
      customReply: null,
      communityNoteStatus: messageData.communityNoteStatus ?? "not-generated",
      communityNote: messageData.isCommunityNoteUsable
        ? fullCommunityNote
        : null,
      instanceCount: 0,
      adminGroupSentMessageId: messageData.messageNotificationId ?? null,
      title: messageData.title ?? null,
      slug: messageData.slug ?? null,
      approvedForPublishing: false,
      approvedBy: null,
      source: "api",
      checkId: messageData.id ?? null,
    }

    await messageRef.set(messageToStore)

    logger.log(`Message ${messageRef.id} successfully created in messages`, {
      messageId: messageRef.id,
    })

    return res.status(201).json({
      success: true,
      messageId: messageRef.id,
      collection: "messages",
    })
  } catch (error) {
    logger.error("Error in messageCreationHandler", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

export { messageCreationHandler }

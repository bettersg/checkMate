import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import {
  updateOne,
  CollectionTypes,
} from "../common/typesense/collectionOperations"
import { getEmbedding } from "../common/machineLearningServer/operations"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { getSignedUrl } from "../common/mediaUtils"
import { getCommunityNote } from "../common/machineLearningServer/operations"
import { MessageData } from "../../types"
import { despatchPoll } from "../../services/checker/votingService"
import { respondToInstance } from "../common/responseUtils"
import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const onInstanceUpdateV2 = onDocumentUpdated(
  {
    document: "messages/{messageId}/instances/{instanceId}",
    secrets: ["TYPESENSE_TOKEN", "ML_SERVER_TOKEN", "WHATSAPP_TOKEN"],
  },
  async (event) => {
    // Grab the current value of what was written to Firestore.
    if (!event?.data?.before || !event?.data?.after) {
      return Promise.resolve()
    }
    const preChangeData = event.data.before.data()
    const snap = event.data.after
    const postChangeData = snap.data()
    if (
      postChangeData.type === "text" &&
      preChangeData.originalText !== postChangeData.originalText
    ) {
      const embedding = await getEmbedding(postChangeData.text)
      const updateDocument = {
        id: snap.ref.path,
        message: postChangeData.text,
        captionHash: postChangeData.captionHash
          ? postChangeData.captionHash
          : "__NULL__",
        embedding: embedding,
      }
      await updateOne(updateDocument, CollectionTypes.Instances)
      await snap.ref.update({
        embedding: embedding,
      })
    }
    if (
      postChangeData.isIrrelevantAppealed === true &&
      preChangeData.isIrrelevantAppealed === false
    ) {
      //get the parent message
      const messageRef = snap.ref.parent.parent
      if (!messageRef) {
        return Promise.resolve()
      }
      const messageUpdateObj: Partial<MessageData> = {
        isWronglyCategorisedIrrelevant: true,
      }
      const messageSnap = await messageRef.get()
      if (messageSnap.get("primaryCategory") === "irrelevant") {
        messageUpdateObj.primaryCategory = null
      }
      if (!messageSnap.get("communityNote")) {
        let communityNoteData
        let isCommunityNoteGenerated = false
        try {
          if (postChangeData.type === "text") {
            communityNoteData = await getCommunityNote({
              text: postChangeData.text,
            })
          } else {
            const filename = postChangeData.storageUrl
            const signedUrl = (await getSignedUrl(filename)) ?? null
            communityNoteData = await getCommunityNote({
              url: signedUrl,
              caption: postChangeData.caption,
            })
          }
          isCommunityNoteGenerated = true
          messageUpdateObj.communityNote = {
            en: communityNoteData?.en || "",
            cn: communityNoteData?.cn || "",
            links: communityNoteData?.links || [],
            downvoted: false,
            pendingCorrection: false,
            adminGroupCommunityNoteSentMessageId: null,
            timestamp: Timestamp.now(),
          }
        } catch (error) {
          functions.logger.error("Error in getCommunityNote:", error)
        }
      }
      await messageRef.update(messageUpdateObj)
      await snap.ref.update({
        isReplied: false,
      })
      // send response
      await respondToInstance(snap, false, true)
      if (messageSnap.get("isPollStarted") === false) {
        await despatchPoll(messageRef)
        messageUpdateObj.isPollStarted = true
      }
    }
  }
)

export { onInstanceUpdateV2 }

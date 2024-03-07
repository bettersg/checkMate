import * as functions from "firebase-functions"
import {
  deleteOne,
  upsertOne,
  CollectionTypes,
} from "../common/typesense/collectionOperations"
import { firestoreTimestampToYYYYMM } from "../common/utils"
import { onDocumentWritten } from "firebase-functions/v2/firestore"

const onMessageWriteV2 = onDocumentWritten(
  {
    document: "messages/{messageId}",
    secrets: ["TYPESENSE_TOKEN"],
  },
  async (event) => {
    // Grab the current value of what was written to Firestore.
    const id = event.params.messageId
    // If the message is deleted, delete from the Typesense index
    const messageSnap = event?.data?.after
    if (messageSnap == undefined || !messageSnap.exists) {
      try {
        await deleteOne(id, CollectionTypes.Messages)
      } catch {
        functions.logger.error(`Failed to delete message ${id} from Typesense`)
      }
      return
    }

    // Otherwise, create/update the message in the the Typesense index
    const messageData = messageSnap.data()
    if (messageData) {
      const lastTimestamp = messageData.lastTimestamp
      const lastMonth = firestoreTimestampToYYYYMM(lastTimestamp)
      const firstTimestamp = messageData.firstTimestamp
      const firstMonth = firestoreTimestampToYYYYMM(firstTimestamp)
      const upsertDoc = {
        id,
        text: messageData.text || null,
        caption: messageData.caption || null,
        category: messageData.primaryCategory,
        truthScore: messageData.truthScore,
        isAssessed: messageData.isAssessed,
        instanceCount: messageData.instanceCount,
        lastReceivedUnixTimestamp: lastTimestamp.seconds,
        firstReceivedUnixTimestamp: firstTimestamp.seconds,
        lastReceivedMonth: lastMonth,
        firstReceivedMonth: firstMonth,
      }
      try {
        await upsertOne(upsertDoc, CollectionTypes.Messages)
      } catch {
        functions.logger.error(`Failed to upsert message ${id} to Typesense`)
      }
    }
  }
)

export { onMessageWriteV2 }

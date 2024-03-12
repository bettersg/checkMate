import * as functions from "firebase-functions"
import {
  updateOne,
  CollectionTypes,
} from "../common/typesense/collectionOperations"
import { getEmbedding } from "../common/machineLearningServer/operations"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"

const onInstanceUpdateV2 = onDocumentUpdated(
  {
    document: "messages/{messageId}/instances/{instanceId}",
    secrets: ["TYPESENSE_TOKEN", "ML_SERVER_TOKEN"],
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
  }
)

export { onInstanceUpdateV2 }

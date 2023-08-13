import * as functions from "firebase-functions"
import {
  updateOne,
  CollectionTypes,
} from "./common/typesense/collectionOperations"
import { getEmbedding } from "./common/machineLearningServer/operations"

exports.onInstanceUpdate = functions
  .region("asia-southeast1")
  .runWith({
    secrets: ["TYPESENSE_TOKEN", "ML_SERVER_TOKEN"],
  })
  .firestore.document("/messages/{messageId}/instances/{instanceId}")
  .onUpdate(async (change, context) => {
    // Grab the current value of what was written to Firestore.
    const before = change.before.data()
    const after = change.after.data()
    if (after.type === "text" && before.text !== after.text) {
      const embedding = await getEmbedding(after.text)
      const updateDocument = {
        id: change.after.ref.path,
        message: after.text,
        captionHash: after.captionHash ? after.captionHash : "__NULL__",
        embedding: embedding,
      }
      await updateOne(updateDocument, CollectionTypes.Instances)
      await change.after.ref.update({
        embedding: embedding,
      })
    }
  })

import * as functions from 'firebase-functions';
import { deleteOne, CollectionTypes } from "./common/typesense/collectionOperations"
import { FieldValue } from "@google-cloud/firestore"

exports.onInstanceDelete = functions
  .region("asia-southeast1")
  .runWith({
    secrets: [
      "TYPESENSE_TOKEN",
    ],
  })
  .firestore.document("/messages/{messageId}/instances/{instanceId}")
  .onDelete(async (snap, context) => {
    // Grab the current value of what was written to Firestore.
    const parentMessageRef = snap.ref.parent.parent;

    if (parentMessageRef) {
      const instancesQuerySnap = await parentMessageRef.collection("instances").orderBy("timestamp").get()
      if (!instancesQuerySnap.empty) {
        const lastInstanceDocSnap = instancesQuerySnap.docs[instancesQuerySnap.docs.length - 1]
        const firstInstanceDocSnap = instancesQuerySnap.docs[0]
        await parentMessageRef.update({
          instanceCount: FieldValue.increment(-1),
          lastTimestamp: lastInstanceDocSnap.get("timestamp"),
          firstTimestamp: firstInstanceDocSnap.get("timestamp"),
        })
      } else {
        await parentMessageRef.update({ instanceCount: 0 })
      }
    }
    const id = snap.ref.path.replace(/\//g, "_") //typesense id can't seem to take /
    try {
      await deleteOne(id, CollectionTypes.Instances)
    }
    catch {
      functions.logger.error(`Failed to delete instance ${snap.ref.path} from Typesense`)
    }
  })
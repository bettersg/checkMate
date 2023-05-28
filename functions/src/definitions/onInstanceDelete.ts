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
      await parentMessageRef.update({
        instanceCount: FieldValue.increment(-1),
      })
    }
    const id = snap.ref.path.replace(/\//g, "_") //typesense id can't seem to take /
    await deleteOne(id, CollectionTypes.Instances)
  })
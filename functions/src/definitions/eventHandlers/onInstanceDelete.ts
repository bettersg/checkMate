import * as functions from "firebase-functions"
import {
  deleteOne,
  CollectionTypes,
} from "../common/typesense/collectionOperations"
import { FieldValue } from "@google-cloud/firestore"
import { onDocumentDeleted } from "firebase-functions/v2/firestore"

const onInstanceDeleteV2 = onDocumentDeleted(
  {
    document: "/messages/{messageId}/instances/{instanceId}",
    secrets: ["TYPESENSE_TOKEN"],
  },
  async (event) => {
    const snap = event.data
    if (!snap) {
      return Promise.resolve()
    }
    const parentMessageRef = snap.ref.parent.parent

    if (parentMessageRef) {
      const instancesQuerySnap = await parentMessageRef
        .collection("instances")
        .orderBy("timestamp")
        .get()
      if (!instancesQuerySnap.empty) {
        const lastInstanceDocSnap =
          instancesQuerySnap.docs[instancesQuerySnap.docs.length - 1]
        const firstInstanceDocSnap = instancesQuerySnap.docs[0]
        try {
          await parentMessageRef.update({
            instanceCount: FieldValue.increment(-1),
            lastTimestamp: lastInstanceDocSnap.get("timestamp"),
            firstTimestamp: firstInstanceDocSnap.get("timestamp"),
          })
        } catch {
          functions.logger.error(
            `Failed to update message ${parentMessageRef.path} in Firestore while deleting instance`
          )
        }
      } else {
        try {
          await parentMessageRef.update({ instanceCount: 0 })
        } catch {
          functions.logger.error(
            `Failed to update message ${parentMessageRef.path} in Firestore while deleting instance`
          )
        }
      }
    }
    const id = snap.ref.path.replace(/\//g, "_") //typesense id can't seem to take /
    try {
      await deleteOne(id, CollectionTypes.Instances)
    } catch {
      functions.logger.error(
        `Failed to delete instance ${snap.ref.path} from Typesense`
      )
    }
  }
)

export { onInstanceDeleteV2 }

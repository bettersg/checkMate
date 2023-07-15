import { FieldValue } from "@google-cloud/firestore"
import { DocumentReference } from "firebase-admin/firestore"

export const incrementCounter = async function (
  docRef: DocumentReference,
  type: string,
  numShards: number,
  increment = 1
) {
  if (!docRef) {
    return
  }
  const shardId = Math.floor(Math.random() * numShards)
  const shardRef = docRef.collection("shards").doc(shardId.toString())
  return shardRef.set(
    { [`${type}Count`]: FieldValue.increment(increment) },
    { merge: true }
  )
}

export const getCount = async function (
  docRef: DocumentReference,
  type: string
) {
  const querySnapshot = await docRef.collection("shards").get()
  const documents = querySnapshot.docs
  let count = 0
  for (const doc of documents) {
    count += doc.get(`${type}Count`) ?? 0
  }
  return count
}

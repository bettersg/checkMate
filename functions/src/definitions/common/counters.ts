import { FieldValue } from "@google-cloud/firestore"
import { DocumentReference } from "firebase-admin/firestore"

const incrementCounter = async function (
  docRef: DocumentReference,
  type: string,
  increment = 1
) {
  if (!docRef) {
    return
  }
  return docRef.set(
    { [`${type}Count`]: FieldValue.increment(increment) },
    { merge: true }
  )
}

const getCount = async function (docRef: DocumentReference, type: string) {
  const docSnap = await docRef.get()
  return docSnap.get(`${type}Count`) ?? 0
}

export { getCount, incrementCounter }

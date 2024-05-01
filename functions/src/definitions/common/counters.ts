import { FieldValue } from "@google-cloud/firestore"
import { DocumentReference } from "firebase-admin/firestore"

const incrementCounter = async function (
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

const getCount = async function (docRef: DocumentReference, type: string) {
  const querySnapshot = await docRef.collection("shards").get()
  const documents = querySnapshot.docs
  let count = 0
  for (const doc of documents) {
    count += doc.get(`${type}Count`) ?? 0
  }
  return count
}

const getVoteCounts = async function (messageRef: DocumentReference) {
  const totalVoteRequestQuery = messageRef
    .collection("voteRequests")
    .count()
    .get()
  const [
    responsesCount,
    passCount,
    irrelevantCount,
    scamCount,
    illicitCount,
    infoCount,
    spamCount,
    legitimateCount,
    unsureCount,
    satireCount,
    voteTotal,
    voteRequestCountSnapshot,
  ] = await Promise.all([
    getCount(messageRef, "responses"),
    getCount(messageRef, "pass"),
    getCount(messageRef, "irrelevant"),
    getCount(messageRef, "scam"),
    getCount(messageRef, "illicit"),
    getCount(messageRef, "info"),
    getCount(messageRef, "spam"),
    getCount(messageRef, "legitimate"),
    getCount(messageRef, "unsure"),
    getCount(messageRef, "satire"),
    getCount(messageRef, "totalVoteScore"),
    totalVoteRequestQuery,
  ])
  const totalVoteRequestsCount = voteRequestCountSnapshot.data().count ?? 0
  const factCheckerCount = totalVoteRequestsCount - passCount //don't count "error" votes in number of fact checkers, as this will slow the replies unnecessarily.
  const validResponsesCount = responsesCount - passCount //can remove in future and replace with nonErrorCount
  const susCount = scamCount + illicitCount
  return {
    responsesCount,
    passCount,
    irrelevantCount,
    scamCount,
    illicitCount,
    infoCount,
    spamCount,
    legitimateCount,
    unsureCount,
    satireCount,
    voteTotal,
    validResponsesCount,
    susCount,
    factCheckerCount,
  }
}

export { getCount, incrementCounter, getVoteCounts }

import { FieldValue } from "@google-cloud/firestore"
import { DocumentReference } from "firebase-admin/firestore"
import * as admin from "firebase-admin"
import { getThresholds, getTags } from "./utils"

const db = admin.firestore()

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
  const tags = (await getTags()) as string[]
  const totalVoteRequestQuery = messageRef
    .collection("voteRequests")
    .count()
    .get()
  // Create an array of promises for the tags
  const tagPromises = tags.map((tag) => getCount(messageRef, tag))
  const otherPromises = [
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
    getThresholds(),
  ]
  const allPromises = [
    ...otherPromises, // spread the other fixed promises
    ...tagPromises, // spread the tag promises
  ]
  const results = await Promise.all(allPromises)
  // Extract the tag counts first
  const tagCounts = results.slice(otherPromises.length) as number[]
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
    thresholds,
  ] = results.slice(0, otherPromises.length) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    admin.firestore.AggregateQuerySnapshot<
      {
        count: admin.firestore.AggregateField<number>
      },
      admin.firestore.DocumentData,
      admin.firestore.DocumentData
    >,
    any
  ] // slice the results to get the fixed promises

  const totalVoteRequestsCount = voteRequestCountSnapshot.data().count ?? 0
  const factCheckerCount = totalVoteRequestsCount - passCount //don't count "error" votes in number of fact checkers, as this will slow the replies unnecessarily.
  const validResponsesCount = responsesCount - passCount //can remove in future and replace with nonErrorCount
  const susCount = scamCount + illicitCount
  const truthScore = computeTruthScore(infoCount, voteTotal)
  let harmfulCount = scamCount + illicitCount
  let harmlessCount = legitimateCount + spamCount
  if (truthScore !== null) {
    if (truthScore < (thresholds.falseUpperBound || 2.5)) {
      harmfulCount += infoCount
    } else if (truthScore <= (thresholds.misleadingUpperBound || 4)) {
      //pass
    } else {
      harmlessCount += infoCount
    }
  }
  const tagCountMap = tags.reduce((acc, tag, index) => {
    acc[tag] = tagCounts[index]
    return acc
  }, {} as { [key: string]: number })
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
    truthScore,
    harmfulCount,
    harmlessCount,
    factCheckerCount,
    tagCounts: tagCountMap,
  }
}

const incrementCheckerCounts = async function (
  whatsappId: string,
  field: string,
  increment = 1
) {
  const factCheckerQuery = db
    .collection("checkers")
    .where("whatsappId", "==", whatsappId)
    .limit(1)
  const factCheckerQuerySnapshot = await factCheckerQuery.get()
  if (factCheckerQuerySnapshot.empty) {
    return
  } else {
    const factCheckerDoc = factCheckerQuerySnapshot.docs[0]
    const factCheckerRef = factCheckerDoc.ref
    return factCheckerRef.update({ [field]: FieldValue.increment(increment) })
  }
}

function computeTruthScore(infoCount: number, voteTotal: number) {
  if (infoCount === 0) {
    return null
  }
  return voteTotal / infoCount
}

export { getCount, incrementCounter, getVoteCounts, incrementCheckerCounts }

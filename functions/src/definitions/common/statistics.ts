import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { LeaderboardEntry } from "../../types"
import { Timestamp } from "firebase-admin/firestore"
import { TIME } from "../../utils/time"
import { CheckerData, CheckerProgramStats } from "../../types"

function checkAccuracy(
  parentMessageSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>
) {
  const isParentMessageAssessed = parentMessageSnap.get("isAssessed") ?? false
  const parentMessageCategory = parentMessageSnap.get("primaryCategory") ?? null
  const parentMessageTags = parentMessageSnap.get("tags") ?? {}
  const voteRequestTags = voteRequestSnap.get("tags") ?? {}
  //make sure all tags match
  const isTagsEqual = areTagsEqual(parentMessageTags, voteRequestTags)
  const parentMessageTruthScore = parentMessageSnap.get("truthScore") ?? null
  const voteRequestCategory = voteRequestSnap.get("category") ?? null
  const voteRequestTruthScore = voteRequestSnap.get("truthScore") ?? null
  if (!isParentMessageAssessed) {
    return null
  }
  if (parentMessageCategory === "unsure") {
    //don't penalise if final outcome is unsure
    return null
  }
  if (parentMessageCategory == null) {
    logger.warn("Parent message has no category")
    return null
  }
  if (voteRequestCategory == null) {
    logger.warn("Vote request has no category")
    return null
  }
  if (voteRequestCategory === "pass") {
    logger.info("Checker has passed")
    return null
  }
  if (voteRequestCategory === "info") {
    //check the truth scores and return true if they are within 1 of each other
    if (!["misleading", "untrue", "accurate"].includes(parentMessageCategory)) {
      return false
    }
    if (parentMessageTruthScore == null || voteRequestTruthScore == null) {
      logger.warn("Truth score missing")
      return null
    }
    return Math.abs(parentMessageTruthScore - voteRequestTruthScore) <= 1
  } else {
    return parentMessageCategory === voteRequestCategory //&& isTagsEqual
    //add next time?
  }
}

function computeGamificationScore(
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  isCorrect: boolean | null
) {
  const createdTimestamp = voteRequestSnap.get(
    "createdTimestamp"
  ) as admin.firestore.Timestamp
  const votedTimestamp = voteRequestSnap.get(
    "votedTimestamp"
  ) as admin.firestore.Timestamp

  // Scoring parameters
  const timeBucketSize = 300 // 5 minutes
  const maxTimeAllowedForPoints = 24 * 60 * 60 // 24 hours

  // Calculate the time taken to vote in seconds
  const timeTaken = votedTimestamp.seconds - createdTimestamp.seconds
  const numBuckets = Math.ceil(maxTimeAllowedForPoints / timeBucketSize)
  const timeBucket = Math.min(
    Math.floor(timeTaken / timeBucketSize),
    numBuckets
  )

  // Scoring function
  const points = isCorrect === true ? 1 - timeBucket / numBuckets / 2 : 0
  return points
}

async function getFullLeaderboard(): Promise<LeaderboardEntry[]> {
  const db = admin.firestore()
  const leaderboardQuery = db
    .collection("checkers")
    .where("isActive", "==", true)
    .orderBy("leaderboardStats.score", "desc")
  const leaderboardSnap = await leaderboardQuery.get()
  const leaderboardData = leaderboardSnap.docs.map((doc, index) => {
    const data = doc.data()
    const numVoted = data.leaderboardStats.numVoted ?? 0
    const numCorrectVotes = data.leaderboardStats.numCorrectVotes ?? 0
    const totalTimeTaken = data.leaderboardStats.totalTimeTaken ?? 0
    const accuracy = numVoted === 0 ? 0 : numCorrectVotes / numVoted
    const averageTimeTaken = numVoted === 0 ? 0 : totalTimeTaken / numVoted
    return {
      id: doc.id,
      position: index + 1,
      name: data.name,
      numVoted: numVoted,
      accuracy: accuracy,
      averageTimeTaken: averageTimeTaken,
      score: data.leaderboardStats.score,
    }
  })
  return leaderboardData
}

function computeTimeTakenMinutes(
  voteRequestData: admin.firestore.DocumentSnapshot
) {
  const createdTimestamp = voteRequestData.get(
    "createdTimestamp"
  ) as admin.firestore.Timestamp
  const votedTimestamp = voteRequestData.get(
    "votedTimestamp"
  ) as admin.firestore.Timestamp
  return (votedTimestamp.seconds - createdTimestamp.seconds) / 60
}

function tabulateVoteStats(
  parentMessageSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>
) {
  const isCorrect = checkAccuracy(parentMessageSnap, voteRequestSnap)
  const score = computeGamificationScore(voteRequestSnap, isCorrect)
  const duration = computeTimeTakenMinutes(voteRequestSnap)
  return { isCorrect, score, duration }
}

async function computeProgramStats(
  checkerSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  updateCompletion: boolean = false
): Promise<CheckerProgramStats> {
  try {
    const checkerData = checkerSnap.data() as CheckerData
    if (!checkerData.programData?.isOnProgram) {
      throw new Error(`Checker ${checkerSnap.ref.id} is not on program`)
    }
    let timestamp = null
    const numVotes =
      checkerData.numVoted - checkerData.programData.numVotesAtProgramStart
    const numCorrectVotes =
      checkerData.numCorrectVotes -
      checkerData.programData.numCorrectVotesAtProgramStart
    const numNonUnsureVotes =
      checkerData.numNonUnsureVotes -
      checkerData.programData.numNonUnsureVotesAtProgramStart
    const numReferrals =
      checkerData.numReferred -
      checkerData.programData.numReferralsAtProgramStart
    const numReports =
      checkerData.numReported - checkerData.programData.numReportsAtProgramStart
    const accuracy =
      numNonUnsureVotes === 0 ? null : numCorrectVotes / numNonUnsureVotes
    const numVotesTarget = checkerData.programData.numVotesTarget
    const numReferralTarget = checkerData.programData.numReferralTarget
    const numReportTarget = checkerData.programData.numReportTarget
    const accuracyTarget = checkerData.programData.accuracyTarget
    const isVotesTargetMet = numVotes >= numVotesTarget
    const isReferralTargetMet = numReferrals >= numReferralTarget
    const isReportTargetMet = numReports >= numReportTarget
    const isAccuracyTargetMet = accuracy !== null && accuracy >= accuracyTarget
    const isProgramCompleted = //program is completed if it has previously been deemed complete (in case votes change it again), or if all targets are met
      checkerData.programData.programEnd != null ||
      (isVotesTargetMet &&
        isReferralTargetMet &&
        isReportTargetMet &&
        isAccuracyTargetMet)
    let isNewlyCompleted = false
    if (
      updateCompletion &&
      isProgramCompleted &&
      checkerData.programData.programEnd == null
    ) {
      timestamp = Timestamp.fromDate(new Date())
      await checkerSnap.ref.update({
        hasCompletedProgram: true,
        "programData.programEnd": timestamp,
        "programData.numVotesAtProgramEnd": checkerData.numVoted,
        "programData.numReferralsAtProgramEnd": checkerData.numReferred,
        "programData.numReportsAtProgramEnd": checkerData.numReported,
        "programData.numCorrectVotesAtProgramEnd": checkerData.numCorrectVotes,
        "programData.numNonUnsureVotesAtProgramEnd":
          checkerData.numNonUnsureVotes,
      })
      isNewlyCompleted = true
    }
    return {
      numVotes,
      numReferrals,
      numReports,
      accuracy,
      isProgramCompleted,
      isNewlyCompleted,
      completionTimestamp: timestamp,
    } as CheckerProgramStats
  } catch (error) {
    logger.error(
      `Error computing program stats for checker ${checkerSnap.ref.id}: ${error}`
    )
    throw error
  }
}

async function computeLast30DaysStats(
  checkerSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>
) {
  const db = admin.firestore()
  const cutoffTimestamp = Timestamp.fromDate(
    new Date(Date.now() - TIME.THIRTY_DAYS)
  )

  const last30DaysQuery = db
    .collectionGroup("voteRequests")
    .where("factCheckerDocRef", "==", checkerSnap.ref)
    .where("createdTimestamp", ">", cutoffTimestamp)

  const last30DaysSnap = await last30DaysQuery.get()

  //filter client side for category != null, since firestore doesn't support inequality on 2 fields
  const last30DaysData = last30DaysSnap.docs.filter(
    (doc) => doc.get("category") !== null && doc.get("category") !== "pass"
  )

  const totalVoted = last30DaysData.length

  // Map each document to a promise to fetch the parent message and count instances
  const fetchDataPromises = last30DaysData.map((doc) => {
    const parentMessageRef = doc.ref.parent.parent // Assuming this is how you get the reference
    if (!parentMessageRef) {
      logger.error(`Vote request ${doc.id} has no parent message`)
      return null
    }

    // You can fetch the parent message and count instances in parallel for each doc
    return Promise.all([
      parentMessageRef.get(),
      parentMessageRef.collection("instances").count().get(),
    ])
      .then(([parentMessageSnap, instanceCountResult]) => {
        if (!parentMessageSnap.exists) {
          logger.error(`Parent message not found for vote request ${doc.id}`)
          return null
        }
        const instanceCount = instanceCountResult.data().count ?? 0
        const isAccurate = checkAccuracy(parentMessageSnap, doc)
        const isAssessed = parentMessageSnap.get("isAssessed") ?? false
        const votedTimestamp = doc.get("votedTimestamp") ?? null
        const createdTimestamp = doc.get("createdTimestamp") ?? null

        // You may adjust what you return based on your needs
        return {
          votedTimestamp,
          createdTimestamp,
          isAccurate,
          isAssessed,
          instanceCount,
        }
      })
      .catch((error) => {
        logger.error(`Error fetching data for vote request ${doc.id}: ${error}`)
        return null // Handle errors as appropriate for your use case
      })
  })

  // Wait for all fetches to complete
  const results = await Promise.all(fetchDataPromises)
  //calculate accuracy
  const accurateCount = results.filter(
    (d) => d !== null && d.isAssessed && d.isAccurate
  ).length
  const totalAssessedAndNonUnsureCount = results.filter(
    (d) => d !== null && d.isAssessed && d.isAccurate !== null
  ).length
  const totalCount = results.filter((d) => d !== null).length
  //calculate people helped
  const peopleHelped = results.reduce(
    (acc, d) => acc + (d !== null ? d.instanceCount : 0),
    0
  )
  //calculate average response time, given data has a createdTimestamp and a votedTimestamp
  const totalResponseTime = results.reduce((acc, d) => {
    if (d === null) {
      return acc
    }
    if (d.createdTimestamp && d.votedTimestamp) {
      const responseTimeMinutes =
        (d.votedTimestamp.toMillis() - d.createdTimestamp.toMillis()) / 60000
      return acc + responseTimeMinutes
    }
    return acc
  }, 0)
  const averageResponseTime = totalResponseTime / (totalCount || 1)

  const accuracyRate =
    totalAssessedAndNonUnsureCount === 0
      ? null
      : accurateCount / totalAssessedAndNonUnsureCount

  return {
    totalVoted,
    accuracyRate,
    averageResponseTime,
    peopleHelped,
  }
}

function areTagsEqual(
  tags1: { [key: string]: boolean },
  tags2: { [key: string]: boolean }
): boolean {
  const getTrueKeys = (tags: { [key: string]: boolean }) =>
    new Set(Object.keys(tags).filter((key) => tags[key]))

  const set1 = getTrueKeys(tags1)
  const set2 = getTrueKeys(tags2)

  if (set1.size !== set2.size) {
    return false
  }

  for (const key of set1) {
    if (!set2.has(key)) {
      return false
    }
  }

  return true
}

export {
  checkAccuracy,
  computeGamificationScore,
  getFullLeaderboard,
  computeTimeTakenMinutes,
  tabulateVoteStats,
  computeLast30DaysStats,
  computeProgramStats,
  areTagsEqual,
}

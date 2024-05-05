import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { LeaderboardEntry } from "../../types"

function checkAccuracy(
  parentMessageSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  voteRequestSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>
) {
  const isLegacy = voteRequestSnap.get("truthScore") === undefined
  const isParentMessageAssessed = parentMessageSnap.get("isAssessed") ?? false
  const parentMessageCategory = parentMessageSnap.get("primaryCategory") ?? null
  const parentMessageTruthScore = isLegacy
    ? parentMessageSnap.get("legacyTruthScore") ?? null
    : parentMessageSnap.get("truthScore") ?? null
  const voteRequestCategory = voteRequestSnap.get("category") ?? null
  const voteRequestTruthScore = isLegacy
    ? voteRequestSnap.get("vote") ?? null
    : voteRequestSnap.get("truthScore") ?? null
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
    return parentMessageCategory === voteRequestCategory
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

export {
  checkAccuracy,
  computeGamificationScore,
  getFullLeaderboard,
  computeTimeTakenMinutes,
  tabulateVoteStats,
}

import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

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

export { checkAccuracy }

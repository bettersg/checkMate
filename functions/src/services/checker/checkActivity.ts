import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"
import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
export async function checkCheckerActivity(
  checkerDocSnap: admin.firestore.DocumentSnapshot,
  durationInSeconds: number = 259200 //3 days in seconds
) {
  try {
    if (durationInSeconds < 86400 * 2) {
      logger.warn("Duration must be at least 2 days")
      return ServiceResponse.success({
        message: "Checker is active",
        isActive: true,
      })
    }
    const lastVotedTimestamp =
      checkerDocSnap.get("lastVotedTimestamp") ??
      Timestamp.fromDate(new Date(0))
    const onboardingTimestamp =
      checkerDocSnap.get("onboardingTime") ?? Timestamp.fromDate(new Date(0))
    const lastActivatedTimestamp =
      checkerDocSnap.get("lastActivatedDate") ?? Timestamp.fromDate(new Date(0))
    const factCheckerDocRef = checkerDocSnap.ref
    const onboardingDate = onboardingTimestamp.toDate()
    const lastActivatedDate = lastActivatedTimestamp.toDate()
    const lastVotedDate = lastVotedTimestamp.toDate()

    //set cutoff to 10 days ago
    const cutoffDate = new Date(Date.now() - durationInSeconds * 1000)
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate)
    const voteRequestsQuerySnap = await db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", factCheckerDocRef)
      .where("createdTimestamp", ">", cutoffTimestamp)
      .get()

    //set grace period of 2 days. we won't deactivate until 2 days has passed for any given message
    const gracePeriodInSeconds = 86400 * 2

    // Determine if any vote requests are overdue
    let hasOverdueVoteRequests = false
    voteRequestsQuerySnap.forEach((doc) => {
      const createdTimestamp =
        doc.get("createdTimestamp") ?? Timestamp.fromDate(new Date(0))
      const ageInSeconds = Timestamp.now().seconds - createdTimestamp.seconds
      if (ageInSeconds > gracePeriodInSeconds) {
        hasOverdueVoteRequests = true
      }
    })
    const isActive =
      voteRequestsQuerySnap.empty ||
      lastVotedDate > cutoffDate ||
      onboardingDate > cutoffDate ||
      lastActivatedDate > cutoffDate ||
      !hasOverdueVoteRequests
    return ServiceResponse.success({
      message: "Checker is active",
      isActive: isActive,
    })
  } catch (error) {
    logger.error("Error in checkActivity", error)
    return ServiceResponse.error("Error in checkActivity")
  }
}

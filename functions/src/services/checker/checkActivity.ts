import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { ServiceResponse } from "../../infrastructure/responseDefinitions/serviceResponse"
import { Timestamp } from "firebase-admin/firestore"
import { TIME } from "../../utils/time"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
export async function checkCheckerActivity(
  checkerDocSnap: admin.firestore.DocumentSnapshot,
  durationInSeconds: number = 259200 //3 days in seconds
) {
  try {
    const lastVotedTimestamp =
      checkerDocSnap.get("lastVotedTimestamp") ??
      Timestamp.fromDate(new Date(0))
    const factCheckerDocRef = checkerDocSnap.ref
    const lastVotedDate = lastVotedTimestamp.toDate()
    //set cutoff to 10 days ago
    const cutoffDate = new Date(Date.now() - durationInSeconds * 1000)
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate)
    const voteRequestsQuerySnap = await db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", factCheckerDocRef)
      .where("createdTimestamp", ">", cutoffTimestamp)
      .get()
    const isActive = voteRequestsQuerySnap.empty || lastVotedDate > cutoffDate
    return ServiceResponse.success({
      message: "Checker is active",
      isActive: isActive,
    })
  } catch {
    logger.error("Error in checkActivity")
    return ServiceResponse.error("Error in checkActivity")
  }
}

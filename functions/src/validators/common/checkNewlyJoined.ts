import { DocumentSnapshot } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

export function checkNewlyJoined(
  userSnap: DocumentSnapshot,
  messageTimestamp: Timestamp
) {
  try {
    const firstMessageReceiptTime = userSnap.get("firstMessageReceiptTime")
    return messageTimestamp.seconds - firstMessageReceiptTime.seconds < 86400
  } catch {
    throw new Error("Error checking if user is newly joined")
  }
}

import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

export async function referralHandler(userSnap: admin.firestore.DocumentData) {
  let isOrganic = false
  let updateObj
  const joinTimestamp = userSnap.get("firstMessageReceiptTime") as Timestamp
  //subtract 1 second from join timestamp to make sure its reasonable
  const referenceTimestamp = Timestamp.fromMillis(
    joinTimestamp.toMillis() - 1000
  )
  //find latest preceding referral click
  const referralClickQuery = db
    .collection("referralClicks")
    .where("timestamp", "<", referenceTimestamp)
    .orderBy("timestamp", "desc")
    .limit(1)

  const referralClickQuerySnap = await referralClickQuery.get()
  if (referralClickQuerySnap.empty) {
    isOrganic = true
  } else {
    const clickTimestamp = referralClickQuerySnap.docs[0].get("timestamp")
    const clickTime = clickTimestamp.toMillis()
    const joinTime = joinTimestamp.toMillis()
    //click if join time is less than 30 seconds after click time
    if (joinTime - clickTime > 30000) {
      isOrganic = true
    }
  }
  if (isOrganic) {
    await userSnap.ref.update({
      utm: {
        source: "organic",
        medium: "none",
        content: "none",
        campaign: "none",
        term: "none",
      },
    })
  } else {
    const referralClickSnap = referralClickQuerySnap.docs[0]
    await userSnap.ref.update({
      utm: {
        source: referralClickSnap.get("utmSource") ?? "none",
        medium: referralClickSnap.get("utmMedium") ?? "none",
        content: referralClickSnap.get("utmContent") ?? "none",
        campaign: referralClickSnap.get("utmCampaign") ?? "none",
        term: referralClickSnap.get("utmTerm") ?? "none",
      },
    })
    await referralClickSnap.ref.update({
      isConverted: true,
    })
  }
}

import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
import { getUserSnapshot } from "../common/userManagement"
import { incrementCheckerCounts } from "../../definitions/common/counters"
import { FieldValue } from "@google-cloud/firestore"
import Hashids from "hashids"
if (!admin.apps.length) {
  admin.initializeApp()
}

const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)

const db = admin.firestore()

export async function referralHandler(userSnap: admin.firestore.DocumentData) {
  let isOrganic = false
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
    //we're linking to a referral click
    const referralClickSnap = referralClickQuerySnap.docs[0]
    const referralId = referralClickSnap.get("referralId")
    if (!referralId) {
      logger.error(
        `Referral click ${referralClickSnap.id} has no referralId, cannot update user`
      )
      return
    }
    if (referralId === "add") {
      //if it's a common referral link
      await userSnap.ref.update({
        utm: {
          source: referralClickSnap.get("utmSource") ?? "none",
          medium: referralClickSnap.get("utmMedium") ?? "none",
          content: referralClickSnap.get("utmContent") ?? "none",
          campaign: referralClickSnap.get("utmCampaign") ?? "none",
          term: referralClickSnap.get("utmTerm") ?? "none",
        },
      })
    } else {
      //if it's a user-specific referral link
      //try to get the userId from the referralId
      let referrer
      try {
        referrer = String(hashids.decode(referralId)[0])
      } catch (error) {
        logger.error(
          `Error decoding referral code ${referralId}, sent by ${userSnap.get(
            "whatsappId"
          )}: ${error}`
        )
      }
      if (referrer) {
        const referrerSnap = await getUserSnapshot(referrer)
        if (referrerSnap !== null) {
          await referrerSnap.ref.update({
            referralCount: FieldValue.increment(1),
          })
          //check if referrer is a checker
          await incrementCheckerCounts(referrer, "numReferred", 1)
          await userSnap.ref.update({
            firstMessageType: "prepopulated",
            utm: {
              source: referrer,
              medium: "uniqueLink",
              content: "none",
              campaign: "none",
              term: "none",
            },
          })
        } else {
          logger.error(`Referrer ${referrer} not found in users collection`)
        }
      }
    }
    await referralClickSnap.ref.update({
      isConverted: true,
    })
  }
}

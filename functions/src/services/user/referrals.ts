import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { getUserSnapshot } from "./userManagement"
import { incrementCheckerCounts } from "../../definitions/common/counters"
import { FieldValue } from "@google-cloud/firestore"
import { normalizeSpaces } from "../../definitions/common/utils"
import { ResponseObject } from "../../definitions/common/responseUtils"
import { checkTemplate } from "../../validators/whatsapp/checkWhatsappText"
import { UserData } from "../../types"

import Hashids from "hashids"
if (!admin.apps.length) {
  admin.initializeApp()
}

const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)

const db = admin.firestore()

async function referralHandler(
  userSnap: admin.firestore.DocumentData,
  message: string,
  from: string
) {
  const code = message.split("\n")[0].split(": ")[1].split(" ")[0]
  if (userSnap.get("firstMessageType") == "prepopulated") {
    return
  }
  const userRef = userSnap.ref
  if (code.length > 0) {
    const referralClickRef = db.collection("referralClicks").doc(code)
    const referralClickSnap = await referralClickRef.get()
    if (referralClickSnap.exists) {
      const referralId = referralClickSnap.get("referralId")
      if (referralId === "add") {
        const updateObj: Partial<UserData> = {
          firstMessageType: "prepopulated",
          utm: {
            source: referralClickSnap.get("utmSource") ?? "none",
            medium: referralClickSnap.get("utmMedium") ?? "none",
            content: referralClickSnap.get("utmContent") ?? "none",
            campaign: referralClickSnap.get("utmCampaign") ?? "none",
            term: referralClickSnap.get("utmTerm") ?? "none",
          },
        }
        await userRef.update(updateObj)
      } else {
        //try to get the userId from the referralId
        let referrer
        try {
          referrer = String(hashids.decode(referralId)[0])
        } catch (error) {
          logger.error(
            `Error decoding referral code ${code}, sent by ${from}: ${error}`
          )
        }
        if (referrer) {
          const referralSourceSnap = await getUserSnapshot(referrer)
          if (referralSourceSnap !== null) {
            await referralSourceSnap.ref.update({
              referralCount: FieldValue.increment(1),
            })
            //check if referrer is a checker
            await incrementCheckerCounts(referrer, "numReferred", 1)
            await userRef.update({
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
      await referralClickRef.update({
        isConverted: true,
      })
    } else {
      logger.error("Referral code not found in referralClicks collection")
    }
  }
}

export function checkPrepopulatedMessage(
  responses: ResponseObject,
  messageText: string
) {
  const textNormalised = normalizeSpaces(messageText).toLowerCase()
  if (
    checkTemplate(
      textNormalised,
      responses?.REFERRAL_PREPOPULATED_PREFIX.toLowerCase()
    ) ||
    checkTemplate(
      textNormalised,
      responses?.REFERRAL_PREPOPULATED_PREFIX_1.toLowerCase()
    ) ||
    messageText == "Show me how to use CheckMate"
  ) {
    return true
  }
  return false
}

export function checkBetaMessage( //TODO: Remove after BETA
  responses: ResponseObject,
  messageText: string
) {
  const textNormalised = normalizeSpaces(messageText).toLowerCase()
  if (
    checkTemplate(
      textNormalised,
      responses?.BETA_PREPOPULATED_PREFIX.toLowerCase()
    )
  ) {
    return true
  }
  return false
}

export { referralHandler }

import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
import { getUserSnapshot } from "./userManagement"
import { incrementCheckerCounts } from "../../definitions/common/counters"
import { FieldValue } from "@google-cloud/firestore"
import { normalizeSpaces, checkPreV2User } from "../../definitions/common/utils"
import {
  getResponsesObj,
  ResponseObject,
} from "../../definitions/common/responseUtils"
import { checkTemplate } from "../../validators/whatsapp/checkWhatsappText"
import { WhatsappMessageObject, UserData } from "../../types"

import Hashids from "hashids"
if (!admin.apps.length) {
  admin.initializeApp()
}

const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)

const db = admin.firestore()

// export async function referralHandler(userSnap: admin.firestore.DocumentData) {
//   let isOrganic = false
//   const joinTimestamp = userSnap.get("firstMessageReceiptTime") as Timestamp
//   //subtract 1 second from join timestamp to make sure its reasonable
//   const referenceTimestamp = Timestamp.fromMillis(
//     joinTimestamp.toMillis() - 1000
//   )
//   //find latest preceding referral click
//   const referralClickQuery = db
//     .collection("referralClicks")
//     .where("timestamp", "<", referenceTimestamp)
//     .orderBy("timestamp", "desc")
//     .limit(1)

//   const referralClickQuerySnap = await referralClickQuery.get()
//   if (referralClickQuerySnap.empty) {
//     isOrganic = true
//   } else {
//     const clickTimestamp = referralClickQuerySnap.docs[0].get("timestamp")
//     const clickTime = clickTimestamp.toMillis()
//     const joinTime = joinTimestamp.toMillis()
//     //click if join time is less than 30 seconds after click time
//     if (joinTime - clickTime > 30000) {
//       isOrganic = true
//     }
//   }
//   if (isOrganic) {
//     await userSnap.ref.update({
//       utm: {
//         source: "organic",
//         medium: "none",
//         content: "none",
//         campaign: "none",
//         term: "none",
//       },
//     })
//   } else {
//     //we're linking to a referral click
//     const referralClickSnap = referralClickQuerySnap.docs[0]
//     const referralId = referralClickSnap.get("referralId")
//     if (!referralId) {
//       logger.error(
//         `Referral click ${referralClickSnap.id} has no referralId, cannot update user`
//       )
//       return
//     }
//     if (referralId === "add") {
//       //if it's a common referral link
//       await userSnap.ref.update({
//         utm: {
//           source: referralClickSnap.get("utmSource") ?? "none",
//           medium: referralClickSnap.get("utmMedium") ?? "none",
//           content: referralClickSnap.get("utmContent") ?? "none",
//           campaign: referralClickSnap.get("utmCampaign") ?? "none",
//           term: referralClickSnap.get("utmTerm") ?? "none",
//         },
//       })
//     } else {
//       //if it's a user-specific referral link
//       //try to get the userId from the referralId
//       let referrer
//       try {
//         referrer = String(hashids.decode(referralId)[0])
//       } catch (error) {
//         logger.error(
//           `Error decoding referral code ${referralId}, sent by ${userSnap.get(
//             "whatsappId"
//           )}: ${error}`
//         )
//       }
//       if (referrer) {
//         const referrerSnap = await getUserSnapshot(referrer)
//         if (referrerSnap !== null) {
//           await referrerSnap.ref.update({
//             referralCount: FieldValue.increment(1),
//           })
//           //check if referrer is a checker
//           await incrementCheckerCounts(referrer, "numReferred", 1)
//           await userSnap.ref.update({
//             firstMessageType: "prepopulated",
//             utm: {
//               source: referrer,
//               medium: "uniqueLink",
//               content: "none",
//               campaign: "none",
//               term: "none",
//             },
//           })
//         } else {
//           logger.error(`Referrer ${referrer} not found in users collection`)
//         }
//       }
//     }
//     await referralClickSnap.ref.update({
//       isConverted: true,
//     })
//   }
// }

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
        if (referralClickSnap.get("utmCampaign") === "v2beta") {
          updateObj.isTester = true
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

export async function handlePreOnboardedMessage(
  userSnap: admin.firestore.DocumentSnapshot,
  message: WhatsappMessageObject
) {
  let step
  if (message.type === "text") {
    step = "preonboard_text_normal"
    const responses = await getResponsesObj("user", "en")
    if (checkPrepopulatedMessage(responses, message.text?.body)) {
      step = "preonboard_text_prepopulated"
      await referralHandler(
        userSnap,
        message.text?.body,
        userSnap.get("whatsappId")
      )
    }
  } else {
    step = `preonboard_${message.type}`
  }
  const messageTimestamp = new Timestamp(Number(message.timestamp), 0)
  const timestampKey =
    messageTimestamp.toDate().toISOString().slice(0, -5) + "Z"
  if (checkPreV2User(userSnap)) {
    return
  }
  await userSnap.ref.update({
    [`initialJourney.${timestampKey}`]: step,
  })
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
    )
  ) {
    return true
  }
  return false
}

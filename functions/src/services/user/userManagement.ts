import * as admin from "firebase-admin"
import Hashids from "hashids"
import { Timestamp } from "firebase-admin/firestore"
import { UserData } from "../../types"
import { logger } from "firebase-functions/v2"
import { getThresholds } from "../../definitions/common/utils"
const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

export async function checkUserExists(
  userId: string,
  platform: string = ""
): Promise<boolean> {
  const userSnap = await getUserSnapshot(userId, platform)
  return userSnap !== null
}

export async function createNewUser(
  userId: string,
  source: string,
  creationTimestamp: Timestamp
): Promise<admin.firestore.DocumentReference | null> {
  // const id = userRef.id
  const id = userId
  const referralId = hashids.encode(id)
  let ids
  switch (source) {
    case "telegram":
      ids = {
        telegramId: userId,
        whatsappId: null,
        emailId: null,
      }
      break
    case "email":
      ids = {
        emailId: userId,
        telegramId: null,
        whatsappId: null,
      }
      break
    case "whatsapp":
      ids = {
        whatsappId: userId,
        telegramId: null,
        emailId: null,
      }
      break

    default:
      logger.error("Unknown source!")
      return null
  }

  const thresholds = await getThresholds()

  const newUserObject: UserData = {
    ...ids,
    instanceCount: 0,
    firstMessageReceiptTime: creationTimestamp,
    firstMessageType: "normal", //TODO update
    lastSent: null,
    satisfactionSurveyLastSent: null,
    initialJourney: {},
    referralId: referralId,
    utm: {
      source: "direct",
      medium: "none",
      content: "none",
      campaign: "none",
      term: "none",
    },
    referralCount: 0,
    language: "en",
    isReferralMessageSent: false,
    isReminderMessageSent: false,
    isSubscribedUpdates: true,
    isIgnored: false,
    ageGroup: null,
    isOnboardingComplete: false,
    isInterestedInSubscription: null,
    isInterestedAtALowerPoint: null,
    interestedFor: null,
    priceWhereInterested: null,
    feedback: null,
    tier: "free",
    numSubmissionsRemaining: thresholds.freeTierMonthlyLimit ?? 5,
    monthlySubmissionLimit: thresholds.freeTierMonthlyLimit ?? 5,
  }
  try {
    const res = await db.collection("users").add(newUserObject)
    return res
  } catch (error) {
    logger.error("Error adding new user: ", error)
    return null
  }
}

export async function getUserSnapshot(
  userId: string,
  platform: string = ""
): Promise<admin.firestore.DocumentSnapshot | null> {
  const platforms = ["whatsapp"] //TODO: add telegram and email eventually
  if (platforms.includes(platform)) {
    const userSnap = await db
      .collection("users")
      .where(`${platform}Id`, "==", userId)
      .get()
    if (!userSnap.empty) {
      return userSnap.docs[0]
    }
  } else if (platform === "") {
    //loop through platforms, do a search, if found return the user
    for (let platform of platforms) {
      const userSnap = await db
        .collection("users")
        .where(`${platform}Id`, "==", userId)
        .get()
      if (!userSnap.empty) {
        return userSnap.docs[0]
      }
    }
  } else {
    logger.error(`Unknown platform: ${platform} for userId ${userId}`)
  }
  return null
}

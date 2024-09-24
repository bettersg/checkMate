import * as admin from "firebase-admin"
import Hashids from "hashids"
import { Timestamp } from "firebase-admin/firestore"
import { UserData } from "../../types"
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
      console.error("Unknown source!")
      return null
  }

  const newUserObject: UserData = {
    ...ids,
    instanceCount: 0,
    firstMessageReceiptTime: creationTimestamp,
    firstMessageType: "normal",
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
  }
  try {
    const res = await db.collection("users").add(newUserObject)
    console.log("New user added successfully!")
    return res
  } catch (error) {
    console.error("Error adding new user: ", error)
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
    console.error(`Unknown platform: ${platform} for userId ${userId}`)
  }
  return null
}
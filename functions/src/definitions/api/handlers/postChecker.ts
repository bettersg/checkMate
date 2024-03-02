import { Request, Response } from "express"
import { createChecker } from "../interfaces"
import { Checker } from "../../../types"
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const postCheckerHandler = async (req: Request, res: Response) => {
  //check request body
  const {
    name,
    type,
    isActive,
    isOnboardingComplete,
    singpassOpenId,
    telegramId,
    whatsappId,
    level,
    experience,
    numVoted,
    numCorrectVotes,
    numVerifiedLinks,
    preferredPlatform,
    lastVotedTimestamp,
  } = req.body as createChecker
  if (!name || !type || (!telegramId && telegramId !== null)) {
    return res.status(400).send("Name, type, and telegramId are required")
  }
  if (type === "ai") {
    //check if name already exists:
    const checkersRef = db.collection("checkers")
    const checkersSnap = await checkersRef
      .where("type", "==", type)
      .where("name", "==", name)
      .get()
    if (!checkersSnap.empty) {
      return res.status(409).send("Checker agent name already exists")
    }
  }
  const newChecker: Checker = {
    name,
    type,
    isActive: isActive || false,
    isOnboardingComplete: isOnboardingComplete || false,
    singpassOpenId: singpassOpenId || null,
    telegramId,
    whatsappId: whatsappId || null,
    voteWeight: 1,
    level: level || 0,
    experience: experience || 0,
    numVoted: numVoted || 0,
    numCorrectVotes: numCorrectVotes || 0,
    numVerifiedLinks: numVerifiedLinks || 0,
    preferredPlatform: preferredPlatform || type === "ai" ? null : "telegram",
    lastVotedTimestamp: lastVotedTimestamp || null,
    getNameMessageId: null,
  }
  //create new factChecker in message
  const ref = await db.collection("checkers").add(newChecker)
  return res.status(200).send({
    success: true,
    factCheckerPath: ref.path,
  })
}

export default postCheckerHandler

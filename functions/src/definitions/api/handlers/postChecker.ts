import { Request, Response } from "express"
import { createChecker } from "../interfaces"
import { CheckerData } from "../../../types"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
import { getThresholds } from "../../common/utils"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const postCheckerHandler = async (req: Request, res: Response) => {
  // Check request body
  const {
    name,
    telegramUsername,
    type,
    isActive,
    isOnboardingComplete,
    isQuizComplete,
    quizScore,
    singpassOpenId,
    telegramId,
    whatsappId,
    level,
    experience,
    numVoted,
    numReferred,
    numReported,
    numCorrectVotes,
    numNonUnsureVotes,
    numVerifiedLinks,
    preferredPlatform,
    lastVotedTimestamp,
  } = req.body as createChecker
  logger.info("ENTERED")

  if (!name || !type || (!telegramId && telegramId !== null)) {
    return res.status(400).send("Name, type, and telegramId are required")
  }
  if (type === "ai") {
    // Check if name already exists
    const checkersRef = db.collection("checkers")
    const checkersSnap = await checkersRef
      .where("type", "==", type)
      .where("name", "==", name)
      .get()
    if (!checkersSnap.empty) {
      return res.status(409).send("Checker agent name already exists")
    }
  }

  const thresholds = await getThresholds()

  const newChecker: CheckerData = {
    name,
    telegramUsername,
    type,
    isActive: isActive || false,
    lastActivatedDate: isActive ? Timestamp.now() : null,
    isOnboardingComplete: isOnboardingComplete || false,
    onboardingTime: isOnboardingComplete ? Timestamp.now() : null,
    isQuizComplete: isQuizComplete || false,
    quizScore: quizScore || null,
    onboardingStatus: "name",
    lastTrackedMessageId: null,
    isAdmin: false,
    singpassOpenId: singpassOpenId || null,
    telegramId,
    whatsappId: whatsappId || null,
    voteWeight: 1,
    level: level || 0,
    experience: experience || 0,
    tier: "beginner",
    numVoted: numVoted || 0,
    numReferred: numReferred || 0,
    numReported: numReported || 0,
    numCorrectVotes: numCorrectVotes || 0,
    numNonUnsureVotes: numNonUnsureVotes || 0,
    numVerifiedLinks: numVerifiedLinks || 0,
    preferredPlatform: preferredPlatform || (type === "ai" ? null : "telegram"),
    lastVotedTimestamp: lastVotedTimestamp || null,
    getNameMessageId: null,
    hasCompletedProgram: false,
    certificateUrl: null,
    leaderboardStats: {
      numVoted: 0,
      numCorrectVotes: 0,
      totalTimeTaken: 0,
      score: 0,
    },
    programData: {
      isOnProgram: type === "human" ? true : false,
      programStart: type === "human" ? Timestamp.fromDate(new Date()) : null,
      programEnd: null,
      numVotesTarget: thresholds.volunteerProgramVotesRequirement ?? 0, // Target number of messages voted on to complete program
      numReferralTarget: thresholds.volunteerProgramReferralRequirement ?? 0, // Target number of referrals made to complete program
      numReportTarget: thresholds.volunteerProgramReportRequirement ?? 0, // Number of non-trivial messages sent in to complete program
      accuracyTarget: thresholds.volunteerProgramAccuracyRequirement ?? 0, // Target accuracy of non-unsure votes
      numVotesAtProgramStart: 0,
      numReferralsAtProgramStart: 0,
      numReportsAtProgramStart: 0,
      numCorrectVotesAtProgramStart: 0,
      numNonUnsureVotesAtProgramStart: 0,
      numVotesAtProgramEnd: null,
      numReferralsAtProgramEnd: null,
      numReportsAtProgramEnd: null,
      numCorrectVotesAtProgramEnd: null,
      numNonUnsureVotesAtProgramEnd: null,
    },
    offboardingTime: null,
  }

  logger.info("Creating new checker", newChecker)

  // Create new factChecker in message
  const ref = await db.collection("checkers").add(newChecker)
  return res.status(200).send({
    success: true,
    factCheckerPath: ref.path,
  })
}

export default postCheckerHandler

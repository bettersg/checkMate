import { Request, Response } from "express"
import { CheckerData } from "../../../types"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
import { getThresholds } from "../../common/utils"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const patchCheckerHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId
    //TODO: GET RETURN FIELDS FROM FIRESTORE
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }

    const checkerRef = db.collection("checkers").doc(checkerId)
    const checkerSnap = await checkerRef.get()

    if (!checkerSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`)
    }

    //check keys in request body, make sure they are defined in checker type
    const body = req.body
    const keys = Object.keys(body)
    const checker = checkerSnap.data() as CheckerData
    const checkerKeys = Object.keys(checker)
    const validKeys = keys.every((key) => checkerKeys.includes(key))

    if (!validKeys) {
      return res.status(400).send("Invalid keys in request body")
    }

    if (keys.includes("whatsappId")) {
      return res.status(400).send("whatsappId cannot be updated")
    }

    if (keys.includes("telegramId")) {
      return res.status(400).send("telegramId cannot be updated")
    }

    if (keys.includes("isAdmin")) {
      return res.status(400).send("isAdmin cannot be updated")
    }

    if (keys.includes("tier")) {
      return res.status(400).send("tier cannot be updated")
    }

    if (keys.includes("programData")) {
      if (
        typeof body.programData === "string" &&
        (body.programData === "reset" || body.programData === "complete")
      ) {
        if (body.programData === "reset") {
          const thresholds = await getThresholds()
          body.programData = {
            isOnProgram: true,
            programStart: Timestamp.fromDate(new Date()),
            programEnd: null,
            numVotesTarget: thresholds.volunteerProgramVotesRequirement ?? 0, //target number of messages voted on to complete program
            numReferralTarget:
              thresholds.volunteerProgramReferralRequirement ?? 0, //target number of referrals made to complete program
            numReportTarget: thresholds.volunteerProgramReportRequirement ?? 0, //number of non-trivial messages sent in to complete program
            accuracyTarget: thresholds.volunteerProgramAccuracyRequirement ?? 0, //target accuracy of non-unsure votes
            numVotesAtProgramStart: checker.numVoted ?? 0,
            numReferralsAtProgramStart: checker.numReferred ?? 0,
            numReportsAtProgramStart: checker.numReported ?? 0,
            numCorrectVotesAtProgramStart: checker.numCorrectVotes ?? 0,
            numNonUnsureVotesAtProgramStart: checker.numNonUnsureVotes ?? 0,
            numVotesAtProgramEnd: null,
            numReferralsAtProgramEnd: null,
            numReportsAtProgramEnd: null,
            numCorrectVotesAtProgramEnd: null,
            numNonUnsureVotesAtProgramEnd: null,
          }
        } else if (body.programData === "complete") {
          //delete programdata from body
          delete body.programData
          body["programData.isOnProgram"] = false
        }
      } else {
        return res
          .status(400)
          .send(
            "programData will only work with the value 'reset' or 'complete'"
          )
      }
    }

    //update checker
    await checkerRef.update(body)

    const updatedCheckerSnap = await checkerRef.get()
    const updatedChecker = updatedCheckerSnap.data() as CheckerData

    res.status(200).send(updatedChecker)
  } catch (error) {
    logger.error("Error getting checker", error)
    res.status(500).send("Error getting checker")
  }
}

export default patchCheckerHandler

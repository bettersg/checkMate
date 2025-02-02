import { Request, Response } from "express"
import { createVoteRequest } from "../interfaces"
import {
  Timestamp,
  DocumentReference,
  DocumentSnapshot,
} from "firebase-admin/firestore"
import { VoteRequest } from "../../../types"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const postVoteRequestHandler = async (req: Request, res: Response) => {
  //get messageId
  const messageId = req.params.messageId
  if (!messageId) {
    res.status(400).send("MessageId is required")
    return
  }
  //confirm factCheckerId in body
  const { factCheckerId, factCheckerName } = req.body as createVoteRequest
  if (!factCheckerId && !factCheckerName) {
    return res
      .status(400)
      .send("One of factCheckerId or factCheckerName is required in body")
  }
  if (factCheckerId && factCheckerName) {
    return res
      .status(400)
      .send("Only one of factCheckerId or factCheckerName should be passed")
  }
  //check if message exists in firestore
  const messageRef = db.collection("messages").doc(messageId)
  const messageSnap = await messageRef.get()
  if (!messageSnap.exists) {
    return res.status(404).send("Message not found")
  }
  //check if factChecker exists in firestore
  let factCheckerRef: DocumentReference
  let factCheckerSnap: DocumentSnapshot
  if (factCheckerId) {
    factCheckerRef = db.collection("checkers").doc(factCheckerId)
    factCheckerSnap = await factCheckerRef.get()
    if (!factCheckerSnap.exists) {
      return res.status(404).send("factChecker not found")
    }
  } else {
    const factCheckerQuerySnap = await db
      .collection("checkers")
      .where("type", "==", "ai")
      .where("name", "==", factCheckerName)
      .get()
    if (factCheckerQuerySnap.empty) {
      return res
        .status(404)
        .send(
          "ai factChecker of this name not found. if you are intending to create a voteRequest for a human factChecker, please pass the factCheckerId instead"
        )
    }
    if (factCheckerQuerySnap.size > 1) {
      functions.logger.warn(
        `Multiple ai factCheckers with name ${factCheckerName} found`
      )
      return res.status(400).send("Multiple ai factCheckers found")
    }
    factCheckerRef = factCheckerQuerySnap.docs[0].ref
    factCheckerSnap = factCheckerQuerySnap.docs[0]
  }
  const newVoteRequest: VoteRequest = {
    factCheckerDocRef: factCheckerRef,
    platformId: factCheckerSnap.get("whatsappId") ?? null,
    hasAgreed: null,
    triggerL2Vote: null,
    triggerL2Others: null,
    platform: "agent",
    sentMessageId: null,
    category: null,
    isAutoPassed: false,
    truthScore: null,
    numberPointScale: 6,
    reasoning: null,
    tags: {},
    communityNoteCategory: null,
    createdTimestamp: Timestamp.fromDate(new Date()),
    acceptedTimestamp: Timestamp.fromDate(new Date()),
    votedTimestamp: null,
    isCorrect: null,
    score: null,
    duration: null,
  }

  //create new voteRequest in message
  const ref = await messageRef.collection("voteRequests").add(newVoteRequest)

  //create return object
  const returnObj = {
    success: true,
    voteRequestPath: ref.path,
  }
  return res.status(200).send(returnObj)
}

export default postVoteRequestHandler

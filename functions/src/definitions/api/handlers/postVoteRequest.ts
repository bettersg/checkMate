import { Request, Response } from "express"
import { createVoteRequest } from "../interfaces"
import { Timestamp } from "firebase-admin/firestore"
import { VoteRequest } from "../../../types"
import * as admin from "firebase-admin"

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
  const { factCheckerId } = req.body as createVoteRequest
  if (!factCheckerId) {
    return res.status(400).send("FactCheckerId is required in body")
  }
  //check if message exists in firestore
  const messageRef = db.collection("messages").doc(messageId)
  const messageSnap = await messageRef.get()
  if (!messageSnap.exists) {
    return res.status(404).send("Message not found")
  }
  //check if factChecker exists in firestore
  const factCheckerRef = db.collection("checkers").doc(factCheckerId)
  const factCheckerSnap = await factCheckerRef.get()
  if (!factCheckerSnap.exists) {
    return res.status(404).send("factChecker not found")
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
    vote: null,
    createdTimestamp: Timestamp.fromDate(new Date()),
    acceptedTimestamp: Timestamp.fromDate(new Date()),
    votedTimestamp: null,
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

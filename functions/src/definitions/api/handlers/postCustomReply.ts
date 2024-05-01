import { Request, Response } from "express"
import { upsertCustomReply } from "../interfaces"
import {
  Timestamp,
  DocumentReference,
  DocumentSnapshot,
} from "firebase-admin/firestore"
import { CustomReply } from "../../../types"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const postCustomReplyHandler = async (req: Request, res: Response) => {
  //get messageId
  const messageId = req.params.messageId
  if (!messageId) {
    res.status(400).send("MessageId is required")
    return
  }
  //confirm customReply in body
  const { customReply } = req.body as upsertCustomReply
  if (!customReply) {
    return res.status(400).send("customReply is required in body")
  }
  //confirm factCheckerId in body
  const { factCheckerId, factCheckerName } = req.body as upsertCustomReply
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
  if (factCheckerSnap.get("tier") !== "expert") {
    return res
      .status(400)
      .send("factChecker must be at expert tier to post custom replies")
  }
  const customReplyObject: CustomReply = {
    type: "text",
    text: customReply,
    caption: null,
    lastUpdatedBy: factCheckerRef,
    lastUpdatedTimestamp: Timestamp.now(),
  }
  messageRef.update({
    customReply: customReplyObject,
  })

  //create return object
  const returnObj = {
    success: true,
  }
  return res.status(200).send(returnObj)
}

export default postCustomReplyHandler

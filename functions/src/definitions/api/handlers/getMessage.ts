import { Request, Response } from "express"
import { MessageSummary } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const getMessageHandler = async (req: Request, res: Response) => {
  //check request body
  //get messageId
  const messageId = req.params.messageId
  if (!messageId) {
    res.status(400).send("MessageId is required")
    return
  }
  //check if message exists in firestore
  const messageRef = db.collection("messages").doc(messageId)
  const messageSnap = await messageRef.get()
  if (!messageSnap.exists) {
    return res.status(404).send("Message not found")
  }
  //check if factChecker exists in firestore

  //create return object
  const returnObj: MessageSummary = {
    primaryCategory: messageSnap.get("primaryCategory"),
    machineCategory: messageSnap.get("machineCategory"),
    truthScore: messageSnap.get("truthScore"),
    instanceCount: messageSnap.get("instanceCount"),
    text: messageSnap.get("text"),
    caption: messageSnap.get("caption"),
    customReply: messageSnap.get("customReply"),
  }
  return res.status(200).send(returnObj)
}

export default getMessageHandler

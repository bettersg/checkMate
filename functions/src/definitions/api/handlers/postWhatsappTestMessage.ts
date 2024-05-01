import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { sendWhatsappTextMessage } from "../../common/sendWhatsappMessage"
import { postWhatsappTestMessage } from "../interfaces"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const postWhatsappTestMessageHandler = async (req: Request, res: Response) => {
  //allows admin to post messages to themselves on whatsapp for testing
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }
    const { message } = req.body as postWhatsappTestMessage
    if (!message) {
      return res.status(400).send("A message is required")
    }
    const checkerDocRef = db.collection("checkers").doc(checkerId)
    const checkerDocSnap = await checkerDocRef.get()
    if (!checkerDocSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`)
    }
    if (!checkerDocSnap.get("isAdmin")) {
      return res.status(403).send("Checker must be admin")
    }
    const whatsappId = checkerDocSnap.get("whatsappId")
    if (!whatsappId) {
      return res.status(400).send("Checker has no whatsappId")
    }
    await sendWhatsappTextMessage("factChecker", whatsappId, message)
    return res.status(200).send("Message sent successfully")
  } catch (error) {
    logger.error(error)
    return res.status(500).send("Internal server error")
  }
}

export default postWhatsappTestMessageHandler

import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { sendOTP } from "../../common/otp"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const postOTPHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }
    const whatsappId = req.body.whatsappId
    if (!whatsappId) {
      return res.status(400).send("whatsappId is required")
    }
    //check if whatsapp id is numeric
    if (isNaN(Number(whatsappId))) {
      return res.status(400).send("whatsappId must be numeric")
    }
    const checkerDocRef = db.collection("checkers").doc(checkerId)
    const checkerDocSnap = await checkerDocRef.get()
    if (!checkerDocSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`)
    }
    const sendOTPStatus = await sendOTP(whatsappId, checkerId)
    if (sendOTPStatus.status === "error") {
      switch (sendOTPStatus.message) {
        case "OTP request limit exceeded":
          return res.status(429).send("OTP request limit exceeded")
        default:
          return res.status(500).send("Internal server error")
      }
    } else {
      return res.status(200).send("OTP sent successfully")
    }
  } catch (error) {
    logger.error(error)
    return res.status(500).send("Internal server error")
  }
}

export default postOTPHandler

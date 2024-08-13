import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { checkOTP } from "../../common/otp"

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()
const checkOTPHandler = async (req: Request, res: Response) => {
  logger.info("Checking OTP...")
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }
    const otp = req.body.otp
    if (!otp) {
      return res.status(400).send("otp is required")
    }

    const checkerRef = db.collection("checkers").doc(checkerId)
    const checkerSnap = await checkerRef.get()
    if (!checkerSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`)
    }

    const checkOTPStatus = await checkOTP(otp, "", checkerId) //still works without whatsappId for this

    if (checkOTPStatus.status === "error") {
      switch (checkOTPStatus.message) {
        case "OTP not found":
          return res.status(404).send("OTP not found")
        case "OTP max attempts":
          return res.status(429).send("Maximum verification attempts reached")
        case "OTP mismatch":
          return res.status(401).send("Invalid OTP")
        case "OTP expired":
          return res.status(401).send("OTP expired")
        case "Missing OTP data at backend":
          return res.status(500).send("Missing OTP data at backend")
        default:
          return res.status(500).send("Internal server error")
      }
    } else {
      return res.status(200).send("OTP verified successfully")
    }
  } catch (error) {
    logger.error(error)
    return res.status(500).send("Internal server error")
  }
}

export default checkOTPHandler

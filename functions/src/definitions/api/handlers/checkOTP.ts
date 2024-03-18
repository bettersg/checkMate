import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()
const checkOTPHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }
    const otp = req.body.otp
    if (!otp) {
      return res.status(400).send("otp is required")
    }
    const otpRef = db.collection("otps").doc(checkerId)
    const otpSnap = await otpRef.get()
    if (!otpSnap.exists) {
      return res.status(404).send("Checker not found")
    }
    const otpData = otpSnap.data()

    const savedOtp = otpData?.otp ?? null
    const expiresAt = otpData?.expiresAt ?? null
    const verificationAttempts = otpData?.verificationAttempts ?? null

    if (
      savedOtp === null ||
      expiresAt === null ||
      verificationAttempts === null
    ) {
      throw new Error("Missing OTP data at backend")
    }

    if (verificationAttempts >= 5) {
      return res.status(429).send("Maximum verification attempts reached")
    }

    if (otp !== savedOtp) {
      await otpRef.update({
        verificationAttempts: verificationAttempts + 1,
      })
      return res.status(401).send("Invalid OTP")
    }

    await otpRef.delete()
    return res.status(200).send("OTP verified successfully")
  } catch (error) {
    logger.error(error)
    return res.status(500).send("Internal server error")
  }
}

export default checkOTPHandler

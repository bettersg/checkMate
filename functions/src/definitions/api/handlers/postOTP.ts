import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { sendWhatsappOTP } from "../../common/sendWhatsappMessage"

import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

function generateOTP() {
  const otp = String(Math.floor(100000 + Math.random() * 900000)) // 6-digit OTP
  const expiresIn = 600000 // OTP expiration time in milliseconds (5 minutes)
  const expiresAt = Date.now() + expiresIn // Calculate the exact expiry time
  return { otp, expiresAt }
}

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
    const otpRef = db.collection("otps").doc(checkerId)
    const otpSnap = await otpRef.get()

    if (otpSnap.exists) {
      const lastRequestedAt = otpSnap?.data()?.lastRequestedAt ?? null
      const requestCount = otpSnap?.data()?.requestCount ?? 0

      if (lastRequestedAt === null || requestCount === null) {
        throw new Error("Invalid OTP data")
      }
      const timeSinceLastRequest =
        Date.now() - lastRequestedAt.toDate().getTime()
      const requestLimit = 3 // Maximum allowed OTP requests
      const requestTimeout = 10 * 60 * 1000 // Timeout period (e.g., 24 hours in milliseconds)
      if (
        timeSinceLastRequest < requestTimeout &&
        requestCount >= requestLimit
      ) {
        logger.warn("OTP request limit exceeded")
        return res.status(429).send("OTP request limit exceeded")
      }
      const newRequestCount =
        timeSinceLastRequest < requestTimeout ? requestCount + 1 : 1
      const { otp, expiresAt } = generateOTP()
      await otpRef.update({
        whatsappId,
        otp,
        expiresAt: Timestamp.fromMillis(expiresAt),
        requestCount: newRequestCount,
        lastRequestedAt: Timestamp.fromDate(new Date()),
        verificationAttempts: 0, // Reset verification attempts for the new OTP
      })
      logger.log(
        `OTP generated for ${checkerId} with whatsappId ${whatsappId} successfully`
      )
      await sendWhatsappOTP("factChecker", whatsappId, otp)
    } else {
      // If no OTP record exists, create a new one
      const { otp, expiresAt } = generateOTP()
      await otpRef.set({
        whatsappId,
        otp,
        expiresAt: Timestamp.fromMillis(expiresAt),
        requestCount: 1,
        lastRequestedAt: Timestamp.fromDate(new Date()),
        verificationAttempts: 0,
      })
      logger.log(
        `OTP generated for ${checkerId} with whatsappId ${whatsappId} successfully`
      )
      await sendWhatsappOTP("factChecker", whatsappId, otp)
    }

    return res.status(200).send("OTP sent successfully")
  } catch (error) {
    logger.error(error)
    return res.status(500).send("Internal server error")
  }
}

export default postOTPHandler

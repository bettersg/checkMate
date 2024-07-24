//TODO TONGYING: Implement webhook here!
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { logger } from "firebase-functions/v2"
import { sendWhatsappOTP } from "../common/sendWhatsappMessage"
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

const postOTPHandler = async (checkerId: string, whatsappId: string) => {
  try {
    const checkerQuerySnap = await db
      .collection("checkers")
      .where("telegramId", "==", checkerId)
      .get()

    if (checkerQuerySnap.empty) {
      logger.error(`Checker with TelegramID ${checkerId} not found`)
      return
    }

    const otpSnap = await db
      .collection("otps")
      .where("whatsappId", "==", whatsappId)
      .get()

    if (!otpSnap.empty) {
      const lastRequestedAt = otpSnap?.docs[0].data()?.lastRequestedAt ?? null
      const requestCount = otpSnap?.docs[0].data()?.requestCount ?? 0

      if (lastRequestedAt === null || requestCount === null) {
        logger.error("Invalid OTP data")
        return
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
        return "OTP request limit exceeded"
      }

      const newRequestCount =
        timeSinceLastRequest < requestTimeout ? requestCount + 1 : 1

      const { otp, expiresAt } = generateOTP()

      await otpSnap?.docs[0].ref.update({
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
      await db.collection("otps").add({
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

    logger.log("OTP sent successfully")
  } catch (error) {
    logger.error(error)
  }
}

const checkOTPHandler = async (
  telegramId: number,
  otp: string,
  whatsappNum: string
) => {
  logger.info("Checking OTP...")

  try {
    const checkerDocQuery = db
      .collection("checkers")
      .where("telegramId", "==", telegramId)
    const checkerQuerySnap = await checkerDocQuery.get()
    if (checkerQuerySnap.empty) {
      logger.error(`Checker with TelegramID ${telegramId} not found`)
      return
    }

    const otpDocQuery = db
      .collection("otps")
      .where("whatsappId", "==", whatsappNum)
    const otpDocSnap = await otpDocQuery.get()

    if (otpDocSnap.empty) {
      logger.error(`OTP not found for checker ${telegramId}`)
      return
    }

    const otpData = otpDocSnap.docs[0].data()
    const whatsappId = otpData?.whatsappId ?? null
    const savedOtp = otpData?.otp ?? null
    const expiresAt = otpData?.expiresAt ?? null
    const verificationAttempts = otpData?.verificationAttempts ?? null

    if (
      savedOtp === null ||
      expiresAt === null ||
      verificationAttempts === null ||
      whatsappId === null
    ) {
      logger.error("Missing OTP data at backend")
      return
    }

    if (verificationAttempts >= 5) {
      logger.warn("Maximum OTP verification attempts reached")
      return "OTP max attempts"
    }

    if (otp !== savedOtp) {
      await otpDocSnap.docs[0].ref.update({
        verificationAttempts: verificationAttempts + 1,
      })
      logger.warn("OTP mismatch")
      return "OTP mismatch"
    }

    await otpDocSnap.docs[0].ref.delete()
    logger.log("OTP verified successfully")
    return "OTP verified"
  } catch (error) {
    logger.error(error)
  }
}

export { postOTPHandler, checkOTPHandler }

import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { logger } from "firebase-functions/v2"
import { sendWhatsappOTP } from "../common/sendWhatsappMessage"
import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

interface OTPData {
  whatsappId: string
  otp: string
  expiresAt: Timestamp
  requestCount: number
  lastRequestedAt: Timestamp
  verificationAttempts: number
}

const REQUEST_LIMIT = parseInt(process.env.REQUEST_LIMIT || "3")
const REQUEST_TIMEOUT =
  parseInt(process.env.REQUEST_TIMEOUT || "600000") || 10 * 60 * 1000
const OTP_EXPIRATION_TIME = parseInt(
  process.env.OTP_EXPIRATION_TIME || "300000"
)

function generateOTP() {
  const otp = String(Math.floor(100000 + Math.random() * 900000)) // 6-digit OTP
  const expiresAt = Date.now() + OTP_EXPIRATION_TIME // Calculate the exact expiry time
  return { otp, expiresAt }
}

async function getCheckerDoc(checkerId: string) {
  const checkerQuerySnap = await db
    .collection("checkers")
    .where("telegramId", "==", parseInt(checkerId))
    .get()

  if (checkerQuerySnap.empty) {
    throw new Error(`Checker with TelegramID ${checkerId} not found`)
  }

  return checkerQuerySnap.docs[0]
}

async function getOTPSnap(whatsappId: string) {
  const otpSnap = await db
    .collection("otps")
    .where("whatsappId", "==", whatsappId)
    .get()

  return otpSnap.empty ? null : otpSnap.docs[0]
}

const postOTPHandler = async (whatsappId: string) => {
  try {
    const otpDoc = await getOTPSnap(whatsappId)
    const { otp, expiresAt } = generateOTP()

    if (otpDoc) {
      const otpData = otpDoc.data() as OTPData
      const timeSinceLastRequest =
        Date.now() - otpData.lastRequestedAt.toDate().getTime()

      if (
        timeSinceLastRequest < REQUEST_TIMEOUT &&
        otpData.requestCount >= REQUEST_LIMIT
      ) {
        logger.warn("OTP request limit exceeded")
        return { status: "error", message: "OTP request limit exceeded" }
      }

      const newRequestCount =
        timeSinceLastRequest < REQUEST_TIMEOUT ? otpData.requestCount + 1 : 1

      await otpDoc.ref.update({
        otp,
        expiresAt: Timestamp.fromMillis(expiresAt),
        requestCount: newRequestCount,
        lastRequestedAt: Timestamp.fromDate(new Date()),
        verificationAttempts: 0,
      })
    } else {
      await db.collection("otps").add({
        whatsappId,
        otp,
        expiresAt: Timestamp.fromMillis(expiresAt),
        requestCount: 1,
        lastRequestedAt: Timestamp.fromDate(new Date()),
        verificationAttempts: 0,
      })
    }
    logger.log(`OTP for ${whatsappId} generated successfully`)
    await sendWhatsappOTP("factChecker", whatsappId, otp)
    logger.log(`OTP sent successfully to ${whatsappId}`)

    return { status: "success", message: "OTP sent successfully" }
  } catch (error) {
    logger.error(error)
    return { status: "error", message: error }
  }
}

const checkOTPHandler = async (otp: string, whatsappNum: string) => {
  logger.info("Checking OTP...")

  try {
    const otpDoc = await getOTPSnap(whatsappNum)

    if (!otpDoc) {
      logger.error(`OTP not found for WhatsApp number ${whatsappNum}`)
      return { status: "error", message: "OTP not found" }
    }

    const otpData = otpDoc.data() as OTPData

    if (otpData.verificationAttempts >= 5) {
      logger.warn("Maximum OTP verification attempts reached")
      return { status: "error", message: "OTP max attempts" }
    }

    if (otp !== otpData.otp) {
      await otpDoc.ref.update({
        verificationAttempts: otpData.verificationAttempts + 1,
      })
      logger.warn("OTP mismatch")
      return { status: "error", message: "OTP mismatch" }
    }

    await otpDoc.ref.delete()
    logger.log("OTP verified successfully")
    return { status: "success", message: "OTP verified" }
  } catch (error) {
    logger.error(error)
    return { status: "error", message: error }
  }
}

export { postOTPHandler, checkOTPHandler }

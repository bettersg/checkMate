import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { sendWhatsappOTP } from "./sendWhatsappMessage"
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

const REQUEST_LIMIT = 3
const REQUEST_TIMEOUT = 10 * 60 * 1000
const OTP_EXPIRATION_TIME = 5 * 60 * 1000
const OTP_ATTEMPT_LIMIT = 5

function generateOTP() {
  const otp = String(Math.floor(100000 + Math.random() * 900000)) // 6-digit OTP
  const expiresAt = Date.now() + OTP_EXPIRATION_TIME // Calculate the exact expiry time
  return { otp, expiresAt }
}

async function getOTPSnap(checkerId: string) {
  const otpSnap = await db.collection("otps").doc(checkerId).get()
  return otpSnap.exists ? otpSnap : null
}

const sendOTP = async (whatsappId: string, checkerId: string) => {
  try {
    const otpSnap = await getOTPSnap(checkerId)
    const { otp, expiresAt } = generateOTP()

    if (otpSnap) {
      const otpData = otpSnap.data() as OTPData
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

      await otpSnap.ref.update({
        otp,
        expiresAt: Timestamp.fromMillis(expiresAt),
        requestCount: newRequestCount,
        lastRequestedAt: Timestamp.fromDate(new Date()),
        verificationAttempts: 0,
      })
    } else {
      await db
        .collection("otps")
        .doc(checkerId)
        .set({
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

const checkOTP = async (
  otp: string,
  whatsappNum: string,
  checkerId: string
) => {
  logger.info("Checking OTP...")

  try {
    const otpSnap = await getOTPSnap(checkerId)

    if (!otpSnap) {
      logger.error(
        `OTP not found for checker ${checkerId} with whatsappID ${whatsappNum}`
      )
      return { status: "error", message: "OTP not found" }
    }

    const otpData = otpSnap.data() as OTPData

    const savedOtp = otpData?.otp ?? null
    const expiresAt = otpData?.expiresAt ?? null
    const verificationAttempts = otpData?.verificationAttempts ?? null
    const whatsappId = otpData?.whatsappId ?? null

    if (
      savedOtp === null ||
      expiresAt === null ||
      verificationAttempts === null ||
      whatsappId === null
    ) {
      logger.error(`Missing OTP data at backend for OTP ID ${checkerId}`)
      return { status: "error", message: "Missing OTP data at backend" }
    }

    //check for expiration
    if (Date.now() > expiresAt.toDate().getTime()) {
      await otpSnap.ref.delete()
      logger.warn("OTP expired")
      return { status: "error", message: "OTP expired" }
    }

    if (otpData.verificationAttempts >= OTP_ATTEMPT_LIMIT) {
      logger.warn("Maximum OTP verification attempts reached")
      return { status: "error", message: "OTP max attempts" }
    }

    if (otp !== otpData.otp) {
      await otpSnap.ref.update({
        verificationAttempts: otpData.verificationAttempts + 1,
      })
      logger.warn("OTP mismatch")
      return { status: "error", message: "OTP mismatch" }
    }

    const batch = db.batch()

    if (whatsappNum !== whatsappId) {
      whatsappNum = whatsappId
      batch.update(db.collection("checkers").doc(checkerId), {
        whatsappId: whatsappId,
      })
    }

    //check for legacy checkers
    const checkerQuerySnap = await db
      .collection("checkers")
      .where("whatsappId", "==", whatsappNum)
      .get()

    //loop through and delete their old entries
    checkerQuerySnap.forEach((doc) => {
      if (doc.id !== checkerId) {
        batch.delete(doc.ref)
      }
    })

    batch.delete(otpSnap.ref)
    await batch.commit()
    logger.log(`OTP for ${checkerId} verified successfully`)
    return { status: "success", message: "OTP verified" }
  } catch (error) {
    logger.error(error)
    return { status: "error", message: error }
  }
}

export { sendOTP, checkOTP }

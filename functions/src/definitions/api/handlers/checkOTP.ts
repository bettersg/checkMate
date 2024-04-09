import { Request, Response } from "express"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"

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

    const otpRef = db.collection("otps").doc(checkerId)
    const otpSnap = await otpRef.get()
    if (!otpSnap.exists) {
      return res.status(404).send(`OTP not found for checker ${checkerId}`)
    }
    const otpData = otpSnap.data()

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

    //check if existing checker
    const checkerQuery = await db
      .collection("checkers")
      .where("whatsappId", "==", whatsappId)
      .get()

    if (checkerQuery.docs.length === 1) {
      const telegramId = checkerSnap.data()?.telegramId
      const existingCheckerRef = checkerQuery.docs[0].ref
      const existingCheckerId = existingCheckerRef.id
      if (!telegramId) {
        return res
          .status(500)
          .send("New checker record for existing checker has no TelegramId")
      }
      try {
        await existingCheckerRef.update({ telegramId: telegramId })
      } catch (error) {
        logger.error("Error updating checker with telegramId", error)
        return res
          .status(500)
          .send("Error updating existing whatsapp checker with telegramId")
      }
      const customToken = await admin
        .auth()
        .createCustomToken(existingCheckerId)
      await otpRef.delete()
      return res.status(202).send({
        existing: true,
        message: "Existing checker found",
        customToken: customToken,
        checkerId: existingCheckerId,
      })
    } else if (checkerQuery.docs.length > 1) {
      return res
        .status(500)
        .send("Multiple checkers found with same whatsappID")
    } else if (checkerQuery.empty) {
      try {
        const checkerRef = db.collection("checkers").doc(checkerId)
        await checkerRef.update({ whatsappId: whatsappId })
      } catch (error) {
        logger.error("Error updating checker with whatsappId", error)
        return res.status(500).send("Error updating checker with whatsappId")
      }
      await otpRef.delete()
      return res.status(200).send({
        existing: false,
        message: "OTP verified successfully",
      })
    }
  } catch (error) {
    logger.error(error)
    return res.status(500).send("Internal server error")
  }
}

export default checkOTPHandler

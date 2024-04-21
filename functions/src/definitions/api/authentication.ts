import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import * as crypto from "crypto"
import { onRequest } from "firebase-functions/v2/https"
import { logger } from "firebase-functions"
import { Checker } from "../../types"
import { defineString } from "firebase-functions/params"
import { AppEnv } from "../../appEnv"

if (!admin.apps.length) {
  admin.initializeApp()
}
const app = express()
const db = admin.firestore()

const env = process.env.ENVIRONMENT
const devTeleId = defineString(AppEnv.CHECKER1_TELEGRAM_ID)

app.post("/", async (req, res) => {
  const initData = req.body // Assuming you send initData in the body of your requests
  const botToken = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN) // Replace with your bot token

  if (!initData) {
    return res.status(400).send("No initData")
  }

  // Extract the data from initData (convert from query string format)
  const params = new URLSearchParams(initData)
  const receivedHash = params.get("hash")

  // Generate the secret key
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest()

  let userId = ""

  if (env !== "DEV" || initData !== "devdummy") {
    try {
      const userObject = JSON.parse(params.get("user") ?? "{}")
      userId = String(userObject.id ?? "")
    } catch (error) {
      return res.status(403).send("No Access")
    }

    if (!userId) {
      logger.warn("User likely not from Telegram, userId does not exist")
      return res.status(403).send("No Access")
    }

    // Generate the data-check-string
    const dataCheckStringParts = []
    for (const [key, value] of params.entries()) {
      if (key !== "hash") {
        // Exclude the hash itself from the data-check-string
        dataCheckStringParts.push(`${key}=${value}`)
      }
    }

    const dataCheckString = dataCheckStringParts.sort().join("\n")
    // Compute the hash
    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex")

    // Validate the hash
    if (computedHash !== receivedHash) {
      functions.logger.warn("User not from Telegram")
      return res.status(403).send("No Access")
    }

    // Check the auth_date for data freshness (e.g., within 24 hours)
    const authDate = Number(params.get("auth_date"))
    const timeNow = Math.floor(Date.now() / 1000) // Convert to Unix timestamp
    if (timeNow - authDate > 3600) {
      //1hr
      functions.logger.warn("Telegram data is outdated")
      return res.status(403).send("No Access")
    }
  } else {
    userId = devTeleId.value()
  }

  const checkerSnap = await db
    .collection("checkers")
    .where("telegramId", "==", parseInt(userId))
    .limit(1)
    .get()

  if (!checkerSnap.empty) {
    try {
      const userDoc = checkerSnap.docs[0]
      const customToken = await admin.auth().createCustomToken(userDoc.id)
      const checkerName = userDoc.data()?.name
      return res.status(200).json({
        customToken: customToken,
        checkerId: userDoc.id,
        name: checkerName,
        isNewUser: false,
        isOnboardingComplete: userDoc.data()?.isOnboardingComplete,
        isActive: userDoc.data()?.isActive,
      })
    } catch (error) {
      functions.logger.error("Error creating custom token:", error)
      return res.status(500).send("Error creating custom token")
    }
  } else {
    //from telegram but not yet a user in database
    functions.logger.info("Creating new user")
    const checkerObject: Checker = {
      name: "",
      type: "human",
      isActive: false,
      isOnboardingComplete: false,
      singpassOpenId: null,
      whatsappId: null,
      telegramId: parseInt(userId),
      voteWeight: 1,
      level: 0,
      experience: 0,
      tier: "beginner",
      numVoted: 0,
      numCorrectVotes: 0,
      numVerifiedLinks: 0,
      preferredPlatform: "telegram",
      lastVotedTimestamp: null,
      getNameMessageId: null,
    }

    try {
      const newCheckerRef = await db.collection("checkers").add(checkerObject)
      const customToken = await admin.auth().createCustomToken(newCheckerRef.id)
      return res.status(200).json({
        customToken: customToken,
        checkerId: newCheckerRef.id,
        name: "",
        isNewUser: true,
        isOnboardingComplete: false,
        isActive: false,
      })
    } catch (error) {
      functions.logger.error("Error creating new user:", error)
      return res.status(500).send("Error creating new user")
    }
  }
})

const main = express()
main.use("/telegramAuth", app)

const telegramAuthHandler = onRequest(
  {
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
  },
  main
)

export { telegramAuthHandler }

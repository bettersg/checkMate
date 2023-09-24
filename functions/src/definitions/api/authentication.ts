import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import express from "express"
import * as crypto from "crypto"
import { onRequest } from "firebase-functions/v2/https"

if (!admin.apps.length) {
  admin.initializeApp()
}

const app = express()
const db = admin.firestore()

app.post("/", async (req, res) => {
  const initData = req.body // Assuming you send initData in the body of your requests
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN) // Replace with your bot token

  // Extract the data from initData (convert from query string format)
  const params = new URLSearchParams(initData)
  const receivedHash = params.get("hash")

  // Generate the secret key
  const secretKey = crypto
    .createHmac("sha256", botToken)
    .update("WebAppData")
    .digest()

  let userId = params.get("user") //TODO: Check this, it should be the telegram bot id!

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
  if (timeNow - authDate > 300) {
    // 300 seconds = 5 mins
    functions.logger.warn("Telegram data is outdated")
    return res.status(403).send("No Access")
  }

  if (userId) {
    const userSnap = await db.collection("factCheckers").doc(userId).get()
    if (userSnap.exists) {
      try {
        const customToken = await admin.auth().createCustomToken(userId)
        return res.json({ customToken: customToken })
      } catch (error) {
        console.error("Error creating custom token:", error)
        return res.status(403).send("No Access")
      }
    } else {
      functions.logger.warn("User not a checker")
      return res.status(403).send("No Access")
    }
  } else {
    functions.logger.warn("No User Id")
    return res.status(403).send("No Access")
  }
})

const telegramAuthHandler = onRequest(
  {
    secrets: ["TELEGRAM_BOT_TOKEN"],
  },
  app
)

export { telegramAuthHandler }

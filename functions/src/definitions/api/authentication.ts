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

const CHECKER1_PHONE_NUMBER: string = String(process.env.CHECKER1_PHONE_NUMBER) //remove later once migrated fully

app.post("/", async (req, res) => {
  const initData = req.body // Assuming you send initData in the body of your requests
  const botToken = String(process.env.TELEGRAM_CHECKER_BOT_TOKEN) // Replace with your bot token

  // Extract the data from initData (convert from query string format)
  const params = new URLSearchParams(initData)
  const receivedHash = params.get("hash")

  // Generate the secret key
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest()

  let userId = ""

  try {
    const userObject = JSON.parse(params.get("user") ?? "{}")
    userId = String(userObject.id ?? "")
  } catch (error) {
    return res.status(403).send("No Access")
  }

  if (!userId) {
    return res.status(403).send("No Access")
  }
  console.log(`userid is ${userId}`) //TODO: remove once finish dev

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

  if (userId) {
    const userSnap = await db
      .collection("factCheckers")
      // .doc(CHECKER1_PHONE_NUMBER)
      .doc(userId)
      .get() //later change to userId
    if (userSnap.exists) {
      try {
        const customToken = await admin.auth().createCustomToken(userId)
        const userName = userSnap.data()?.name
        return res.json({ customToken: customToken, userId:userId, name:userName })
      } catch (error) {
        functions.logger.error("Error creating custom token:", error)
        return res.status(500).send("Error creating custom token")
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

const main = express()
main.use("/telegramAuth", app)

const telegramAuthHandler = onRequest(
  {
    secrets: ["TELEGRAM_CHECKER_BOT_TOKEN"],
  },
  main
)

export { telegramAuthHandler }

import * as admin from "firebase-admin"
import express from "express"
import * as functions from "firebase-functions"
import { onRequest } from "firebase-functions/v2/https"
import { Timestamp } from "firebase-admin/firestore"
import { config } from "dotenv"
import getCheckerHandler from "./handlers/getChecker"
import getCheckerVotesHandler from "./handlers/getCheckerVotes"
import getVoteHandler from "./handlers/getVote"
import patchVoteRequestHandler from "./handlers/patchVoteRequest"
import postCheckerHandler from "./handlers/postChecker"
import patchCheckerHandler from "./handlers/patchChecker"
import getCheckerPendingCount from "./handlers/getCheckerPendingCount"
import postOTPHandler from "./handlers/postOTP"
import checkOTPHandler from "./handlers/checkOTP"
import deleteCheckerHandler from "./handlers/deleteChecker"
import { validateFirebaseIdToken } from "./middleware/validator"

config()

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()

const app = express()
app.use(validateFirebaseIdToken)

app.get("/checkers/:checkerId", getCheckerHandler)

app.patch("/checkers/:checkerId", patchCheckerHandler)

app.delete("/checkers/:checkerId", deleteCheckerHandler)

app.get("/checkers/:checkerId/pendingCount", getCheckerPendingCount)

app.post("/checkers", postCheckerHandler)

app.post("/checkers/:checkerId/otp/check", checkOTPHandler)

app.post("/checkers/:checkerId/otp", postOTPHandler)

app.get("/checkers/:checkerId/votes", getCheckerVotesHandler)

app.get("/messages/:messageId/voteRequests/:voteRequestId", getVoteHandler)

app.patch(
  "/messages/:messageId/voteRequests/:voteRequestId",
  patchVoteRequestHandler
)

const main = express()
main.use("/api", app)

const apiHandler = onRequest(
  {
    secrets: [
      "TELEGRAM_CHECKER_BOT_TOKEN",
      "WHATSAPP_TOKEN",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
    ],
  },
  main
)

export { apiHandler }

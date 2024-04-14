import * as admin from "firebase-admin"
import express, { RequestHandler } from "express"
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

const app = express()
const checkersRouter = express.Router()
const messagesRouter = express.Router()

checkersRouter.post("/checkers", validateFirebaseIdToken, postCheckerHandler)

checkersRouter.get(
  "/checkers/:checkerId",
  validateFirebaseIdToken,
  getCheckerHandler
)

checkersRouter.patch(
  "/checkers/:checkerId",
  validateFirebaseIdToken,
  patchCheckerHandler
)

checkersRouter.delete(
  "/checkers/:checkerId",
  validateFirebaseIdToken,
  deleteCheckerHandler
)

checkersRouter.get(
  "/checkers/:checkerId/pendingCount",
  validateFirebaseIdToken,
  getCheckerPendingCount
)

checkersRouter.post(
  "/checkers/:checkerId/otp/check",
  validateFirebaseIdToken,
  checkOTPHandler
)

checkersRouter.post(
  "/checkers/:checkerId/otp",
  validateFirebaseIdToken,
  postOTPHandler
)

checkersRouter.get(
  "/checkers/:checkerId/votes",
  validateFirebaseIdToken,
  getCheckerVotesHandler
)

messagesRouter.get(
  "/messages/:messageId/voteRequests/:voteRequestId",
  validateFirebaseIdToken,
  getVoteHandler
)

messagesRouter.patch(
  "/messages/:messageId/voteRequests/:voteRequestId",
  validateFirebaseIdToken,
  patchVoteRequestHandler
)

app.use("/api", [checkersRouter, messagesRouter])

const apiHandler = onRequest(
  {
    secrets: [
      "TELEGRAM_CHECKER_BOT_TOKEN",
      "WHATSAPP_TOKEN",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
    ],
  },
  app
)

export { apiHandler }

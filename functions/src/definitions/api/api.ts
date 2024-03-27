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

// Type for supported HTTP methods
type HttpMethod = "get" | "post" | "put" | "delete" | "patch"

config()

if (!admin.apps.length) {
  admin.initializeApp()
}

// Usage

const app = express()

// Route Registration Helper
function secureRoute(
  path: string,
  handler: RequestHandler,
  method: HttpMethod = "get"
) {
  app[method](path, validateFirebaseIdToken, handler)
}

secureRoute("/checkers/:checkerId", getCheckerHandler, "get")
secureRoute("/checkers/:checkerId", patchCheckerHandler, "patch")
secureRoute("/checkers/:checkerId", deleteCheckerHandler, "delete")
secureRoute("/checkers/:checkerId/pendingCount", getCheckerPendingCount)
secureRoute("/checkers", postCheckerHandler, "post")
secureRoute("/checkers/:checkerId/otp/check", checkOTPHandler, "post")
secureRoute("/checkers/:checkerId/otp", postOTPHandler, "post")
secureRoute("/checkers/:checkerId/votes", getCheckerVotesHandler, "get")
secureRoute(
  "/messages/:messageId/voteRequests/:voteRequestId",
  getVoteHandler,
  "get"
)
secureRoute(
  "/messages/:messageId/voteRequests/:voteRequestId",
  patchVoteRequestHandler,
  "patch"
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

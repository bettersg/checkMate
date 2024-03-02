import express from "express"
import { onRequest } from "firebase-functions/v2/https"

import postCheckerHandler from "./handlers/postChecker"
import postVoteRequestHandler from "./handlers/postVoteRequest"
import patchVoteRequestHandler from "./handlers/patchVoteRequest"

const app = express()

app.use(express.json())

app.post("/messages/:messageId/voteRequests", postVoteRequestHandler)

app.patch(
  "/messages/:messageId/voteRequests/:voteRequestId",
  patchVoteRequestHandler
)

app.post("/checkers", postCheckerHandler)

const internalApiHandler = onRequest(
  {
    invoker: "private", //use google cloud IAM to limit access
  },
  app
)

export { internalApiHandler }

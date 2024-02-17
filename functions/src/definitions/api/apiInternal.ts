import * as admin from "firebase-admin"
import { Checker } from "../../types"
import express from "express"
import { onRequest } from "firebase-functions/v2/https"
import { Timestamp } from "firebase-admin/firestore"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

interface createVoteRequest {
  factCheckerId: string
}

interface updateVoteRequest {
  category: string
  vote?: number
}

interface createChecker {
  name: string
  type: "human" | "ai"
  isActive?: boolean
  isOnboardingComplete?: boolean
  singpassOpenId: string | null
  telegramId: string | null
  whatsappId?: string | null
  level?: number
  experience?: number
  numVoted?: number
  numCorrectVotes?: number
  numVerifiedLinks?: number
  preferredPlatform?: string | null
  lastVotedTimestamp?: null
}

const app = express()

app.use(express.json())

app.post("/:messageId/voteRequests", async (req, res) => {
  //get messageId
  const messageId = req.params.messageId
  if (!messageId) {
    res.status(400).send("MessageId is required")
    return
  }
  //confirm factCheckerId in body
  const { factCheckerId } = req.body as createVoteRequest
  if (!factCheckerId) {
    return res.status(400).send("FactCheckerId is required in body")
  }
  //check if message exists in firestore
  const messageRef = db.collection("messages").doc(messageId)
  const messageSnap = await messageRef.get()
  if (!messageSnap.exists) {
    return res.status(404).send("Message not found")
  }
  //check if factChecker exists in firestore
  const factCheckerRef = db.collection("checkers").doc(factCheckerId)
  const factCheckerSnap = await factCheckerRef.get()
  if (!factCheckerSnap.exists) {
    return res.status(404).send("factChecker not found")
  }

  //create new voteRequest in message
  const ref = await messageRef.collection("voteRequests").add({
    factCheckerDocRef: factCheckerRef,
    platformId: factCheckerSnap.get("whatsappId") ?? null,
    hasAgreed: null,
    triggerL2Vote: null,
    triggerL2Others: null,
    platform: "agent",
    sentMessageId: null,
    category: null,
    vote: null,
    createdTimestamp: Timestamp.fromDate(new Date()),
    acceptedTimestamp: Timestamp.fromDate(new Date()),
    votedTimestamp: null,
  })

  //create return object
  const returnObj = {
    success: true,
    voteRequestPath: ref.path,
  }
  return res.status(200).send(returnObj)
})

app.patch("/:messageId/voteRequests/:voteRequestId", async (req, res) => {
  // get message ID and voteRequestId
  const messageId = req.params.messageId
  const voteRequestId = req.params.voteRequestId
  // check that both are passed
  if (!messageId || !voteRequestId) {
    res.status(400).send("Message Id or vote request Id missing.")
  }
  //confirm category in body
  const { category, vote } = req.body as updateVoteRequest
  if (!category) {
    res.status(400).send("A category is required in the body")
  }
  //check if vote request exists in firestore
  const voteRequestRef = db
    .collection("messages")
    .doc(messageId)
    .collection("voteRequests")
    .doc(voteRequestId)
  const voteRequestSnap = await voteRequestRef.get()
  if (!voteRequestSnap.exists) {
    return res.status(404).send("vote request not found")
  }
  await voteRequestRef.update({
    category: category,
    vote: vote ?? null,
  })
  return {
    success: true,
  }
})

app.post("/checkers", async (req, res) => {
  //check request body
  const {
    name,
    type,
    isActive,
    isOnboardingComplete,
    singpassOpenId,
    telegramId,
    whatsappId,
    level,
    experience,
    numVoted,
    numCorrectVotes,
    numVerifiedLinks,
    preferredPlatform,
    lastVotedTimestamp,
  } = req.body as createChecker
  if (!name || !type || !telegramId) {
    return res.status(400).send("Name, type, and telegramId are required")
  }
  const newChecker: Checker = {
    name,
    type,
    isActive: isActive || false,
    isOnboardingComplete: isOnboardingComplete || false,
    singpassOpenId,
    telegramId,
    whatsappId: whatsappId || null,
    level: level || 0,
    experience: experience || 0,
    numVoted: numVoted || 0,
    numCorrectVotes: numCorrectVotes || 0,
    numVerifiedLinks: numVerifiedLinks || 0,
    preferredPlatform: preferredPlatform || "telegram",
    lastVotedTimestamp: lastVotedTimestamp || null,
    getNameMessageId: null,
  }
  //create new factChecker in message
  const ref = await db.collection("checkers").add(newChecker)
  return res.status(200).send({
    success: true,
    factCheckerPath: ref.path,
  })
})

const internalApiHandler = onRequest(
  {
    invoker: "private",
  },
  app
)

export { internalApiHandler }

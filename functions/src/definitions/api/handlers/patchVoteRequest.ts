import { Request, Response } from "express"
import { updateVoteRequest } from "../interfaces"
import { Timestamp } from "firebase-admin/firestore"
import { getTags } from "../../common/utils"
import * as admin from "firebase-admin"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const patchVoteRequestHandler = async (req: Request, res: Response) => {
  // get message ID and voteRequestId
  const messageId = req.params.messageId
  const voteRequestId = req.params.voteRequestId
  // check that both are passed
  if (!messageId || !voteRequestId) {
    return res.status(400).send("Message Id or vote request Id missing.")
  }
  //confirm category in body
  const { category, communityNoteCategory, truthScore, reasoning, tags } =
    req.body as updateVoteRequest
  if (!category) {
    return res.status(400).send("A category is required in the body")
  }

  if (
    category === "info" &&
    (typeof truthScore !== "number" || truthScore < 0 || truthScore > 5)
  ) {
    return res
      .status(400)
      .send("A truthscore between 0 and 5 is required for the info category")
  }

  if (category !== "info" && truthScore != null) {
    return res
      .status(400)
      .send("Truthscore can only be submitted for info category")
  }

  if (
    ![
      "scam",
      "illicit",
      "info",
      "satire",
      "spam",
      "legitimate",
      "irrelevant",
      "unsure",
      "pass",
    ].includes(category)
  ) {
    return res.status(400).send(`${category} is not a valid category`)
  }

  if (
    communityNoteCategory &&
    !["unacceptable", "acceptable", "great"].includes(communityNoteCategory)
  ) {
    return res
      .status(400)
      .send(`${communityNoteCategory} is not a valid category`)
  }

  const allowedTags = await getTags()
  if (Array.isArray(tags)) {
    const allElementsValid = tags.every(
      (tag) => typeof tag === "string" && allowedTags.includes(tag)
    )
    if (!allElementsValid) {
      //check if tags are valid
      return res
        .status(400)
        .send(
          `Tags must be an array of strings, and each string must be one of ${allowedTags.join(
            ", "
          )}`
        )
    }
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
  const updateObj = {
    category: category,
    communityNoteCategory: communityNoteCategory ?? null,
    truthScore: truthScore ?? null,
    votedTimestamp: Timestamp.fromDate(new Date()),
    reasoning: reasoning ?? null,
    tags: {} as { [key: string]: boolean },
  }

  // Add tags dynamically to the 'tags' field
  if (tags) {
    for (const tag of tags) {
      updateObj.tags[tag] = true
    }
  }
  await voteRequestRef.update(updateObj)
  return res.status(200).send({
    success: true,
  })
}

export default patchVoteRequestHandler

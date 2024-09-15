import { Request, Response } from "express"
import { VoteSummary, VoteSummaryApiResponse } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { checkAccuracy } from "../../common/statistics"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const getCheckerVotesHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker Id missing.")
    }
    const n = req.query.n ? parseInt(req.query.n as string) : 10
    const last = req.query.last ? (req.query.last as string) : null //should be a path
    const status = req.query.status ? (req.query.status as string) : "pending"

    if (!["pending", "voted", "both"].includes(status)) {
      return res.status(400).send("Invalid status")
    }

    const checkerDocRef = db.collection("checkers").doc(checkerId)

    let query = db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", checkerDocRef)

    if (status === "pending") {
      query = query.where("category", "==", null)
    } else if (status === "voted") {
      query = query.where("category", "!=", null)
    }

    const totalCount = (await query.count().get()).data().count

    const sortOrder = status === "pending" ? "asc" : "desc"
    const sortField =
      status === "pending" ? "createdTimestamp" : "votedTimestamp"

    query = query.orderBy(sortField, sortOrder).limit(n)

    if (last) {
      const lastDocRef = db.doc(last)
      const lastDocSnap = await lastDocRef.get()
      if (!lastDocSnap.exists) {
        logger.warn("Last document not found")
      } else {
        query = query.startAfter(lastDocSnap)
      }
    }

    const querySnap = await query.get()
    if (querySnap.empty) {
      return res.status(200).send({
        votes: [],
        lastPath: null,
        totalPages: 1,
      })
    }
    const promises = querySnap.docs.map(async (doc) => {
      try {
        const parentMessageRef = doc.ref.parent.parent
        if (!parentMessageRef) {
          logger.error(`Vote request ${doc.id} has no parent message`)
          return null
        }
        const parentMessageSnap = await parentMessageRef.get()
        if (!parentMessageSnap.exists) {
          logger.error(`Parent message not found for vote request ${doc.id}`)
          return null
        }
        const latestInstanceRef = parentMessageSnap.get("latestInstance")
        if (!latestInstanceRef) {
          logger.error(
            `Parent message ${parentMessageSnap.id} has no latest instance`
          )
          return null
        }
        const latestInstanceSnap = await latestInstanceRef.get()
        if (!latestInstanceSnap.exists) {
          logger.error(
            `Latest instance not found for parent message ${parentMessageSnap.id}`
          )
          return null
        }
        const category = doc.get("category") ?? null
        const truthScore = doc.get("truthScore") ?? null
        const type = latestInstanceSnap.get("type") ?? null
        const createdTimestamp = doc.get("createdTimestamp")?.toDate() ?? null
        const votedTimestamp = doc.get("votedTimestamp")?.toDate() ?? null
        const text = parentMessageSnap.get("text") ?? null
        const caption = latestInstanceSnap.get("caption") ?? null
        const isAssessed = parentMessageSnap.get("isAssessed") ?? false
        const firestorePath = doc.ref.path
        const isCorrect = checkAccuracy(parentMessageSnap, doc)
        const needsReview = isAssessed && isCorrect === false
        const isUnsure = isCorrect === null //either unsure or some other type of error

        const returnObject: VoteSummary = {
          category,
          truthScore,
          type,
          createdTimestamp,
          votedTimestamp,
          text,
          caption,
          needsReview,
          isAssessed,
          isUnsure,
          firestorePath,
        }
        return returnObject
      } catch (error) {
        logger.error(`Error fetching data for vote request ${doc.id}: ${error}`)
        return null // Consider how you want to handle errors.
      }
    })

    const votes = (await Promise.all(promises)).filter(
      (d): d is VoteSummary => d !== null
    ) as VoteSummary[]

    if (votes.length === 0) {
      return res.status(200).send({
        votes: [],
        lastPath: null,
        totalPages: 1,
      })
    }

    if (votes === null) {
      return res.status(500).send("Error fetching documents")
    }

    const lastVote = votes[votes.length - 1]
    if (!lastVote) {
      return res.status(500).send("Error fetching documents")
    }

    const lastVotePath = lastVote.firestorePath

    const totalPages = Math.ceil(totalCount / n)

    const response: VoteSummaryApiResponse = {
      votes: votes,
      lastPath: lastVotePath,
      totalPages,
    }

    return res.status(200).send(response)
  } catch (error) {
    logger.error("Error fetching documents: ", error)
    return res.status(500).send(error)
  }
}

export default getCheckerVotesHandler

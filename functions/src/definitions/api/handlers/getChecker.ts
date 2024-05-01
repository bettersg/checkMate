import { Request, Response } from "express"
import { Checker } from "../interfaces"
import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"
import { checkAccuracy } from "../../common/statistics"
import { TIME } from "../../../utils/time"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const getCheckerHandler = async (req: Request, res: Response) => {
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }

    const checkerRef = db.collection("checkers").doc(checkerId)
    const checkerSnap = await checkerRef.get()

    if (!checkerSnap.exists) {
      return res.status(404).send(`Checker with id ${checkerId} not found`)
    }

    const checkerData = checkerSnap.data()

    if (!checkerData) {
      return res.status(500).send("Checker data not found")
    }

    const pendingVoteQuery = db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", checkerRef)
      .where("category", "==", null)
    const pendingVoteSnap = await pendingVoteQuery.count().get()
    const pendingVoteCount = pendingVoteSnap.data().count

    const cutoffTimestamp = Timestamp.fromDate(
      new Date(Date.now() - TIME.THIRTY_DAYS)
    )

    const last30DaysQuery = db
      .collectionGroup("voteRequests")
      .where("factCheckerDocRef", "==", checkerRef)
      .where("createdTimestamp", ">", cutoffTimestamp)

    const last30DaysSnap = await last30DaysQuery.get()

    //filter client side for category != null, since firestore doesn't support inequality on 2 fields
    const last30DaysData = last30DaysSnap.docs.filter(
      (doc) => doc.get("category") !== null
    )

    const totalVoted = last30DaysData.length

    // Map each document to a promise to fetch the parent message and count instances
    const fetchDataPromises = last30DaysData.map((doc) => {
      const parentMessageRef = doc.ref.parent.parent // Assuming this is how you get the reference
      if (!parentMessageRef) {
        logger.error(`Vote request ${doc.id} has no parent message`)
        return null
      }

      // You can fetch the parent message and count instances in parallel for each doc
      return Promise.all([
        parentMessageRef.get(),
        parentMessageRef.collection("instances").count().get(),
      ])
        .then(([parentMessageSnap, instanceCountResult]) => {
          if (!parentMessageSnap.exists) {
            logger.error(`Parent message not found for vote request ${doc.id}`)
            return null
          }
          const instanceCount = instanceCountResult.data().count ?? 0
          const isAccurate = checkAccuracy(parentMessageSnap, doc)
          const isAssessed = parentMessageSnap.get("isAssessed") ?? false
          const votedTimestamp = doc.get("votedTimestamp") ?? null
          const createdTimestamp = doc.get("createdTimestamp") ?? null

          // You may adjust what you return based on your needs
          return {
            votedTimestamp,
            createdTimestamp,
            isAccurate,
            isAssessed,
            instanceCount,
          }
        })
        .catch((error) => {
          logger.error(
            `Error fetching data for vote request ${doc.id}: ${error}`
          )
          return null // Handle errors as appropriate for your use case
        })
    })

    // Wait for all fetches to complete
    const results = await Promise.all(fetchDataPromises)
    //calculate accuracy
    const accurateCount = results.filter(
      (d) => d !== null && d.isAccurate
    ).length
    const totalAssessedAndNonUnsureCount = results.filter(
      (d) => d !== null && d.isAssessed && d.isAccurate !== null
    ).length
    const totalCount = results.filter((d) => d !== null).length
    //calculate people helped
    const peopleHelped = results.reduce(
      (acc, d) => acc + (d !== null ? d.instanceCount : 0),
      0
    )
    //calculate average response time, given data has a createdTimestamp and a votedTimestamp
    const totalResponseTime = results.reduce((acc, d) => {
      if (d === null) {
        return acc
      }
      if (d.createdTimestamp && d.votedTimestamp) {
        const responseTimeMinutes =
          (d.votedTimestamp.toMillis() - d.createdTimestamp.toMillis()) / 60000
        return acc + responseTimeMinutes
      }
      return acc
    }, 0)
    const averageResponseTime = totalResponseTime / (totalCount || 1)

    const accuracyRate =
      totalAssessedAndNonUnsureCount === 0
        ? null
        : accurateCount / totalAssessedAndNonUnsureCount
    const returnData: Checker = {
      name: checkerData.name,
      type: checkerData.type,
      isActive: checkerData.isActive,
      tier: checkerData.tier,
      isAdmin: checkerData.isAdmin,
      isOnboardingComplete: checkerData.isOnboardingComplete,
      pendingVoteCount: pendingVoteCount,
      last30days: {
        totalVoted: totalVoted,
        accuracyRate: accuracyRate,
        averageResponseTime: averageResponseTime,
        peopleHelped: peopleHelped,
      },
      achievements: null,
      level: 0, //TODO,
      experience: 0, //TOD0
    }
    res.status(200).send(returnData)
  } catch (error) {
    logger.error("Error fetching checker", error)
    res.status(500).send("Error fetching checker")
  }
}

export default getCheckerHandler

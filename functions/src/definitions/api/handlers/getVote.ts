import { Request, Response } from "express"
import { Vote } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { getVoteCounts } from "../../common/counters"
import { getSignedUrl } from "../../common/mediaUtils"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const getVoteHandler = async (req: Request, res: Response) => {
  try {
    // get message ID and voteRequestId
    const messageId = req.params.messageId
    const voteRequestId = req.params.voteRequestId
    // check that both are passed
    if (!messageId || !voteRequestId) {
      return res.status(400).send("Message Id or vote request Id missing.")
    }
    const messageRef = db.collection("messages").doc(messageId)
    const voteRequestRef = messageRef
      .collection("voteRequests")
      .doc(voteRequestId)
    //promise.all the two
    const [messageSnap, voteRequestSnap] = await Promise.all([
      messageRef.get(),
      voteRequestRef.get(),
    ])
    if (!messageSnap.exists) {
      return res.status(404).send("Message not found")
    }
    if (!voteRequestSnap.exists) {
      return res.status(404).send("Vote request not found")
    }
    const latestInstanceRef = messageSnap.get("latestInstance")
    if (!latestInstanceRef) {
      return res.status(500).send("Message has no latest instance")
    }
    const latestInstanceSnap = await latestInstanceRef.get()
    if (!latestInstanceSnap.exists) {
      return res.status(500).send("Latest instance not found")
    }

    const latestType = latestInstanceSnap.get("type") ?? "text"

    const sender = latestInstanceSnap.get("from") ?? "Unknown"

    //mask all but last 4 characters of sender

    const maskedSender =
      sender != "Unknown" ? sender.replace(/.(?=.{4})/g, "*") : sender

    const storageBucketUrl = latestInstanceSnap.get("storageUrl")
    const signedUrl =
      latestType === "image" ? await getSignedUrl(storageBucketUrl) : null
    const isAssessed = messageSnap.get("isAssessed")

    const isLegacy =
      voteRequestSnap.get("truthScore") === undefined &&
      voteRequestSnap.get("vote") !== undefined

    const tags = voteRequestSnap.get("tags") ?? {}
    const parentTags = messageSnap.get("tags") ?? {}

    //loop through tags, check that value is true, if so add to array
    const tagArray = Object.keys(tags).filter((tag) => tags[tag])
    const parentTagArray = Object.keys(parentTags).filter(
      (tag) => parentTags[tag]
    )
    const {
      irrelevantCount,
      scamCount,
      illicitCount,
      infoCount,
      spamCount,
      legitimateCount,
      unsureCount,
      satireCount,
      validResponsesCount,
      tagCounts,
    } = await getVoteCounts(messageRef)

    //get counts from each truthScore

    const truthScoreCountPromiseArr = Array.from(
      { length: 5 },
      (_, index) => index + 1
    ).map((truthScore) =>
      messageRef
        .collection("voteRequests")
        .where("truthScore", "==", truthScore)
        .count()
        .get()
        .then((snapshot) => snapshot.data().count)
    )

    let oneCount, twoCount, threeCount, fourCount, fiveCount, hasDiscrepancy

    if (isLegacy) {
      ;[oneCount, twoCount, threeCount, fourCount, fiveCount] = new Array(
        5
      ).fill(null)
    } else {
      try {
        ;[oneCount, twoCount, threeCount, fourCount, fiveCount] =
          await Promise.all(truthScoreCountPromiseArr)
        //if sum not equals to infoCount, then it is a legacy message
        if (
          oneCount + twoCount + threeCount + fourCount + fiveCount !==
          infoCount
        ) {
          logger.warn(
            "Mismatch in truth score counts for message: " + messageId
          )
          hasDiscrepancy = true
        }
      } catch (e) {
        logger.error("Error retrieving truth score counts")
        hasDiscrepancy = true
      }
    }

    const returnData: Vote = {
      type: latestType,
      text: latestType === "text" ? messageSnap.get("text") : null,
      caption:
        latestType === "image" ? latestInstanceSnap.get("caption") : null,
      signedImageUrl: signedUrl,
      category: voteRequestSnap.get("category"),
      sender: maskedSender,
      truthScore: isLegacy
        ? voteRequestSnap.get("vote")
        : voteRequestSnap.get("truthScore"),
      isAssessed: isAssessed,
      finalStats: isAssessed
        ? {
            responseCount: validResponsesCount,
            scamCount: scamCount,
            illicitCount: illicitCount,
            infoCount:
              isLegacy || hasDiscrepancy
                ? {
                    total: infoCount,
                  }
                : {
                    1: oneCount,
                    2: twoCount,
                    3: threeCount,
                    4: fourCount,
                    5: fiveCount,
                  },
            satireCount: satireCount,
            spamCount: spamCount,
            irrelevantCount: irrelevantCount,
            legitimateCount: legitimateCount,
            unsureCount: unsureCount,
            tagCounts: tagCounts,
            truthScore: isLegacy
              ? messageSnap.get("legacyTruthScore")
              : messageSnap.get("truthScore"),
            tags: parentTagArray,
            primaryCategory: messageSnap.get("primaryCategory"),
            rationalisation: messageSnap.get("rationalisation"),
          }
        : null,
      tags: tagArray,
    }
    return res.status(200).send(returnData)
  } catch {
    logger.error("Error retrieving vote.")
    return res.status(500).send("Error retrieving vote.")
  }
}

export default getVoteHandler

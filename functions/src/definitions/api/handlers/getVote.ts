import { Request, Response } from "express"
import { Vote } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { getCount } from "../../common/counters"
import { getSignedUrl } from "../../common/mediaUtils"
import { info } from "console"
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
    const [
      irrelevantCount,
      scamCount,
      illicitCount,
      infoCount,
      spamCount,
      legitimateCount,
      unsureCount,
      satireCount,
      responseCount,
    ] = await Promise.all([
      getCount(messageRef, "irrelevant"),
      getCount(messageRef, "scam"),
      getCount(messageRef, "illicit"),
      getCount(messageRef, "info"),
      getCount(messageRef, "spam"),
      getCount(messageRef, "legitimate"),
      getCount(messageRef, "unsure"),
      getCount(messageRef, "satire"),
      getCount(messageRef, "responses"),
    ])

    const latestType = latestInstanceSnap.get("type") ?? "text"

    const storageBucketUrl = latestInstanceSnap.get("storageUrl")
    const signedUrl =
      latestType === "image" ? await getSignedUrl(storageBucketUrl) : null
    const isAssessed = messageSnap.get("isAssessed")

    const returnData: Vote = {
      type: latestType,
      text: latestType === "text" ? messageSnap.get("text") : null,
      caption:
        latestType === "image" ? latestInstanceSnap.get("caption") : null,
      signedImageUrl: signedUrl,
      category: voteRequestSnap.get("category"),
      truthScore: voteRequestSnap.get("truthScore"),
      isAssessed: isAssessed,
      finalStats: isAssessed
        ? {
            responseCount: responseCount,
            scamCount: scamCount,
            illicitCount: illicitCount,
            infoCount: infoCount,
            satireCount: satireCount,
            spamCount: spamCount,
            irrelevantCount: irrelevantCount,
            legitimateCount: legitimateCount,
            unsureCount: unsureCount,
            truthScore: messageSnap.get("truthScore"),
            primaryCategory: messageSnap.get("primaryCategory"),
            rationalisation: messageSnap.get("rationalisation"),
          }
        : null,
    }
    return res.status(200).send(returnData)
  } catch {
    logger.error("Error retrieving vote.")
    return res.status(500).send("Error retrieving vote.")
  }
}

export default getVoteHandler

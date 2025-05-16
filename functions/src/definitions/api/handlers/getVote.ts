import { Request, Response } from "express"
import { Vote } from "../interfaces"
import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import normalizeUrl from "normalize-url"
import urlRegexSafe from "url-regex-safe"
import { hashScreenshotUrl } from "../../common/utils"
import { getVoteCounts } from "../../common/counters"
import { getSignedUrl } from "../../common/mediaUtils"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const storage = admin.storage()

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
      greatCount,
      acceptableCount,
      unacceptableCount,
      validResponsesCount,
      tagCounts,
    } = await getVoteCounts(messageRef)

    //get counts from each truthScore

    const truthScoreCountPromiseArr = Array.from(
      { length: 6 },
      (_, index) => index
    ).map((truthScore) =>
      messageRef
        .collection("voteRequests")
        .where("truthScore", "==", truthScore)
        .count()
        .get()
        .then((snapshot) => snapshot.data().count)
    )

    let zeroCount,
      oneCount,
      twoCount,
      threeCount,
      fourCount,
      fiveCount,
      hasDiscrepancy

    try {
      ;[zeroCount, oneCount, twoCount, threeCount, fourCount, fiveCount] =
        await Promise.all(truthScoreCountPromiseArr)
      //if sum not equals to infoCount, then it is a legacy message
      if (
        zeroCount + oneCount + twoCount + threeCount + fourCount + fiveCount !==
        infoCount
      ) {
        logger.warn("Mismatch in truth score counts for message: " + messageId)
        hasDiscrepancy = true
      }
    } catch (e) {
      logger.error("Error retrieving truth score counts")
      hasDiscrepancy = true
    }

    //extract URLs and get screenshot hashes
    let urls = null
    let text = null
    if (latestType === "text") {
      text = messageSnap.get("text")
      const extractedUrls = extractUrls(messageSnap.get("text"))
      urls = await Promise.all(
        extractedUrls.map(async (url) => {
          const screenshotUrl = await getScreenshotUrl(url)
          return {
            url,
            screenshotUrl,
          }
        })
      )
    }

    const returnData: Vote = {
      type: latestType,
      text: text,
      urls: urls,
      caption:
        latestType === "image" ? latestInstanceSnap.get("caption") : null,
      signedImageUrl: signedUrl,
      communityNote: messageSnap.get("communityNote"),
      commentOnNote: voteRequestSnap.get("commentOnNote"),
      category: voteRequestSnap.get("category"),
      communityNoteCategory: voteRequestSnap.get("communityNoteCategory"),
      sender: maskedSender,
      truthScore: voteRequestSnap.get("truthScore"),
      isAssessed: isAssessed,
      finalStats: isAssessed
        ? {
            responseCount: validResponsesCount,
            scamCount: scamCount,
            illicitCount: illicitCount,
            infoCount: hasDiscrepancy
              ? {
                  total: infoCount,
                }
              : {
                  0: zeroCount,
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
            truthScore: messageSnap.get("truthScore"),
            tags: parentTagArray,
            primaryCategory: messageSnap.get("primaryCategory"),
            rationalisation: messageSnap.get("rationalisation"),
            greatCount: greatCount,
            acceptableCount: acceptableCount,
            unacceptableCount: unacceptableCount,
          }
        : null,
      tags: tagArray,
      numberPointScale: voteRequestSnap.get("numberPointScale"),
    }
    return res.status(200).send(returnData)
  } catch {
    logger.error("Error retrieving vote.")
    return res.status(500).send("Error retrieving vote.")
  }
}

function extractUrls(text: string) {
  const extractedUrls = text.match(urlRegexSafe()) || []
  return extractedUrls.map((url) =>
    normalizeUrl(url, { defaultProtocol: "https", stripWWW: false })
  )
}

async function getScreenshotUrl(url: string) {
  //first hash
  const hash = hashScreenshotUrl(url)
  const blobName = `${hash}.png`
  const bucketName = process.env.SCREENSHOT_BUCKET_NAME
  if (!bucketName) {
    throw new Error("SCREENSHOT_BUCKET_NAME is not set")
  }
  const bucket = storage.bucket(bucketName)
  const blob = bucket.file(blobName)
  const [exists] = await blob.exists()
  if (exists) {
    return blob.publicUrl()
  }
  return null
}

export default getVoteHandler

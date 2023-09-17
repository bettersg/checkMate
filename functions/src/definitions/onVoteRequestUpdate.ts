import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { getThresholds } from "./common/utils"
import {
  sendVotingMessage,
  sendL2OthersCategorisationMessage,
  sendRemainingReminder,
} from "./common/sendFactCheckerMessages"
import { incrementCounter, getCount } from "./common/counters"
import { FieldValue } from "@google-cloud/firestore"
import { defineInt } from "firebase-functions/params"

// Define some parameters
const numVoteShards = defineInt("NUM_SHARDS_VOTE_COUNT")

if (!admin.apps.length) {
  admin.initializeApp()
}

const onVoteRequestUpdate = functions
  .region("asia-southeast1")
  .runWith({
    secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"],
  })
  .firestore.document("/messages/{messageId}/voteRequests/{voteRequestId}")
  .onUpdate(async (change, context) => {
    // Grab the current value of what was written to Firestore.
    const before = change.before.data()
    const docSnap = change.after
    const after = docSnap.data()
    const messageRef = docSnap.ref.parent.parent
    if (!messageRef) {
      functions.logger.error(`Vote request ${docSnap.ref.path} has no parent`)
      return
    }
    if (before.triggerL2Vote !== true && after.triggerL2Vote === true) {
      await sendVotingMessage(change.after, messageRef)
    } else if (
      before.triggerL2Others !== true &&
      after.triggerL2Others === true
    ) {
      await sendL2OthersCategorisationMessage(change.after, messageRef)
    } else if (before.vote != after.vote || before.category != after.category) {
      await updateCounts(messageRef, before, after)
      await updateCheckerVoteCount(before, after)
      const db = admin.firestore()
      const voteRequestQuerySnapshot = await messageRef
        .collection("voteRequests")
        .get()
      const numFactCheckers = voteRequestQuerySnapshot.size
      const responseCount = await getCount(messageRef, "responses")
      const irrelevantCount = await getCount(messageRef, "irrelevant")
      const scamCount = await getCount(messageRef, "scam")
      const illicitCount = await getCount(messageRef, "illicit")
      const infoCount = await getCount(messageRef, "info")
      const spamCount = await getCount(messageRef, "spam")
      const legitimateCount = await getCount(messageRef, "legitimate")
      const unsureCount = await getCount(messageRef, "unsure")
      const susCount = scamCount + illicitCount
      const voteTotal = await getCount(messageRef, "totalVoteScore")
      const truthScore = infoCount > 0 ? voteTotal / infoCount : null
      const thresholds = await getThresholds()
      const isSus = susCount > thresholds.isSus * responseCount
      const isScam = isSus && scamCount >= illicitCount
      const isIllicit = isSus && !isScam
      const isInfo = infoCount > thresholds.isInfo * responseCount
      const isSpam = spamCount > thresholds.isSpam * responseCount
      const isLegitimate =
        legitimateCount > thresholds.isLegitimate * responseCount
      const isIrrelevant =
        irrelevantCount > thresholds.isIrrelevant * responseCount
      const isUnsure =
        (!isSus && !isInfo && !isSpam && !isLegitimate && !isIrrelevant) ||
        unsureCount > thresholds.isUnsure * responseCount
      const isAssessed =
        (isUnsure &&
          responseCount > thresholds.endVoteUnsure * numFactCheckers) ||
        (!isUnsure && responseCount > thresholds.endVote * numFactCheckers) ||
        (isSus && responseCount > thresholds.endVoteSus * numFactCheckers)

      //set primaryCategory
      let primaryCategory
      if (isScam) {
        primaryCategory = "scam"
      } else if (isIllicit) {
        primaryCategory = "illicit"
      } else if (isInfo) {
        if (truthScore === null) {
          primaryCategory = "error"
          functions.logger.error("Category is info but truth score is null")
        } else if (truthScore < (thresholds.falseUpperBound || 1.5)) {
          primaryCategory = "untrue"
        } else if (truthScore < (thresholds.misleadingUpperBound || 3.5)) {
          primaryCategory = "misleading"
        } else {
          primaryCategory = "accurate"
        }
      } else if (isSpam) {
        primaryCategory = "spam"
      } else if (isLegitimate) {
        primaryCategory = "legitimate"
      } else if (isIrrelevant) {
        primaryCategory = "irrelevant"
      } else if (isUnsure) {
        primaryCategory = "unsure"
      } else {
        primaryCategory = "error"
        functions.logger.error("Error in primary category determination")
      }
      await messageRef.update({
        truthScore: truthScore,
        isScam: isScam,
        isIllicit: isIllicit,
        isInfo: isInfo,
        isSpam: isSpam,
        isLegitimate: isLegitimate,
        isIrrelevant: isIrrelevant,
        isUnsure: isUnsure,
        isAssessed: isAssessed,
        primaryCategory: primaryCategory,
      })
      if (after.category !== null) {
        //vote has ended
        await sendRemainingReminder(after.factCheckerDocRef.id, after.platform)
        if (after.votedTimestamp !== before.votedTimestamp) {
          await after.factCheckerDocRef.set(
            {
              lastVotedTimestamp: after.votedTimestamp,
            },
            { merge: true }
          )
        }
      }
    }
    return Promise.resolve()
  })

async function updateCounts(
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  before: admin.firestore.DocumentData,
  after: admin.firestore.DocumentData
) {
  const previousCategory = before.category
  const currentCategory = after.category
  const previousVote = before.vote
  const currentVote = after.vote
  if (previousCategory === null) {
    if (currentCategory !== null) {
      await incrementCounter(messageRef, "responses", numVoteShards.value())
    }
  } else {
    if (currentCategory === null) {
      await incrementCounter(messageRef, "responses", numVoteShards.value(), -1) //if previous category is not null and current category is, reduce the response count
    }
    await incrementCounter(
      messageRef,
      previousCategory,
      numVoteShards.value(),
      -1
    ) //if previous category is not null and current category also not now, reduce the count of the previous category
    if (previousCategory === "info") {
      await incrementCounter(
        messageRef,
        "totalVoteScore",
        numVoteShards.value(),
        -previousVote
      ) //if previous category is info, reduce the total vote score
    }
  }
  if (currentCategory !== null) {
    await incrementCounter(messageRef, currentCategory, numVoteShards.value())
    if (currentCategory === "info") {
      await incrementCounter(
        messageRef,
        "totalVoteScore",
        numVoteShards.value(),
        currentVote
      )
    }
  }
}

async function updateCheckerVoteCount(
  before: admin.firestore.DocumentData,
  after: admin.firestore.DocumentData
) {
  let factCheckerRef
  if (before.category === null && after.category !== null) {
    factCheckerRef = after.factCheckerDocRef
    factCheckerRef.update({
      numVoted: FieldValue.increment(1),
    })
  } else if (before.category !== null && after.category === null) {
    factCheckerRef = after.factCheckerDocRef
    factCheckerRef.update({
      numVoted: FieldValue.increment(-1),
    })
  }
}

export { onVoteRequestUpdate }

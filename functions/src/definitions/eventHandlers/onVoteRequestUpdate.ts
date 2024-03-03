import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { getThresholds } from "../common/utils"
import {
  sendVotingMessage,
  sendL2OthersCategorisationMessage,
  sendRemainingReminder,
} from "../common/sendFactCheckerMessages"
import { incrementCounter, getCount } from "../common/counters"
import { FieldValue } from "@google-cloud/firestore"
import { defineInt } from "firebase-functions/params"

// Define some parameters
const numVoteShards = defineInt("NUM_SHARDS_VOTE_COUNT")

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

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
    } else if (
      before.truthScore != after.truthScore ||
      before.category != after.category ||
      before.vote != after.vote
    ) {
      const isLegacy =
        after.truthScore === undefined && after.vote !== undefined
      await updateCounts(messageRef, before, after, isLegacy)
      await updateCheckerVoteCount(before, after)
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
      const satireCount = await getCount(messageRef, "satire")
      const susCount = scamCount + illicitCount
      const voteTotal = await getCount(messageRef, "totalVoteScore")
      const truthScore = computeTruthScore(infoCount, voteTotal, isLegacy)
      const thresholds = await getThresholds()
      const isSus = susCount > thresholds.isSus * responseCount
      const isScam = isSus && scamCount >= illicitCount
      const isIllicit = isSus && !isScam
      const isInfo = infoCount > thresholds.isInfo * responseCount
      const isSatire = satireCount > thresholds.isSatire * responseCount
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
      } else if (isSatire) {
        primaryCategory = "satire"
      } else if (isInfo) {
        if (truthScore === null) {
          primaryCategory = "error"
          functions.logger.error("Category is info but truth score is null")
        } else if (truthScore < (thresholds.falseUpperBound || 2)) {
          primaryCategory = "untrue"
        } else if (truthScore <= (thresholds.misleadingUpperBound || 4)) {
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
        if (after.platform !== "agent" && !!after.platformId) {
          await sendRemainingReminder(after.platformId, after.platform)
        }
        if (after.votedTimestamp !== before.votedTimestamp) {
          const factCheckerDocRef = await switchLegacyCheckerRef(
            after.factCheckerDocRef
          )
          factCheckerDocRef === null ||
            (await factCheckerDocRef.set(
              {
                lastVotedTimestamp: after.votedTimestamp,
              },
              { merge: true }
            ))
        }
      }
    }
    return Promise.resolve()
  })

async function updateCounts(
  messageRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  before: admin.firestore.DocumentData,
  after: admin.firestore.DocumentData,
  isLegacy: boolean = false
) {
  const previousCategory = before.category
  const currentCategory = after.category
  //START REMOVE IN APRIL//
  let previousScore = before.truthScore
  let currentScore = after.truthScore

  if (isLegacy) {
    previousScore = before.vote
    currentScore = after.vote
  }
  //END REMOVE IN APRIL//
  if (previousCategory === null) {
    if (currentCategory !== null) {
      await incrementCounter(messageRef, "responses")
    }
  } else {
    if (currentCategory === null) {
      await incrementCounter(messageRef, "responses", -1) //if previous category is not null and current category is, reduce the response count
    }
    await incrementCounter(messageRef, previousCategory, -1) //if previous category is not null and current category also not now, reduce the count of the previous category
    if (previousCategory === "info") {
      await incrementCounter(messageRef, "totalVoteScore", -previousScore) //if previous category is info, reduce the total vote score
    }
  }
  if (currentCategory !== null) {
    await incrementCounter(messageRef, currentCategory)
    if (currentCategory === "info") {
      await incrementCounter(messageRef, "totalVoteScore", currentScore)
    }
  }
}

async function updateCheckerVoteCount(
  before: admin.firestore.DocumentData,
  after: admin.firestore.DocumentData
) {
  let factCheckerRef: admin.firestore.DocumentReference<admin.firestore.DocumentData> | null
  factCheckerRef = await switchLegacyCheckerRef(after.factCheckerDocRef)
  if (factCheckerRef === null) {
    functions.logger.error("Checker not found")
    return
  }
  if (before.category === null && after.category !== null) {
    factCheckerRef.update({
      numVoted: FieldValue.increment(1),
    })
  } else if (before.category !== null && after.category === null) {
    factCheckerRef.update({
      numVoted: FieldValue.increment(-1),
    })
  }
}

async function switchLegacyCheckerRef(
  factCheckerDocRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) {
  if (factCheckerDocRef.path.startsWith("factCheckers")) {
    const factCheckerSnap = await db
      .collection("checkers")
      .where("whatsappId", "==", factCheckerDocRef.id)
      .limit(1)
      .get()
    if (factCheckerSnap.empty) {
      functions.logger.error(
        "Legacy factChecker not found in new checkers collection"
      )
      return null
    } else {
      return factCheckerSnap.docs[0].ref
    }
  } else if (factCheckerDocRef.path.startsWith("checkers")) {
    return factCheckerDocRef
  } else {
    functions.logger.error("Invalid factCheckerDocRef path")
    return null
  }
}

function computeTruthScore(
  infoCount: number,
  voteTotal: number,
  isLegacy: boolean
) {
  if (infoCount === 0) {
    return null
  }
  const truthScore = voteTotal / infoCount
  if (isLegacy) {
    return (truthScore / 5) * 4 + 1
  } else {
    return truthScore
  }
}

export { onVoteRequestUpdate }

import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { getThresholds } from "../common/utils"
import {
  sendVotingMessage,
  sendL2OthersCategorisationMessage,
  sendRemainingReminder,
} from "../common/sendFactCheckerMessages"
import { incrementCounter, getVoteCounts } from "../common/counters"
import { FieldValue } from "@google-cloud/firestore"
import { defineInt } from "firebase-functions/params"
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { tabulateVoteStats } from "../common/statistics"

// Define some parameters
const numVoteShards = defineInt("NUM_SHARDS_VOTE_COUNT")

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const onVoteRequestUpdateV2 = onDocumentUpdated(
  {
    document: "messages/{messageId}/voteRequests/{voteRequestId}",
    secrets: ["WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"],
  },
  async (event) => {
    // Grab the current value of what was written to Firestore.
    if (!event?.data?.before || !event?.data?.after) {
      return Promise.resolve()
    }
    const preChangeData = event.data.before.data()
    const postChangeData = event.data.after.data()
    const docSnap = event.data.after
    const messageRef = docSnap.ref.parent.parent
    if (!messageRef) {
      functions.logger.error(`Vote request ${docSnap.ref.path} has no parent`)
      return
    }
    const messageSnap = await messageRef.get()
    if (
      preChangeData.triggerL2Vote !== true &&
      postChangeData.triggerL2Vote === true
    ) {
      await sendVotingMessage(docSnap, messageRef)
    } else if (
      preChangeData.triggerL2Others !== true &&
      postChangeData.triggerL2Others === true
    ) {
      await sendL2OthersCategorisationMessage(docSnap, messageRef)
    } else if (
      preChangeData.truthScore != postChangeData.truthScore ||
      preChangeData.category != postChangeData.category ||
      preChangeData.vote != postChangeData.vote
    ) {
      const isLegacy =
        postChangeData.truthScore === undefined &&
        postChangeData.vote !== undefined
      await Promise.all([
        updateCounts(messageRef, preChangeData, postChangeData),
        updateCheckerVoteCount(preChangeData, postChangeData),
      ])

      const thresholds = await getThresholds()

      const {
        irrelevantCount,
        scamCount,
        illicitCount,
        infoCount,
        spamCount,
        legitimateCount,
        unsureCount,
        satireCount,
        voteTotal,
        validResponsesCount,
        susCount,
        factCheckerCount,
      } = await getVoteCounts(messageRef)

      const truthScore = computeTruthScore(infoCount, voteTotal, isLegacy)
      const isSus = susCount > thresholds.isSus * validResponsesCount
      const isScam = isSus && scamCount >= illicitCount
      const isIllicit = isSus && !isScam
      const isInfo = infoCount > thresholds.isInfo * validResponsesCount
      const isSatire = satireCount > thresholds.isSatire * validResponsesCount
      const isSpam = spamCount > thresholds.isSpam * validResponsesCount
      const isLegitimate =
        legitimateCount > thresholds.isLegitimate * validResponsesCount
      const isIrrelevant =
        irrelevantCount > thresholds.isIrrelevant * validResponsesCount
      const isUnsure =
        (!isSus &&
          !isInfo &&
          !isSpam &&
          !isLegitimate &&
          !isIrrelevant &&
          !isSatire) ||
        unsureCount > thresholds.isUnsure * validResponsesCount
      const isAssessed =
        (isUnsure &&
          validResponsesCount > thresholds.endVoteUnsure * factCheckerCount) ||
        (!isUnsure &&
          validResponsesCount > thresholds.endVote * factCheckerCount) ||
        (isSus &&
          validResponsesCount > thresholds.endVoteSus * factCheckerCount)

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
        isSatire: isSatire,
        isSpam: isSpam,
        isLegitimate: isLegitimate,
        isIrrelevant: isIrrelevant,
        isUnsure: isUnsure,
        isAssessed: isAssessed,
        primaryCategory: primaryCategory,
      })
      if (messageSnap.get("isAssessed") === true) {
        const { isCorrect, score, duration } = tabulateVoteStats(
          messageSnap,
          docSnap
        )
        await docSnap.ref.update({
          isCorrect: isCorrect,
          score: score,
          duration: duration,
        })
      }
      if (postChangeData.category !== null) {
        //vote has ended
        if (
          postChangeData.platform === "whatsapp" &&
          !!postChangeData.platformId
        ) {
          await sendRemainingReminder(
            postChangeData.platformId,
            postChangeData.platform
          )
        }
        if (postChangeData.votedTimestamp !== preChangeData.votedTimestamp) {
          const factCheckerDocRef = await switchLegacyCheckerRef(
            postChangeData.factCheckerDocRef
          )
          factCheckerDocRef === null ||
            (await factCheckerDocRef.set(
              {
                lastVotedTimestamp: postChangeData.votedTimestamp,
              },
              { merge: true }
            ))
        }
      }
    }
    //update leaderboard stats
    if (preChangeData.isCorrect !== postChangeData.isCorrect) {
      const checkerUpdateObj = {} as Record<string, any>
      const previousCorrect = preChangeData.isCorrect
      const currentCorrect = postChangeData.isCorrect
      const previousScore = preChangeData.score
      const currentScore = postChangeData.score
      const previousDuration = preChangeData.duration
      const currentDuration = postChangeData.duration
      let durationDelta = 0
      if (previousDuration != null && previousCorrect != null) {
        durationDelta -= previousDuration
      }
      if (currentDuration != null && currentCorrect != null) {
        durationDelta += currentDuration
      }
      if (durationDelta !== 0) {
        checkerUpdateObj["leaderboardStats.totalTimeTaken"] =
          FieldValue.increment(durationDelta)
      }

      if (previousCorrect === true) {
        //means now its not correct
        checkerUpdateObj["leaderboardStats.numCorrectVotes"] =
          FieldValue.increment(-1)
        if (previousScore != null) {
          checkerUpdateObj["leaderboardStats.score"] = FieldValue.increment(
            -previousScore
          )
        }
      }
      if (currentCorrect === null) {
        //means now it's unsure and should not be added to denominator
        checkerUpdateObj["leaderboardStats.numVoted"] = FieldValue.increment(-1)
      }

      if (currentCorrect === true) {
        await docSnap.ref.update({ score: currentScore })
        checkerUpdateObj["leaderboardStats.numCorrectVotes"] =
          FieldValue.increment(1)
        checkerUpdateObj["leaderboardStats.score"] =
          FieldValue.increment(currentScore)
      }
      if (previousCorrect == null) {
        checkerUpdateObj["leaderboardStats.numVoted"] = FieldValue.increment(1)
      }
      await postChangeData.factCheckerDocRef.update(checkerUpdateObj)
    }
    return Promise.resolve()
  }
)

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
        -previousScore
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
        currentScore
      )
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
  const isBeforeNoCount = before.category === null || before.category === "pass"
  const isAferNoCount = after.category === null || after.category === "pass"
  if (isBeforeNoCount && !isAferNoCount) {
    factCheckerRef.update({
      numVoted: FieldValue.increment(1),
    })
  } else if (!isBeforeNoCount && isAferNoCount) {
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

export { onVoteRequestUpdateV2 }

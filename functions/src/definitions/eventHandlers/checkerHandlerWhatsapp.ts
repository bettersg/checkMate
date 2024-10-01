import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { onMessagePublished } from "firebase-functions/v2/pubsub"
import { sendTextMessage, sendImageMessage } from "../common/sendMessage"
import {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappButtonMessage,
} from "../common/sendWhatsappMessage"
import { getResponsesObj } from "../common/responseUtils"
import { sleep, getThresholds } from "../common/utils"
import {
  sendL1CategorisationMessage,
  sendRemainingReminder,
} from "../common/sendFactCheckerMessages"
import { getSignedUrl } from "../common/mediaUtils"
import { Timestamp } from "firebase-admin/firestore"
import { resetL2Status } from "../common/voteUtils"
import { WhatsappMessageObject, CheckerData } from "../../types"

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const checkerHandlerWhatsapp = async function (message: WhatsappMessageObject) {
  const from = message.from // extract the phone number from the webhook payload
  const type = message.type
  let responses

  switch (type) {
    case "button":
      const button = message.button
      switch (button.text) {
        case "Yes!":
          await onFactCheckerYes(button.payload, from, "whatsapp")
          break
        case "No":
          responses = await getResponsesObj("factChecker")
          sendWhatsappTextMessage(
            "factChecker",
            from,
            responses.VOTE_NO,
            message.id
          )
          break
        case "I'm ready to continue!":
          try {
            await onContinue(button.payload)
          } catch {
            functions.logger.warn(
              `New onContinue failed, payload = ${button.payload}`
            )
          }
      }
      break
    case "interactive":
      // handle voting here
      const interactive = message.interactive
      switch (interactive.type) {
        case "list_reply":
          await onTextListReceipt(
            db,
            interactive.list_reply.id,
            from,
            message.id
          )
          break
        case "button_reply":
          await onButtonReply(db, interactive.button_reply.id, from, message.id)
          break
      }
      break

    case "text":
      if (!message.text || !message.text.body) {
        break
      }
      if (
        message.text.body ===
        "I'd like to join as a CheckMate to help counter misinformation and scams! 💪🏻"
      ) {
        await onSignUp(from, "whatsapp")
      } else if (!!message?.context?.id) {
        await onMsgReplyReceipt(
          from,
          message.context.id,
          message.text.body,
          "whatsapp"
        )
      } else {
        responses = await getResponsesObj("factChecker")
        sendWhatsappTextMessage("factChecker", from, responses.NOT_A_REPLY)
      }
      break
  }
  markWhatsappMessageAsRead("factChecker", message.id)
}

async function onSignUp(from: string, platform = "whatsapp") {
  const responses = await getResponsesObj("factChecker")
  let res = await sendTextMessage(
    "factChecker",
    from,
    responses.ONBOARDING_1,
    (platform = platform)
  )
  if (!res) {
    functions.logger.error(
      `Error sending message upon signup for factChecker ${from}`
    )
    return
  }
  const thresholds = await getThresholds()
  const checkerObj: CheckerData = {
    name: "",
    type: "human",
    isActive: true,
    isOnboardingComplete: false,
    isQuizComplete: false,
    quizScore: null,
    onboardingStatus: "name",
    lastTrackedMessageId: null,
    isAdmin: false,
    singpassOpenId: null,
    telegramId: null,
    whatsappId: from,
    voteWeight: 1,
    level: 1,
    experience: 0,
    tier: "beginner",
    numVoted: 0,
    numReferred: 0,
    numReported: 0,
    numCorrectVotes: 0,
    numNonUnsureVotes: 0,
    numVerifiedLinks: 0,
    preferredPlatform: "whatsapp",
    getNameMessageId: res.data.messages[0].id,
    lastVotedTimestamp: null,
    certificateUrl: "", // Initialize certificateUrl as an empty string
    leaderboardStats: {
      numVoted: 0,
      numCorrectVotes: 0,
      totalTimeTaken: 0,
      score: 0,
    },
    programData: {
      isOnProgram: true,
      programStart: Timestamp.fromDate(new Date()),
      programEnd: null,
      numVotesTarget: thresholds.volunteerProgramVotesRequirement ?? 0, // Target number of messages voted on to complete program
      numReferralTarget: thresholds.volunteerProgramReferralRequirement ?? 0, // Target number of referrals made to complete program
      numReportTarget: thresholds.volunteerProgramReportRequirement ?? 0, // Number of non-trivial messages sent in to complete program
      accuracyTarget: thresholds.volunteerProgramAccuracyRequirement ?? 0, // Target accuracy of non-unsure votes
      numVotesAtProgramStart: 0,
      numReferralsAtProgramStart: 0,
      numReportsAtProgramStart: 0,
      numCorrectVotesAtProgramStart: 0,
      numNonUnsureVotesAtProgramStart: 0,
      numVotesAtProgramEnd: null,
      numReferralsAtProgramEnd: null,
      numReportsAtProgramEnd: null,
      numCorrectVotesAtProgramEnd: null,
      numNonUnsureVotesAtProgramEnd: null,
    },
  }
  await db.collection("checkers").add(checkerObj)
}

async function onMsgReplyReceipt(
  from: string,
  messageId: string,
  text: string,
  platform = "whatsapp"
) {
  const responses = await getResponsesObj("factChecker")
  const factCheckerQuerySnap = await db
    .collection("checkers")
    .where("whatsappId", "==", from)
    .limit(1)
    .get()
  if (factCheckerQuerySnap.empty) {
    functions.logger.error(`No factChecker found with whatsappId ${from}`)
    return
  }
  const factCheckerSnap = factCheckerQuerySnap.docs[0]
  if (factCheckerSnap.get("getNameMessageId") === messageId) {
    await factCheckerSnap.ref.update({
      name: text.trim(),
    })
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "privacyOk",
          title: "Got it!",
        },
      },
    ]
    await sendWhatsappButtonMessage(
      "factChecker",
      from,
      responses.ONBOARDING_2.replace("{{name}}", text.trim()),
      buttons
    )
  }
}

async function onFactCheckerYes(
  voteRequestPath: string,
  from: string,
  platform = "whatsapp"
) {
  if (!voteRequestPath.includes("/")) {
    throw new Error("The voteRequestPath does not contain a forward slash (/).")
  }
  const voteRequestRef = db.doc(voteRequestPath)
  const voteRequestSnap = await voteRequestRef.get()
  if (!voteRequestSnap.exists) {
    functions.logger.log(
      `No corresponding voteRequest at ${voteRequestPath} found`
    )
    return
  }
  if (!!voteRequestSnap.get("category")) {
    await sendTextMessage(
      "factChecker",
      from,
      "Oops! you have already checked this message 👍",
      null,
      platform
    )
    await sendRemainingReminder(from, "whatsapp")
    return
  }
  await resetL2Status(voteRequestSnap)
  const messageRef = voteRequestRef.parent.parent
  if (!messageRef) {
    functions.logger.error(`null messageRef in resetL2Status`)
    return
  }
  const messageSnap = await messageRef.get()
  const latestInstanceRef = messageSnap.get("latestInstance")
  const latestInstanceSnap = await latestInstanceRef.get()
  const latestType = latestInstanceSnap.get("type") ?? "text"
  let res
  const updateObj: {
    hasAgreed: boolean
    acceptedTimestamp: admin.firestore.Timestamp
    sentMessageId?: string
    triggerL2Vote?: boolean
    triggerL2Others?: boolean
  } = {
    hasAgreed: true,
    acceptedTimestamp: Timestamp.fromDate(new Date()),
  }
  switch (latestType) {
    case "text":
      res = await sendTextMessage(
        "factChecker",
        from,
        messageSnap.get("text"),
        null,
        platform
      )
      if (!res) {
        return
      }
      updateObj.sentMessageId = res.data.messages[0].id
      break
    case "image":
      const temporaryUrl = await getSignedUrl(
        latestInstanceSnap.get("storageUrl")
      )
      if (temporaryUrl) {
        try {
          res = await sendImageMessage(
            "factChecker",
            from,
            temporaryUrl,
            latestInstanceSnap.get("caption"),
            null,
            platform
          )
          if (!res) {
            return
          }
          updateObj.sentMessageId = res.data.messages[0].id
        } catch {
          functions.logger.error(
            `Problem sending message ${messageRef.id} to ${from}}`
          )
          await sendTextMessage(
            "factChecker",
            from,
            "Sorry, an error occured",
            null,
            platform
          )
          return
        }
      } else {
        functions.logger.error(
          `Problem creating URL while sending message ${messageRef.id} to ${from}}`
        )
        await sendTextMessage(
          "factChecker",
          from,
          "Sorry, an error occured",
          null,
          platform
        )
        return
      }
      break
    default:
      functions.logger.error(
        `Unknown message type while sending message ${messageRef.id} to ${from}`
      )
      await sendTextMessage(
        "factChecker",
        from,
        "Sorry, an error occured",
        null,
        platform
      )
      return
  }
  if (messageSnap.get("machineCategory") === "info") {
    // handle case where machine has predicted info, so no need to go into L1 categorisation, but still need to go into L2 voting
    updateObj.triggerL2Vote = true
    updateObj.triggerL2Others = false
    await sleep(1000)
  } else {
    await sleep(3000)
    await sendL1CategorisationMessage(
      voteRequestSnap,
      messageRef,
      res.data.messages[0].id
    )
  }
  await voteRequestSnap.ref.update(updateObj)
}

async function onButtonReply(
  db: admin.firestore.Firestore,
  buttonId: string,
  from: string,
  replyId: string,
  platform = "whatsapp"
) {
  // let messageId, voteRequestId, type
  const responses = await getResponsesObj("factChecker")
  const [buttonMessageRef, ...rest] = buttonId.split("_")
  if (rest.length === 0) {
    //this means responses to the onboarding messages.
    switch (buttonMessageRef) {
      case "privacyOk":
        const buttons = [
          {
            type: "reply",
            reply: {
              id: "typeformDone",
              title: "I've done the quiz!",
            },
          },
        ]
        await sendWhatsappButtonMessage(
          "factChecker",
          from,
          responses.ONBOARDING_3,
          buttons
        )
        break
      case "typeformDone":
        await sendTextMessage(
          "factChecker",
          from,
          responses.ONBOARDING_4,
          null,
          "whatsapp",
          true
        )
        const checkersQuerySnap = await db
          .collection("checkers")
          .where("whatsappId", "==", from)
          .limit(1)
          .get()
        if (checkersQuerySnap.empty) {
          functions.logger.error(
            `No factChecker found with whatsappId ${from} for onboarding`
          )
          return
        }
        const factCheckerDocRef = checkersQuerySnap.docs[0].ref
        await factCheckerDocRef.update({
          isOnboardingComplete: true,
        })
        break
    }
  } else {
    switch (buttonMessageRef) {
      case "continueOutstanding":
        const [voteRequestPath] = rest
        await onFactCheckerYes(voteRequestPath, from, platform)
    }
  }
}

async function onTextListReceipt(
  db: admin.firestore.Firestore,
  listId: string,
  from: string,
  replyId: string,
  platform = "whatsapp"
) {
  const responses = await getResponsesObj("factChecker")
  const [type, messageId, voteRequestId, selection] = listId.split("_")
  const voteRequestRef = db
    .collection("messages")
    .doc(messageId)
    .collection("voteRequests")
    .doc(voteRequestId)
  const voteRequestSnap = await voteRequestRef.get()
  const isLegacy =
    voteRequestSnap.get("truthScore") === undefined &&
    voteRequestSnap.get("vote") !== undefined
  const updateObj: {
    category?: string
    truthScore?: number | null
    triggerL2Vote?: boolean
    triggerL2Others?: boolean
    votedTimestamp?: Timestamp
    vote?: number | null //legacy
  } = {}
  let isEnd = false
  let response
  switch (type) {
    case "vote":
      const vote = selection
      updateObj.category = "info"
      if (isNaN(parseInt(vote))) {
        functions.logger.warn("Non-integer vote received")
      } else {
        updateObj.truthScore = parseInt(vote)
        response = responses.RESPONSE_RECORDED
        isEnd = true
      }
      break

    case "categorize":
      switch (selection) {
        case "scam":
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = false
          updateObj.category = "scam"
          updateObj.truthScore = null
          response = responses.RESPONSE_RECORDED
          isEnd = true
          break
        case "illicit":
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = false
          updateObj.category = "illicit"
          updateObj.truthScore = null
          response = responses.RESPONSE_RECORDED
          isEnd = true
          break

        case "satire":
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = false
          updateObj.category = "satire"
          updateObj.truthScore = null
          response = responses.RESPONSE_RECORDED
          isEnd = true
          break

        case "info":
          await resetL2Status(voteRequestSnap)
          updateObj.triggerL2Vote = true
          updateObj.triggerL2Others = false
          response = responses.HOLD_FOR_NEXT_POLL
          break

        case "others":
          await resetL2Status(voteRequestSnap)
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = true
          response = responses.HOLD_FOR_L2_CATEGORISATION
          break
      }
      break

    case "others":
      updateObj.category = selection
      updateObj.truthScore = null
      response = responses.RESPONSE_RECORDED
      isEnd = true
      break
  }
  //if isLegacy and updateObject has truthScore, remove truthScore and change it to vote
  //START REMOVE IN APRIL//
  if (isLegacy && updateObj.truthScore !== undefined) {
    updateObj.vote = updateObj.truthScore
    delete updateObj.truthScore
  }
  //END REMOVE IN APRIL//
  if (!response) {
    functions.logger.warn(
      `Response not set for id ${voteRequestId} for message ${messageId}. Unexpected text list selection likely the cause.`
    )
    return
  }
  if (isEnd) {
    updateObj.votedTimestamp = Timestamp.fromDate(new Date())
  }
  await sendWhatsappTextMessage("factChecker", from, response, replyId)
  try {
    await voteRequestRef.set(updateObj, { merge: true })
  } catch (error) {
    functions.logger.warn(
      `No corresponding voteRequest with id ${voteRequestId} for message ${messageId} found`
    )
  }
}

async function onContinue(factCheckerId: string) {
  const checkerQuery = await db
    .collection("checkers")
    .where("whatsappId", "==", factCheckerId)
    .limit(1)
    .get()
  if (checkerQuery.empty) {
    functions.logger.error(
      `No factChecker found with whatsappId ${factCheckerId}`
    )
    return
  }
  const factCheckerRef = checkerQuery.docs[0].ref
  await factCheckerRef.update({
    isActive: true,
  })
  await sendRemainingReminder(factCheckerId, "whatsapp")
}

const onCheckerPublish = onMessagePublished(
  {
    topic: "checkerEvents",
    secrets: [
      "WHATSAPP_USER_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_CHECKERS_BOT_PHONE_NUMBER_ID",
      "WHATSAPP_TOKEN",
      "VERIFY_TOKEN",
      "TYPESENSE_TOKEN",
      "TELEGRAM_REPORT_BOT_TOKEN",
    ],
  },
  async (event) => {
    if (event.data.message.json) {
      if (event.data.message.attributes.source === "whatsapp") {
        functions.logger.log(`Processing ${event.data.message.messageId}`)
        await checkerHandlerWhatsapp(event.data.message.json)
      }
    } else {
      functions.logger.warn(
        `Unknown message type for messageId ${event.data.message.messageId})`
      )
    }
  }
)
export { onCheckerPublish }

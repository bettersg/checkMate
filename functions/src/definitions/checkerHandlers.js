const functions = require("firebase-functions")
const admin = require("firebase-admin")
const { sendTextMessage, sendImageMessage } = require("./common/sendMessage")
const {
  sendWhatsappTextMessage,
  markWhatsappMessageAsRead,
  sendWhatsappButtonMessage,
} = require("./common/sendWhatsappMessage")
const { getResponsesObj } = require("./common/responseUtils")
const { sleep } = require("./common/utils")
const {
  sendL1CategorisationMessage,
  sendRemainingReminder,
} = require("./common/sendFactCheckerMessages")
const { getSignedUrl } = require("./common/mediaUtils")
const { Timestamp } = require("firebase-admin/firestore")

if (!admin.apps.length) {
  admin.initializeApp()
}

exports.checkerHandlerWhatsapp = async function (message) {
  const from = message.from // extract the phone number from the webhook payload
  const type = message.type
  const db = admin.firestore()
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

exports.checkerHandlerTelegram = async function (message) {
  const from = message.from.id
  const db = admin.firestore()
}

async function onSignUp(from, platform = "whatsapp") {
  const responses = await getResponsesObj("factChecker")
  const db = admin.firestore()
  let res = await sendTextMessage(
    "factChecker",
    from,
    responses.ONBOARDING_1,
    (platform = platform)
  )
  await db.collection("factCheckers").doc(`${from}`).set({
    name: "",
    isActive: true,
    isOnboardingComplete: false,
    platformId: from,
    level: 1,
    experience: 0,
    numVoted: 0,
    numCorrectVotes: 0,
    numVerifiedLinks: 0,
    preferredPlatform: "whatsapp",
    getNameMessageId: res.data.messages[0].id,
    lastVotedTimestamp: null,
  })
}

async function onMsgReplyReceipt(from, messageId, text, platform = "whatsapp") {
  const responses = await getResponsesObj("factChecker")
  const db = admin.firestore()
  const factCheckerSnap = await db.collection("factCheckers").doc(from).get()
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

async function onFactCheckerYes(voteRequestPath, from, platform = "whatsapp") {
  const db = admin.firestore()
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
  try {
    const updateObj = {}
    if (voteRequestSnap.get("triggerL2Vote") !== null) {
      updateObj.triggerL2Vote = null
    }
    if (voteRequestSnap.get("triggerL2Others") !== null) {
      updateObj.triggerL2Others = null
    }
    if (Object.keys(updateObj).length) {
      // only perform the update if there's something to update
      await voteRequestRef.update(updateObj)
    }
  } catch (error) {
    functions.logger.error(
      "Error resetting triggerL2Vote or triggerL2Others",
      error
    )
  }
  const messageRef = voteRequestRef.parent.parent
  const messageSnap = await messageRef.get()
  const message = messageSnap.data()
  const latestInstanceRef = messageSnap.get("latestInstance")
  const latestInstanceSnap = await latestInstanceRef.get()
  const latestType = latestInstanceSnap.get("type") ?? "text"
  let res
  switch (latestType) {
    case "text":
      res = await sendTextMessage(
        "factChecker",
        from,
        message.text,
        null,
        platform
      )
      break
    case "image":
      const temporaryUrl = await getSignedUrl(message.storageUrl)
      if (temporaryUrl) {
        res = await sendImageMessage(
          "factChecker",
          from,
          temporaryUrl,
          message.caption,
          null,
          platform
        )
      } else {
        functions.logger.warn("Problem creating URL")
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
  }
  const updateObj = {
    hasAgreed: true,
    acceptedTimestamp: Timestamp.fromDate(new Date()),
    sentMessageId: res.data.messages[0].id,
  }
  if (message.machineCategory === "info") {
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
  db,
  buttonId,
  from,
  replyId,
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
        await db.collection("factCheckers").doc(`${from}`).update({
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
  db,
  listId,
  from,
  replyId,
  platform = "whatsapp"
) {
  const responses = await getResponsesObj("factChecker")
  const [type, messageId, voteRequestId, selection] = listId.split("_")
  const voteRequestRef = db
    .collection("messages")
    .doc(messageId)
    .collection("voteRequests")
    .doc(voteRequestId)
  const updateObj = {}
  let isEnd = false
  let response
  switch (type) {
    case "vote":
      const vote = selection
      updateObj.category = "info"
      updateObj.vote = parseInt(vote)
      response = responses.RESPONSE_RECORDED
      isEnd = true
      break

    case "categorize":
      switch (selection) {
        case "scam":
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = false
          updateObj.category = "scam"
          updateObj.vote = null
          response = responses.RESPONSE_RECORDED
          isEnd = true
          break
        case "illicit":
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = false
          updateObj.category = "illicit"
          updateObj.vote = null
          response = responses.RESPONSE_RECORDED
          isEnd = true
          break

        case "info":
          updateObj.triggerL2Vote = true
          updateObj.triggerL2Others = false
          response = responses.HOLD_FOR_NEXT_POLL
          break

        case "others":
          updateObj.triggerL2Vote = false
          updateObj.triggerL2Others = true
          response = responses.HOLD_FOR_L2_CATEGORISATION
          break
      }
      break

    case "others":
      updateObj.category = selection
      updateObj.vote = null
      response = responses.RESPONSE_RECORDED
      isEnd = true
      break
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

async function onContinue(factCheckerId) {
  const db = admin.firestore()
  await db.collection("factCheckers").doc(factCheckerId).update({
    isActive: true,
  })
  await sendRemainingReminder(factCheckerId, "whatsapp")
}

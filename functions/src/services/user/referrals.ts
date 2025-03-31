import * as admin from "firebase-admin"
import { logger } from "firebase-functions/v2"
import { Timestamp } from "firebase-admin/firestore"
import { getUserSnapshot } from "./userManagement"
import { incrementCheckerCounts } from "../../definitions/common/counters"
import { FieldValue } from "@google-cloud/firestore"
import { normalizeSpaces, checkPreV2User } from "../../definitions/common/utils"
import {
  ResponseObject,
  sendOnboardingFlow,
  sendLanguageSelection,
  sendCheckMateUsagePrompt,
  sendCheckMateDemonstration,
  sendUnsupportedTypeMessage,
} from "../../definitions/common/responseUtils"
import { checkTemplate } from "../../validators/whatsapp/checkWhatsappText"
import { sendWhatsappTextMessage } from "../../definitions/common/sendWhatsappMessage"
import { WhatsappMessageObject, UserData, LanguageSelection } from "../../types"
import { GeneralMessage } from "../../types"
import { publishToTopic } from "../../definitions/common/pubsub"

import Hashids from "hashids"
import { determineNeedsChecking } from "../../definitions/common/machineLearningServer/operations"
if (!admin.apps.length) {
  admin.initializeApp()
}

const salt = process.env.HASHIDS_SALT
const hashids = new Hashids(salt)

const db = admin.firestore()

const INSTRUCTION_MESSAGE =
  "Tap one of these below to simulate sending a message in for checking👇"

const PREPOPULATED_MESSAGE = "Show me how to use CheckMate"

const SAMPLE_MESSAGES = [
  {
    message:
      "Your A⁪ppI͏e lD Has Been D­isabIed Pending Further Verific‌ation #86359110",
    response: `🚨 This is a scam. The message claiming your Apple ID is disabled is a phishing attempt. It uses unusual characters and formatting, which are red flags. Legitimate companies like Apple communicate clearly and professionally, directing users to official channels for verification. Do not click on any links or provide personal information in response to this message.

☝️This response was generated by AI on 02 Mar 2025.`,
    language: "en",
  },
  {
    message:
      "您的电话号码在我的通讯录里，请问我们是不是在哪里见过？相互留下了电话号码😊",
    response: `🚨 这是一个骗局。此信息是一种常见的策略，用于引导收件人进行对话，通常会导致试图获取个人信息或金钱。如果您不认识发件人，请不要回复，并考虑屏蔽该号码以保护自己免受潜在的欺诈。

☝️此回复由人工智能于30 Mar 2025撰写。`,
    language: "cn",
  },
  {
    message:
      "Fm a friend: hearsay hitting yr elbow can save one from heart attack",
    response: `❌ This is largely untrue. The claim that hitting or tapping your elbow can prevent or help recover from a heart attack lacks scientific evidence. Heart attacks are caused by blockages in blood supply, and tapping the elbow does not address this issue. Traditional Chinese medicine may mention tapping for circulation, but it does not support this claim. In case of a heart attack, CPR is the recommended action, not tapping the elbow.

☝️This response was generated by AI on 30 Mar 2025.`,
    language: "en",
  },
  {
    message: "https://signup.redeem.gov.sg/",
    response: `✅ This is a legitimate government site. The link leads to a website with the 'gov.sg' domain, reserved for official Singapore government websites. It provides information on CDC Vouchers 2025 and Climate Vouchers, both government initiatives. The site is managed by GovTech Singapore, confirming its authenticity.

☝️This response was generated by AI on 30 Mar 2025.`,
    language: "en",
  },
]

async function referralHandler(
  userSnap: admin.firestore.DocumentData,
  message: string,
  from: string
) {
  const code = message.split("\n")[0].split(": ")[1].split(" ")[0]
  if (userSnap.get("firstMessageType") == "prepopulated") {
    return
  }
  const userRef = userSnap.ref
  if (code.length > 0) {
    const referralClickRef = db.collection("referralClicks").doc(code)
    const referralClickSnap = await referralClickRef.get()
    if (referralClickSnap.exists) {
      const referralId = referralClickSnap.get("referralId")
      if (referralId === "add") {
        const updateObj: Partial<UserData> = {
          firstMessageType: "prepopulated",
          utm: {
            source: referralClickSnap.get("utmSource") ?? "none",
            medium: referralClickSnap.get("utmMedium") ?? "none",
            content: referralClickSnap.get("utmContent") ?? "none",
            campaign: referralClickSnap.get("utmCampaign") ?? "none",
            term: referralClickSnap.get("utmTerm") ?? "none",
          },
        }
        const BETA_CAMPAIGN = process.env.BETA_CAMPAIGN_NAME
        if (
          BETA_CAMPAIGN &&
          referralClickSnap.get("utmCampaign") === BETA_CAMPAIGN
        ) {
          updateObj.isTester = true
        } //TODO: Remove eventually after beta
        await userRef.update(updateObj)
      } else {
        //try to get the userId from the referralId
        let referrer
        try {
          referrer = String(hashids.decode(referralId)[0])
        } catch (error) {
          logger.error(
            `Error decoding referral code ${code}, sent by ${from}: ${error}`
          )
        }
        if (referrer) {
          const referralSourceSnap = await getUserSnapshot(referrer)
          if (referralSourceSnap !== null) {
            await referralSourceSnap.ref.update({
              referralCount: FieldValue.increment(1),
            })
            //check if referrer is a checker
            await incrementCheckerCounts(referrer, "numReferred", 1)
            await userRef.update({
              firstMessageType: "prepopulated",
              utm: {
                source: referrer,
                medium: "uniqueLink",
                content: "none",
                campaign: "none",
                term: "none",
              },
            })
          } else {
            logger.error(`Referrer ${referrer} not found in users collection`)
          }
        }
      }
      await referralClickRef.update({
        isConverted: true,
      })
    } else {
      logger.error("Referral code not found in referralClicks collection")
    }
  }
}

export async function handlePreOnboardedMessage(
  userSnap: admin.firestore.DocumentSnapshot,
  message: WhatsappMessageObject
) {
  let step
  let shouldProcessJourney = true

  try {
    if (userSnap.get("numPreOnboardSubmissionsRemaining") <= 0) {
      console.log(`No more submissions remaining`)
      await sendOnboardingFlow(userSnap, false)
      step = "preonboard_limit_reached"
    } else {
      console.log(`More submissions remaining`)
      switch (message.type) {
        case "text":
          step = "preonboard_open"
          //if no text, throw error
          const text = message.text?.body
          if (!text) {
            throw new Error("No text in message")
          }
          if (text === PREPOPULATED_MESSAGE) {
            step = "preonboard_prepopulated"
            //wait 5 seconds before sending onboarding flow
            await sendCheckMateDemonstration(userSnap)
            break
          }
          if (text === INSTRUCTION_MESSAGE) {
            step = "preonboard_wrong_message"
            await sendCheckMateUsagePrompt(userSnap, true, true, true)
            break
          }
          if (await respondToSampleMessage(message, userSnap)) {
            step = "preonboard_sample"
            //wait 5 seconds before sending onboarding flow
            await new Promise((resolve) => setTimeout(resolve, 5000))
            await sendOnboardingFlow(userSnap, true)
            break
          }
          const needsChecking = await determineNeedsChecking({
            text: text,
          })
          if (!needsChecking) {
            step = "preonboard_trivial"
            if (userSnap.get("numPreOnboardMessagesSent") > 0) {
              await sendCheckMateUsagePrompt(userSnap, true)
            } else {
              await sendLanguageSelection(userSnap, true)
            }
            break
          }

          // Non-trivial message that needs checking
          step = "preonboard_needs_checking"
          await createAndPublishMessage(message, userSnap)
          break

        case "image":
          step = "preonboard_image"
          await createAndPublishMessage(message, userSnap)
          break

        case "interactive":
          const interactive = message.interactive
          if (!interactive) {
            logger.error("Message has no interactive object")
            break
          }
          switch (interactive.type) {
            case "button_reply":
              step = await onPreOnboardButtonReply(userSnap, message)
              break
          }
          break
        default:
          step = "preonboard_unsupported"
          await sendUnsupportedTypeMessage(userSnap, message.id)
          await sendCheckMateUsagePrompt(userSnap, false)
          break
      }
    }
    await userSnap.ref.update({
      numPreOnboardMessagesSent: FieldValue.increment(1),
    })
  } catch (error) {
    logger.error(`Error in handlePreOnboardedMessage: ${error}`)
  } finally {
    // Check if we should update the journey log
    if (checkPreV2User(userSnap)) {
      shouldProcessJourney = false
    }

    if (shouldProcessJourney && step) {
      const messageTimestamp = new Timestamp(Number(message.timestamp), 0)
      const timestampKey =
        messageTimestamp.toDate().toISOString().slice(0, -5) + "Z"

      await userSnap.ref.update({
        [`initialJourney.${timestampKey}`]: step,
      })
    }
  }
}

/**
 * Creates a GeneralMessage object and publishes it to the userNavigationEvents topic
 */
async function createAndPublishMessage(
  message: WhatsappMessageObject,
  userSnap: admin.firestore.DocumentSnapshot
) {
  //convert message to general Message object for processing
  let genericMessage: GeneralMessage = {
    source: "whatsapp",
    id: message.id,
    userId: message.from,
    isUserOnboarded: userSnap.get("isOnboardingComplete"),
    type: message.type,
    subject: null,
    text: message.text?.body ?? null,
    media: {
      fileId: message.image?.id ?? null, //to download the media
      caption: message.image?.caption ?? null,
      mimeType: message.image?.mime_type ?? null, //determines if it is an image or video
    },
    timestamp: message.timestamp,
    isForwarded: message.context?.forwarded,
    frequently_forwarded: message.context?.frequently_forwarded,
  }

  await publishToTopic("userGenericMessages", genericMessage, "whatsapp")
}

async function onPreOnboardButtonReply(
  userSnap: admin.firestore.DocumentSnapshot,
  messageObj: WhatsappMessageObject
) {
  const buttonId = messageObj.interactive?.button_reply.id
  if (!buttonId) {
    logger.error("No buttonId in interactive object")
    return
  }
  const [type, ...rest] = buttonId.split("_")
  let selection
  switch (type) {
    case "show":
      await sendCheckMateDemonstration(userSnap)
      break
    case "signup":
      await sendOnboardingFlow(userSnap, false)
      break
    case "languageSelection":
      ;[selection] = rest as [LanguageSelection]
      await userSnap.ref.update({
        language: selection,
      })
      await sendCheckMateUsagePrompt(userSnap, false)
      break
  }
  const step = "preonboard_button_" + type + (selection ? `_${selection}` : "")
  return step
}

async function respondToSampleMessage(
  message: WhatsappMessageObject,
  userSnap: admin.firestore.DocumentSnapshot
) {
  if (!message.text?.body) {
    throw new Error("No text in message")
  }
  const textNormalised = normalizeSpaces(message.text?.body).toLowerCase()

  for (const sample of SAMPLE_MESSAGES) {
    const sampleNormalised = normalizeSpaces(sample.message).toLowerCase()
    if (textNormalised === sampleNormalised) {
      console.log(`Sample message found`)
      await sendWhatsappTextMessage(
        "user",
        userSnap.get("whatsappId"),
        sample.response
      )
      if (sample.language !== userSnap.get("language")) {
        await userSnap.ref.update({
          language: sample.language,
        })
      }
      return true
    }
  }
  console.log(`No sample message found`)
  return false
}

export function checkPrepopulatedMessage(
  responses: ResponseObject,
  messageText: string
) {
  const textNormalised = normalizeSpaces(messageText).toLowerCase()
  if (
    checkTemplate(
      textNormalised,
      responses?.REFERRAL_PREPOPULATED_PREFIX.toLowerCase()
    ) ||
    checkTemplate(
      textNormalised,
      responses?.REFERRAL_PREPOPULATED_PREFIX_1.toLowerCase()
    )
  ) {
    return true
  }
  return false
}

export function checkBetaMessage( //TODO: Remove after BETA
  responses: ResponseObject,
  messageText: string
) {
  const textNormalised = normalizeSpaces(messageText).toLowerCase()
  if (
    checkTemplate(
      textNormalised,
      responses?.BETA_PREPOPULATED_PREFIX.toLowerCase()
    )
  ) {
    return true
  }
  return false
}

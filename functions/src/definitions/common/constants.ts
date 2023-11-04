const USER_BOT_RESPONSES = {
  UNTRUE: `{{thanks}}{{matched}}{{methodology}}*untrue*.❌{{image_caveat}}

Please do not spread it further⛔️⛔️

Thank you for keeping Singapore informed!`,

  MISLEADING: `{{thanks}}{{matched}}{{methodology}}*presented in a misleading or unbalanced way*, even though some elements within could be true!⚠️{{image_caveat}}

Please take it with a pinch of salt and think twice before spreading it further🚧🚧.

Thank you for keeping Singapore informed!`,

  ACCURATE: `{{thanks}}{{matched}}{{methodology}}*accurate*.✅{{image_caveat}}

Thank you for keeping Singapore informed!`,

  ERROR: `Oops, we encountered an error assessing this message.
  
You can try sending the message in again, or report the error via our form at https://bit.ly/checkmate-feedback. Sorry about that! 😔`,

  MESSAGE_NOT_YET_ASSESSED:
    "Hello! 👋 Thanks for sending this in! Our *CheckMates🕵🏻 will review this* and *provide the results soon*.",

  //button
  SCAM: `{{thanks}}{{matched}}{{methodology}}*a scam*!🚫{{image_caveat}}

We recommend you do not engage further⛔️⛔️

CheckMate will report suspicious messages to ScamShield (https://scamshield.org.sg) on your behalf.

To avoid reporting this message, select "Don't report this" below.`,

  //button
  ILLICIT: `{{thanks}}{{matched}}{{methodology}}*suspicious*!🚨{{image_caveat}}

We recommend you do not engage further⛔️⛔️

CheckMate will report suspicious messages to ScamShield (https://scamshield.org.sg) on your behalf.

To avoid reporting this message, select "Don't report this" below.`,

  SPAM: `{{thanks}}{{matched}}{{methodology}}spam!🚧{{image_caveat}}

It's likely harmless, but you should always make sure 🧐

Thank you for keeping Singapore safe!`,

  LEGITIMATE: `{{thanks}}{{matched}}{{methodology}}*from a legitimate source*.✅{{image_caveat}}

Thank you for keeping Singapore safe!`,

  UNSURE: `{{thanks}}

Unfortunately, our CheckMates are *unsure about this message*🤷🏻‍♂️🤷🏻‍♀️. Sorry, we're human too! 😞

If you haven't done so, you could send in the message with more context, e.g. sending in a screenshot containing the sender's number.

Thank you for keeping Singapore safe!`,

  THANKS_IMMEDIATE: `Thanks for sending this in! `,

  THANKS_DELAYED: `Thanks for waiting! `,

  IMAGE_CAVEAT: `

This assessment refers to any claims made within the captions. If there are no claims/captions, it refers to the image itself.`,

  METHODOLOGY_HUMAN: `Our CheckMates have reviewed this message and think it's `,

  METHODOLOGY_AUTO: `Based on pattern matching, our auto-classifier is confident that this message is `,

  //not used
  MATCHED: `In fact, other users have sent this message in {{numberInstances}} times. `,

  UNSUPPORTED_TYPE:
    "Sorry, CheckMate currently doesn't support this type of message.",

  SCAMSHIELD_EXPLAINER:
    "ScamShield is an anti-scam product developed by the National Crime Prevention Council and Open Government Products. You can learn more at https://scamshield.org.sg.",

  //not used
  STATS_TEMPLATE: `{{top}}% of our CheckMates identified this as *{{category1}}**{{info_placeholder}}*. *{{second}}*% felt this was *{{category2}}*.`,

  //button
  INTERIM_TEMPLATE: `At this time, {{%voted}}% of our CheckMates have assessed and voted on this message. The majority think is that this {{prelim_assessment}}{{info_placeholder}}. 

NOTE: This is a *preliminary result*. We aim to provide you with a more credible final result as soon as more of our CheckMates have voted, or when 24 hours has lapsed since you sent in your message.{{get_feedback}}`,

  INTERIM_TEMPLATE_UNSURE: `At this time, {{%voted}}% of our CheckMates have assessed and voted on this message. Unfortunately, our CheckMates either have not reached any clear consensus, or are still unsure how to assess the message at this time.

If you haven't done so, you could send in the message with more context, e.g. sending in a screenshot containing the sender's number.`,

  INTERIM_FEEDBACK: `

Thanks for trusting CheckMate! 👋🏼 If this interim update was useful to you, we'd appreciate it if you'd let us know by tapping on “Yes, it's useful” below. Otherwise, tap on “No, it's not” to continue waiting for the final result. Either way, you can continue to request more updates as more votes come in.`,

  //button
  INTERIM_PROMPT: `Thanks for waiting! We are currently still pending the assessment from some of our network of trusted CheckMate volunteers and will only be able to provide a credible final result once enough votes have come in. 

You may press the button below *to get an interim update of the preliminary result*. However, do note that there may be discrepancies between the preliminary and the final result, and *the preliminary result should be interpreted with caution*. We appreciate your patience and hope to deliver the final result to you soon! 💪🏼`,

  INTERIM_USEFUL: `Thanks for your valuable feedback! We will provide you with the final result as soon as more of our CheckMates have voted, or when 24 hours has lapsed since you sent in your message.

In the meantime, if you'd like another update after more votes come in, just tap the button below to request one.`,

  INTERIM_NOT_USEFUL: `Sorry to hear that, but thanks anyway for your valuable feedback! We will provide you with the final result as soon as more of our CheckMates have voted, or when 24 hours has lapsed since you sent in your message.

If you'd like still another update after more votes come in, just tap the button below to request one.`,

  ALREADY_REPLIED: `CheckMate has already provided a final response to this message.`,

  SCAMSHIELD_ON_DECLINE: `No worries! We will not send your message to ScamShield. Thank you for sharing this message with us, and for keeping Singapore safe!`,

  //menu text list
  MENU: `{{prefix}}

If you know what to do, please go ahead! Else, select "View Menu" below to see what CheckMate can do! 👈

Do note that CheckMate *is designed to check dubious messages you send in. It cannot converse freely with you*.

Anytime you need a refresher on what CheckMate can do, type "menu" to get here again! 😊`,

  //menu text list prefix
  NEW_USER_MENU_PREFIX: `Hello and welcome to CheckMate! We noticed it's your first time here. We're glad you've joined us to battle scams and misinformation😊.`,

  //menu text list prefix
  IRRELEVANT_MENU_PREFIX: `Thanks for waiting!🙏🏻 Our CheckMates didn't find anything to assess in this message.😕`,

  //menu text list prefix
  IRRELEVANT_AUTO_MENU_PREFIX: `Hmm...There doesn't seem to be anything to assess in this message.😕`,

  //menu text list prefix
  MENU_PREFIX: `Hi! Thanks for using CheckMate. 🙏🏻`,

  PROCEED_TO_SEND: `Nice! Just send/forward us the message. We'll help you check and/or report it! ✅✅

If you like, you can also send in screenshots 📷 or other images 🖼️! This can help to capture the sender's number, or a full conversation, which could help our CheckMates' assessment.

One last thing: by continuing to use CheckMate, you're agreeing to our privacy policy, which can be found at https://checkmate.sg/privacy-policy. In short, we only collect the messages sent to us and your number to facilitate a response!`,

  HOW_TO: `Check out https://youtube.com/shorts/gFeO_qFOchs?feature=share to see how CheckMate works!

Done? You're now ready to use CheckMate! Let's do our part in the fight against scams and misinformation! 💪`,

  LEARN_MORE: `To learn more about CheckMate, you can visit our website at https://checkmate.sg`,

  FEEDBACK: `You can submit feedback at https://bit.ly/checkmate-feedback. Rest assured, we'll read it ASAP!`,

  DISPUTE: `Thanks for letting us know! Our CheckMates will review the assessment of this message.`,

  CONTACT: `Here's our contact! Do add us to your contact list so you can find us in future. 😊`,

  REFERRAL: `Have you started checking and reporting suspicious messages using CheckMate yet? Sign up by clicking this link and sending in the pre-loaded message!! {{link}}`,

  REFERRAL_PREPOPULATED_PREFIX: `Welcome to CheckMate! Send in this entire message (including the code) to get started, and credit your friend with your referral. Code:`,

  GENERIC_PREPOPULATED_PREFIX: `Welcome to Checkmate! Send in this entire message (including the code) to get started. Code:`,

  REFERRAL_INVALID: `Sorry, referrals are only credited upon your first interaction with CheckMate.`,

  GENERIC_ERROR: `Sorry, an error occured. 😔 We'll be looking into this! Meanwhile, you can try out other functions of the bot. Apologies!`,

  SATISFACTION_SURVEY: `Thanks so much for using CheckMate🙏. We're improving the product from time to time, and your feedback is valuable to us.

On a scale from 1-10, how likely are you to recommend us to a friend, colleague or family member?`,

  SATISFACTION_SURVEY_THANKS: `Thanks for your feedback!`,

  HOWD_WE_TELL: `*This is an experimental feature powered by generative AI*. Do let us know if it was useful below!
 
{{rationalisation}}`,
  RATIONALISATION_USEFUL: `Thanks for your valuable feedback!`,

  RATIONALISATION_NOT_USEFUL: `Sorry to hear that, but thanks anyway for your valuable feedback!`,
}

const FACTCHECKER_BOT_RESPONSES = {
  VOTE_NO:
    "No problem! If you wish to come back and assess the message, you may do so by clicking the 'yes' button. See you soon!😊",

  //text list
  FACTCHECK_PROMPT:
    "Please assess the veracity of the claim(s) in this message on a scale from 0 to 5, where 0 means the claim(s) are entirely false, and 5 means the claim(s) are entirely true.",

  //text list
  L1_ASSESSMENT_PROMPT:
    "Which of these categories best describes this message?",

  //text list
  L2_OTHERS_ASSESSEMENT_PROMPT:
    "Which of these subcategories best describes this message?",

  RESPONSE_RECORDED:
    "Got it! Your response has been recorded. Thank you for playing your part in the fight against scams and misinformation, one message at a time! 💪",

  HOLD_FOR_NEXT_POLL:
    "Got it👍! Please hold for another poll to vote on how true the message is.",

  HOLD_FOR_L2_CATEGORISATION: "Got it👍! Please hold for another selection.",

  ONBOARDING_1:
    "Welcome to our community of CheckMates! 👋🏻 We're grateful to have you on board to combat misinformation and scams. 🙇‍♀️🙇🏻 We'd love to get to know you better - could you *reply to this message* and share your name with us? (Reply to this message by swiping right)!",

  ONBOARDING_2:
    "Thank you and welcome, {{name}}! We're thrilled to have you on board as we work together to combat misinformation and scams.😊 By using the CheckMate bot, you are accepting our privacy policy which can be found here: https://bit.ly/checkmate-privacy",

  ONBOARDING_3: `To ensure you're equipped with the necessary skills to identify misinformation and scams, let's start with a quick quiz. 📝 Simply follow the link (https://bit.ly/checkmates-quiz) to take the quiz. Once you've completed it, come back to this chat and click on "I've done the quiz!" to notify me. Let's get started! 🤖`,

  ONBOARDING_4: `Awesome! Now that you know how to identify misinformation and scams, you are ready to help us combat them! 🙌🏻 If you haven't already, do join this WhatsApp group (https://bit.ly/checkmates-groupchat) that brings together all the other CheckMates and the core product team for updates and feedback. If you're looking for resources, you can visit our wiki page (https://bit.ly/checkmates-wiki). Thanks again for joining our community of CheckMates. Enjoy! 👋🏻🤖`,

  NOT_A_REPLY:
    "Sorry, did you forget to reply to a message? You need to swipe right on the message to reply to it.",

  //button
  OUTSTANDING_REMINDER:
    "You have *{{num_outstanding}} remaining messages* to assess. Would you like to be sent the next one in line?",

  NO_OUTSTANDING:
    "Great, you have no further messages to assess. Keep it up!💪",
}

const env = process.env.ENVIRONMENT

const thresholds = {
  endVote: 0.5,
  endVoteSus: 0.2,
  endVoteUnsure: 0.8,
  startVote: 1,
  isSpam: 0.5,
  isLegitimate: 0.5,
  isInfo: 0.5,
  isIrrelevant: 0.5,
  isUnsure: 0.5,
  isSus: 0.5,
  falseUpperBound: 1.5,
  misleadingUpperBound: 3.5,
  sendInterimMinVotes: 1,
  surveyLikelihood: env !== "PROD" ? 1 : 0.25,
  satisfactionSurveyCooldownDays: 30,
}

export { USER_BOT_RESPONSES, FACTCHECKER_BOT_RESPONSES, thresholds }

exports.USER_BOT_RESPONSES = {
  UNTRUE: `{{thanks}}{{matched}}{{methodology}}*untrue*.❌
  
Please do not spread it further⛔️⛔️

Thank you for keeping Singapore informed!`,

  MISLEADING: `{{thanks}}{{matched}}{{methodology}}*presented in a misleading or unbalanced way*, even though some elements within could be true!⚠️

Please take it with a pinch of salt and think twice before spreading it further🚧🚧.

Thank you for keeping Singapore informed!`,

  ACCURATE: `{{thanks}}{{matched}}{{methodology}}*accurate*.✅

Thank you for keeping Singapore informed!`,

  ERROR: `Oops, we encountered an error assessing this message.
  
You can try sending the message in again, or report the error via our form at https://bit.ly/checkmate-feedback. Sorry about that! 😔`,

  MESSAGE_NOT_YET_ASSESSED:
    "Hello! 👋 Thanks for sending this in! Our *CheckMates🕵🏻 will review this* and *provide the results soon*.",

  //button
  SCAM: `{{thanks}}{{matched}}{{methodology}}*a scam*!🚫

We recommend you do not engage further⛔️⛔️

This is the collective opinion of our CheckMates. That said, ScamShield (https://scamshield.org.sg) is still the authoritative, official source for scams in Singapore. We are currently exploring a collaboration with ScamShield.

Would you like us to share this message with ScamShield? Only the contents of this message, and no other information, will be sent.{{results}}`,

  //button
  ILLICIT: `{{thanks}}{{matched}}{{methodology}}*suspicious*!🚨

We recommend you do not engage further⛔️⛔️

This is the collective opinion of our CheckMates. That said, ScamShield (https://scamshield.org.sg) is still the authoritative, official source for scams in Singapore. We are currently exploring a collaboration with ScamShield.

Would you like us to share this message with ScamShield? Only the contents of this message, and no other information, will be sent.{{results}}`,

  SPAM: `{{thanks}}{{matched}}{{methodology}}spam!🚧 

It's likely harmless, but you should always make sure 🧐

Thank you for keeping Singapore safe!`,

  LEGITIMATE: `{{thanks}}{{matched}}{{methodology}}*from a legitimate source*.✅

Thank you for keeping Singapore safe!`,

  UNSURE: `{{thanks}}

Unfortunately, our CheckMates are *unsure about this message*🤷🏻‍♂️🤷🏻‍♀️. Sorry, we're human too! 😞

If you haven't done so, you could send in the message with more context, e.g. sending in a screenshot containing the sender's number.

Thank you for keeping Singapore safe!`,

  THANKS_IMMEDIATE: `Thanks for sending this in! `,

  THANKS_DELAYED: `Thanks for waiting! `,

  METHODOLOGY_HUMAN: `Our CheckMates have reviewed this message and think it's `,

  METHODOLOGY_AUTO: `Based on pattern matching, our auto-classifier is confident that this message is `,

  VOTE_RESULTS_SUFFIX: ` You can also see how we voted, before deciding.`,

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

NOTE: This is a *preliminary assessment*. We will update you with a final assessment once more of our CheckMates have voted, or latest 24 hours since you sent in your message. The final assessment will be more credible, as more CheckMates would have voted. Thank you for using CheckMate!`,

  INTERIM_TEMPLATE_UNSURE: `At this time, {{%voted}} of our CheckMates have assessed and voted on this message. Unfortunately, our CheckMates either have not reached any clear consensus, or are still unsure how to assess the message at this time.
  
If you haven't done so, you could send in the message with more context, e.g. sending in a screenshot containing the sender's number.`,

  //button
  INTERIM_PROMPT: `Thanks for waiting! We're still pending some of our volunteer CheckMates to assess and vote on this message.

CheckMate relies on the wisdom of crowds, thus we will only be able to provide a credible final assessment once enough votes have come in.
  
However, if you want an early update of what our CheckMates think this message is, press the button below. Do note that this *is a preliminary assessment, of which we have less confidence in*. Please take it with a pinch of salt.`,

  ALREADY_REPLIED: `CheckMate has already provided a final response to this message.`,

  //button
  SCAMSHIELD_SEEK_CONSENT:
    "Would you now like us to share this message with ScamShield on your behalf? Only the contents of this message, and no other information, will be sent.",

  SCAMSHIELD_ON_CONSENT:
    "Thank you for sharing this message with us and ScamShield, and for keeping Singapore safe!",

  SCAMSHIELD_ON_DECLINE: `No worries! We will not send your message to ScamShield. If you change your mind, you can still hit "Yes" above. Thank you for sharing this message with us, and for keeping Singapore safe!`,

  //menu text list
  MENU: `{{prefix}}

Select "View Menu" below to see what CheckMate can do! 👈 Scroll down to see all the options, select one, then hit send.

Do note that CheckMate *cannot respond like a human*. Do stick to the existing menu options if not sending in messages for checking! 😅

To pull up this selection anytime, just type "menu"!`,

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
}

exports.FACTCHECKER_BOT_RESPONSES = {
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

exports.thresholds = {
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
}

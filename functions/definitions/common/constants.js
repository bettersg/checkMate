exports.USER_BOT_RESPONSES = {
  1.5: "⛔⛔ Thank you for waiting! Our CheckMates have reviewed the message and think it's *likely to be untrue*.❌\n\nPlease do not spread it further⛔️\n\nThank you for keeping Singapore informed!",
  3.5: "🚧🚧 Thank you for waiting! Our CheckMates have reviewed the message and think that *while some elements within could be true, it's presented in a misleading way*.⚠️\n\nPlease take it with a pinch of salt and think twice before spreading it further🚧.\n\nThank you for keeping Singapore informed!",
  5: "✅✅ Thank you for waiting! Our CheckMates have reviewed the message and think that it's *accurate*.✅\n\nThank you for keeping Singapore informed!",
  IRRELEVANT: "Thank you for waiting! Our CheckMates have reviewed the message and think it's *harmless*.👌",
  NO_SCORE: "Hello! 👋 Thank you for sending this in! Our *CheckMates🕵🏻 will be reviewing this message* and *providing you with the results soon*.",
  MESSAGE_NOT_YET_ASSESSED: "Hello! 👋 Thank you for sending this in! Our *CheckMates🕵🏻 will be reviewing this message* and *providing you with the results soon*.",
  SCAM: "⛔⛔ Thank you for waiting! Our CheckMates have reviewed the message and think this is likely to be a *scam*!🚫\n\nWe recommend you do not engage further⛔️\n\nThank you for keeping Singapore safe!",
  SUSPICIOUS: "⛔⛔ Thank you for waiting! Our CheckMates have reviewed the message and think this *looks suspicious*!🚨\n\nWe recommend you do not engage further⛔️\n\nThank you for keeping Singapore safe!",
  UNSUPPORTED_TYPE: "Sorry, CheckMate currently doesn't support this type of message.",
  DEMO_SCAM_MESSAGE: "Imagine this is a scam message that you receive in another WhatsApp chat. Forward me in to this same chat to try how CheckMate works!",
  DEMO_SCAM_PROMPT: "If you receive a scam message like this demo one above, just forward or copy and send it to this number. Go ahead and try it to see how CheckMate works!",
  ONBOARDING_END: "See how it works now? When you see a message that you're unsure of 🤔, just forward it in and we'll help you check it ✅✅. It works for images/photos too! Apart from such messages, please don't send in anything else, because then our CheckMates will have to review it. Now, let's go do our part in the fight against scams and fake news! 💪"
};

exports.FACTCHECKER_BOT_RESPONSES = {
  VOTE_NO: "No problem! If you wish to come back and assess the message, you may do so by clicking the 'yes' button. See you soon!😊",
  FACTCHECK_PROMPT: "Please vote on the new viral message above. If there is no claim in the message, select 'No Claim Made'. Otherwise, assess the veracity of the claim(s) on a scale from 0 to 5, where 0 means the claims(s) are entirely false, and 5 means the claims(s) are entirely true.",
  SCAM_ASSESSMENT_PROMPT: "Is this message a scam, i.e. an attempt to trick someone into giving away their money or personal information, or is it something else?",
  RESPONSE_RECORDED: "Got it! Your response has been recorded. Thank you for playing your part in the fight against scams and misinformation, one message at a time! 💪",
  HOLD_FOR_NEXT_POLL: "Got it👍! Please hold for another poll to vote on how true the message is.",
  ONBOARDING_START: "Welcome to the community of CheckMates! To complete signup, please *reply to this message (swipe right on it)* with the name you'd like CheckMate to address you as, e.g. Aaron",
  ONBOARDING_SUCCESS: "Hi {{name}}, welcome to CheckMate! You're now all set to help check messages that our users send in 💪",
  NOT_A_REPLY: "Sorry, did you forget to reply to a message? You need to swipe right on the message to reply to it.",
};

exports.thresholds = {
  endVote: 0.5,
  endVoteScam: 0.2,
  startVote: 1,
  isIrrelevant: 0.5,
  isScam: 0.7,
};

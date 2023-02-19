exports.USER_BOT_RESPONSES = {
  1.5: "This message is likely to contain fabricated/untrue claims. We encourage you not to forward it on before making absolutely sure it is accurate. Thank you for using CheckMate.😊💪",
  3.5: "This message is likely to contain some truth, but may be misleading or otherwise contain some untrue claims. We encourage you to treat the claims within with a pinch of salt. Thank you for using CheckMate.😊💪",
  5: "This message is likely to contain accurate and well-sourced claims. Thank you for using CheckMate.😊💪",
  IRRELEVANT: "CheckMate has assessed the message and found that there are no meaningful claims made within it. Thank you for using CheckMate.😊💪",
  NO_SCORE: "Sorry! CheckMate has yet to assess the message",
  MESSAGE_NOT_YET_ASSESSED: "Sorry, CheckMate doesn't have an answer for you now. We will update you again if the message has been accessed",
  SCAM: "CheckMate has assessed that this message is likely to be a scam!",
  UNSUPPORTED_TYPE: "Sorry, CheckMate currently doesn't support this type of message.",
  DEMO_SCAM_MESSAGE: "<Demo Scam Message>",
  DEMO_SCAM_PROMPT: "If you receive a scam message like this demo one above, just forward or copy and send it to this number. Go ahead and try it to see how CheckMate works!",
  ONBOARDING_END: "See how it works now? When you see a message that you're unsure of 🤔, just forward it in and we'll help you check it ✅✅. It works for images/photos too! Apart from such messages, please don't send in anything else, because then our CheckMates will have to review it. Now, let's go do our part in the fight against scams and fake news! 💪"
};

exports.FACTCHECKER_BOT_RESPONSES = {
  VOTE_NO: "Sure, no worries! If you change your mind, you can go back up to the message and click yes. 😊",
  FACTCHECK_PROMPT: "Please vote on the new viral message above. If there is no claim in the message, select 'No Claim Made'. Otherwise, assess the veracity of the claim(s) on a scale from 0 to 5, where 0 means the claims(s) are entirely false, and 5 means the claims(s) are entirely true.",
  SCAM_ASSESSMENT_PROMPT: "Is this message a scam, i.e. an attempt to trick someone into giving away their money or personal information, or is it something else?",
  RESPONSE_RECORDED: "Your response has been recorded. Thank you! 🙏",
  HOLD_FOR_NEXT_POLL: "Thank you 🙏! Please hold for another poll to vote on how true the message is.",
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

exports.USER_BOT_RESPONSES = {
  1.5: "This message is likely to contain fabricated/untrue claims. We encourage you not to forward it on before making absolutely sure it is accurate. Thank you for using CheckMate.😊💪",
  3.5: "This message is likely to contain some truth, but may be misleading or otherwise contain some untrue claims. We encourage you to treat the claims within with a pinch of salt. Thank you for using CheckMate.😊💪",
  5: "This message is likely to contain accurate and well-sourced claims. Thank you for using CheckMate.😊💪",
  IRRELEVANT: "CheckMate has assessed the message and found that there are no meaningful claims made within it. Thank you for using CheckMate.😊💪",
  NO_SCORE: "Sorry! CheckMate has yet to assess the message",
  MESSAGE_NOT_YET_ASSESSED: "Sorry, CheckMate doesn't have an answer for you now. We will update you again if the message has been accessed",
  UNSUPPORTED_TYPE: "Sorry, CheckMate currently doesn't support this type of message.",
};

exports.FACTCHECKER_BOT_RESPONSES = {
  VOTE_NO: "Sure, no worries! If you change your mind, you can go back up to the message and click yes. 😊",
  FACTCHECK_PROMPT: "Please vote on the new viral message above. If there is no claim in the message, select 'No Claim Made'. Otherwise, assess the veracity of the claim(s) on a scale from 0 to 5, where 0 means the claims(s) are entirely false, and 5 means the claims(s) are entirely true.",
  SCAM_ASSESSMENT_PROMPT: "Is this message a scam, i.e. an attempt to trick someone into giving away their money or personal information, or is it something else?",
};

exports.thresholds = {
  endVote: 0.2,
  startVote: 1,
  isIrrelevant: 0.5,
};

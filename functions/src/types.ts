import { Timestamp } from "firebase-admin/firestore"
import { DocumentReference } from "@google-cloud/firestore"

export type WhatsappMessage = {
  from: string
  id: string
  timestamp: string
  text: {
    body: string
  }
  type: string
}

export type WhatsappButton = {
  type: string
  reply: {
    id: string
    title: string
  }
}

export type LanguageSelection = "en" | "cn"

export type WhatsappMessageObject = {
  from: string
  type: string
  button: {
    text: string
    payload: string
  }
  id: string
  interactive: {
    type: string
    list_reply: { id: string }
    button_reply: { id: string }
    nfm_reply?: {
      name: string
      body: string
      response_json: string // JSON string containing flow-specific data
    }
  }
  text: { body: string }
  context: { id: string; forwarded: boolean; frequently_forwarded: boolean }
  timestamp: number
  image?: { caption: string; id: string; mime_type: string }
}

type TagsMap = {
  [tag: string]: boolean
}

export type TelegramMessageObject = {
  message_id: number
  from?: {
    id: number
    is_bot: boolean
    first_name: string
    language_code: string
  }
  chat: {
    id: number
    type: string
  }
  reply_to_message?: TelegramMessageObject
  date: number
  text?: string
  entities?: {
    type: string
    offset: number
    length: number
    url: string
  }[]
  photo?: {
    file_id: string
    file_unique_id: string
    file_size: number
    width: number
    height: number
  }[] //an array of photo sizes, last one in the array gives the full size
  video?: {
    file_id: string
    file_unique_id: string
    width: number
    height: number
    duration: number
    thumbnail?: {
      file_id: string
      file_unique_id: string
      file_size: number
      width: number
      height: number
    }
    file_name?: string
    mime_type?: string
    file_size?: number
  }
  caption?: string
  caption_entities?: {
    type: string
    offset: number
    length: number
    url: string
  }[]
}
//General Message object
export type GeneralMessage = {
  source: string //the source of the message, e.g. whatsapp, telegram
  id: string //the message id received
  userId: string
  type: string
  subject: string | null //for emails
  text: string | null
  media?: {
    fileId: string | null //to download the media
    caption: string | null
    mimeType: string | null //determines if it is an image or video
  } | null
  timestamp: number
  isForwarded: boolean | null
  frequently_forwarded: boolean | null
}

export type MessageData = {
  machineCategory: string //category assigned by the machine learning model. Can be either "scam", "illicit", "spam", "info", "irrelevant", "irrelevant_length", or "unsure"
  isMachineCategorised: boolean //whether or not the message was categorised by the machine learning model
  isWronglyCategorisedIrrelevant: boolean //whether or not the message was categorised as irrelevant by the machine learning model but was actually not as indicated by the user
  originalText: string | null //the original, unredacted text of the message. For image messages, this is the OCR-extracted text from the image if present
  text: string | null //the text of the message, redacted for PII, to be shown on website and to checkers. For image messages, this is the redacted OCR-extracted text from the image if present
  caption: string | null //for image messages, the caption of the image
  latestInstance: DocumentReference | null //reference to the most recent instance of the message that has been sent in
  firstTimestamp: Timestamp //the timestamp of the first instance of the message
  lastTimestamp: Timestamp //the timestamp of the most recent instance of the message
  lastRefreshedTimestamp: Timestamp //the timestamp of the last time the message was refreshed
  isPollStarted: boolean //whether or not the checkers poll has been sent out for this message
  isAssessed: boolean //whether or not the message has been considered assessed, i.e. ready to reply the users who sent it in
  assessedTimestamp: Timestamp | null //the timestamp when the message was considered assessed
  assessmentExpiry: Timestamp | null //the timestamp at which the assessment expires, not yet implemented
  assessmentExpired: boolean //whether the assessment has expired
  truthScore: number | null //the mean of the checker-submitted truth scores for this message
  numberPointScale: 5 | 6 //whether or not this message was voted on with the 5-point or 6-point truth scale
  isControversial: boolean | null //whether this message is considered controversial (by GenAI)
  isIrrelevant: boolean | null //whether this message is considered irrelevant, i.e. whether the sum of irrelevant votes > irrelevant threshold
  isScam: boolean | null //whether this message is considered scam, i.e. the sum of scam votes > scam threshold
  isIllicit: boolean | null //whether this message is considered illicit, i.e. the sum of illicit votes > illicit threshold
  isSpam: boolean | null //whether this message is considered spam, i.e. the sum of spam votes > spam threshold
  isLegitimate: boolean | null //whether this message is considered legitimate, i.e. the sum of legitimate votes > legitimate threshold
  isUnsure: boolean | null //whether this message is considerde unsure, i.e. if the message is not any of the other categories
  isInfo: boolean | null //whether this message is considered info, i.e. the sum of info votes > info threshold
  isSatire: boolean | null //whether this message is considered satire, i.e. the sum of satire votes > satire threshold
  isHarmful: boolean | null //whether this message is considered harmful, i.e. the sum of scam + illicit + untrue votes > harmful threshold
  isHarmless: boolean | null //whether this message is considered harmless, i.e. the sum of legitimate + accurate + spam votes > harmless threshold
  tags: TagsMap //tags assigned to the message
  primaryCategory: string | null //the category that the message has been assigned to. Either "scam", "illicit", "satire", "untrue", "misleading", "accurate", "spam", "legitimate", "irrelevant", "unsure" or "error". Note, legitimate refers to nvc-credible and irrelevant nvc-cant-tell.
  customReply: CustomReply | null //the admin-assigned custom reply for this message, that supercedes the default replies
  communityNoteStatus: string | null //the status of the community note for this message, either "error", "generated" or "unusable"
  communityNote: CommunityNote | null // the gen-ai generated community note for this message
  instanceCount: number //the number of instances of this message
  adminGroupSentMessageId: string | null // The original message id of the message sent to the admin group
}

export type InstanceData = {
  source: string //Source of the message, e.g. whatsapp, telegram, email
  id: string | null //whatsapp id for the instance
  timestamp: Timestamp //Timestamp where the instance was received by CheckMate
  type: "text" | "image" //Type of the message. Currently either "text" or "image"
  text: string | null //Either the text of the message for text messages, or the OCR-extracted text of the image for image messages. Not redacted for PII.
  textHash: string | null //Hash of the text of the message. Identifical messages will have the same hash
  caption: string | null //Caption of the image, if the message is an image
  captionHash: string | null //Hash of the caption of the image, if the message is an image
  sender: string | null //OCR-extracted sender of the original message to the user (e.g. the scammer etc), if present in the screenshot
  imageType: "convo" | "email" | "letter" | "others" | null //Type of image, if the message is an image. Either "convo" for conversation screenshots, "email" for email screenshots, "letter" for letter screenshots, or "others" for other types of images. Decided by the LLM.
  ocrVersion: string | null //Version of the OCR engine used to extract text from the image
  from: string | null //The sender of the message to CheckMate. For whatsapp, this would be the whatsapp phone number
  subject: string | null //The subject of the message, if the message is an email
  hash: string | null //Locality sensitive hash of the image. Similar images will have the same hash
  mediaId: string | null //file ID of the image, if the message is an image
  mimeType: string | null //MIME type of the image, if the message is an image
  storageUrl: string | null //URL of the image in the storage bucket
  isForwarded: boolean | null //Whether the message was forwarded, based on whatsapp webhook
  isFrequentlyForwarded: boolean | null //Whether the message was frequently forwarded, based on whatsapp webhook
  isReplied: boolean //Whether the message has been replied to
  isInterimPromptSent: boolean | null //Whether the interim prompt, inviting the user to get the interim response, has been sent
  isInterimReplySent: boolean | null //Whether the interim response has been sent
  isMeaningfulInterimReplySent: boolean | null //Whether the interim response was meaningful, i.e. not unsure
  isRationalisationSent: boolean | null //Whether the rationalisation has been sent
  isRationalisationUseful: boolean | null //Whether the rationalisation was voted as useful by the user
  isCommunityNoteSent: boolean | null //Whether the community note has been sent
  isCommunityNoteCorrected: boolean //Whether the community note has been corrected
  isCommunityNoteUseful: boolean | null //Whether the community note was voted as useful by the user
  isCommunityNoteReviewRequested: boolean | null //Whether the user requested to see the human review
  isIrrelevantAppealed: boolean | null //Whether the user indicate that they message was incorrectly marked by the automated pipelines as irrelevant
  isReplyForced: boolean | null //Whether the reply was forced at the end of 24 hours, without the message naturally being assessed.
  isMatched: boolean //Whether this instance has been matched to a message in the database. If it is not matched, it will be the first instance of a new message.
  isReplyImmediate: boolean | null //Whether the reply was sent immediately after the message was received, meaning it was either matched or auto-categorised
  replyCategory: string | null //The category of the reply sent to the user. May not be equivalent to the primaryCategory of the message, which could change over time.
  replyTimestamp: Timestamp | null //The timestamp when the reply was sent
  disclaimerSentTimestamp: Timestamp | null //The timestamp when the controversial disclaimer was sent, if applicable
  disclaimerAcceptanceTimestamp: Timestamp | null //The timestamp when the user accepted the controversial disclaimer, if applicable
  matchType: string //The type of match. Either "none" (no match), "similarity" (match based on semantic similarity of text), "image" (match based on the perceptual hash) or "exact" (match based on exact text match)
  scamShieldConsent: boolean | null //Whether the user has consented to share the message with ScamShield. Defaults to true unless user explicitly opts out.
  embedding: number[] | null // Embedding of the message
  closestMatch: {
    instanceRef: DocumentReference | null //Reference to the closest matching instance
    text: string | null //Text of the closest matching instance
    score: number | null //Similarity score of the closest matching instance
    parentRef: DocumentReference | null //Reference to the parent message of the closest matching instance
    algorithm: string //Algorithm used to find the closest match
  }
  isSatisfactionSurveySent: boolean | null //Whether the satisfaction (aka NPS) survey was sent for this message
  satisfactionScore: number | null //The score, from 0-10, given by the user to the satisfaction survey
  flowId: string | null //If a flow was triggered from this instance, this tracks the flowId. Otherwise null
  communityNoteMessageId: string | null // ID of the community note sent in the telegram admin group
}

export type ReferralClicksData = {
  referralId: string //either "add", or a hash identifying the user.
  utmSource: string //the source of the click
  utmMedium: string //the medium of the click
  utmCampaign: string //the campaign of the click
  utmContent: string //the content of the click
  utmTerm: string //the term of the click
  isConverted: boolean //whether they onboarded onto the users app or not
  variant: string //the variant of the referral message
  timestamp: Timestamp //the timestamp of the click
}

export type UserData = {
  whatsappId: string | null // The user's whatsapp phone number
  telegramId: string | null // The user's telegram id, if available. Note this is not the username
  emailId: string | null // The user's email address, if available
  ageGroup: "<20" | "21-35" | "36-50" | "51-65" | ">65" | null // The user's age group
  instanceCount: number // Number of instances sent by this user
  firstMessageReceiptTime: Timestamp // Timestamp of the first interaction between the user and the WhatsApp bot.
  firstMessageType: "normal" | "irrelevant" | "prepopulated" // One of "normal" (a normal message that wasn't categorised as "irrelevant", and so created an instance), "irrelevant" (stuff like hello which got auto-categorised as this), or "prepopulated" (referral link)
  lastSent: Timestamp | null //Timestamp of the last instance sent by the and the WhatsApp bot
  satisfactionSurveyLastSent: Timestamp | null // When satisfaction survey was last sent, used to implement cooldown for sending the survey
  initialJourney: Record<string, string> // Assuming initialJourney is an object with unknown properties
  referralId: string // Hash of the user, used to track referrals
  utm: {
    source: string // The source of the referral
    medium: string // The medium of the referral
    content: string // The content of the referral
    campaign: string // The campaign of the referral
    term: string // The term of the referral
  }
  referralCount: number // Number of referrals made by this user
  isReferralMessageSent: boolean // Whether the referral prompt, asking the user to send a referral link to their friends, has been sent
  isReminderMessageSent: boolean // Whether the reminder message, reminding the user of how to use CheckMate, has been sent
  language: LanguageSelection // The user's preferred language, either "en" or "cn"
  isSubscribedUpdates: boolean // Whether the user wants to receive proactive updates/messages from CheckMate
  isIgnored: boolean // Whether the user is blocked
  isOnboardingComplete: boolean // Whether the user has completed the onboarding flow (selected language, age group, agreed to terms of use)
  numSubmissionsRemaining: number // Number of submissions made in given time period
  submissionLimit: number // Number of submissions allowed in given time period
  isInterestedInSubscription: boolean | null // Whether the user is interested in subscribing to CheckMate's paid tier at $5 a month
  isInterestedAtALowerPoint: boolean | null // Whether the user is interested in subscribing to CheckMate's paid tier at a lower price point
  interestedFor: Array<string> | null // For whom the user is interested subscribing, can be "me", "parents", "children", "relatives", "friends", "others"
  priceWhereInterested: number | null // The price point when the user is interested
  feedback: string | null // The user's feedback, if they've provided any
  tier: "free" | "paid"
  isTester: boolean //Whether or not the user is whitelisted for the beta phase
}

export type CheckerData = {
  name: string | null // The name of the Checker, set by them on onboarding
  telegramUsername: string | null // The Telegram username of the Checker, if available
  type: "human" | "ai" // Either "human" or "ai"
  isActive: boolean // Whether the Checker is active and receiving new messages to vote on
  lastActivatedDate: Timestamp | null // The last date the Checker was made active
  isOnboardingComplete: boolean | null // Whether the Checker has completed onboarding
  isQuizComplete: boolean // Whether the Checker has completed the quiz
  quizScore: number | null // The score the Checker got on the quiz, not yet saved
  onboardingStatus: // The onboarding status of the Checker, either "name", "number", "verify", "quiz", "onboardWhatsapp", "joinGroupChat", "nlb", "completed", or "offboarded"
  | "name"
    | "number"
    | "verify"
    | "quiz"
    | "onboardWhatsapp"
    | "joinGroupChat"
    | "nlb"
    | "completed"
    | "offboarded"
  onboardingTime: Timestamp | null // The time the Checker completed his onboarding
  offboardingTime: Timestamp | null // The time the Checker was offboarded, if he was offboarded
  lastTrackedMessageId: number | null // The last Telegram message ID of the message sent to user. Used for determining where the user was at in the onboarding process.
  isAdmin: boolean // Whether this checker is an admin
  singpassOpenId: string | null // The Singpass OpenID of the checker, if available. Not yet implemented
  telegramId: number | null // The Telegram ID of the checker
  whatsappId: string | null // The WhatsApp ID of the checker, obtained on onboarding
  hasReceivedExtension: boolean // Whether the checker has received an extension to complete the program
  hasCompletedProgram: boolean // Whether the checker has completed the CheckMate's program
  certificateUrl?: string | null // The public cloud storage URL of the certificate, if the checker has completed the program
  level: number // The level of the checker, for gamification. Not yet implemented
  experience: number // The experience of the checker, for gamification. Not yet implemented
  tier: "beginner" | "intermediate" | "expert" // The tier of the checker. Not yet implemented
  numVoted: number // Number of messages voted on
  numReferred: number // Number of new users referred
  numReported: number // Number of non-trivial (aka nvc-cant tell) instances sent in sent in
  voteWeight: number // How much weight to give this checker's votes. Not implemented
  numCorrectVotes: number // Number of correct votes made by the checker. Correct is defined as same category, and if category is info, +-1 away from mean truth score
  numNonUnsureVotes: number // Number of votes on messages that didn't end as unsure, to act as the denominator for computing accuracy
  numVerifiedLinks: number // Number of links sent in by the checker. Not yet implemented
  preferredPlatform: string | null // The preferred platform of the checker, either "telegram" or "whatsapp", but only "telegram" for now
  lastVotedTimestamp: Timestamp | null // The timestamp of the last vote made by the checker
  getNameMessageId: string | null // The Telegram message ID of the message asking the checker to input their name, used for onboarding ops only
  leaderboardStats: LeaderBoardStats // The leaderboard stats of the checker
  programData: ProgramData // The Checker Program data of the checker
  dailyAssignmentCount: Number // Daily count of checker votes
  isTester: Boolean //Whether or not the checker is whitelisted for the beta phase. Whitelisted checkers will see and vote on GenAI replies
  hasBlockedTelegramMessages: Boolean //Whether or not the checker has blocked CheckMate from sending them messages on Telegram
}

export type NudgeData = {
  type: string //type of nudge, e.g. "reactivation"
  sentTimestamp: Timestamp
  outcomeTimestamp: Timestamp | null
  variant: string
  outcome: string | null
}

export type FlowData = {
  type: "waitlist" | "onboarding" //types of flows available
  whatsappId: string //whatsappId of the user the flow was sent to
  sentTimestamp: Timestamp
  outcomeTimestamp: Timestamp | null
  outcome: string | null
  variant: string
}

type LeaderBoardStats = {
  numVoted: number // number of votes cast where the parent message category is not unsure
  numCorrectVotes: number // number of correct votes cast where the parent message category is not unsure
  totalTimeTaken: number // total time taken to vote where the parent message category is not unsure
  score: number // total score of this checker for the leaderboard
}

export type CheckerProgramStats = {
  accuracy: number | null
  numVotes: number
  numReferrals: number
  numReports: number
  isProgramCompleted: boolean
  isNewlyCompleted: boolean
  completionTimestamp: Timestamp | null
}

export type ProgramData = {
  isOnProgram: boolean
  programStart: Timestamp | null
  programEnd: Timestamp | null
  numVotesTarget: number //target number of messages voted on to complete program
  numReferralTarget: number //target number of referrals made to complete program
  numReportTarget: number //number of non-trivial messages sent in to complete program
  accuracyTarget: number //target accuracy of non-unsure votes
  numVotesAtProgramStart: number //number of votes checker has made at program start
  numReferralsAtProgramStart: number //number of referrals checker has made at program start
  numReportsAtProgramStart: number //number of non-trivial messages reports checker has made at program start
  numCorrectVotesAtProgramStart: number //number of non-unsure correct votes checker has made at program start
  numNonUnsureVotesAtProgramStart: number //number of non-unsure votes checker has made at program start
  numVotesAtProgramEnd: number | null //number of votes checker has made at program end
  numReferralsAtProgramEnd: number | null //number of referrals checker has made at program end
  numReportsAtProgramEnd: number | null //number of non-trivial messages reports checker has made at program end
  numCorrectVotesAtProgramEnd: number | null //number of non-unsure correct votes checker has made at program end
  numNonUnsureVotesAtProgramEnd: number | null //number of non-unsure votes checker has made at program end
}

export type LeaderboardEntry = {
  id: string
  position: number
  name: string
  numVoted: number
  accuracy: number
  averageTimeTaken: number
  score: number
}

export type VoteRequest = {
  factCheckerDocRef: DocumentReference // The firestore document reference of the checker
  platformId: string | null // The platform id of the checker, either the whatsappId or the telegramId
  platform: "whatsapp" | "telegram" | "agent" // The platform the checker is on, either "whatsapp", "telegram" or "agent"
  hasAgreed: boolean | null // to remove eventually
  triggerL2Vote: boolean | null // to remove eventually
  triggerL2Others: boolean | null // to remove eventually
  sentMessageId: string | null // The message id of the message sent to the checker. To remove eventually
  truthScore: 0 | 1 | 2 | 3 | 4 | 5 | null // The truth score assigned to the message by the checker, on a 0-5 scale. Null means no truth score
  numberPointScale: 5 | 6 // The number point scale of the vote, either 5 (1-5) or 6 (0-5)
  category: // The category of the message, either "scam", "illicit", "info", "satire", "spam", "legitimate", "irrelevant", "unsure", "pass". Null means not yet voted
  | "scam"
    | "illicit"
    | "info"
    | "satire"
    | "spam"
    | "legitimate"
    | "irrelevant"
    | "unsure"
    | "pass"
    | null
  isAutoPassed: boolean // Whether the message was auto-passed after 48 hours, to avoid massive influx of messages to vote upon return
  reasoning: string | null // The reasoning given by the fact-checking agent for their vote. Null for human checkers
  createdTimestamp: Timestamp | null // The timestamp when the vote request was created
  acceptedTimestamp: Timestamp | null // The timestamp when the vote request was accepted by the checker
  votedTimestamp: Timestamp | null // The timestamp when the vote was submitted by the checker
  isCorrect: boolean | null // Whether the checker's vote was correct, based on the final category of the message. Correct is defined as same category, and if category is info, +-1 away from mean truth score
  score: number | null // The score that this vote contributes to the checker's leaderboard score
  tags: TagsMap // Tags assigned to the vote request
  communityNoteCategory: "great" | "acceptable" | "unacceptable" | null // The category assigned to the community note, either "great" i.e. "super", "acceptable", or "bad"
  duration: number | null // The time taken by the checker to vote on the message, in minutes
}

export type VoteRequestUpdateObject = Partial<VoteRequest>

export type CustomReply = {
  type: "text" | "image"
  text: string | null
  caption: string | null
  lastUpdatedBy: DocumentReference
  lastUpdatedTimestamp: Timestamp
}

export type CommunityNote = {
  en: string
  cn: string
  links: string[]
  downvoted: boolean
  pendingCorrection: boolean
  adminGroupCommunityNoteSentMessageId: string | null
  timestamp: Timestamp
}

export type BlastData = {
  type: "text" | "image"
  text: string | null //blast text, or caption if type is image
  storageUrl: string | null //image storage URL
  isActive: boolean //whether or not blast
  createdDate: Timestamp
  blastDate: Timestamp
}

export type UserBlast = {
  feedbackCategory: "positive" | "negative" | "neutral" | null
  sentTimestamp: Timestamp
}

export type TeleMessage = {
  id: string
  caption: string | null
  text: string
  isAssessed: boolean
  isMatch: boolean
  primaryCategory: string
  voteRequests: VoteRequest
  rationalisation: string
  avgTruthScore: number | null
  firstTimestamp: Timestamp | null
  storageUrl: string | null
  crowdPercentage: number
  votedPercentage: number
}

export type Thresholds = {
  endVote: number
  endVoteBigSus: number
  endVoteUnsure: number
  endVoteAbsolute: number
  endVoteBigSusAbsolute: number
  endVoteUnsureAbsolute: number
  startVote: number
  isSpam: number
  isNoClaim: number
  isLegitimate: number
  isInfo: number
  isIrrelevant: number
  isUnsure: number
  isBigSus: number
  isSus: number
  isSatire: number
  isHarmless: number
  isHarmful: number
  falseUpperBound: number
  misleadingUpperBound: number
  sendInterimMinVotes: number
  surveyLikelihood: number
  satisfactionSurveyCooldownDays: number
  volunteerProgramVotesRequirement: number
  volunteerProgramReferralRequirement: number
  volunteerProgramReportRequirement: number
  volunteerProgramAccuracyRequirement: number
  accuracyNudgeThreshold: number
  numberBeforeAccuracyNudge: number
  daysBeforeFirstCompletionCheck: number
  daysBeforeSecondCompletionCheck: number
  freeTierLimit: number
  paidTierLimit: number
  frequency: string
  numberToTrigger: number | string
  targetDailyVotes: number
  minVotesPerMessage: number
  price: number
}

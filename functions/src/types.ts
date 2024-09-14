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
  }
  text: { body: string }
  context: { id: string; forwarded: boolean; frequently_forwarded: boolean }
  timestamp: number
  image?: { caption: string; id: string; mime_type: string }
}

type TagsMap = {
  [tag: string]: boolean
}

export type MessageData = {
  machineCategory: string
  isMachineCategorised: boolean
  originalText: string | null
  text: string | null
  caption: string | null
  latestInstance: DocumentReference | null
  firstTimestamp: Timestamp
  lastTimestamp: Timestamp
  lastRefreshedTimestamp: Timestamp
  isPollStarted: boolean
  isAssessed: boolean
  assessedTimestamp: Timestamp | null
  assessmentExpiry: Timestamp | null
  assessmentExpired: boolean
  truthScore: number | null
  numberPointScale: 5 | 6
  isIrrelevant: boolean | null
  isScam: boolean | null
  isIllicit: boolean | null
  isSpam: boolean | null
  isLegitimate: boolean | null
  isUnsure: boolean | null
  isInfo: boolean | null
  isSatire: boolean | null
  isHarmful: boolean | null // whether the sum of scam + illicit + untrue votes > harmful threshold
  isHarmless: boolean | null // whether the sum of legitimate + accurate + spam votes > harmless threshold
  tags: TagsMap
  primaryCategory: string | null
  customReply: string | null
  instanceCount: number
  rationalisation: string | null // Assuming 'rationalisation' is a string; adjust as necessary if it's a different type.
}

export type InstanceData = {
  source: string
  id: string | null
  timestamp: Timestamp
  type: "text" | "image"
  text: string | null
  textHash: string | null
  caption: string | null
  captionHash: string | null
  sender: string | null
  imageType: "convo" | "email" | "letter" | "others"
  ocrVersion: string
  from: string | null
  subject: string | null
  hash: string | null
  mediaId: string
  mimeType: string
  storageUrl: string
  isForwarded: boolean | null
  isFrequentlyForwarded: boolean | null
  isReplied: boolean
  isInterimPromptSent: boolean | null
  isInterimReplySent: boolean | null
  isMeaningfulInterimReplySent: boolean | null
  isRationalisationSent: boolean | null
  isRationalisationUseful: boolean | null
  isReplyForced: boolean | null
  isMatched: boolean
  isReplyImmediate: boolean | null
  replyCategory: string | null
  replyTimestamp: Timestamp | null
  matchType: string
  scamShieldConsent: boolean | null
  embedding: number[] | null // Specify more precisely based on the actual type used
  closestMatch: {
    instanceRef: DocumentReference | null
    text: string | null
    score: number | null
    parentRef: DocumentReference | null
    algorithm: string
  }
  isSatisfactionSurveySent: boolean | null
  satisfactionScore: number | null
}

export type ReferralClicksData = {
  referralId: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  isConverted: boolean
  variant: string
  timestamp: Timestamp
}

export type UserData = {
  instanceCount: number
  firstMessageReceiptTime: Timestamp
  firstMessageType: "normal" | "irrelevant" | "prepopulated" // Assuming "normal" is one of the possible types
  lastSent: Timestamp | null
  satisfactionSurveyLastSent: Timestamp | null //when satisfaction survey was last sent, used to implement cooldown for sending the survey
  initialJourney: Record<string, string> // Assuming initialJourney is an object with unknown properties
  referralId: string // Assuming referralId is a string
  utm: {
    source: string
    medium: string
    content: string
    campaign: string
    term: string
  }
  referralCount: number
  isReferralMessageSent: boolean
  isReminderMessageSent: boolean //whether the response
  language: "en" | "cn"
  isSubscribedUpdates: boolean
  isIgnored: boolean
}

export type CheckerData = {
  name: string | null
  type: "human" | "ai"
  isActive: boolean
  isOnboardingComplete: boolean | null
  isQuizComplete: boolean
  quizScore: number | null
  onboardingStatus:
    | "name"
    | "number"
    | "otpSent"
    | "verify"
    | "quiz"
    | "onboardWhatsapp"
    | "joinGroupChat"
    | "nlb"
    | "completed"
  lastTrackedMessageId: number | null //to handle onboarding callback replies in a serverless context
  isAdmin: boolean
  singpassOpenId: string | null
  telegramId: number | null
  whatsappId?: string | null
  level: number
  experience: number
  tier: "beginner" | "intermediate" | "expert"
  numVoted: number //"Number of messages voted on"
  numReferred: number //"Number of new users referred"
  numReported: number //"Number of non-trivial instances sent in sent in"
  voteWeight: number
  numCorrectVotes: number //
  numNonUnsureVotes: number //"Number of votes on messages that didn't end as unsure, for computing accuracy"
  numVerifiedLinks: number
  preferredPlatform: string | null
  lastVotedTimestamp: Timestamp | null
  getNameMessageId: string | null
  leaderboardStats: LeaderBoardStats
  programData: ProgramData
}

type LeaderBoardStats = {
  numVoted: number // number of votes cast where the parent message category is not unsure
  numCorrectVotes: number // number of correct votes cast where the parent message category is not unsure
  totalTimeTaken: number // total time taken to vote where the parent message category is not unsure
  score: number // total score
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
  factCheckerDocRef: DocumentReference
  platformId: string | null
  platform: "whatsapp" | "telegram" | "agent"
  hasAgreed: boolean | null
  triggerL2Vote: boolean | null
  triggerL2Others: boolean | null
  sentMessageId: string | null
  truthScore: 0 | 1 | 2 | 3 | 4 | 5 | null
  numberPointScale: 5 | 6
  category:
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
  isAutoPassed: boolean
  reasoning: string | null
  createdTimestamp: Timestamp | null
  acceptedTimestamp: Timestamp | null
  votedTimestamp: Timestamp | null
  isCorrect: boolean | null
  score: number | null
  tags: TagsMap
  duration: number | null //duration in minutes
}

export type VoteRequestUpdateObject = Partial<VoteRequest>

export type CustomReply = {
  type: "text" | "image"
  text: string | null
  caption: string | null
  lastUpdatedBy: DocumentReference
  lastUpdatedTimestamp: Timestamp
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

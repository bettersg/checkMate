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

export type CheckerData = {
  name: string
  type: "human" | "ai"
  isActive: boolean
  isOnboardingComplete: boolean | null
  isAdmin: boolean
  singpassOpenId: string | null
  telegramId: number | null
  whatsappId?: string | null
  level: number
  experience: number
  tier: "beginner" | "intermediate" | "expert"
  numVoted: number
  numReferred: number
  numReported: number
  voteWeight: number
  numCorrectVotes: number
  numNonUnsureVotes: number
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
  numVotesAtProgramStart: number
  numReferralsAtProgramStart: number
  numReportsAtProgramStart: number
  numCorrectVotesAtProgramStart: number
  numNonUnsureVotesAtProgramStart: number
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
  truthScore: 1 | 2 | 3 | 4 | 5 | null
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
  reasoning: string | null
  createdTimestamp: Timestamp | null
  acceptedTimestamp: Timestamp | null
  votedTimestamp: Timestamp | null
  isCorrect: boolean | null
  score: number | null
  duration: number | null //duration in minutes
}

export type CustomReply = {
  type: "text" | "image"
  text: string | null
  caption: string | null
  lastUpdatedBy: DocumentReference
  lastUpdatedTimestamp: Timestamp
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

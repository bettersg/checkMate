import { Timestamp } from "firebase-admin/firestore"
import { DocumentReference } from "@google-cloud/firestore"

export type Checker = {
  name: string
  type: "human" | "ai"
  isActive: boolean | null
  isOnboardingComplete: boolean | null
  singpassOpenId: string | null
  telegramId: string | null
  whatsappId?: string | null
  level: number
  experience: number
  numVoted: number
  voteWeight: number
  numCorrectVotes: number
  numVerifiedLinks: number
  preferredPlatform: string | null
  lastVotedTimestamp: Timestamp | null
  getNameMessageId: string | null
}

export type VoteRequest = {
  factCheckerDocRef: DocumentReference
  platformId: string | null
  platform: "whatsapp" | "telegram" | "agent"
  hasAgreed: boolean | null
  triggerL2Vote: boolean | null
  triggerL2Others: boolean | null
  sentMessageId: string | null
  vote: 0 | 1 | 2 | 3 | 4 | 5 | null
  category: string | null
  createdTimestamp: Timestamp | null
  acceptedTimestamp: Timestamp | null
  votedTimestamp: Timestamp | null
}

export type TeleMessage = {
  id: string;
  caption: string | null;
  text: string;
  isAssessed: boolean;
  isMatch: boolean;
  primaryCategory: string;
  voteRequests: VoteRequest;
  rationalisation: string;
  avgTruthScore: number | null;
  firstTimestamp: Timestamp | null;
  storageUrl: string | null;
  crowdPercentage: number;
  votedPercentage: number;
}
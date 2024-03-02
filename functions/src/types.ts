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

export type Message = {
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

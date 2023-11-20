import { IncomingHttpHeaders } from "http"
import { Timestamp } from "firebase-admin/firestore"

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

export type VoteRequest = {
  id: string, 
  factCheckerDocRef: string;
  category: string | null;
  acceptedTimestamp: Timestamp | null;
  hasAgreed: boolean;
  vote: number | null;
  votedTimestamp: Timestamp | null;
  checkTimestamp: Timestamp | null,
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
  truthScore: number | null;
  isView: boolean //checks if checker has clicked in to view results/msg
}
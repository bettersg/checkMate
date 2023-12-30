import { Timestamp } from "firebase/firestore";

export type VoteRequest = {
  id: string,
  factCheckerDocRef: string;
  category: string | null;
  acceptedTimestamp: Timestamp | null;
  hasAgreed: boolean;
  vote: number | null;
  votedTimestamp: Timestamp | null;
  checkTimestamp: Timestamp | null;
  isView: boolean; //checks if checker has clicked in to view results/msg
  truthScore: number | null;
}

export type Message = {
  id: string;
  caption: string | null;
  text: string;
  isAssessed: boolean;
  isMatch: boolean;
  primaryCategory: string;
  voteRequests: VoteRequest;
  rationalisation: string;
  truthScore: number | null;
  firstTimestamp: string;
  // imageUrl: string | null;
}
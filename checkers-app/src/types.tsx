export type VoteRequest = {
  id: string,
  factCheckerDocRef: string;
  category: string | null;
  createdTimestamp: Date | null;
  acceptedTimestamp: Date | null;
  hasAgreed: boolean;
  vote: number | null;
  votedTimestamp: Date | null;
  checkTimestamp: Date | null;
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
  avgTruthScore: number | null;
  firstTimestamp: Date;
  storageUrl: string | null;
  crowdPercentage: number;
  votedPercentage: number;
}
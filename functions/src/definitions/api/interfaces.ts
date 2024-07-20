import { CustomReply, LeaderboardEntry, ProgramData } from "../../types"

interface createVoteRequest {
  factCheckerId?: string
  factCheckerName?: string
}

interface upsertCustomReply {
  factCheckerId?: string
  factCheckerName?: string
  customReply: string
}

interface postWhatsappTestMessage {
  message: string
}

interface updateVoteRequest {
  category: string
  truthScore?: number //between 1 and 5
  reasoning?: string
}

interface createChecker {
  name: string
  type: "human" | "ai"
  isActive?: boolean
  isOnboardingComplete?: boolean
  singpassOpenId: string | null
  telegramId: number | null
  whatsappId?: string | null
  level?: number
  experience?: number
  numVoted?: number
  numReferred?: number
  numReported?: number
  numCorrectVotes?: number
  numNonUnsureVotes?: number
  numVerifiedLinks?: number
  preferredPlatform?: string | null
  lastVotedTimestamp?: null
}

interface updateChecker {
  name?: string
  type?: "human" | "ai"
  isActive?: boolean
  isOnboardingComplete?: boolean
  singpassOpenId?: string | null
  telegramId?: number | null
  whatsappId?: string | null
  level?: number
  experience?: number
  numVoted?: number
  numReferred?: number
  numReported?: number
  numCorrectVotes?: number
  numNonUnsureVotes?: number
  numVerifiedLinks?: number
  preferredPlatform?: string | null
  lastVotedTimestamp?: null
  programData?: "reset" | "complete"
}

interface Checker {
  name: string;
  type: "human" | "ai";
  isActive: boolean;
  isOnboardingComplete: boolean | null;
  tier: "beginner" | "intermediate" | "expert";
  isAdmin: boolean;
  isOnProgram: boolean;
  referralCode: string | null;
  hasCompletedProgram: boolean;
  pendingVoteCount: number;
  last30days?: Last30DaysStats;
  programStats?: ProgramStats;
  achievements: Achievements | null;
  level: number;
  experience: number;
  certificateUrl?: string | null;
}

interface ProgramStats
  extends Pick<
    ProgramData,
    | "numVotesTarget"
    | "numReferralTarget"
    | "numReportTarget"
    | "accuracyTarget"
  > {
  accuracy: number | null
  numVotes: number
  numReferrals: number
  numReports: number
  isProgramCompleted: boolean
}

interface VoteSummary {
  category: string | null
  truthScore: number | null
  type: "image" | "text"
  createdTimestamp: Date
  votedTimestamp: Date
  text: string | null //only for type text
  caption: string | null //only for type image
  needsReview: boolean //if the vote differs from the majority
  isAssessed: boolean //if the message is assessed
  isUnsure: boolean //if the final assessed category ended as unsure
  firestorePath: string
}

interface MessageSummary {
  primaryCategory: string | null
  machineCategory: string | null
  truthScore: number | null
  instanceCount: number
  text: string | null //only for type text
  caption: string | null //only for type image
  customReply: CustomReply | null
}

interface VoteSummaryApiResponse {
  votes: VoteSummary[]
  lastPath: string | null
  totalPages: number
}

interface Vote {
  type: "image" | "text"
  text: string | null //only for type text
  sender: string
  caption: string | null //only for type image
  signedImageUrl: string | null //only for type image
  category: string | null
  truthScore: number | null
  isAssessed: boolean //if the message is assessed
  finalStats: AssessedInfo | null
}

interface Last30DaysStats {
  totalVoted: number
  accuracyRate: number | null
  averageResponseTime: number
  peopleHelped: number
}

interface PendingCountApiResponse {
  pendingCount: number
}

interface Achievements {
  //TODO: add more achievements in future
}

interface AssessedInfo {
  responseCount: number
  scamCount: number
  illicitCount: number
  infoCount: {
    total?: number
    1?: number | null
    2?: number | null
    3?: number | null
    4?: number | null
    5?: number | null
  }
  satireCount: number
  spamCount: number
  irrelevantCount: number
  legitimateCount: number
  unsureCount: number
  truthScore: number
  primaryCategory: string
  rationalisation: string | null
}

export type {
  createVoteRequest,
  updateVoteRequest,
  createChecker,
  Checker,
  VoteSummary,
  Vote,
  VoteSummaryApiResponse,
  PendingCountApiResponse,
  AssessedInfo,
  updateChecker,
  upsertCustomReply,
  postWhatsappTestMessage,
  MessageSummary,
  LeaderboardEntry,
  ProgramStats,
}

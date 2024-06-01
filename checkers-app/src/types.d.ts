import {
  Vote,
  VoteSummary,
  Checker,
  updateVoteRequest,
  VoteSummaryApiResponse,
  PendingCountApiResponse,
  AssessedInfo,
  updateChecker,
  LeaderboardEntry,
  ProgramStats,
} from "../../functions/src/definitions/api/interfaces";

interface CheckerDetails {
  checkerId: string | null;
  checkerName: string;
  pendingCount: number;
  isAdmin: boolean;
  tier: string;
  isActive: boolean;
}

interface Window {
  Telegram: {
    WebApp: any;
  };
}

export type {
  Vote,
  VoteSummary,
  Checker,
  updateVoteRequest,
  VoteSummaryApiResponse,
  PendingCountApiResponse,
  AssessedInfo,
  updateChecker,
  CheckerDetails,
  Window,
  LeaderboardEntry,
  ProgramStats,
};

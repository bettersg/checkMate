export interface FactChecker {
  experience: number;
  isActive: boolean;
  isOnboardingComplete: boolean;
  lastVoteTime: string;
  level: number;
  name: string;
  numCorrectVotes: number;
  numVerifiedLinks: number;
  numVoted: number;
  platformId: string;
  preferredPlatform: string;
}
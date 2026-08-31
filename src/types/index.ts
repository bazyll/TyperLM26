export * from "./database.types";

export interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  isActive: boolean;
  points: number;
  rank?: number;
}

export interface MatchWithTeams {
  id: string;
  matchday: number | null;
  stage: "league" | "playoff" | "round_of_16" | "quarter_finals" | "semi_finals" | "final";
  kickoffAt: string;
  isBettingLocked: boolean;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  liveMinute: number | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string;
    code: string;
    logoUrl: string;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string;
    code: string;
    logoUrl: string;
  };
  userPrediction?: {
    id?: string;
    homeScore: number;
    awayScore: number;
    pointsAwarded?: number | null;
    scoringCategory?: "exact" | "diff" | "outcome" | "incorrect" | null;
  };
  allPredictions?: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    homeScore: number;
    awayScore: number;
    pointsAwarded?: number | null;
    scoringCategory?: "exact" | "diff" | "outcome" | "incorrect" | null;
    livePoints?: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  matchPoints: number;
  specialPoints: number;
  pickemPoints: number;
  totalPoints: number;
  exactScoresCount: number;
  diffScoresCount: number;
  outcomeScoresCount: number;
  incorrectScoresCount: number;
  predictedMatchesCount: number;
  accuracyRate: number; // percentage of predictions with > 0 pts
}

export interface UserMatchStats {
  predictedMatchesCount: number;
  totalPoints: number;
  exactScoresCount: number;
  diffScoresCount: number;
  outcomeScoresCount: number;
  incorrectScoresCount: number;
  averagePointsPerMatch: number;
  accuracyRate: number; // (exact + diff + outcome) / predictedMatchesCount * 100
}

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
    homeScore: number;
    awayScore: number;
    pointsAwarded?: number | null;
    scoringCategory?: "exact" | "diff" | "outcome" | "incorrect" | null;
  };
}

export interface SpecialPredictionWithDetails {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetType: "team" | "player";
  pointsValue: number;
  deadlineAt: string;
  status: "open" | "locked" | "settled";
  userAnswer?: {
    selectedTeamId?: string | null;
    selectedPlayerId?: string | null;
    pointsAwarded?: number | null;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  totalPoints: number;
  exactScoresCount: number;
  diffScoresCount: number;
  outcomeScoresCount: number;
  accuracyRate: number;
  currentStreak: number;
  bestStreak: number;
}

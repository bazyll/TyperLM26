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
  announcementsLastSeenAt?: string | null;
}

export interface LeagueCompletenessInfo {
  totalTeams: number;
  totalScheduledMatches: number;
  finishedMatchesCount: number;
  isComplete: boolean;
  teamsWith8MatchesCount: number;
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

export interface SpecialCategoryWithPrediction {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetType: "team" | "player";
  pointsValue: number;
  deadlineAt: string;
  status: "open" | "locked" | "settled";
  isLocked: boolean;
  correctAnswers?: Array<{
    teamId?: string | null;
    teamName?: string | null;
    teamLogo?: string | null;
    playerId?: string | null;
    playerName?: string | null;
  }>;
  userPrediction?: {
    id?: string;
    selectedTeamId?: string | null;
    selectedTeamName?: string | null;
    selectedTeamLogo?: string | null;
    selectedPlayerId?: string | null;
    selectedPlayerName?: string | null;
    pointsAwarded?: number | null;
  };
  allPredictions?: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    selectedTeamId?: string | null;
    selectedTeamName?: string | null;
    selectedPlayerId?: string | null;
    selectedPlayerName?: string | null;
    pointsAwarded?: number | null;
  }>;
}

export interface PickemSelectionItem {
  teamId: string;
  teamName: string;
  teamCode: string;
  teamLogoUrl: string;
  category: "first" | "top8" | "out" | "middle";
  finalRank?: number;
  pointsAwarded?: number;
  isHit?: boolean;
}

export interface PickemSubmissionWithDetails {
  id?: string;
  userId?: string;
  pointsAwarded?: number | null;
  firstTeamId?: string;
  top8TeamIds?: string[];
  outTeamIds?: string[];
  selections: PickemSelectionItem[];
  allSubmissions?: Array<{
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    pointsAwarded?: number | null;
    firstTeamId?: string;
    top8TeamIds?: string[];
    outTeamIds?: string[];
  }>;
}

export interface AnnouncementItem {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

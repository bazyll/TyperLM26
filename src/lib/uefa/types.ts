/**
 * UEFA Champions League Official Squad Types & Snapshot Structure
 */

export interface UefaPlayerItem {
  uefaPlayerId: string;
  name: string;
  position?: string | null;
  jerseyNumber?: string | null;
  listType?: "A" | "B" | null;
}

export interface UefaTeamSquad {
  teamCode: string;
  teamName: string;
  players: UefaPlayerItem[];
}

export interface UefaSnapshot {
  competition: "UEFA Champions League";
  season: "2026/27";
  retrievedAt: string;
  source: "UEFA";
  version: string;
  teams: UefaTeamSquad[];
}

export interface UefaUnresolvedPlayer {
  uefaPlayerId: string;
  name: string;
  teamCode: string;
  teamName: string;
  reason: "MULTIPLE_GOAL_API_CANDIDATES" | "NO_GOAL_API_MATCH" | "AMBIGUOUS_LOCAL_MATCH";
  candidates?: Array<{
    id: string;
    apiId: string;
    name: string;
    teamName?: string;
  }>;
}

export interface UefaReconciliationResult {
  success: boolean;
  version: string;
  totalUefaPlayers: number;
  matchedExistingLocalCount: number;
  matchedGoalApiSearchCount: number;
  insertedCount: number;
  updatedCount: number;
  unresolvedCount: number;
  unresolvedPlayers: UefaUnresolvedPlayer[];
  quotaRequestsUsed: number;
  error?: string;
}

/**
 * GOAL API Domain & Integration Types
 */

export interface GoalApiRateLimitState {
  quotaLimit: number | null;
  quotaRemaining: number | null;
  quotaResetAt: string | null;
  quotaType: string | null;
}

export interface GoalApiSyncStatus {
  isConfigured: boolean;
  provider: string;
  quotaLimit: number | null;
  quotaRemaining: number | null;
  quotaResetAt: string | null;
  lastRequestAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  leaseStatus: "idle" | "running" | "failed";
  leaseLockedUntil: string | null;
}

export interface GoalApiFixtureItem {
  id: string;
  apiId?: string | null;
  leagueId: string;
  leagueName: string;
  leagueYear?: string | null;
  matchDate: string;
  matchTime: string;
  kickoffUtc: string;
  matchStatus: string;
  matchLive?: string | number | null;
  homeTeamId?: string;
  homeTeamName: string;
  homeTeamScore?: string | number | null;
  homeTeamHalftimeScore?: string | number | null;
  homeTeamFtScore?: string | number | null;
  awayTeamId?: string;
  awayTeamName: string;
  awayTeamScore?: string | number | null;
  awayTeamHalftimeScore?: string | number | null;
  awayTeamFtScore?: string | number | null;
  matchRound?: string | null;
  stageName?: string | null;
  teamHomeBadge?: string | null;
  teamAwayBadge?: string | null;
  homeTeam?: { id?: string | null; name?: string | null; badge?: string | null } | null;
  awayTeam?: { id?: string | null; name?: string | null; badge?: string | null } | null;
  events?: GoalApiRawEvent[];
}

export interface GoalApiRawEvent {
  id: string;
  fixtureId?: string;
  time?: string | number | null;
  timeNum?: number | null;
  type: string;
  homeScorer?: string | null;
  homeScorerId?: string | null;
  homeAssist?: string | null;
  homeAssistId?: string | null;
  awayScorer?: string | null;
  awayScorerId?: string | null;
  awayAssist?: string | null;
  awayAssistId?: string | null;
  score?: string | null;
  info?: string | null;
  scoreInfoTime?: string | null;
}

export interface MappingPreviewItem {
  goalApiFixtureId: string;
  kickoffUtc: string;
  goalApiHomeTeam: string;
  goalApiAwayTeam: string;
  status: string;
  suggestedMatchId?: string;
  suggestedHomeTeam?: string;
  suggestedAwayTeam?: string;
  confidence: "exact" | "high" | "low" | "none";
  isMapped: boolean;
}

export interface GoalApiSyncResult {
  success: boolean;
  error?: string;
  syncedMatchesCount: number;
  finalizedMatchesCount: number;
  reconciledEventsCount: number;
  skippedManualOverridesCount: number;
  unmappedCount: number;
  quotaRemaining?: number | null;
  details?: Array<{
    matchId?: string;
    fixtureId: string;
    action: "SCORE_UPDATED" | "FINALIZED" | "OVERRIDE_SKIPPED" | "UNMAPPED" | "NO_CHANGE";
    score?: string;
    status?: string;
  }>;
}

export interface PlayerScorerAssistRankingItem {
  playerName: string;
  scorerExternalId?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamCode?: string | null;
  teamLogoUrl?: string | null;
  goalsCount: number;
  assistsCount: number;
}

export interface GoalApiPlayerItem {
  id: string;
  apiId: string;
  name: string;
  number?: string | null;
  type?: string | null;
  image?: string | null;
  teamId?: string | null;
  isActive?: boolean | null;
}

export interface GoalApiPlayersSyncResult {
  success: boolean;
  error?: string;
  totalTeamsChecked: number;
  successfulTeamsCount: number;
  failedTeamsCount: number;
  totalPlayersSynced: number;
  insertedCount: number;
  updatedCount: number;
  deactivatedCount: number;
  conflictsCount: number;
  quotaRemaining?: number | null;
}


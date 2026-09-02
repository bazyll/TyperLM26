import { createClient } from "@/lib/supabase/server";
import { getNativeUclScorersAndAssists } from "@/lib/goal-api/scorers";

export interface TeamUclStatsItem {
  teamId: string;
  teamName: string;
  teamCode: string;
  teamLogoUrl: string | null;
  matchesPlayed: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheetsCount: number;
}

export interface SpecialPredictionLeadersResult {
  topScorers: {
    playerName: string;
    scorerExternalId?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    goalsCount: number;
  }[];
  topAssists: {
    playerName: string;
    scorerExternalId?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    assistsCount: number;
  }[];
  teamMostGoals: {
    teamId: string;
    teamName: string;
    goalsScored: number;
  }[];
  teamMostCleanSheets: {
    teamId: string;
    teamName: string;
    cleanSheetsCount: number;
  }[];
}

/**
 * Calculates Team Goals and Clean Sheets strictly from FINISHED matches.
 */
export async function getTeamUclStats(supabaseClient?: any): Promise<TeamUclStatsItem[]> {
  const supabase = supabaseClient || (await createClient());

  const [{ data: rawTeams }, { data: rawMatches }] = await Promise.all([
    supabase.from("teams").select("id, name, code, logo_url"),
    supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score, status")
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null),
  ]);

  const teams = rawTeams || [];
  const finishedMatches = rawMatches || [];

  const teamStatsMap = new Map<string, TeamUclStatsItem>();

  teams.forEach((t: any) => {
    teamStatsMap.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      teamCode: t.code,
      teamLogoUrl: t.logo_url,
      matchesPlayed: 0,
      goalsScored: 0,
      goalsConceded: 0,
      cleanSheetsCount: 0,
    });
  });

  finishedMatches.forEach((m: any) => {
    const homeGoals = Number(m.home_score) || 0;
    const awayGoals = Number(m.away_score) || 0;

    const homeStats = teamStatsMap.get(m.home_team_id);
    if (homeStats) {
      homeStats.matchesPlayed += 1;
      homeStats.goalsScored += homeGoals;
      homeStats.goalsConceded += awayGoals;
      if (awayGoals === 0) {
        homeStats.cleanSheetsCount += 1;
      }
    }

    const awayStats = teamStatsMap.get(m.away_team_id);
    if (awayStats) {
      awayStats.matchesPlayed += 1;
      awayStats.goalsScored += awayGoals;
      awayStats.goalsConceded += homeGoals;
      if (homeGoals === 0) {
        awayStats.cleanSheetsCount += 1;
      }
    }
  });

  return Array.from(teamStatsMap.values()).sort((a, b) => {
    if (b.goalsScored !== a.goalsScored) return b.goalsScored - a.goalsScored;
    return a.teamName.localeCompare(b.teamName);
  });
}

/**
 * Computes leaders with complete tie-handling for Special Predictions:
 * - Top Scorer(s)
 * - Top Assist(s)
 * - Team Most Goals
 * - Team Most Clean Sheets
 *
 * If multiple leaders have the same top stat, returns ALL tied leaders.
 * Returns empty array if no matches / events have occurred.
 */
export async function getSpecialPredictionLeaders(supabaseClient?: any): Promise<SpecialPredictionLeadersResult> {
  const [playerStats, teamStats] = await Promise.all([
    getNativeUclScorersAndAssists(),
    getTeamUclStats(supabaseClient),
  ]);

  // 1. Top Scorers (Max goals > 0)
  const maxGoals = Math.max(0, ...playerStats.map((p) => p.goalsCount));
  const topScorers =
    maxGoals > 0
      ? playerStats
          .filter((p) => p.goalsCount === maxGoals)
          .map((p) => ({
            playerName: p.playerName,
            scorerExternalId: p.scorerExternalId,
            teamId: p.teamId,
            teamName: p.teamName,
            goalsCount: p.goalsCount,
          }))
      : [];

  // 2. Top Assists (Max assists > 0)
  const maxAssists = Math.max(0, ...playerStats.map((p) => p.assistsCount));
  const topAssists =
    maxAssists > 0
      ? playerStats
          .filter((p) => p.assistsCount === maxAssists)
          .map((p) => ({
            playerName: p.playerName,
            scorerExternalId: p.scorerExternalId,
            teamId: p.teamId,
            teamName: p.teamName,
            assistsCount: p.assistsCount,
          }))
      : [];

  // 3. Team Most Goals (Max goals scored > 0)
  const maxTeamGoals = Math.max(0, ...teamStats.map((t) => t.goalsScored));
  const teamMostGoals =
    maxTeamGoals > 0
      ? teamStats
          .filter((t) => t.goalsScored === maxTeamGoals)
          .map((t) => ({
            teamId: t.teamId,
            teamName: t.teamName,
            goalsScored: t.goalsScored,
          }))
      : [];

  // 4. Team Most Clean Sheets (Max clean sheets > 0)
  const maxCleanSheets = Math.max(0, ...teamStats.map((t) => t.cleanSheetsCount));
  const teamMostCleanSheets =
    maxCleanSheets > 0
      ? teamStats
          .filter((t) => t.cleanSheetsCount === maxCleanSheets)
          .map((t) => ({
            teamId: t.teamId,
            teamName: t.teamName,
            cleanSheetsCount: t.cleanSheetsCount,
          }))
      : [];

  return {
    topScorers,
    topAssists,
    teamMostGoals,
    teamMostCleanSheets,
  };
}

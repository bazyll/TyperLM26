"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateUCLTable, UCLStandingRow, UCLTableMode } from "@/lib/scoring/ucl-table";
import { Database } from "@/types/database.types";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

export interface LeagueCompletenessInfo {
  totalTeams: number;
  totalScheduledMatches: number;
  finishedMatchesCount: number;
  isComplete: boolean;
  teamsWith8MatchesCount: number;
}

/**
 * Fetches dynamic UEFA Champions League 36-team table generated from completed matches.
 */
export async function getUCLTableAction(): Promise<{
  table: UCLStandingRow[];
  completeness: LeagueCompletenessInfo;
  mode: UCLTableMode;
}> {
  const supabase = await createClient();

  const [{ data: rawTeams }, { data: rawMatches }] = await Promise.all([
    supabase.from("teams").select("*"),
    supabase.from("matches").select("*").eq("stage", "league"),
  ]);

  const teams = (rawTeams || []) as unknown as TeamRow[];
  const allLeagueMatches = (rawMatches || []) as unknown as MatchRow[];

  const finishedMatches = allLeagueMatches.filter(
    (m) => (m.status === "finished" || m.status === "live") && m.home_score !== null && m.away_score !== null
  );

  // Check completeness: all 36 teams have 8 finished matches (total 144)
  const matchesPerTeam = new Map<string, number>();
  teams.forEach((t) => matchesPerTeam.set(t.id, 0));

  finishedMatches
    .filter((m) => m.status === "finished")
    .forEach((m) => {
      matchesPerTeam.set(m.home_team_id, (matchesPerTeam.get(m.home_team_id) || 0) + 1);
      matchesPerTeam.set(m.away_team_id, (matchesPerTeam.get(m.away_team_id) || 0) + 1);
    });

  let teamsWith8 = 0;
  for (const count of matchesPerTeam.values()) {
    if (count === 8) teamsWith8 += 1;
  }

  const isComplete = teams.length === 36 && teamsWith8 === 36 && finishedMatches.filter((m) => m.status === "finished").length === 144;
  const mode: UCLTableMode = isComplete ? "final" : "in-progress";

  const tableTeamsData = teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    code: t.code,
    logoUrl: t.logo_url,
    uefaCoefficient: Number(t.uefa_coefficient) || 0,
    disciplinaryPoints: t.disciplinary_points || 0,
  }));

  const finishedMatchesData = finishedMatches.map((m) => ({
    id: m.id,
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
    homeScore: m.home_score ?? 0,
    awayScore: m.away_score ?? 0,
    status: m.status as "live" | "finished",
  }));

  const table = calculateUCLTable(tableTeamsData, finishedMatchesData, mode);

  return {
    table,
    completeness: {
      totalTeams: teams.length,
      totalScheduledMatches: 144,
      finishedMatchesCount: finishedMatches.filter((m) => m.status === "finished").length,
      isComplete,
      teamsWith8MatchesCount: teamsWith8,
    },
    mode,
  };
}

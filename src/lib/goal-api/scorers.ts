import { createClient } from "@/lib/supabase/server";
import { PlayerScorerAssistRankingItem } from "./types";

/**
 * Calls the canonical PostgreSQL stored procedure get_ucl_scorers_and_assists()
 * Single source of truth for goals and assists calculation from match_events.
 */
export async function getNativeUclScorersAndAssists(): Promise<PlayerScorerAssistRankingItem[]> {
  const supabase = await createClient();

  const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("get_ucl_scorers_and_assists");

  if (rpcErr) {
    console.error("Error calling get_ucl_scorers_and_assists RPC:", rpcErr.message);
    return [];
  }

  if (!Array.isArray(rpcData)) {
    return [];
  }

  return (rpcData as any[]).map((row: any) => ({
    playerName: row.player_name,
    scorerExternalId: row.scorer_external_id,
    teamId: row.team_id,
    teamName: row.team_name,
    teamCode: row.team_code,
    teamLogoUrl: row.team_logo_url,
    goalsCount: Number(row.goals_count) || 0,
    assistsCount: Number(row.assists_count) || 0,
  }));
}

/**
 * Returns the Top Scorers ranking sorted by:
 * 1. goalsCount DESC
 * 2. assistsCount DESC
 * 3. playerName ASC
 */
export async function getUclScorersRanking(): Promise<PlayerScorerAssistRankingItem[]> {
  const all = await getNativeUclScorersAndAssists();
  return all
    .filter((item) => item.goalsCount > 0)
    .sort((a, b) => {
      if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
      if (b.assistsCount !== a.assistsCount) return b.assistsCount - a.assistsCount;
      return a.playerName.localeCompare(b.playerName);
    });
}

/**
 * Returns the Top Assists ranking sorted by:
 * 1. assistsCount DESC
 * 2. goalsCount DESC
 * 3. playerName ASC
 */
export async function getUclAssistsRanking(): Promise<PlayerScorerAssistRankingItem[]> {
  const all = await getNativeUclScorersAndAssists();
  return all
    .filter((item) => item.assistsCount > 0)
    .sort((a, b) => {
      if (b.assistsCount !== a.assistsCount) return b.assistsCount - a.assistsCount;
      if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
      return a.playerName.localeCompare(b.playerName);
    });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { GoalApiClient, goalApiClient } from "./client";
import { GoalApiPlayersSyncResult } from "./types";

export class GoalApiPlayersSyncService {
  private client: GoalApiClient;

  constructor(client?: GoalApiClient) {
    this.client = client || goalApiClient;
  }

  /**
   * Synchronizes squads for all 36 UCL teams from GOAL API.
   * - Identifies players by goal_api_player_id and goal_api_player_api_id.
   * - Respects provider's player.isActive status.
   * - Preflight conflict detection (different UUIDs for player_id vs player_api_id).
   * - Safe transfers without breaking existing user predictions.
   * - Scoped global deactivation strictly executed ONLY when 100% (36/36) club requests succeed.
   */
  public async executeSquadsSync(): Promise<GoalApiPlayersSyncResult> {
    const adminSupabase = createAdminClient();

    // 1. Check Rate Limit State
    const { data: syncState } = await adminSupabase
      .from("external_api_sync_state")
      .select("quota_remaining, quota_limit")
      .eq("provider", "goal_api")
      .single();

    if (syncState && syncState.quota_remaining !== null && syncState.quota_remaining <= 50) {
      return {
        success: false,
        error: `Zbyt niski stan limitu zapytań GOAL API (${syncState.quota_remaining}/${syncState.quota_limit}). Wymagane minimum 50 zapytań rezerwy.`,
        totalTeamsChecked: 0,
        successfulTeamsCount: 0,
        failedTeamsCount: 0,
        totalPlayersSynced: 0,
        insertedCount: 0,
        updatedCount: 0,
        deactivatedCount: 0,
        conflictsCount: 0,
        quotaRemaining: syncState.quota_remaining,
      };
    }

    // 2. Fetch all 36 UCL teams
    const { data: rawTeams, error: teamsErr } = await adminSupabase
      .from("teams")
      .select("id, name, code, goal_api_id")
      .not("goal_api_id", "is", null);

    if (teamsErr || !rawTeams || rawTeams.length === 0) {
      return {
        success: false,
        error: `Błąd pobierania drużyn UCL z bazy danych: ${teamsErr?.message || "Brak drużyn z goal_api_id"}`,
        totalTeamsChecked: 0,
        successfulTeamsCount: 0,
        failedTeamsCount: 0,
        totalPlayersSynced: 0,
        insertedCount: 0,
        updatedCount: 0,
        deactivatedCount: 0,
        conflictsCount: 0,
      };
    }

    const uclTeams = rawTeams;
    const uclTeamIds = uclTeams.map((t) => t.id);

    let successfulTeamFetches = 0;
    let failedTeamFetches = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let conflictsCount = 0;
    let totalPlayersSynced = 0;

    const globalActivePlayerExternalIds = new Set<string>();

    // 3. Process squads for each UCL team
    for (const team of uclTeams) {
      if (!team.goal_api_id) continue;

      try {
        const squad = await this.client.getTeamPlayers(team.goal_api_id);
        successfulTeamFetches++;

        for (const player of squad) {
          totalPlayersSynced++;

          const providerId = player.id?.trim();
          const providerApiId = player.apiId ? String(player.apiId).trim() : null;
          const isActive = player.isActive !== false;

          if (providerId && isActive) {
            globalActivePlayerExternalIds.add(providerId);
          }

          if (!providerId) continue;

          // Preflight Conflict Detection
          const { data: existingMatches } = await adminSupabase
            .from("players")
            .select("id, goal_api_player_id, goal_api_player_api_id, name, team_id")
            .or(`goal_api_player_id.eq.${providerId}${providerApiId ? `,goal_api_player_api_id.eq.${providerApiId}` : ""}`);

          if (existingMatches && existingMatches.length > 1) {
            // CONFLICT: goal_api_player_id and goal_api_player_api_id point to TWO DIFFERENT local UUIDs
            console.warn(
              `[GOAL API Sync] Conflict for player ${player.name}: id=${providerId}, apiId=${providerApiId} matched multiple DB records:`,
              existingMatches.map((m) => m.id)
            );
            conflictsCount++;
            continue;
          }

          if (existingMatches && existingMatches.length === 1) {
            // Existing record found -> UPDATE
            const existing = existingMatches[0];
            const { error: updateErr } = await adminSupabase
              .from("players")
              .update({
                name: player.name?.trim() || existing.name,
                team_id: team.id,
                goal_api_player_id: providerId,
                goal_api_player_api_id: providerApiId || existing.goal_api_player_api_id,
                position: player.type || null,
                jersey_number: player.number !== undefined && player.number !== null ? String(player.number) : null,
                photo_url: player.image || null,
                is_active: isActive,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);

            if (!updateErr) {
              updatedCount++;
            }
          } else {
            // New player -> INSERT
            const { error: insertErr } = await adminSupabase
              .from("players")
              .insert({
                name: player.name?.trim(),
                team_id: team.id,
                goal_api_player_id: providerId,
                goal_api_player_api_id: providerApiId,
                position: player.type || null,
                jersey_number: player.number !== undefined && player.number !== null ? String(player.number) : null,
                photo_url: player.image || null,
                is_active: isActive,
              });

            if (!insertErr) {
              insertedCount++;
            }
          }
        }
      } catch (err: any) {
        console.error(`[GOAL API Sync] Failed to fetch squad for ${team.name} (${team.goal_api_id}):`, err?.message);
        failedTeamFetches++;
      }
    }

    // 4. Global Deactivation (Executed strictly ONLY if 100% of teams succeeded)
    let deactivatedCount = 0;
    if (successfulTeamFetches === uclTeams.length && failedTeamFetches === 0) {
      // Find players in UCL teams that were NOT present in the global active set
      const { data: uclPlayers } = await adminSupabase
        .from("players")
        .select("id, goal_api_player_id")
        .in("team_id", uclTeamIds)
        .eq("is_active", true)
        .not("goal_api_player_id", "is", null);

      if (uclPlayers && uclPlayers.length > 0) {
        const toDeactivate = uclPlayers.filter(
          (p) => p.goal_api_player_id && !globalActivePlayerExternalIds.has(p.goal_api_player_id)
        );

        for (const p of toDeactivate) {
          const { error: deactErr } = await adminSupabase
            .from("players")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", p.id);

          if (!deactErr) {
            deactivatedCount++;
          }
        }
      }
    } else {
      console.warn(
        `[GOAL API Sync] Partial squad sync (${successfulTeamFetches}/${uclTeams.length} succeeded). Skipping global deactivation to protect active players.`
      );
    }

    return {
      success: failedTeamFetches === 0,
      error: failedTeamFetches > 0 ? `Częściowy błąd: nie udało się pobrać składów ${failedTeamFetches} z ${uclTeams.length} drużyn.` : undefined,
      totalTeamsChecked: uclTeams.length,
      successfulTeamsCount: successfulTeamFetches,
      failedTeamsCount: failedTeamFetches,
      totalPlayersSynced,
      insertedCount,
      updatedCount,
      deactivatedCount,
      conflictsCount,
    };
  }
}

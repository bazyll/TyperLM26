import { createAdminClient } from "@/lib/supabase/admin";
import { goalApiClient, GoalApiClient } from "@/lib/goal-api/client";
import { UefaSnapshot, UefaReconciliationResult, UefaUnresolvedPlayer } from "./types";
import { uefaSnapshotSchema } from "./schemas";

function cleanPlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export class UefaSquadReconciliationService {
  private client: GoalApiClient;

  constructor(client?: GoalApiClient) {
    this.client = client || goalApiClient;
  }

  /**
   * Reconciles official UEFA snapshot with local database and GOAL API.
   * - Does NOT delete any existing players.
   * - Sets is_ucl_registered = true for confirmed UEFA players.
   * - Assigns canonical team_id from UEFA list (fixing Spain/France/England issues from GOAL API).
   * - Uses GOAL API /players/search only for missing players to conserve quota.
   */
  public async reconcileSnapshot(rawSnapshot: unknown): Promise<UefaReconciliationResult> {
    const parsed = uefaSnapshotSchema.safeParse(rawSnapshot);
    if (!parsed.success) {
      return {
        success: false,
        version: "unknown",
        totalUefaPlayers: 0,
        matchedExistingLocalCount: 0,
        matchedGoalApiSearchCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        unresolvedCount: 0,
        unresolvedPlayers: [],
        quotaRequestsUsed: 0,
        error: `Niepoprawny format snapshotu UEFA: ${parsed.error.message}`,
      };
    }

    const snapshot: UefaSnapshot = parsed.data;
    const adminSupabase = createAdminClient();

    // 1. Fetch all UCL teams from DB
    const { data: dbTeams, error: teamsErr } = await adminSupabase
      .from("teams")
      .select("id, name, code, goal_api_id");

    if (teamsErr || !dbTeams || dbTeams.length === 0) {
      return {
        success: false,
        version: snapshot.version,
        totalUefaPlayers: 0,
        matchedExistingLocalCount: 0,
        matchedGoalApiSearchCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        unresolvedCount: 0,
        unresolvedPlayers: [],
        quotaRequestsUsed: 0,
        error: "Brak drużyn UCL w bazie danych.",
      };
    }

    const teamByCode = new Map<string, typeof dbTeams[0]>();
    for (const t of dbTeams) {
      if (t.code) teamByCode.set(t.code.toUpperCase(), t);
    }

    // 2. Fetch existing players from local DB
    const { data: existingPlayers } = await adminSupabase
      .from("players")
      .select("id, name, team_id, uefa_player_id, goal_api_player_id, goal_api_player_api_id, is_active, is_ucl_registered");

    const localPlayersList = existingPlayers || [];

    let totalUefaPlayers = 0;
    let matchedExistingLocalCount = 0;
    let matchedGoalApiSearchCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let quotaRequestsUsed = 0;
    const unresolvedPlayers: UefaUnresolvedPlayer[] = [];

    for (const teamSquad of snapshot.teams) {
      const uclTeam = teamByCode.get(teamSquad.teamCode.toUpperCase());
      if (!uclTeam) {
        console.warn(`[UEFA Reconciliation] Team code "${teamSquad.teamCode}" not found in local DB.`);
        continue;
      }

      for (const uefaPlayer of teamSquad.players) {
        totalUefaPlayers++;
        const uefaId = uefaPlayer.uefaPlayerId.trim();
        const cleanUefaName = cleanPlayerName(uefaPlayer.name);

        // Priority A: Match by uefa_player_id in local DB
        const matchByUefaId = localPlayersList.find((p) => p.uefa_player_id === uefaId);
        if (matchByUefaId) {
          const { error: updateErr } = await adminSupabase
            .from("players")
            .update({
              team_id: uclTeam.id,
              name: uefaPlayer.name.trim(),
              position: uefaPlayer.position || null,
              jersey_number: uefaPlayer.jerseyNumber ? String(uefaPlayer.jerseyNumber) : null,
              is_ucl_registered: true,
              uefa_list_type: uefaPlayer.listType || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", matchByUefaId.id);

          if (!updateErr) {
            matchedExistingLocalCount++;
            updatedCount++;
          }
          continue;
        }

        // Priority B: Candidate match in local DB for this team by name
        const candidatesInLocalDb = localPlayersList.filter((p) => {
          if (p.uefa_player_id && p.uefa_player_id !== uefaId) return false;
          const cleanLocalName = cleanPlayerName(p.name);
          return (
            cleanLocalName === cleanUefaName ||
            cleanLocalName.includes(cleanUefaName) ||
            cleanUefaName.includes(cleanLocalName)
          );
        });

        if (candidatesInLocalDb.length === 1) {
          const matched = candidatesInLocalDb[0];
          const { error: updateErr } = await adminSupabase
            .from("players")
            .update({
              uefa_player_id: uefaId,
              team_id: uclTeam.id,
              is_ucl_registered: true,
              uefa_list_type: uefaPlayer.listType || null,
              position: uefaPlayer.position || null,
              jersey_number: uefaPlayer.jerseyNumber ? String(uefaPlayer.jerseyNumber) : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", matched.id);

          if (!updateErr) {
            matched.uefa_player_id = uefaId;
            matchedExistingLocalCount++;
            updatedCount++;
          }
          continue;
        }

        // Priority C: Player is missing locally -> Search GOAL API by name
        try {
          quotaRequestsUsed++;
          const searchList = await this.client.searchPlayers(uefaPlayer.name);

          if (searchList.length === 1) {
            // Exactly 1 confident match from GOAL API!
            const goalP = searchList[0];
            const { error: insertErr } = await adminSupabase
              .from("players")
              .insert({
                name: uefaPlayer.name.trim(),
                team_id: uclTeam.id, // Canonical UEFA UCL Club!
                uefa_player_id: uefaId,
                is_ucl_registered: true,
                uefa_list_type: uefaPlayer.listType || null,
                goal_api_player_id: goalP.id,
                goal_api_player_api_id: goalP.apiId ? String(goalP.apiId) : null,
                position: uefaPlayer.position || goalP.type || null,
                jersey_number: uefaPlayer.jerseyNumber ? String(uefaPlayer.jerseyNumber) : goalP.number ? String(goalP.number) : null,
                photo_url: goalP.image || null,
                is_active: goalP.isActive !== false,
              });

            if (!insertErr) {
              matchedGoalApiSearchCount++;
              insertedCount++;
            }
          } else if (searchList.length > 1) {
            // Multiple search results -> check if one matches exact full name
            const exactMatches = searchList.filter(
              (gp: any) => cleanPlayerName(gp.name) === cleanUefaName
            );

            if (exactMatches.length === 1) {
              const goalP = exactMatches[0];
              const { error: insertErr } = await adminSupabase
                .from("players")
                .insert({
                  name: uefaPlayer.name.trim(),
                  team_id: uclTeam.id,
                  uefa_player_id: uefaId,
                  is_ucl_registered: true,
                  uefa_list_type: uefaPlayer.listType || null,
                  goal_api_player_id: goalP.id,
                  goal_api_player_api_id: goalP.apiId ? String(goalP.apiId) : null,
                  position: uefaPlayer.position || goalP.type || null,
                  jersey_number: uefaPlayer.jerseyNumber ? String(uefaPlayer.jerseyNumber) : goalP.number ? String(goalP.number) : null,
                  photo_url: goalP.image || null,
                  is_active: goalP.isActive !== false,
                });

              if (!insertErr) {
                matchedGoalApiSearchCount++;
                insertedCount++;
              }
            } else {
              // Ambiguous
              unresolvedPlayers.push({
                uefaPlayerId: uefaId,
                name: uefaPlayer.name,
                teamCode: teamSquad.teamCode,
                teamName: teamSquad.teamName,
                reason: "MULTIPLE_GOAL_API_CANDIDATES",
                candidates: searchList.map((c: any) => ({
                  id: c.id,
                  apiId: String(c.apiId),
                  name: c.name,
                  teamName: c.team?.name,
                })),
              });
            }
          } else {
            // 0 results from GOAL search -> insert player with UEFA identity
            const { error: insertErr } = await adminSupabase
              .from("players")
              .insert({
                name: uefaPlayer.name.trim(),
                team_id: uclTeam.id,
                uefa_player_id: uefaId,
                is_ucl_registered: true,
                uefa_list_type: uefaPlayer.listType || null,
                position: uefaPlayer.position || null,
                jersey_number: uefaPlayer.jerseyNumber ? String(uefaPlayer.jerseyNumber) : null,
                is_active: true,
              });

            if (!insertErr) {
              insertedCount++;
              unresolvedPlayers.push({
                uefaPlayerId: uefaId,
                name: uefaPlayer.name,
                teamCode: teamSquad.teamCode,
                teamName: teamSquad.teamName,
                reason: "NO_GOAL_API_MATCH",
              });
            }
          }
        } catch (err: any) {
          console.error(`[UEFA Reconciliation] Error searching GOAL API for "${uefaPlayer.name}":`, err?.message);
        }
      }
    }

    return {
      success: unresolvedPlayers.length === 0,
      version: snapshot.version,
      totalUefaPlayers,
      matchedExistingLocalCount,
      matchedGoalApiSearchCount,
      insertedCount,
      updatedCount,
      unresolvedCount: unresolvedPlayers.length,
      unresolvedPlayers,
      quotaRequestsUsed,
    };
  }
}

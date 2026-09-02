"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { goalApiClient } from "./client";
import { getGoalApiMappingPreview } from "./mapping";
import { goalApiSyncService } from "./sync";
import { GoalApiSyncStatus, GoalApiSyncResult, MappingPreviewItem } from "./types";

/**
 * Server Action: Fetches sync status, quota state, and lease info for Admin Panel
 */
export async function adminGetGoalApiSyncStatusAction(): Promise<GoalApiSyncStatus> {
  await requireAdminRole();
  const adminSupabase = createAdminClient();

  const isConfigured = goalApiClient.isConfigured();

  const [{ data: stateRow }, { data: leaseRow }] = await Promise.all([
    adminSupabase
      .from("external_api_sync_state")
      .select("*")
      .eq("provider", "goal_api")
      .single(),
    adminSupabase
      .from("sync_leases")
      .select("*")
      .eq("sync_name", "goal_api_sync")
      .single(),
  ]);

  return {
    isConfigured,
    provider: "goal_api",
    quotaLimit: stateRow?.quota_limit ?? 1000,
    quotaRemaining: stateRow?.quota_remaining ?? null,
    quotaResetAt: stateRow?.quota_reset_at ?? null,
    lastRequestAt: stateRow?.last_request_at ?? null,
    lastSuccessAt: stateRow?.last_success_at ?? null,
    lastError: stateRow?.last_error ?? null,
    leaseStatus: (leaseRow?.status as any) || "idle",
    leaseLockedUntil: leaseRow?.locked_until ?? null,
  };
}

/**
 * Server Action: Tests connectivity with GOAL API (Admin only)
 */
export async function adminCheckGoalApiConnectionAction(): Promise<{
  success: boolean;
  message: string;
  quotaRemaining?: number | null;
}> {
  await requireAdminRole();

  try {
    const res = await goalApiClient.checkConnection();
    revalidatePath("/admin");
    return {
      success: true,
      message: res.message,
      quotaRemaining: res.rateLimit.quotaRemaining,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Błąd połączenia z GOAL API.",
    };
  }
}

/**
 * Server Action: Fetches mapping preview of external fixtures vs local matches (Admin only)
 */
export async function adminGetGoalApiMappingPreviewAction(): Promise<{
  success: boolean;
  previews: MappingPreviewItem[];
  error?: string;
}> {
  await requireAdminRole();

  try {
    const previews = await getGoalApiMappingPreview(goalApiClient);
    return { success: true, previews };
  } catch (err: any) {
    return { success: false, previews: [], error: err.message || "Błąd podglądu mapowania." };
  }
}

/**
 * Server Action: Triggers manual live sync cycle (Admin only)
 */
export async function adminTriggerManualGoalApiSyncAction(): Promise<GoalApiSyncResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  const result = await goalApiSyncService.executeSync();

  await adminSupabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: "GOAL_API_MANUAL_SYNC",
    target_type: "external_sync",
    details: {
      success: result.success,
      syncedMatchesCount: result.syncedMatchesCount,
      finalizedMatchesCount: result.finalizedMatchesCount,
      reconciledEventsCount: result.reconciledEventsCount,
      skippedManualOverridesCount: result.skippedManualOverridesCount,
      unmappedCount: result.unmappedCount,
      error: result.error || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/mecze");
  revalidatePath("/ranking");
  revalidatePath("/tabela");

  return result;
}

/**
 * Server Action: Admin maps or unmaps a match to a GOAL API fixture ID
 */
export async function adminApplyGoalApiMappingAction(
  matchId: string,
  goalApiFixtureId: string | null
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  if (goalApiFixtureId && goalApiFixtureId.trim()) {
    const cleanId = goalApiFixtureId.trim();

    // Ensure fixtureId is not already assigned to another match
    const { data: duplicateMatch } = await adminSupabase
      .from("matches")
      .select("id")
      .eq("goal_api_fixture_id", cleanId)
      .neq("id", matchId)
      .maybeSingle();

    if (duplicateMatch) {
      return {
        success: false,
        error: "Ten identyfikator fixture GOAL API jest już przypisany do innego meczu w TyperLM26.",
      };
    }

    const { error } = await adminSupabase
      .from("matches")
      .update({
        goal_api_fixture_id: cleanId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (error) {
      return { success: false, error: error.message };
    }

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "GOAL_API_MAPPING_APPLIED",
      target_type: "match",
      target_id: matchId,
      details: { goalApiFixtureId: cleanId },
    });
  } else {
    // Unmapping
    const { error } = await adminSupabase
      .from("matches")
      .update({
        goal_api_fixture_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (error) {
      return { success: false, error: error.message };
    }

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "GOAL_API_MAPPING_REMOVED",
      target_type: "match",
      target_id: matchId,
      details: { previousFixtureId: null },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/mecze");
  return { success: true };
}

// Backward-compatible alias
export const adminSetMatchGoalApiMappingAction = adminApplyGoalApiMappingAction;

/**
 * Server Action: Admin toggles manual override flag for a match
 */
export async function adminToggleMatchManualOverrideAction(
  matchId: string,
  isManualOverride: boolean
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("matches")
    .update({
      is_manual_override: isManualOverride,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    return { success: false, error: error.message };
  }

  await adminSupabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: "MATCH_MANUAL_OVERRIDE_TOGGLED",
    target_type: "match",
    target_id: matchId,
    details: { isManualOverride },
  });

  revalidatePath("/admin");
  revalidatePath("/mecze");
  return { success: true };
}

/**
 * Server Action: Synchronizes UCL 2026/27 real teams and League Phase fixtures from GOAL API (Admin only)
 */
export async function adminSyncUclScheduleAction(): Promise<import("./import").UclScheduleSyncResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { syncUclSchedule } = await import("./import");
  const result = await syncUclSchedule();

  await adminSupabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: "GOAL_API_SCHEDULE_SYNCED",
    target_type: "schedule_sync",
    details: {
      success: result.success,
      teamsSyncedCount: result.teamsSyncedCount,
      newTeamsCount: result.newTeamsCount,
      updatedTeamsCount: result.updatedTeamsCount,
      matchesSyncedCount: result.matchesSyncedCount,
      newMatchesCount: result.newMatchesCount,
      updatedMatchesCount: result.updatedMatchesCount,
      qualifyingIgnoredCount: result.qualifyingIgnoredCount,
      manualOverridesSkippedCount: result.manualOverridesSkippedCount,
      error: result.error || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/mecze");
  revalidatePath("/ranking");
  revalidatePath("/tabela");
  revalidatePath("/");

  return result;
}

/**
 * Server Action: Safely deletes the 16 approved orphan seed teams (Admin only)
 */
export async function adminCleanupSafeOrphanTeamsAction(): Promise<import("./cleanup").OrphanCleanupResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { cleanupSafeOrphanTeams } = await import("./cleanup");
  const result = await cleanupSafeOrphanTeams();

  await adminSupabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CLEANUP_ORPHAN_TEAMS",
    target_type: "teams",
    details: {
      deletedCount: result.deletedCount,
      skippedCount: result.skippedCount,
      deletedTeamNames: result.deletedTeamNames,
      skippedDetails: result.skippedDetails,
      error: result.error || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/mecze");
  revalidatePath("/tabela");
  revalidatePath("/ranking");
  revalidatePath("/");

  return result;
}

/**
 * Server Action: Bootstraps the full 144-match UEFA Champions League 2026/27 schedule (Admin only)
 */
export async function adminBootstrapFullUclScheduleAction(): Promise<import("./bootstrap").BootstrapUclScheduleResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { bootstrapFullUclSchedule } = await import("./bootstrap");
  const result = await bootstrapFullUclSchedule();

  await adminSupabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: "BOOTSTRAP_UCL_144_SCHEDULE",
    target_type: "matches",
    details: {
      success: result.success,
      totalDatasetMatches: result.totalDatasetMatches,
      existingReusedCount: result.existingReusedCount,
      newMatchesInsertedCount: result.newMatchesInsertedCount,
      error: result.error || null,
    },
  });

  revalidatePath("/");

  return result;
}

/**
 * Server Action: Synchronizes squad players for all 36 UCL teams from GOAL API (Admin only)
 */
export async function adminSyncUclPlayersAction(): Promise<import("./types").GoalApiPlayersSyncResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { GoalApiPlayersSyncService } = await import("./players-sync");
  const service = new GoalApiPlayersSyncService();
  const result = await service.executeSquadsSync();

  await adminSupabase.from("audit_logs").insert({
    actor_id: admin.id,
    action: "SYNC_UCL_PLAYERS_SQUADS",
    target_type: "players",
    details: {
      success: result.success,
      totalTeamsChecked: result.totalTeamsChecked,
      successfulTeamsCount: result.successfulTeamsCount,
      failedTeamsCount: result.failedTeamsCount,
      totalPlayersSynced: result.totalPlayersSynced,
      insertedCount: result.insertedCount,
      updatedCount: result.updatedCount,
      deactivatedCount: result.deactivatedCount,
      conflictsCount: result.conflictsCount,
      error: result.error || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/typy-specjalne");
  revalidatePath("/tabela");

  return result;
}



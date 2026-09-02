import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoalApiClient, UCL_LEAGUE_ID } from "./client";
import { GoalApiFixtureItem, GoalApiRawEvent, GoalApiSyncResult } from "./types";

export class GoalApiSyncService {
  private client: GoalApiClient;

  constructor(client: GoalApiClient = new GoalApiClient()) {
    this.client = client;
  }

  /**
   * Checks if an active match window exists right now:
   * Window: [now - 3.5 hours, now + 15 minutes] OR status = 'live'
   */
  public async isMatchWindowActive(adminSupabase = createAdminClient()): Promise<boolean> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const { data: matches, error } = await adminSupabase
      .from("matches")
      .select("id")
      .or(`status.eq.live,and(kickoff_at.gte.${windowStart},kickoff_at.lte.${windowEnd})`)
      .limit(1);

    if (error || !matches) return false;
    return matches.length > 0;
  }

  /**
   * Executes manual / automated sync cycle
   */
  public async executeSync(options: { checkWindowFirst?: boolean } = {}): Promise<GoalApiSyncResult> {
    const adminSupabase = createAdminClient();

    if (options.checkWindowFirst) {
      const active = await this.isMatchWindowActive(adminSupabase);
      if (!active) {
        return {
          success: true,
          syncedMatchesCount: 0,
          finalizedMatchesCount: 0,
          reconciledEventsCount: 0,
          skippedManualOverridesCount: 0,
          unmappedCount: 0,
          details: [],
        };
      }
    }

    const lockId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Acquire DB Lease (Atomic lock)
    const { data: leaseAcquired, error: leaseErr } = await adminSupabase.rpc("acquire_sync_lease", {
      p_sync_name: "goal_api_sync",
      p_locked_by: lockId,
      p_duration_seconds: 90,
    });

    if (leaseErr || !leaseAcquired) {
      return {
        success: false,
        error: "Inna operacja synchronizacji jest aktualnie w toku (aktywny DB lease).",
        syncedMatchesCount: 0,
        finalizedMatchesCount: 0,
        reconciledEventsCount: 0,
        skippedManualOverridesCount: 0,
        unmappedCount: 0,
      };
    }

    try {
      // 2. Check Quota Remaining from DB state (Reserve at least 50 requests)
      const { data: stateRow } = await adminSupabase
        .from("external_api_sync_state")
        .select("quota_remaining, quota_limit")
        .eq("provider", "goal_api")
        .single();

      if (stateRow && stateRow.quota_remaining !== null && stateRow.quota_remaining <= 50) {
        throw new Error(`Zbyt niski stan limitu zapytań GOAL API (${stateRow.quota_remaining} pozostało <= 50). Synchronizacja wstrzymana ze względów bezpieczeństwa.`);
      }

      // 3. Fetch LIVE fixtures from provider
      let liveFixtures: GoalApiFixtureItem[] = [];
      try {
        liveFixtures = await this.client.getLiveFixtures();
      } catch (err: any) {
        throw new Error(`Błąd pobierania meczów LIVE: ${err.message}`);
      }

      // Filter for UEFA Champions League fixtures
      const uclLiveFixtures = liveFixtures.filter((f) => f.leagueId === UCL_LEAGUE_ID);

      // 4. Fetch all local matches mapped to GOAL API or currently marked 'live'
      const { data: rawMatches } = await adminSupabase
        .from("matches")
        .select("id, status, home_score, away_score, goal_api_fixture_id, is_manual_override, home_team_id, away_team_id");

      const localMatches = (rawMatches || []) as Array<{
        id: string;
        status: string;
        home_score: number | null;
        away_score: number | null;
        goal_api_fixture_id: string | null;
        is_manual_override: boolean;
        home_team_id: string;
        away_team_id: string;
      }>;

      let syncedMatchesCount = 0;
      let finalizedMatchesCount = 0;
      let reconciledEventsCount = 0;
      let skippedManualOverridesCount = 0;
      let unmappedCount = 0;
      const details: GoalApiSyncResult["details"] = [];

      const liveExtIds = new Set(uclLiveFixtures.map((f) => f.id));

      // 5. Process currently LIVE fixtures
      for (const extFixture of uclLiveFixtures) {
        const localMatch = localMatches.find((m) => m.goal_api_fixture_id === extFixture.id);

        if (!localMatch) {
          unmappedCount += 1;
          details.push({
            fixtureId: extFixture.id,
            action: "UNMAPPED",
            status: extFixture.matchStatus,
          });
          continue;
        }

        if (localMatch.is_manual_override) {
          skippedManualOverridesCount += 1;
          details.push({
            matchId: localMatch.id,
            fixtureId: extFixture.id,
            action: "OVERRIDE_SKIPPED",
          });
          continue;
        }

        const newHomeScore = Number(extFixture.homeTeamScore) || 0;
        const newAwayScore = Number(extFixture.awayTeamScore) || 0;

        await adminSupabase
          .from("matches")
          .update({
            status: "live",
            home_score: newHomeScore,
            away_score: newAwayScore,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", localMatch.id);

        syncedMatchesCount += 1;

        // Reconcile live events if provided in fixture object
        if (extFixture.events && extFixture.events.length > 0) {
          const recCount = await this.reconcileMatchEvents(
            adminSupabase,
            localMatch.id,
            localMatch.home_team_id,
            localMatch.away_team_id,
            extFixture.events
          );
          reconciledEventsCount += recCount;
        }

        details.push({
          matchId: localMatch.id,
          fixtureId: extFixture.id,
          action: "SCORE_UPDATED",
          score: `${newHomeScore}:${newAwayScore}`,
          status: "live",
        });
      }

      // 6. Handle Disappeared Live Matches (e.g. match just finished FT)
      const locallyLiveMatches = localMatches.filter((m) => m.status === "live" && m.goal_api_fixture_id);

      for (const localLive of locallyLiveMatches) {
        if (!liveExtIds.has(localLive.goal_api_fixture_id!)) {
          // Query single fixture detail
          const detail = await this.client.getFixtureById(localLive.goal_api_fixture_id!);

          if (!detail) continue;

          if (localLive.is_manual_override) {
            skippedManualOverridesCount += 1;
            continue;
          }

          const statusUpper = (detail.matchStatus || "").toString().trim().toUpperCase();

          if (statusUpper === "FINISHED") {
            // Fetch full events
            let fullEvents: GoalApiRawEvent[] = [];
            try {
              fullEvents = await this.client.getFixtureEvents(detail.id);
            } catch (err) {
              console.warn("Could not fetch full fixture events on FT:", err);
            }

            if (fullEvents.length > 0) {
              const recCount = await this.reconcileMatchEvents(
                adminSupabase,
                localLive.id,
                localLive.home_team_id,
                localLive.away_team_id,
                fullEvents
              );
              reconciledEventsCount += recCount;
            }

            const finalHome = Number(detail.homeTeamFtScore ?? detail.homeTeamScore ?? 0);
            const finalAway = Number(detail.awayTeamFtScore ?? detail.awayTeamScore ?? 0);

            // Trigger idempotent settlement
            await adminSupabase.rpc("finalize_and_score_match", {
              p_match_id: localLive.id,
              p_home_score: finalHome,
              p_away_score: finalAway,
            });

            await adminSupabase
              .from("matches")
              .update({
                last_synced_at: new Date().toISOString(),
                events_reconciled_at: new Date().toISOString(),
              })
              .eq("id", localLive.id);

            finalizedMatchesCount += 1;
            details.push({
              matchId: localLive.id,
              fixtureId: detail.id,
              action: "FINALIZED",
              score: `${finalHome}:${finalAway}`,
              status: "finished",
            });
          } else if (statusUpper === "POSTPONED") {
            await adminSupabase
              .from("matches")
              .update({
                status: "postponed",
                is_betting_locked: true,
                last_synced_at: new Date().toISOString(),
              })
              .eq("id", localLive.id);
          } else if (statusUpper === "LIVE") {
            // Keep live
          } else {
            console.warn(`GOAL API sync: unhandled status "${statusUpper}" for match ${localLive.id}. Skipping finalization.`);
          }
        }
      }

      // Revalidate dashboard routes
      try {
        revalidatePath("/mecze");
        revalidatePath("/ranking");
        revalidatePath("/tabela");
        revalidatePath("/");
        revalidatePath("/admin");
      } catch {
        // Safe when running in test / non-request environments
      }

      return {
        success: true,
        syncedMatchesCount,
        finalizedMatchesCount,
        reconciledEventsCount,
        skippedManualOverridesCount,
        unmappedCount,
        quotaRemaining: stateRow?.quota_remaining,
        details,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Błąd podczas synchronizacji GOAL API.",
        syncedMatchesCount: 0,
        finalizedMatchesCount: 0,
        reconciledEventsCount: 0,
        skippedManualOverridesCount: 0,
        unmappedCount: 0,
      };
    } finally {
      // 7. Release DB lease
      await adminSupabase.rpc("release_sync_lease", {
        p_sync_name: "goal_api_sync",
        p_locked_by: lockId,
        p_status: "idle",
      });
    }
  }

  /**
   * Reconciles incoming match events against existing DB events
   * - Upserts current incoming events
   * - Deletes events that disappeared from provider response (e.g. VAR cancel)
   */
  public async reconcileMatchEvents(
    adminSupabase: any,
    matchId: string,
    homeTeamId: string | null,
    awayTeamId: string | null,
    rawEvents: GoalApiRawEvent[]
  ): Promise<number> {
    if (!rawEvents || rawEvents.length === 0) return 0;

    const incomingEventIds: string[] = [];

    for (const ev of rawEvents) {
      if (!ev.id) continue;
      incomingEventIds.push(ev.id);

      const isHome = Boolean(ev.homeScorer || ev.homeAssist);
      const isAway = Boolean(ev.awayScorer || ev.awayAssist);
      const side = isHome ? "home" : isAway ? "away" : null;
      const teamId = isHome ? homeTeamId : isAway ? awayTeamId : null;

      const scorerName = ev.homeScorer || ev.awayScorer || null;
      const scorerExtId = ev.homeScorerId || ev.awayScorerId || null;
      const assistName = ev.homeAssist || ev.awayAssist || null;
      const assistExtId = ev.homeAssistId || ev.awayAssistId || null;
      const minute = ev.timeNum ?? (ev.time ? parseInt(String(ev.time), 10) : null);

      await adminSupabase.from("match_events").upsert(
        {
          match_id: matchId,
          goal_api_event_id: ev.id,
          event_type: ev.type || "GOAL",
          minute: isNaN(Number(minute)) ? null : minute,
          team_id: teamId,
          side,
          scorer_external_id: scorerExtId,
          scorer_name: scorerName,
          assist_external_id: assistExtId,
          assist_name: assistName,
          info: ev.info || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "goal_api_event_id" }
      );
    }

    // Delete any local events for this match that were removed upstream
    if (incomingEventIds.length > 0) {
      const { data: existingEvents } = await adminSupabase
        .from("match_events")
        .select("id, goal_api_event_id")
        .eq("match_id", matchId);

      const toDelete = (existingEvents || []).filter(
        (e: any) => !incomingEventIds.includes(e.goal_api_event_id)
      );

      if (toDelete.length > 0) {
        const deleteIds = toDelete.map((e: any) => e.id);
        await adminSupabase.from("match_events").delete().in("id", deleteIds);
      }
    }

    return incomingEventIds.length;
  }
}

export const goalApiSyncService = new GoalApiSyncService();

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const UCL_LEAGUE_ID = "cmr77dw3900f5rx06j05wgzv4";
const GOAL_API_BASE_URL = "https://api.goal-api.com/v1";
const QUOTA_SAFETY_RESERVE = 50;

interface MatchRow {
  id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  goal_api_fixture_id: string | null;
  is_manual_override: boolean;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
}

Deno.serve(async (req: Request) => {
  const startMs = Date.now();

  // Basic CORS & method check
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const goalApiKey = (Deno.env.get("GOAL_API_KEY") || "").trim().replace(/^["'=]+|["']+$/g, "");
  const cronSecret = (Deno.env.get("CRON_SECRET") || "").trim();

  // Validate caller authentication using dedicated CRON_SECRET
  if (cronSecret) {
    const incomingSecret =
      req.headers.get("x-cron-secret") ||
      req.headers.get("apikey") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (!incomingSecret || incomingSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid or missing cron secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing Supabase service environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!goalApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing GOAL_API_KEY secret" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();

  // 1. SMART WINDOW CHECK:
  // Window: [now - 3.5 hours, now + 15 minutes] OR status = 'live'
  const windowStart = new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const { data: activeMatches, error: windowErr } = await adminSupabase
    .from("matches")
    .select("id, status, home_score, away_score, goal_api_fixture_id, is_manual_override, home_team_id, away_team_id, kickoff_at")
    .or(`status.eq.live,and(kickoff_at.gte.${windowStart},kickoff_at.lte.${windowEnd})`);

  if (windowErr) {
    return new Response(
      JSON.stringify({ success: false, error: `DB Error checking match window: ${windowErr.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const candidateMatches = (activeMatches || []) as MatchRow[];

  if (candidateMatches.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: "NO_ACTIVE_MATCH_WINDOW",
        activeMatchesCount: 0,
        quotaUsed: 0,
        durationMs: Date.now() - startMs,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. ATOMIC DB LEASE (Lock concurrency)
  const lockId = `edge_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { data: leaseAcquired, error: leaseErr } = await adminSupabase.rpc("acquire_sync_lease", {
    p_sync_name: "goal_api_sync",
    p_locked_by: lockId,
    p_duration_seconds: 90,
  });

  if (leaseErr || !leaseAcquired) {
    return new Response(
      JSON.stringify({
        success: false,
        skipped: true,
        reason: "LEASE_HELD_BY_ANOTHER_INSTANCE",
        durationMs: Date.now() - startMs,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 3. QUOTA SAFETY RESERVE CHECK
    const { data: stateRow } = await adminSupabase
      .from("external_api_sync_state")
      .select("quota_remaining, quota_limit")
      .eq("provider", "goal_api")
      .single();

    if (stateRow && stateRow.quota_remaining !== null && stateRow.quota_remaining <= QUOTA_SAFETY_RESERVE) {
      throw new Error(
        `GOAL API quota safety reserve reached (${stateRow.quota_remaining} remaining <= ${QUOTA_SAFETY_RESERVE}). Polling paused safely.`
      );
    }

    // 4. FETCH LIVE FIXTURES FROM GOAL API (Single call for all live matches)
    const liveResp = await fetch(`${GOAL_API_BASE_URL}/fixtures/live`, {
      headers: {
        Authorization: `Bearer ${goalApiKey}`,
        Accept: "application/json",
      },
    });

    // Update quota tracking from response headers if available
    const quotaRemHeader = liveResp.headers.get("x-ratelimit-remaining") || liveResp.headers.get("ratelimit-remaining");
    const quotaLimHeader = liveResp.headers.get("x-ratelimit-limit") || liveResp.headers.get("ratelimit-limit");
    if (quotaRemHeader) {
      const remainingNum = parseInt(quotaRemHeader, 10);
      const limitNum = quotaLimHeader ? parseInt(quotaLimHeader, 10) : 1000;
      if (!isNaN(remainingNum)) {
        await adminSupabase.from("external_api_sync_state").upsert(
          {
            provider: "goal_api",
            quota_remaining: remainingNum,
            quota_limit: limitNum,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "provider" }
        );
      }
    }

    if (!liveResp.ok) {
      throw new Error(`GOAL API HTTP ${liveResp.status}: ${liveResp.statusText}`);
    }

    const liveJson = await liveResp.json();
    const allLiveFixtures = (liveJson.data || []) as any[];
    const uclLiveFixtures = allLiveFixtures.filter((f) => f.leagueId === UCL_LEAGUE_ID);
    const liveExtIds = new Set(uclLiveFixtures.map((f) => f.id));

    // Fetch all mapped matches
    const { data: allMappedMatchesRaw } = await adminSupabase
      .from("matches")
      .select("id, status, home_score, away_score, goal_api_fixture_id, is_manual_override, home_team_id, away_team_id, kickoff_at");

    const allMappedMatches = (allMappedMatchesRaw || []) as MatchRow[];

    let syncedMatchesCount = 0;
    let finalizedMatchesCount = 0;
    let reconciledEventsCount = 0;
    let skippedOverridesCount = 0;

    // 5. UPDATE CURRENTLY LIVE MATCHES
    for (const extFixture of uclLiveFixtures) {
      const localMatch = allMappedMatches.find((m) => m.goal_api_fixture_id === extFixture.id);
      if (!localMatch) continue;

      if (localMatch.is_manual_override) {
        skippedOverridesCount++;
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

      syncedMatchesCount++;

      // Reconcile events
      if (extFixture.events && Array.isArray(extFixture.events) && extFixture.events.length > 0) {
        const evCount = await reconcileEvents(
          adminSupabase,
          localMatch.id,
          localMatch.home_team_id,
          localMatch.away_team_id,
          extFixture.events
        );
        reconciledEventsCount += evCount;
      }
    }

    // 6. DETECT TRANSITIONS FROM LIVE -> FINISHED / POSTPONED
    const locallyLiveMatches = allMappedMatches.filter((m) => m.status === "live" && m.goal_api_fixture_id);

    for (const localLive of locallyLiveMatches) {
      if (!liveExtIds.has(localLive.goal_api_fixture_id!)) {
        // Fetch specific fixture detail
        const detailResp = await fetch(`${GOAL_API_BASE_URL}/fixtures/${localLive.goal_api_fixture_id}`, {
          headers: {
            Authorization: `Bearer ${goalApiKey}`,
            Accept: "application/json",
          },
        });

        if (!detailResp.ok) continue;

        const detailJson = await detailResp.json();
        const detail = detailJson.data || detailJson;
        if (!detail) continue;

        if (localLive.is_manual_override) {
          skippedOverridesCount++;
          continue;
        }

        const rawStatus = (detail.matchStatus || detail.status || "").toString().trim().toUpperCase();

        if (rawStatus === "FINISHED") {
          // Fetch full events
          let fullEvents: any[] = [];
          try {
            const evResp = await fetch(`${GOAL_API_BASE_URL}/fixtures/${detail.id}/events`, {
              headers: { Authorization: `Bearer ${goalApiKey}`, Accept: "application/json" },
            });
            if (evResp.ok) {
              const evJson = await evResp.json();
              fullEvents = evJson.data || [];
            }
          } catch (e) {
            console.warn("Could not fetch full fixture events on FT:", e);
          }

          if (fullEvents.length > 0) {
            const evCount = await reconcileEvents(
              adminSupabase,
              localLive.id,
              localLive.home_team_id,
              localLive.away_team_id,
              fullEvents
            );
            reconciledEventsCount += evCount;
          }

          const finalHome = Number(detail.homeTeamFtScore ?? detail.homeTeamScore ?? 0);
          const finalAway = Number(detail.awayTeamFtScore ?? detail.awayTeamScore ?? 0);

          // Atomic & idempotent scoring RPC
          await adminSupabase.rpc("finalize_and_score_match", {
            p_match_id: localLive.id,
            p_home_score: finalHome,
            p_away_score: finalAway,
          });

          await adminSupabase
            .from("matches")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", localLive.id);

          finalizedMatchesCount++;
        } else if (rawStatus === "POSTPONED") {
          await adminSupabase
            .from("matches")
            .update({
              status: "postponed",
              is_betting_locked: true,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", localLive.id);
        } else if (rawStatus === "LIVE") {
          // Remain live
        } else {
          console.warn(`Unhandled status for match ${localLive.id}: "${rawStatus}"`);
        }
      }
    }

    // 7. Update sync state
    await adminSupabase.from("external_api_sync_state").upsert(
      {
        provider: "goal_api",
        last_synced_at: new Date().toISOString(),
        error_message: null,
      },
      { onConflict: "provider" }
    );

    return new Response(
      JSON.stringify({
        success: true,
        syncedMatchesCount,
        finalizedMatchesCount,
        reconciledEventsCount,
        skippedOverridesCount,
        durationMs: Date.now() - startMs,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Record error state
    await adminSupabase.from("external_api_sync_state").upsert(
      {
        provider: "goal_api",
        error_message: err.message || "Unknown error during edge sync",
      },
      { onConflict: "provider" }
    );

    return new Response(
      JSON.stringify({ success: false, error: err.message, durationMs: Date.now() - startMs }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    // 8. RELEASE LEASE
    await adminSupabase.rpc("release_sync_lease", {
      p_sync_name: "goal_api_sync",
      p_locked_by: lockId,
      p_status: "idle",
    });
  }
});

/**
 * Reconciles match events (upsert new/changed, delete disappeared/VAR cancelled)
 */
async function reconcileEvents(
  supabase: any,
  matchId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
  rawEvents: any[]
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

    await supabase.from("match_events").upsert(
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

  // Delete disappeared events
  if (incomingEventIds.length > 0) {
    const { data: existingEvents } = await supabase
      .from("match_events")
      .select("id, goal_api_event_id")
      .eq("match_id", matchId);

    const toDelete = (existingEvents || []).filter(
      (e: any) => !incomingEventIds.includes(e.goal_api_event_id)
    );

    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((e: any) => e.id);
      await supabase.from("match_events").delete().in("id", deleteIds);
    }
  }

  return incomingEventIds.length;
}

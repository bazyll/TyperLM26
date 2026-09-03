"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdminRole } from "@/lib/auth/actions";
import { assertLiveSandboxAllowed } from "./guards";
import { goalApiClient } from "@/lib/goal-api/client";
import { goalApiSyncService } from "@/lib/goal-api/sync";
import { GoalApiFixtureItem, GoalApiRawEvent } from "@/lib/goal-api/types";

export interface LiveSandboxFixtureSummary {
  fixtureId: string;
  leagueName: string;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  homeScore: number;
  awayScore: number;
  rawStatus: string;
  kickoffUtc: string;
  providerUpdatedAt: string | null;
  latestEventMinute: number | null;
  latestEventDescription: string | null;
  isFinished: boolean;
}

export interface LiveSandboxSessionState {
  matchId: string;
  fixtureId: string;
  homeTeam: { id: string; name: string; shortName: string; code: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; shortName: string; code: string; logoUrl: string | null };
  dbScore: { home: number; away: number };
  providerScore: { home: number; away: number };
  mappedStatus: "scheduled" | "live" | "finished" | "postponed";
  rawStatus: string;
  kickoffUtc: string;
  providerUpdatedAt: string | null;
  latestEventMinute: number | null;
  latestEventDescription: string | null;
  userPrediction: { home: number; away: number; pointsAwarded: number | null };
  isBettingLocked: boolean;
  requestCount: number;
  lastSyncedAt: string | null;
  eventsReconciledCount: number;
  isFinished: boolean;
}

const MAX_SANDBOX_REQUESTS = 150;

/**
 * Server Action: Discover active live fixtures worldwide from GOAL API.
 */
export async function adminGetLiveFixturesAction(): Promise<{
  success: boolean;
  error?: string;
  fixtures?: LiveSandboxFixtureSummary[];
  quotaRemaining?: number | null;
}> {
  assertLiveSandboxAllowed();
  await requireAdminRole();

  try {
    const rawFixtures = await goalApiClient.getLiveFixtures();

    const fixtures: LiveSandboxFixtureSummary[] = (rawFixtures || []).map((f) => {
      const homeScore = Number(f.homeTeamScore ?? 0);
      const awayScore = Number(f.awayTeamScore ?? 0);
      const rawStatus = (f.matchStatus || "LIVE").toString().trim();
      const isFinished = rawStatus.toUpperCase() === "FINISHED";

      let latestEventMinute: number | null = null;
      let latestEventDescription: string | null = null;
      if (f.events && f.events.length > 0) {
        const sorted = [...f.events].sort((a, b) => (b.timeNum ?? 0) - (a.timeNum ?? 0));
        const top = sorted[0];
        if (top && top.timeNum) {
          latestEventMinute = top.timeNum;
          latestEventDescription = `${top.type || "Zdarzenie"} (${top.timeNum}')`;
        }
      }

      return {
        fixtureId: f.id,
        leagueName: f.leagueName || "Rozgrywki międzynarodowe",
        homeTeamName: f.homeTeamName || f.homeTeam?.name || "Gospodarze",
        homeTeamLogo: f.teamHomeBadge || f.homeTeam?.badge || null,
        awayTeamName: f.awayTeamName || f.awayTeam?.name || "Goście",
        awayTeamLogo: f.teamAwayBadge || f.awayTeam?.badge || null,
        homeScore: isNaN(homeScore) ? 0 : homeScore,
        awayScore: isNaN(awayScore) ? 0 : awayScore,
        rawStatus,
        kickoffUtc: f.kickoffUtc || new Date().toISOString(),
        providerUpdatedAt: (f as any).updatedAt || null,
        latestEventMinute,
        latestEventDescription,
        isFinished,
      };
    });

    return {
      success: true,
      fixtures,
    };
  } catch (err: any) {
    console.error("[LIVE SANDBOX] Error fetching live fixtures:", err);
    return {
      success: false,
      error: err.message || "Nie udało się pobrać meczów LIVE z GOAL API.",
    };
  }
}

/**
 * Server Action: Start Live Sandbox session for a selected fixture.
 */
export async function adminStartSandboxSessionAction(input: {
  fixtureId: string;
  userHomeScore: number;
  userAwayScore: number;
}): Promise<{
  success: boolean;
  error?: string;
  sessionState?: LiveSandboxSessionState;
}> {
  assertLiveSandboxAllowed();
  const admin = await requireAdminRole();

  const parsed = z
    .object({
      fixtureId: z.string().min(1),
      userHomeScore: z.number().int().min(0).max(99),
      userAwayScore: z.number().int().min(0).max(99),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe parametry startowe." };
  }

  const { fixtureId, userHomeScore, userAwayScore } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    // 1. Fetch live fixture detail from provider
    const fixture = await goalApiClient.getFixtureById(fixtureId);
    if (!fixture) {
      return { success: false, error: "Nie znaleziono meczu w GOAL API." };
    }

    const rawHomeName = fixture.homeTeamName || fixture.homeTeam?.name || "Drużyna A";
    const rawAwayName = fixture.awayTeamName || fixture.awayTeam?.name || "Drużyna B";
    const homeCode = rawHomeName.slice(0, 3).toUpperCase().padEnd(3, "X").slice(0, 4);
    const awayCode = rawAwayName.slice(0, 3).toUpperCase().padEnd(3, "X").slice(0, 4);

    // 2. Upsert test teams in staging DB
    const homeTeamGoalApiId = fixture.homeTeam?.id || fixture.homeTeamId || `sandbox_team_home_${fixtureId}`;
    const awayTeamGoalApiId = fixture.awayTeam?.id || fixture.awayTeamId || `sandbox_team_away_${fixtureId}`;

    const { data: homeTeam, error: homeTeamErr } = await adminSupabase
      .from("teams")
      .upsert(
        {
          name: `${rawHomeName} [TEST]`,
          short_name: rawHomeName,
          code: homeCode,
          logo_url: fixture.teamHomeBadge || fixture.homeTeam?.badge || null,
          goal_api_id: homeTeamGoalApiId,
          uefa_coefficient: 0,
          disciplinary_points: 0,
        },
        { onConflict: "goal_api_id" }
      )
      .select("id, name, short_name, code, logo_url")
      .single();

    if (homeTeamErr || !homeTeam) {
      throw new Error(`Błąd tworzenia drużyny gospodarzy: ${homeTeamErr?.message}`);
    }

    const { data: awayTeam, error: awayTeamErr } = await adminSupabase
      .from("teams")
      .upsert(
        {
          name: `${rawAwayName} [TEST]`,
          short_name: rawAwayName,
          code: awayCode,
          logo_url: fixture.teamAwayBadge || fixture.awayTeam?.badge || null,
          goal_api_id: awayTeamGoalApiId,
          uefa_coefficient: 0,
          disciplinary_points: 0,
        },
        { onConflict: "goal_api_id" }
      )
      .select("id, name, short_name, code, logo_url")
      .single();

    if (awayTeamErr || !awayTeam) {
      throw new Error(`Błąd tworzenia drużyny gości: ${awayTeamErr?.message}`);
    }

    const rawStatus = (fixture.matchStatus || "LIVE").toString().trim().toUpperCase();
    const mappedStatus = rawStatus === "FINISHED" ? "finished" : "live";
    const initialHomeScore = Number(fixture.homeTeamScore ?? 0);
    const initialAwayScore = Number(fixture.awayTeamScore ?? 0);
    const providerMinute: string | null = null; // No elapsed minute/clock field exists in GOAL API payload

    // 3. Create or update test match in staging DB
    const { data: match, error: matchErr } = await adminSupabase
      .from("matches")
      .upsert(
        {
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          kickoff_at: fixture.kickoffUtc || new Date().toISOString(),
          status: mappedStatus,
          home_score: initialHomeScore,
          away_score: initialAwayScore,
          is_betting_locked: true,
          stage: "league",
          matchday: 99,
          goal_api_fixture_id: fixtureId,
          points_multiplier: 1,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "goal_api_fixture_id" }
      )
      .select("id, home_score, away_score, status, is_betting_locked, last_synced_at")
      .single();

    if (matchErr || !match) {
      throw new Error(`Błąd tworzenia meczu testowego: ${matchErr?.message}`);
    }

    // 4. Create admin test prediction
    const { data: prediction, error: predErr } = await adminSupabase
      .from("predictions")
      .upsert(
        {
          match_id: match.id,
          user_id: admin.id,
          home_score: userHomeScore,
          away_score: userAwayScore,
          points_awarded: null,
          scoring_category: null,
        },
        { onConflict: "match_id,user_id" }
      )
      .select("home_score, away_score, points_awarded")
      .single();

    if (predErr) {
      console.warn("[LIVE SANDBOX] Prediction upsert warning:", predErr);
    }

    const sessionState: LiveSandboxSessionState = {
      matchId: match.id,
      fixtureId,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        shortName: homeTeam.short_name,
        code: homeTeam.code,
        logoUrl: homeTeam.logo_url,
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        shortName: awayTeam.short_name,
        code: awayTeam.code,
        logoUrl: awayTeam.logo_url,
      },
      dbScore: { home: match.home_score ?? 0, away: match.away_score ?? 0 },
      providerScore: { home: initialHomeScore, away: initialAwayScore },
      mappedStatus,
      rawStatus,
      kickoffUtc: fixture.kickoffUtc || new Date().toISOString(),
      providerUpdatedAt: (fixture as any).updatedAt || null,
      latestEventMinute: null,
      latestEventDescription: null,
      userPrediction: {
        home: prediction?.home_score ?? userHomeScore,
        away: prediction?.away_score ?? userAwayScore,
        pointsAwarded: prediction?.points_awarded ?? null,
      },
      isBettingLocked: true,
      requestCount: 1,
      lastSyncedAt: match.last_synced_at,
      eventsReconciledCount: 0,
      isFinished: mappedStatus === "finished",
    };

    return {
      success: true,
      sessionState,
    };
  } catch (err: any) {
    console.error("[LIVE SANDBOX] Error starting session:", err);
    return {
      success: false,
      error: err.message || "Błąd podczas uruchamiania sesji testowej.",
    };
  }
}

/**
 * Server Action: Execute single sync tick for the active live sandbox fixture.
 */
export async function adminTickSandboxSyncAction(input: {
  matchId: string;
  fixtureId: string;
  currentRequestCount: number;
  currentHomeScore?: number;
  currentAwayScore?: number;
  currentLatestEventMinute?: number | null;
  currentLatestEventDescription?: string | null;
}): Promise<{
  success: boolean;
  error?: string;
  dbScore?: { home: number; away: number };
  providerScore?: { home: number; away: number };
  mappedStatus?: "live" | "finished" | "postponed" | "scheduled";
  rawStatus?: string;
  kickoffUtc?: string;
  providerUpdatedAt?: string | null;
  latestEventMinute?: number | null;
  latestEventDescription?: string | null;
  isFinished?: boolean;
  eventsCount?: number;
  pointsAwarded?: number | null;
  requestCount?: number;
  lastSyncedAt?: string;
}> {
  assertLiveSandboxAllowed();
  const admin = await requireAdminRole();

  const {
    matchId,
    fixtureId,
    currentRequestCount,
    currentHomeScore = 0,
    currentAwayScore = 0,
    currentLatestEventMinute = null,
    currentLatestEventDescription = null,
  } = input;

  if (currentRequestCount >= MAX_SANDBOX_REQUESTS) {
    return {
      success: false,
      error: `Osiągnięto limit ${MAX_SANDBOX_REQUESTS} requestów na sesję testową ze względów bezpieczeństwa.`,
    };
  }

  const adminSupabase = createAdminClient();
  let requestsExecuted = 1; // Count 1: getFixtureById

  try {
    // 1. Fetch fresh fixture status from provider (1 request/min)
    const detail = await goalApiClient.getFixtureById(fixtureId);
    if (!detail) {
      return { success: false, error: "Nie udało się pobrać szczegółów meczu z GOAL API." };
    }

    const rawStatus = (detail.matchStatus || "LIVE").toString().trim().toUpperCase();
    const isFinished = rawStatus === "FINISHED";
    const mappedStatus = isFinished ? "finished" : rawStatus === "POSTPONED" ? "postponed" : "live";

    const provHome = Number(detail.homeTeamScore ?? 0);
    const provAway = Number(detail.awayTeamScore ?? 0);

    const isScoreChanged = provHome !== currentHomeScore || provAway !== currentAwayScore;

    let latestEventMinute: number | null = currentLatestEventMinute;
    let latestEventDescription: string | null = currentLatestEventDescription;
    let fullEvents: GoalApiRawEvent[] = [];

    // 2. Fetch events ONLY on score change (for live clock anchor) or on FT (for final reconciliation)
    if (isScoreChanged || isFinished) {
      try {
        requestsExecuted += 1; // Count 2: getFixtureEvents
        fullEvents = await goalApiClient.getFixtureEvents(fixtureId);
        if (fullEvents && fullEvents.length > 0) {
          const goals = fullEvents
            .filter((e) => (e.type || "").toUpperCase().includes("GOAL"))
            .sort((a, b) => (b.timeNum ?? 0) - (a.timeNum ?? 0));

          const latestGoal = goals[0] || [...fullEvents].sort((a, b) => (b.timeNum ?? 0) - (a.timeNum ?? 0))[0];

          if (latestGoal && latestGoal.timeNum) {
            latestEventMinute = latestGoal.timeNum;
            const scorer = latestGoal.homeScorer || latestGoal.awayScorer;
            latestEventDescription = `${latestGoal.type || "Gol"}${scorer ? ` - ${scorer}` : ""} (${latestGoal.timeNum}')`;
          }
        }
      } catch (err) {
        console.warn("[LIVE SANDBOX] Could not fetch fixture events on trigger:", err);
      }
    }

    let eventsReconciled = 0;
    let pointsAwardedResult: number | null = null;

    // 3. Update DB with live score & status (Triggers Supabase Realtime broadcast)
    if (!isFinished) {
      await adminSupabase
        .from("matches")
        .update({
          status: mappedStatus,
          home_score: provHome,
          away_score: provAway,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", matchId);
    } else {
      // 4. Finalization Flow (FT)
      // Fetch team IDs from match record
      const { data: matchRow } = await adminSupabase
        .from("matches")
        .select("home_team_id, away_team_id")
        .eq("id", matchId)
        .single();

      if (matchRow && fullEvents.length > 0) {
        eventsReconciled = await goalApiSyncService.reconcileMatchEvents(
          adminSupabase,
          matchId,
          matchRow.home_team_id,
          matchRow.away_team_id,
          fullEvents
        );
      }

      const finalHome = Number(detail.homeTeamFtScore ?? provHome);
      const finalAway = Number(detail.awayTeamFtScore ?? provAway);

      // Finalize and calculate points in PostgreSQL procedure
      await adminSupabase.rpc("finalize_and_score_match", {
        p_match_id: matchId,
        p_home_score: finalHome,
        p_away_score: finalAway,
      });

      await adminSupabase
        .from("matches")
        .update({
          last_synced_at: new Date().toISOString(),
          events_reconciled_at: new Date().toISOString(),
        })
        .eq("id", matchId);

      // Read awarded points for admin
      const { data: predRow } = await adminSupabase
        .from("predictions")
        .select("points_awarded")
        .eq("match_id", matchId)
        .eq("user_id", admin.id)
        .maybeSingle();

      pointsAwardedResult = predRow?.points_awarded ?? null;
    }

    const nowIso = new Date().toISOString();

    return {
      success: true,
      dbScore: { home: provHome, away: provAway },
      providerScore: { home: provHome, away: provAway },
      mappedStatus,
      rawStatus,
      kickoffUtc: detail.kickoffUtc || new Date().toISOString(),
      providerUpdatedAt: (detail as any).updatedAt || null,
      latestEventMinute,
      latestEventDescription,
      isFinished,
      eventsCount: eventsReconciled,
      pointsAwarded: pointsAwardedResult,
      requestCount: currentRequestCount + requestsExecuted,
      lastSyncedAt: nowIso,
    };
  } catch (err: any) {
    console.error("[LIVE SANDBOX] Error during sync tick:", err);
    return {
      success: false,
      error: err.message || "Błąd podczas synchronizacji meczu testowego.",
    };
  }
}

/**
 * Server Action: Clean teardown of sandbox test session from Staging DB.
 */
export async function adminTeardownSandboxAction(input: {
  matchId: string;
}): Promise<{ success: boolean; error?: string }> {
  // Strict staging environment re-verification before deletion!
  assertLiveSandboxAllowed();
  await requireAdminRole();

  const parsed = z.object({ matchId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowy identyfikator meczu." };
  }

  const { matchId } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    // 1. Fetch match to get team IDs
    const { data: match } = await adminSupabase
      .from("matches")
      .select("id, home_team_id, away_team_id, stage, goal_api_fixture_id")
      .eq("id", matchId)
      .maybeSingle();

    if (!match) {
      return { success: true }; // Already deleted
    }

    // Safety check: ensure fixture is assigned
    if (!match.goal_api_fixture_id) {
      throw new Error("Odmowa usunięcia: Wybrany mecz nie posiada przypisanego fixtureId z sandboxa.");
    }

    // 2. Delete match_events
    await adminSupabase.from("match_events").delete().eq("match_id", matchId);

    // 3. Delete predictions
    await adminSupabase.from("predictions").delete().eq("match_id", matchId);

    // 4. Delete match
    await adminSupabase.from("matches").delete().eq("id", matchId);

    // 5. Delete test teams
    if (match.home_team_id) {
      await adminSupabase.from("teams").delete().eq("id", match.home_team_id);
    }
    if (match.away_team_id) {
      await adminSupabase.from("teams").delete().eq("id", match.away_team_id);
    }

    revalidatePath("/admin/live-sandbox");
    return { success: true };
  } catch (err: any) {
    console.error("[LIVE SANDBOX] Teardown error:", err);
    return { success: false, error: err.message || "Błąd podczas czyszczenia danych testowych." };
  }
}

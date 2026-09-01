"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile, requireAdminRole } from "@/lib/auth/actions";
import { ActionResult } from "@/lib/auth/schemas";
import {
  savePredictionSchema,
  createMatchSchema,
  updateMatchSchema,
  liveScoreSchema,
  finalizeMatchSchema,
} from "./schemas";
import { calculateLivePoints } from "@/lib/scoring/matches";
import { MatchWithTeams, LeaderboardEntry, UserMatchStats } from "@/types";
import { Database } from "@/types/database.types";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// ============================================================================
// PREDICTION USER ACTIONS
// ============================================================================

/**
 * Server Action: Save or update current user's match score prediction
 */
export async function savePredictionAction(input: z.infer<typeof savePredictionSchema>): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) {
    return { success: false, error: "Wymagane logowanie." };
  }

  const parsed = savePredictionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Niepoprawne dane typu." };
  }

  const { matchId, homeScore, awayScore } = parsed.data;
  const supabase = await createClient();

  try {
    // 1. Verify match existence, kickoff time, and betting lock
    const { data: rawMatch, error: matchError } = await supabase
      .from("matches")
      .select("id, kickoff_at, is_betting_locked, status")
      .eq("id", matchId)
      .single();

    const match = rawMatch as unknown as MatchRow | null;

    if (matchError || !match) {
      return { success: false, error: "Nie znaleziono meczu." };
    }

    const kickoffTime = new Date(match.kickoff_at).getTime();
    const now = Date.now();

    if (now >= kickoffTime || match.is_betting_locked || match.status !== "scheduled") {
      return { success: false, error: "Typowanie tego meczu zostało już zakończone." };
    }

    // 2. Perform upsert into predictions table (guarded by PostgreSQL RLS & triggers)
    const { error: upsertError } = await (supabase.from("predictions") as unknown as {
      upsert: (values: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: unknown }>;
    }).upsert(
        {
          user_id: currentUser.id,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,match_id" }
      );

    if (upsertError) {
      console.error("Prediction upsert error:", upsertError);
      return { success: false, error: "Nie udało się zapisać typu. Spróbuj ponownie." };
    }

    revalidatePath("/mecze");
    revalidatePath("/ranking");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Unexpected error saving prediction:", err);
    return { success: false, error: "Wystąpił błąd podczas zapisywania typu." };
  }
}

// ============================================================================
// ADMIN MATCH ACTIONS
// ============================================================================

/**
 * Server Action: Admin creates a new match
 */
export async function adminCreateMatchAction(input: z.infer<typeof createMatchSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = createMatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane meczu." };
  }

  const { homeTeamId, awayTeamId, kickoffAt, stage, matchday } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: newMatch, error } = await adminSupabase
      .from("matches")
      .insert({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: kickoffAt,
        stage: stage,
        matchday: matchday,
        status: "scheduled",
        is_betting_locked: false,
      })
      .select("id")
      .single();

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "MATCH_CREATED",
      target_type: "match",
      target_id: newMatch?.id || null,
      details: { homeTeamId, awayTeamId, kickoffAt, stage, matchday },
    });

    revalidatePath("/admin");
    revalidatePath("/mecze");
    return { success: true };
  } catch (err) {
    console.error("Error creating match:", err);
    return { success: false, error: "Nie udało się utworzyć meczu." };
  }
}

/**
 * Server Action: Admin updates existing match
 */
export async function adminUpdateMatchAction(input: z.infer<typeof updateMatchSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = updateMatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane meczu." };
  }

  const { matchId, homeTeamId, awayTeamId, kickoffAt, stage, matchday, status, isBettingLocked } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { data: rawOld, error: fetchErr } = await adminSupabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    const oldMatch = rawOld as unknown as MatchRow | null;

    if (fetchErr || !oldMatch) {
      return { success: false, error: "Nie znaleziono meczu." };
    }

    // If postponed, check if kickoff had already passed
    const hadPassed = new Date(oldMatch.kickoff_at).getTime() <= Date.now();
    const finalLocked = isBettingLocked !== undefined ? isBettingLocked : (hadPassed ? true : oldMatch.is_betting_locked);

    const { error: updateErr } = await adminSupabase
      .from("matches")
      .update({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: kickoffAt,
        stage: stage,
        matchday: matchday,
        status: status,
        is_betting_locked: finalLocked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (updateErr) throw updateErr;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "MATCH_UPDATED",
      target_type: "match",
      target_id: matchId,
      details: { oldStatus: oldMatch.status, newStatus: status, kickoffAt, isBettingLocked: finalLocked },
    });

    revalidatePath("/admin");
    revalidatePath("/mecze");
    revalidatePath("/ranking");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Error updating match:", err);
    return { success: false, error: "Nie udało się zaktualizować meczu." };
  }
}

/**
 * Server Action: Admin updates LIVE match score & minute
 */
export async function adminUpdateLiveScoreAction(input: z.infer<typeof liveScoreSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = liveScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane wyniku LIVE." };
  }

  const { matchId, homeScore, awayScore, liveMinute } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    const { error } = await adminSupabase
      .from("matches")
      .update({
        status: "live",
        home_score: homeScore,
        away_score: awayScore,
        live_minute: liveMinute,
        is_betting_locked: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (error) throw error;

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "MATCH_SCORE_UPDATED",
      target_type: "match",
      target_id: matchId,
      details: { homeScore, awayScore, liveMinute, status: "live" },
    });

    revalidatePath("/mecze");
    revalidatePath("/ranking");
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Error updating live score:", err);
    return { success: false, error: "Nie udało się zaktualizować wyniku na żywo." };
  }
}

/**
 * Server Action: Admin finalizes match & triggers atomic score calculation in PostgreSQL
 */
export async function adminFinalizeMatchAction(input: z.infer<typeof finalizeMatchSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = finalizeMatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane wyniku końcowego." };
  }

  const { matchId, homeScore, awayScore } = parsed.data;
  const adminSupabase = createAdminClient();

  try {
    // Check if match was already finished (for audit action distinction)
    const { data: rawCurrent } = await adminSupabase
      .from("matches")
      .select("status, home_score, away_score")
      .eq("id", matchId)
      .single();

    const currentMatch = rawCurrent as unknown as MatchRow | null;
    const isCorrection = currentMatch?.status === "finished";

    // Call atomic PostgreSQL function
    const { error: rpcError } = await adminSupabase.rpc("finalize_and_score_match", {
      p_match_id: matchId,
      p_home_score: homeScore,
      p_away_score: awayScore,
    });

    if (rpcError) {
      console.error("RPC finalize_and_score_match error:", rpcError);
      throw rpcError;
    }

    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: isCorrection ? "MATCH_RESULT_CORRECTED" : "MATCH_FINISHED",
      target_type: "match",
      target_id: matchId,
      details: { homeScore, awayScore, previousStatus: currentMatch?.status },
    });

    revalidatePath("/mecze");
    revalidatePath("/ranking");
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Error finalizing match:", err);
    return { success: false, error: "Wystąpił błąd podczas finalizacji meczu i przeliczania punktów." };
  }
}

// ============================================================================
// DATA FETCHING ACTIONS
// ============================================================================

/**
 * Fetches all matches with teams, current user's prediction, and revealed predictions
 */
export async function getMatchesWithPredictionsAction(): Promise<MatchWithTeams[]> {
  const supabase = await createClient();
  const currentUser = await getCurrentUserProfile();

  const { data: rawMatches, error: matchesErr } = await supabase
    .from("matches")
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*)
    `)
    .order("kickoff_at", { ascending: true });

  if (matchesErr || !rawMatches) {
    console.error("Error fetching matches:", matchesErr);
    return [];
  }

  // Fetch all accessible predictions
  const { data: rawPredictions } = await supabase
    .from("predictions")
    .select(`
      *,
      profile:profiles(*)
    `);

  const predictions = (rawPredictions || []) as unknown as Array<PredictionRow & { profile: ProfileRow }>;

  const predictionMap = new Map<string, Array<PredictionRow & { profile: ProfileRow }>>();
  predictions.forEach((p) => {
    const list = predictionMap.get(p.match_id) || [];
    list.push(p);
    predictionMap.set(p.match_id, list);
  });

  const matches = (rawMatches || []) as unknown as Array<MatchRow & {
    home_team: TeamRow;
    away_team: TeamRow;
  }>;

  return matches.map((m) => {
    const matchPreds = predictionMap.get(m.id) || [];
    const myPred = currentUser ? matchPreds.find((p) => p.user_id === currentUser.id) : undefined;

    const allPredictions = matchPreds.map((p) => {
      const livePts = m.status === "live"
        ? calculateLivePoints(p.home_score, p.away_score, m.home_score, m.away_score)?.points || 0
        : (p.points_awarded ?? 0);

      const prof = p.profile as ProfileRow | undefined;
      return {
        userId: p.user_id,
        username: prof?.username || "gracz",
        firstName: prof?.first_name || "Gracz",
        lastName: prof?.last_name || "",
        avatarUrl: prof?.avatar_url || null,
        homeScore: p.home_score,
        awayScore: p.away_score,
        pointsAwarded: p.points_awarded,
        scoringCategory: p.scoring_category,
        livePoints: livePts,
      };
    });

    return {
      id: m.id,
      matchday: m.matchday,
      stage: m.stage,
      kickoffAt: m.kickoff_at,
      isBettingLocked: m.is_betting_locked,
      status: m.status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      liveMinute: m.live_minute,
      homeTeam: {
        id: m.home_team.id,
        name: m.home_team.name,
        shortName: m.home_team.short_name,
        code: m.home_team.code,
        logoUrl: m.home_team.logo_url,
      },
      awayTeam: {
        id: m.away_team.id,
        name: m.away_team.name,
        shortName: m.away_team.short_name,
        code: m.away_team.code,
        logoUrl: m.away_team.logo_url,
      },
      userPrediction: myPred
        ? {
            id: myPred.id,
            homeScore: myPred.home_score,
            awayScore: myPred.away_score,
            pointsAwarded: myPred.points_awarded,
            scoringCategory: myPred.scoring_category,
          }
        : undefined,
      allPredictions: allPredictions.length > 0 ? allPredictions : undefined,
    };
  });
}

/**
 * Fetches general leaderboard with TOTAL = MATCH POINTS + SPECIAL POINTS + PICK'EM POINTS
 */
export async function getLeaderboardAction(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();

  // 1. Fetch all active profiles, predictions, special predictions, and pickem submissions in parallel
  const [
    { data: rawProfiles, error: profErr },
    { data: rawPredictions },
    { data: rawSpecialPreds },
    { data: rawPickemSubs },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("is_active", true),
    supabase.from("predictions").select("user_id, points_awarded, scoring_category"),
    supabase.from("special_predictions").select("user_id, points_awarded"),
    supabase.from("pickem_submissions").select("user_id, points_awarded"),
  ]);

  const profiles = (rawProfiles || []) as unknown as ProfileRow[];

  if (profErr || !profiles) {
    console.error("Error fetching leaderboard profiles:", profErr);
    return [];
  }

  const predictions = (rawPredictions || []) as unknown as PredictionRow[];
  const specialPreds = (rawSpecialPreds || []) as unknown as Array<{ user_id: string; points_awarded: number | null }>;
  const pickemSubs = (rawPickemSubs || []) as unknown as Array<{ user_id: string; points_awarded: number | null }>;

  // Aggregate stats per user
  const statsMap = new Map<string, {
    matchPoints: number;
    specialPoints: number;
    pickemPoints: number;
    exact: number;
    diff: number;
    outcome: number;
    incorrect: number;
    count: number;
  }>();

  profiles.forEach((p) => {
    statsMap.set(p.id, {
      matchPoints: 0,
      specialPoints: 0,
      pickemPoints: 0,
      exact: 0,
      diff: 0,
      outcome: 0,
      incorrect: 0,
      count: 0,
    });
  });

  // 1. Match points
  predictions.forEach((pred) => {
    const stats = statsMap.get(pred.user_id);
    if (stats && pred.points_awarded !== null && pred.points_awarded !== undefined) {
      stats.matchPoints += pred.points_awarded;
      stats.count += 1;
      if (pred.scoring_category === "exact") stats.exact += 1;
      else if (pred.scoring_category === "diff") stats.diff += 1;
      else if (pred.scoring_category === "outcome") stats.outcome += 1;
      else if (pred.scoring_category === "incorrect") stats.incorrect += 1;
    }
  });

  // 2. Special predictions points
  specialPreds.forEach((sp) => {
    const stats = statsMap.get(sp.user_id);
    if (stats && sp.points_awarded !== null && sp.points_awarded !== undefined) {
      stats.specialPoints += sp.points_awarded;
    }
  });

  // 3. Pick'em points
  pickemSubs.forEach((ps) => {
    const stats = statsMap.get(ps.user_id);
    if (stats && ps.points_awarded !== null && ps.points_awarded !== undefined) {
      stats.pickemPoints += ps.points_awarded;
    }
  });

  const entries: LeaderboardEntry[] = profiles.map((p) => {
    const s = statsMap.get(p.id)!;
    const accuracy = s.count > 0 ? Math.round(((s.exact + s.diff + s.outcome) / s.count) * 100) : 0;
    const totalPoints = s.matchPoints + s.specialPoints + s.pickemPoints;

    return {
      rank: 1,
      userId: p.id,
      username: p.username,
      firstName: p.first_name,
      lastName: p.last_name,
      avatarUrl: p.avatar_url,
      matchPoints: s.matchPoints,
      specialPoints: s.specialPoints,
      pickemPoints: s.pickemPoints,
      totalPoints,
      exactScoresCount: s.exact,
      diffScoresCount: s.diff,
      outcomeScoresCount: s.outcome,
      incorrectScoresCount: s.incorrect,
      predictedMatchesCount: s.count,
      accuracyRate: accuracy,
    };
  });

  // Sort by total points DESC, exact scores DESC, username ASC
  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactScoresCount !== a.exactScoresCount) return b.exactScoresCount - a.exactScoresCount;
    return a.username.localeCompare(b.username);
  });

  // Assign ranks
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  return entries;
}

/**
 * Fetches recent 5 matches + LIVE matches with all player predictions for matrix & mobile cards
 */
export async function getRecentMatchesWithMatrixAction(): Promise<{
  liveMatches: MatchWithTeams[];
  recentMatches: MatchWithTeams[];
  users: ProfileRow[];
}> {
  const supabase = await createClient();

  // 1. Fetch active users
  const { data: rawUsers } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("username", { ascending: true });

  const users = (rawUsers || []) as unknown as ProfileRow[];
  const allMatches = await getMatchesWithPredictionsAction();

  // LIVE matches
  const liveMatches = allMatches.filter((m) => m.status === "live");

  // Finished or started matches (sorted by kickoff DESC, max 5)
  const recentMatches = allMatches
    .filter((m) => m.status === "finished" || (m.status !== "live" && new Date(m.kickoffAt).getTime() <= Date.now()))
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime())
    .slice(0, 5);

  return {
    liveMatches,
    recentMatches,
    users,
  };
}

/**
 * Fetches user match prediction stats
 */
export async function getUserStatsAction(userId: string): Promise<UserMatchStats> {
  const supabase = await createClient();

  const { data: rawPredictions } = await supabase
    .from("predictions")
    .select("points_awarded, scoring_category")
    .eq("user_id", userId);

  const predictions = (rawPredictions || []) as unknown as PredictionRow[];

  let totalPoints = 0;
  let exact = 0;
  let diff = 0;
  let outcome = 0;
  let incorrect = 0;
  let count = 0;

  predictions.forEach((p) => {
    if (p.points_awarded !== null && p.points_awarded !== undefined) {
      count += 1;
      totalPoints += p.points_awarded;
      if (p.scoring_category === "exact") exact += 1;
      else if (p.scoring_category === "diff") diff += 1;
      else if (p.scoring_category === "outcome") outcome += 1;
      else if (p.scoring_category === "incorrect") incorrect += 1;
    }
  });

  const avg = count > 0 ? Number((totalPoints / count).toFixed(2)) : 0;
  const accuracy = count > 0 ? Math.round(((exact + diff + outcome) / count) * 100) : 0;

  return {
    predictedMatchesCount: count,
    totalPoints,
    exactScoresCount: exact,
    diffScoresCount: diff,
    outcomeScoresCount: outcome,
    incorrectScoresCount: incorrect,
    averagePointsPerMatch: avg,
    accuracyRate: accuracy,
  };
}

/**
 * Fetches all teams for match creator dropdowns
 */
export async function getAllTeamsAction(): Promise<TeamRow[]> {
  const supabase = await createClient();
  const { data: rawTeams } = await supabase.from("teams").select("*").order("name", { ascending: true });
  return (rawTeams || []) as unknown as TeamRow[];
}

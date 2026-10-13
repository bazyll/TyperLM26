import { createClient } from "@/lib/supabase/server";

export interface UserRankingScoreBreakdown {
  matchPoints: number;
  specialPoints: number;
  pickemPoints: number;
  totalPoints: number;
}

/**
 * Pure calculation helper ensuring complete parity between ranking and user header/profile views.
 * Total points = match points (with applied multipliers) + special category points + pick'em points.
 */
export function calculateUserTotalPoints(
  matchPredictions: Array<{ points_awarded?: number | null }>,
  specialPredictions: Array<{ points_awarded?: number | null }>,
  pickemSubmissions: Array<{ points_awarded?: number | null }> | { points_awarded?: number | null } | null
): UserRankingScoreBreakdown {
  let matchPoints = 0;
  if (Array.isArray(matchPredictions)) {
    for (const p of matchPredictions) {
      if (p.points_awarded !== null && p.points_awarded !== undefined) {
        matchPoints += p.points_awarded;
      }
    }
  }

  let specialPoints = 0;
  if (Array.isArray(specialPredictions)) {
    for (const sp of specialPredictions) {
      if (sp.points_awarded !== null && sp.points_awarded !== undefined) {
        specialPoints += sp.points_awarded;
      }
    }
  }

  let pickemPoints = 0;
  if (Array.isArray(pickemSubmissions)) {
    for (const ps of pickemSubmissions) {
      if (ps.points_awarded !== null && ps.points_awarded !== undefined) {
        pickemPoints += ps.points_awarded;
      }
    }
  } else if (pickemSubmissions && pickemSubmissions.points_awarded !== null && pickemSubmissions.points_awarded !== undefined) {
    pickemPoints += pickemSubmissions.points_awarded;
  }

  return {
    matchPoints,
    specialPoints,
    pickemPoints,
    totalPoints: matchPoints + specialPoints + pickemPoints,
  };
}

/**
 * Fetches the user's total ranking points from the exact same sources of truth as the official leaderboard:
 * - predictions.points_awarded
 * - special_predictions.points_awarded
 * - pickem_submissions.points_awarded
 */
export async function getUserTotalPoints(
  userId: string,
  client?: any
): Promise<number> {
  const supabase = client || (await createClient());
  const [
    { data: matchPreds },
    { data: specialPreds },
    { data: pickemSub },
  ] = await Promise.all([
    supabase.from("predictions").select("points_awarded").eq("user_id", userId),
    supabase.from("special_predictions").select("points_awarded").eq("user_id", userId),
    supabase.from("pickem_submissions").select("points_awarded").eq("user_id", userId).maybeSingle(),
  ]);

  const breakdown = calculateUserTotalPoints(matchPreds || [], specialPreds || [], pickemSub);
  return breakdown.totalPoints;
}

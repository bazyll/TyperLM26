import { ScoringCategory } from "@/types/database.types";

export interface MatchScoreResult {
  points: number;
  category: ScoringCategory;
}

export interface PredictionInput {
  userHome: number;
  userAway: number;
  actualHome: number;
  actualAway: number;
}

/**
 * Calculates score and category for a single match prediction.
 *
 * Rules:
 * - 3 pts: Exact score (e.g., 2:1 vs 2:1, or 1:1 vs 1:1)
 * - 2 pts: Correct winner + correct goal difference, but NOT exact score (e.g., 2:0 vs 3:1)
 * - 1 pt:  Correct outcome (home win, away win, or non-exact draw like 1:1 vs 2:2) without correct goal diff
 * - 0 pts: Incorrect outcome
 *
 * Points NEVER sum up. Maximum is 3 points.
 */
export function calculateMatchScore({
  userHome,
  userAway,
  actualHome,
  actualAway,
}: PredictionInput): MatchScoreResult {
  // 1. Exact score check -> 3 points
  if (userHome === actualHome && userAway === actualAway) {
    return { points: 3, category: "exact" };
  }

  const userDiff = userHome - userAway;
  const actualDiff = actualHome - actualAway;

  const userOutcome = Math.sign(userDiff); // 1 = home win, -1 = away win, 0 = draw
  const actualOutcome = Math.sign(actualDiff);

  // 2. Incorrect outcome -> 0 points
  if (userOutcome !== actualOutcome) {
    return { points: 0, category: "incorrect" };
  }

  // 3. For draws: exact draw was handled in step 1. Any other predicted draw when actual is draw gives 1 pt.
  if (userOutcome === 0 && actualOutcome === 0) {
    return { points: 1, category: "outcome" };
  }

  // 4. For wins: if goal difference is exact (e.g. user 2:0, actual 3:1 -> diff +2) -> 2 points
  if (userDiff === actualDiff) {
    return { points: 2, category: "diff" };
  }

  // 5. Correct winner, but different goal difference (e.g. user 2:1, actual 3:0) -> 1 point
  return { points: 1, category: "outcome" };
}

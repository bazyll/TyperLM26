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
  multiplier?: number;
}

/**
 * Calculates score and category for a single match prediction.
 *
 * Official TyperLM26 Scoring Rules:
 * - Base 3 pts: Exact score (e.g., 2:1 vs 2:1, or exact draw 1:1 vs 1:1) -> category 'exact'
 * - Base 2 pts: Correct goal difference & winner (e.g., 2:0 vs 3:1) OR any non-exact correctly predicted draw (e.g., 1:1 vs 2:2, 0:0 vs 3:3) -> category 'diff'
 * - Base 1 pt:  Correct winner/outcome without correct goal difference (e.g., 2:1 vs 1:0) -> category 'outcome'
 * - Base 0 pts: Incorrect outcome (e.g., 2:1 vs 0:1) -> category 'incorrect'
 *
 * Points NEVER sum up. Base points are multiplied by match multiplier (default x1).
 */
export function calculateMatchScore({
  userHome,
  userAway,
  actualHome,
  actualAway,
  multiplier = 1,
}: PredictionInput): MatchScoreResult {
  const mult = Math.max(1, Math.min(10, Math.floor(multiplier || 1)));

  // 1. Exact score check -> 3 points
  if (userHome === actualHome && userAway === actualAway) {
    return { points: 3 * mult, category: "exact" };
  }

  const userDiff = userHome - userAway;
  const actualDiff = actualHome - actualAway;

  const userOutcome = Math.sign(userDiff); // 1 = home win, -1 = away win, 0 = draw
  const actualOutcome = Math.sign(actualDiff);

  // 2. Incorrect outcome -> 0 points
  if (userOutcome !== actualOutcome) {
    return { points: 0, category: "incorrect" };
  }

  // 3. For draws: exact draw was handled in step 1. Any other predicted draw when actual is a draw has diff=0 -> 2 pts ('diff')
  if (userOutcome === 0 && actualOutcome === 0) {
    return { points: 2 * mult, category: "diff" };
  }

  // 4. For wins: if goal difference is exact (e.g. user 2:0, actual 3:1 -> diff +2) -> 2 points ('diff')
  if (userDiff === actualDiff) {
    return { points: 2 * mult, category: "diff" };
  }

  // 5. Correct winner, but different goal difference (e.g. user 2:1, actual 1:0) -> 1 point ('outcome')
  return { points: 1 * mult, category: "outcome" };
}

/**
 * Calculates dynamic live points preview for an in-progress match.
 */
export function calculateLivePoints(
  userHome: number | null | undefined,
  userAway: number | null | undefined,
  liveHome: number | null | undefined,
  liveAway: number | null | undefined,
  multiplier: number = 1
): MatchScoreResult | null {
  if (
    userHome === null ||
    userHome === undefined ||
    userAway === null ||
    userAway === undefined ||
    liveHome === null ||
    liveHome === undefined ||
    liveAway === null ||
    liveAway === undefined
  ) {
    return null;
  }

  return calculateMatchScore({
    userHome,
    userAway,
    actualHome: liveHome,
    actualAway: liveAway,
    multiplier,
  });
}

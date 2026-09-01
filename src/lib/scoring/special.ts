export interface SpecialPredictionScoringInput {
  targetType: "team" | "player";
  userTeamId?: string | null;
  userPlayerId?: string | null;
  correctTeamIds?: string[];
  correctPlayerIds?: string[];
  // Legacy single ID fallback
  correctTeamId?: string | null;
  correctPlayerId?: string | null;
  pointsValue?: number;
}

/**
 * Calculates points for special predictions.
 * Standard points value is 20 pts.
 * Supports multiple correct answers (e.g. ties in golden boot/assists/clean sheets).
 */
export function calculateSpecialPredictionScore({
  targetType,
  userTeamId,
  userPlayerId,
  correctTeamIds,
  correctPlayerIds,
  correctTeamId,
  correctPlayerId,
  pointsValue = 20,
}: SpecialPredictionScoringInput): number {
  if (targetType === "team") {
    if (!userTeamId) return 0;
    const teamSet = new Set(correctTeamIds || (correctTeamId ? [correctTeamId] : []));
    if (teamSet.has(userTeamId)) {
      return pointsValue;
    }
  } else if (targetType === "player") {
    if (!userPlayerId) return 0;
    const playerSet = new Set(correctPlayerIds || (correctPlayerId ? [correctPlayerId] : []));
    if (playerSet.has(userPlayerId)) {
      return pointsValue;
    }
  }
  return 0;
}

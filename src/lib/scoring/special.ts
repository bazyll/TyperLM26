export interface SpecialPredictionScoringInput {
  targetType: "team" | "player";
  userTeamId?: string | null;
  userPlayerId?: string | null;
  correctTeamId?: string | null;
  correctPlayerId?: string | null;
  pointsValue?: number;
}

/**
 * Calculates points for special predictions.
 * Standard points value is 20 pts.
 */
export function calculateSpecialPredictionScore({
  targetType,
  userTeamId,
  userPlayerId,
  correctTeamId,
  correctPlayerId,
  pointsValue = 20,
}: SpecialPredictionScoringInput): number {
  if (targetType === "team") {
    if (userTeamId && correctTeamId && userTeamId === correctTeamId) {
      return pointsValue;
    }
  } else if (targetType === "player") {
    if (userPlayerId && correctPlayerId && userPlayerId === correctPlayerId) {
      return pointsValue;
    }
  }
  return 0;
}

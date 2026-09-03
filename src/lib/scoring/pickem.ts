export interface PickemSubmissionInput {
  firstTeamId: string;
  top8TeamIds: string[]; // 7 team IDs
  outTeamIds: string[]; // 8 team IDs
}

export interface PickemDetailedScore {
  totalPoints: number;
  firstPlacePoints: number;
  firstPlaceHit: boolean;
  top8Points: number;
  top8HitsCount: number;
  outPoints: number;
  outHitsCount: number;
  middlePoints: number;
  middleHitsCount: number;
}

export interface PickemValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates disjointness and counts for Pick'em submission.
 * Required:
 * - 1 team in firstTeamId
 * - 7 distinct teams in top8TeamIds (none equal to firstTeamId)
 * - 8 distinct teams in outTeamIds (none equal to firstTeamId or top8TeamIds)
 */
export function validatePickemSubmission(
  submission: PickemSubmissionInput,
  all36TeamIds?: string[]
): PickemValidationResult {
  const errors: string[] = [];

  if (!submission.firstTeamId) {
    errors.push("Brak wybranej drużyny na 1. miejsce (FIRST).");
  }

  const top8Set = new Set(submission.top8TeamIds || []);
  if (top8Set.size !== 7) {
    errors.push(`Kategoria TOP 8 musi zawierać dokładnie 7 różnych drużyn (wybrano ${top8Set.size}).`);
  }

  if (top8Set.has(submission.firstTeamId)) {
    errors.push("Drużyna wskazana na 1. miejsce nie może być powtórzona w TOP 8.");
  }

  const outSet = new Set(submission.outTeamIds || []);
  if (outSet.size !== 8) {
    errors.push(`Kategoria OUT musi zawierać dokładnie 8 różnych drużyn (wybrano ${outSet.size}).`);
  }

  if (outSet.has(submission.firstTeamId)) {
    errors.push("Drużyna z 1. miejsca nie może znajdować się w kategorii OUT.");
  }

  for (const teamId of outSet) {
    if (top8Set.has(teamId)) {
      errors.push(`Drużyna ${teamId} znajduje się jednocześnie w TOP 8 i OUT.`);
    }
  }

  if (all36TeamIds && all36TeamIds.length > 0) {
    const allKnown = new Set(all36TeamIds);
    if (!allKnown.has(submission.firstTeamId)) {
      errors.push("Wybrana drużyna FIRST nie istnieje w lidze.");
    }
    for (const t of top8Set) {
      if (!allKnown.has(t)) errors.push(`Drużyna ${t} w TOP 8 nie istnieje w lidze.`);
    }
    for (const t of outSet) {
      if (!allKnown.has(t)) errors.push(`Drużyna ${t} w OUT nie istnieje w lidze.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates Pick'em score given user submission and final 36-team ordered standing.
 *
 * @param submission User's chosen FIRST (1), TOP8 (7), OUT (8)
 * @param finalStandings Array of team IDs in exact 1..36 order (index 0 is 1st place, index 35 is 36th place)
 */
export function calculatePickemScore(
  submission: PickemSubmissionInput,
  finalStandings: string[],
  multiplier: number = 1
): PickemDetailedScore {
  if (finalStandings.length < 36) {
    throw new Error(`Standings must contain 36 teams, got ${finalStandings.length}`);
  }

  const mult = Math.max(1, Math.min(10, Math.floor(multiplier || 1)));

  const teamToRank = new Map<string, number>();
  finalStandings.forEach((teamId, index) => {
    teamToRank.set(teamId, index + 1); // 1 to 36
  });

  // 1. FIRST place check (must be rank 1) -> 3 pts base
  const firstRank = teamToRank.get(submission.firstTeamId);
  const firstPlaceHit = firstRank === 1;
  const firstPlacePoints = (firstPlaceHit ? 3 : 0) * mult;

  // 2. TOP 8 check (7 chosen teams must end in rank 1..8) -> 3 pts base each
  let top8HitsCount = 0;
  for (const teamId of submission.top8TeamIds) {
    const rank = teamToRank.get(teamId);
    if (rank !== undefined && rank >= 1 && rank <= 8) {
      top8HitsCount += 1;
    }
  }
  const top8Points = top8HitsCount * 3 * mult;

  // 3. OUT check (8 chosen teams must end in rank 25..36) -> 3 pts base each
  let outHitsCount = 0;
  for (const teamId of submission.outTeamIds) {
    const rank = teamToRank.get(teamId);
    if (rank !== undefined && rank >= 25 && rank <= 36) {
      outHitsCount += 1;
    }
  }
  const outPoints = outHitsCount * 3 * mult;

  // 4. MIDDLE check (all remaining 20 teams must end in rank 9..24) -> 3 pts base each
  const chosenExplicitly = new Set<string>([
    submission.firstTeamId,
    ...submission.top8TeamIds,
    ...submission.outTeamIds,
  ]);

  let middleHitsCount = 0;
  for (const teamId of finalStandings) {
    if (!chosenExplicitly.has(teamId)) {
      const rank = teamToRank.get(teamId);
      if (rank !== undefined && rank >= 9 && rank <= 24) {
        middleHitsCount += 1;
      }
    }
  }
  const middlePoints = middleHitsCount * 3 * mult;

  const totalPoints = firstPlacePoints + top8Points + outPoints + middlePoints;

  return {
    totalPoints,
    firstPlacePoints,
    firstPlaceHit,
    top8Points,
    top8HitsCount,
    outPoints,
    outHitsCount,
    middlePoints,
    middleHitsCount,
  };
}

export interface TableTeamData {
  id: string;
  name: string;
  shortName: string;
  code: string;
  logoUrl: string;
  uefaCoefficient: number;
  disciplinaryPoints: number;
}

export interface FinishedMatchData {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: "live" | "finished";
}

export interface UCLStandingRow {
  rank: number;
  team: TableTeamData;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  awayGoals: number;
  awayWins: number;
  points: number;
  opponentsPoints: number;
  opponentsGoalDiff: number;
  opponentsGoalsFor: number;
  zone: "top8" | "playoff" | "eliminated";
}

export type UCLTableMode = "in-progress" | "final";

/**
 * Calculates complete UEFA Champions League 36-team table.
 *
 * @param teams List of 36 participating teams with metadata
 * @param matches List of completed or live league stage matches
 * @param mode "in-progress" (during season, standard primary criteria + shortName) or "final" (after all 144 matches, 10 official UEFA tiebreakers)
 */
export function calculateUCLTable(
  teams: TableTeamData[],
  matches: FinishedMatchData[],
  mode: UCLTableMode = "in-progress"
): UCLStandingRow[] {
  // 1. Initialize stats for all teams
  const statsMap = new Map<
    string,
    {
      team: TableTeamData;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      awayGoals: number;
      awayWins: number;
      points: number;
      opponentsIds: string[];
      opponentsPoints: number;
      opponentsGoalDiff: number;
      opponentsGoalsFor: number;
    }
  >();

  for (const team of teams) {
    statsMap.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      awayGoals: 0,
      awayWins: 0,
      points: 0,
      opponentsIds: [],
      opponentsPoints: 0,
      opponentsGoalDiff: 0,
      opponentsGoalsFor: 0,
    });
  }

  // 2. Process all completed / live matches
  for (const match of matches) {
    const home = statsMap.get(match.homeTeamId);
    const away = statsMap.get(match.awayTeamId);

    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;

    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;
    away.awayGoals += match.awayScore;

    home.opponentsIds.push(match.awayTeamId);
    away.opponentsIds.push(match.homeTeamId);

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.awayWins += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      home.points += 1;
      away.drawn += 1;
      away.points += 1;
    }
  }

  // 3. Compute goal difference and opponent metrics
  for (const stat of statsMap.values()) {
    stat.goalDifference = stat.goalsFor - stat.goalsAgainst;
  }

  for (const stat of statsMap.values()) {
    for (const oppId of stat.opponentsIds) {
      const opp = statsMap.get(oppId);
      if (opp) {
        stat.opponentsPoints += opp.points;
        stat.opponentsGoalDiff += opp.goalDifference;
        stat.opponentsGoalsFor += opp.goalsFor;
      }
    }
  }

  // 4. Sort according to mode
  const sorted = Array.from(statsMap.values()).sort((a, b) => {
    // 1. Points (primary for both modes)
    if (b.points !== a.points) return b.points - a.points;

    // 2. Superior goal difference
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;

    // 3. Higher number of goals scored
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    // 4. Higher number of away goals scored
    if (b.awayGoals !== a.awayGoals) return b.awayGoals - a.awayGoals;

    // 5. Higher number of wins
    if (b.won !== a.won) return b.won - a.won;

    // 6. Higher number of away wins
    if (b.awayWins !== a.awayWins) return b.awayWins - a.awayWins;

    if (mode === "in-progress") {
      // In-progress tiebreaker: alphabetical by short name for stable display without incomplete strength of schedule
      return a.team.shortName.localeCompare(b.team.shortName);
    }

    // FINAL mode: 10 official UEFA criteria
    // 7. Higher number of points obtained collectively by opponents
    if (b.opponentsPoints !== a.opponentsPoints) return b.opponentsPoints - a.opponentsPoints;

    // 8. Superior collective goal difference of opponents
    if (b.opponentsGoalDiff !== a.opponentsGoalDiff) return b.opponentsGoalDiff - a.opponentsGoalDiff;

    // 9. Higher number of goals scored collectively by opponents
    if (b.opponentsGoalsFor !== a.opponentsGoalsFor) return b.opponentsGoalsFor - a.opponentsGoalsFor;

    // 10. Lower disciplinary points (fair play - lower is better)
    if (a.team.disciplinaryPoints !== b.team.disciplinaryPoints) {
      return a.team.disciplinaryPoints - b.team.disciplinaryPoints;
    }

    // 11. Higher UEFA club coefficient
    return b.team.uefaCoefficient - a.team.uefaCoefficient;
  });

  // 5. Assign ranks and zones (1-8 top8, 9-24 playoff, 25-36 eliminated)
  return sorted.map((item, index) => {
    const rank = index + 1;
    let zone: "top8" | "playoff" | "eliminated" = "eliminated";
    if (rank <= 8) {
      zone = "top8";
    } else if (rank <= 24) {
      zone = "playoff";
    }

    return {
      rank,
      team: item.team,
      played: item.played,
      won: item.won,
      drawn: item.drawn,
      lost: item.lost,
      goalsFor: item.goalsFor,
      goalsAgainst: item.goalsAgainst,
      goalDifference: item.goalDifference,
      awayGoals: item.awayGoals,
      awayWins: item.awayWins,
      points: item.points,
      opponentsPoints: item.opponentsPoints,
      opponentsGoalDiff: item.opponentsGoalDiff,
      opponentsGoalsFor: item.opponentsGoalsFor,
      zone,
    };
  });
}

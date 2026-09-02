import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import rawScheduleDataset from "@/data/ucl-2026-27-league-phase.json";

export interface ScheduleDatasetItem {
  id: string;
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  goalApiFixtureId: string | null;
  source: string;
}

export interface BootstrapValidationResult {
  valid: boolean;
  errors: string[];
  totalMatches: number;
  uniqueTeamsCount: number;
  matchdaysCount: Record<number, number>;
  teamsWith4H4A: boolean;
}

export interface BootstrapUclScheduleResult {
  success: boolean;
  error?: string;
  totalDatasetMatches: number;
  existingReusedCount: number;
  newMatchesInsertedCount: number;
  validationSummary?: BootstrapValidationResult;
}

/**
 * Strictly validates the 144-match UEFA dataset against invariants before any database operation
 */
export function validateUclScheduleDataset(
  dataset: ScheduleDatasetItem[],
  allowedTeamNames?: Set<string>
): BootstrapValidationResult {
  const errors: string[] = [];
  const teamStats: Record<string, { total: number; home: number; away: number }> = {};
  const matchdaysCount: Record<number, number> = {};
  const seenFixtures = new Set<string>();

  if (!Array.isArray(dataset) || dataset.length !== 144) {
    errors.push(`Nieprawidłowa liczba meczów w datassecie: ${dataset?.length || 0} (wymagane dokładnie 144).`);
  }

  dataset.forEach((m, idx) => {
    if (!m.homeTeam || !m.awayTeam) {
      errors.push(`Mecz #${idx + 1}: Brak nazwy gospodarza lub gościa.`);
      return;
    }

    if (m.homeTeam === m.awayTeam) {
      errors.push(`Mecz #${idx + 1}: Gospodarz i gość są tą samą drużyną ("${m.homeTeam}").`);
    }

    if (allowedTeamNames && !allowedTeamNames.has(m.homeTeam)) {
      errors.push(`Mecz #${idx + 1}: Drużyna "${m.homeTeam}" nie należy do 36 klubów UCL.`);
    }
    if (allowedTeamNames && !allowedTeamNames.has(m.awayTeam)) {
      errors.push(`Mecz #${idx + 1}: Drużyna "${m.awayTeam}" nie należy do 36 klubów UCL.`);
    }

    if (!m.matchday || m.matchday < 1 || m.matchday > 8) {
      errors.push(`Mecz #${idx + 1}: Nieprawidłowa kolejka matchday=${m.matchday} (musi być 1..8).`);
    } else {
      matchdaysCount[m.matchday] = (matchdaysCount[m.matchday] || 0) + 1;
    }

    const kickoffDate = new Date(m.kickoffUtc);
    if (isNaN(kickoffDate.getTime())) {
      errors.push(`Mecz #${idx + 1}: Nieprawidłowy format daty kickoffUtc="${m.kickoffUtc}".`);
    }

    const fixtureKey = `${m.homeTeam} -> ${m.awayTeam}`;
    if (seenFixtures.has(fixtureKey)) {
      errors.push(`Zduplikowane spotkanie w datassecie: "${fixtureKey}".`);
    }
    seenFixtures.add(fixtureKey);

    if (!teamStats[m.homeTeam]) teamStats[m.homeTeam] = { total: 0, home: 0, away: 0 };
    if (!teamStats[m.awayTeam]) teamStats[m.awayTeam] = { total: 0, home: 0, away: 0 };

    teamStats[m.homeTeam].total += 1;
    teamStats[m.homeTeam].home += 1;
    teamStats[m.awayTeam].total += 1;
    teamStats[m.awayTeam].away += 1;
  });

  // Verify matchday distribution (18 per MD)
  for (let md = 1; md <= 8; md++) {
    if (matchdaysCount[md] !== 18) {
      errors.push(`Kolejka ${md} zawiera ${matchdaysCount[md] || 0} meczów (wymagane dokładnie 18).`);
    }
  }

  // Verify team counts (exactly 4H + 4A = 8 total)
  const uniqueTeams = Object.keys(teamStats);
  if (uniqueTeams.length !== 36) {
    errors.push(`Liczba unikalnych drużyn w datassecie wynosi ${uniqueTeams.length} (wymagane dokładnie 36).`);
  }

  let teamsWith4H4A = true;
  uniqueTeams.forEach((t) => {
    const s = teamStats[t];
    if (s.total !== 8 || s.home !== 4 || s.away !== 4) {
      teamsWith4H4A = false;
      errors.push(`Drużyna "${t}" ma ${s.total} meczów (${s.home} dom, ${s.away} wyjazd) zamiast 4 dom + 4 wyjazd.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    totalMatches: dataset.length,
    uniqueTeamsCount: uniqueTeams.length,
    matchdaysCount,
    teamsWith4H4A,
  };
}

/**
 * Bootstraps the full 144 UEFA League Phase fixtures safely and idempotently
 */
export async function bootstrapFullUclSchedule(): Promise<BootstrapUclScheduleResult> {
  const adminSupabase = createAdminClient();
  const dataset = rawScheduleDataset as ScheduleDatasetItem[];

  // 1. Fetch the 36 real UCL clubs from database
  const { data: dbTeamsRaw, error: teamsErr } = await adminSupabase
    .from("teams")
    .select("id, name, short_name, code, goal_api_id")
    .not("goal_api_id", "is", null);

  if (teamsErr || !dbTeamsRaw || dbTeamsRaw.length !== 36) {
    return {
      success: false,
      error: `W bazie znajduje się ${dbTeamsRaw?.length || 0} klubów z goal_api_id (wymagane dokładnie 36). Najpierw zsynchronizuj kluby.`,
      totalDatasetMatches: dataset.length,
      existingReusedCount: 0,
      newMatchesInsertedCount: 0,
    };
  }

  const teamIdByName = new Map<string, string>();
  const allowedNames = new Set<string>();

  dbTeamsRaw.forEach((t) => {
    teamIdByName.set(t.name.trim(), t.id);
    allowedNames.add(t.name.trim());
  });

  // 2. Validate Dataset
  const validation = validateUclScheduleDataset(dataset, allowedNames);
  if (!validation.valid) {
    return {
      success: false,
      error: `Walidacja datasetu 144 meczów nie powiodła się:\n${validation.errors.join("\n")}`,
      totalDatasetMatches: dataset.length,
      existingReusedCount: 0,
      newMatchesInsertedCount: 0,
      validationSummary: validation,
    };
  }

  // 3. Fetch existing matches from DB
  const { data: existingMatchesRaw, error: matchesErr } = await adminSupabase
    .from("matches")
    .select("id, matchday, home_team_id, away_team_id, kickoff_at, goal_api_fixture_id, is_manual_override, status");

  if (matchesErr) {
    return {
      success: false,
      error: `Błąd pobierania istniejących meczów: ${matchesErr.message}`,
      totalDatasetMatches: dataset.length,
      existingReusedCount: 0,
      newMatchesInsertedCount: 0,
      validationSummary: validation,
    };
  }

  const existingMatches = existingMatchesRaw || [];

  let existingReusedCount = 0;
  let newMatchesInsertedCount = 0;

  // 4. Iterate over 144 dataset matches
  for (const item of dataset) {
    const homeId = teamIdByName.get(item.homeTeam);
    const awayId = teamIdByName.get(item.awayTeam);

    if (!homeId || !awayId) {
      throw new Error(`Nie odnaleziono ID dla drużyn: ${item.homeTeam} vs ${item.awayTeam}`);
    }

    // Check if match already exists:
    // 1. By goal_api_fixture_id (for the 18 known fixtures)
    // 2. By pair (home_team_id, away_team_id, matchday)
    let existingMatch = existingMatches.find(
      (m) => item.goalApiFixtureId && m.goal_api_fixture_id === item.goalApiFixtureId
    );

    if (!existingMatch) {
      existingMatch = existingMatches.find(
        (m) => m.home_team_id === homeId && m.away_team_id === awayId && m.matchday === item.matchday
      );
    }

    if (existingMatch) {
      // Re-use existing match: preserve UUID, predictions, status, is_manual_override
      if (item.goalApiFixtureId && !existingMatch.goal_api_fixture_id) {
        await adminSupabase
          .from("matches")
          .update({ goal_api_fixture_id: item.goalApiFixtureId })
          .eq("id", existingMatch.id);
      }
      existingReusedCount += 1;
    } else {
      // Insert new scheduled match
      const { error: insertErr } = await adminSupabase.from("matches").insert({
        stage: "league",
        matchday: item.matchday,
        home_team_id: homeId,
        away_team_id: awayId,
        kickoff_at: new Date(item.kickoffUtc).toISOString(),
        status: "scheduled",
        is_betting_locked: false,
        goal_api_fixture_id: item.goalApiFixtureId || null,
        is_manual_override: false,
      });

      if (insertErr) {
        throw new Error(`Błąd wstawiania meczu ${item.homeTeam} vs ${item.awayTeam}: ${insertErr.message}`);
      }

      newMatchesInsertedCount += 1;
    }
  }

  // 5. Revalidate routes
  try {
    revalidatePath("/");
    revalidatePath("/mecze");
    revalidatePath("/tabela");
    revalidatePath("/ranking");
    revalidatePath("/admin");
  } catch {
    // Safe outside Next.js request context
  }

  return {
    success: true,
    totalDatasetMatches: dataset.length,
    existingReusedCount,
    newMatchesInsertedCount,
    validationSummary: validation,
  };
}

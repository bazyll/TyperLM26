import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { GoalApiClient } from "./client";
import { GoalApiFixtureItem } from "./types";

export interface UclScheduleSyncResult {
  success: boolean;
  error?: string;
  teamsSyncedCount: number;
  newTeamsCount: number;
  updatedTeamsCount: number;
  matchesSyncedCount: number;
  newMatchesCount: number;
  updatedMatchesCount: number;
  qualifyingIgnoredCount: number;
  manualOverridesSkippedCount: number;
  details?: string[];
}

export interface RawTeamData {
  goalApiId: string;
  name: string;
  badgeUrl: string | null;
}

const CANONICAL_CODES: Record<string, string> = {
  "real madrid": "RMA",
  "manchester city": "MCI",
  "manchester united": "MUN",
  "manchester utd": "MUN",
  "bayern munich": "BAY",
  "paris saint germain": "PSG",
  "psg": "PSG",
  "barcelona": "BAR",
  "arsenal": "ARS",
  "liverpool": "LIV",
  "inter": "INT",
  "internazionale": "INT",
  "ac milan": "MIL",
  "milan": "MIL",
  "napoli": "NAP",
  "borussia dortmund": "BVB",
  "dortmund": "BVB",
  "atletico madrid": "ATM",
  "atl madrid": "ATM",
  "atl. madrid": "ATM",
  "sporting cp": "SCP",
  "sporting": "SCP",
  "galatasaray": "GAL",
  "fenerbahce": "FEN",
  "as roma": "ROM",
  "roma": "ROM",
  "psv": "PSV",
  "shakhtar donetsk": "SHK",
  "shakhtar": "SHK",
  "rb leipzig": "RBL",
  "leipzig": "RBL",
  "como": "COM",
  "bodo glimt": "BOD",
  "bodo/glimt": "BOD",
  "slavia prague": "SLA",
  "slavia praha": "SLA",
  "lens": "LEN",
  "lille": "LIL",
  "villarreal": "VIL",
  "fc porto": "POR",
  "porto": "POR",
  "betis": "BET",
  "real betis": "BET",
  "stuttgart": "STU",
  "viking": "VIK",
  "feyenoord": "FEY",
  "slovan bratislava": "SLO",
  "sabah baku": "SAB",
  "sabah": "SAB",
  "aek athens": "AEK",
  "lask": "LAS",
  "club brugge": "CLU",
  "club brugge kv": "CLU",
  "aston villa": "AVL",
  "dinamo zagreb": "DIN",
  "crvena zvezda": "CRV",
  "red star": "CRV",
  "young boys": "YBB",
  "sparta prague": "SPA",
  "salzburg": "SAL",
  "atalanta": "ATA",
  "bologna": "BOL",
  "brest": "BRE",
  "monaco": "MON",
  "sturm graz": "STU",
};

const TEAM_ALIASES: Record<string, string> = {
  "psg": "parissaintgermain",
  "parissaintgermain": "parissaintgermain",
  "inter": "internazionale",
  "internazionale": "internazionale",
  "dortmund": "borussiadortmund",
  "borussiadortmund": "borussiadortmund",
  "bayernmunich": "bayernmunchen",
  "bayernmunchen": "bayernmunchen",
  "sportingcp": "sportingportugal",
  "sporting": "sportingportugal",
  "sportingclubeportugal": "sportingportugal",
  "atlmadrid": "atleticomadrid",
  "atleticomadrid": "atleticomadrid",
  "manchesterutd": "manchesterunited",
  "manchesterunited": "manchesterunited",
  "manchestercity": "manchestercity",
  "slaviaprague": "slaviapraha",
  "slaviapraha": "slaviapraha",
  "spartaprague": "spartapraha",
  "spartapraha": "spartapraha",
  "bodoglimt": "bodoglimt",
  "rbleipzig": "rbleipzig",
  "leipzig": "rbleipzig",
  "shakhtardonetsk": "shakhtardonetsk",
  "shakhtar": "shakhtardonetsk",
  "dinamozagreb": "dinamozagreb",
  "crvenazvezda": "crvenazvezda",
  "redstar": "crvenazvezda",
  "slovanbratislava": "slovanbratislava",
  "youngboys": "youngboysbern",
  "youngboysbern": "youngboysbern",
  "sturmgraz": "sturmgraz",
  "stadebrestois": "brest",
  "brest": "brest",
  "astonvilla": "astonvilla",
  "clubbrugge": "clubbrugge",
};

/**
 * Normalizes club name by removing prefixes/suffixes (FC, CF, OSC, etc.) and diacritics
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|osc|bc|kv|1909|1893|29|sk|ac|sl|fk|bsc|gnk|vfb|club|clube de|de)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Returns canonical lookup key for club name
 */
export function getCanonicalTeamKey(name: string): string {
  const norm = normalizeTeamName(name);
  return TEAM_ALIASES[norm] || norm;
}

/**
 * Generates a clean, unique 3-letter team code deterministically
 */
export function generateTeamCode(teamName: string, usedCodes: Set<string>): string {
  const norm = teamName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Check canonical dictionary
  if (CANONICAL_CODES[norm] && !usedCodes.has(CANONICAL_CODES[norm])) {
    return CANONICAL_CODES[norm];
  }

  for (const [key, code] of Object.entries(CANONICAL_CODES)) {
    if ((norm === key || norm.includes(key) || key.includes(norm)) && !usedCodes.has(code)) {
      return code;
    }
  }

  // 2. Derive 3-letter abbreviation from words
  const words = norm.split(" ").filter((w) => w.length > 0);
  let candidate = "";

  if (words.length >= 3) {
    candidate = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  } else if (words.length === 2) {
    candidate = (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 3) {
    candidate = words[0].slice(0, 3).toUpperCase();
  }

  if (candidate.length === 3 && !usedCodes.has(candidate)) {
    return candidate;
  }

  // 3. Fallback: Systematic deterministic resolution
  const letters = norm.replace(/[^a-z]/g, "").toUpperCase();
  for (let i = 0; i < letters.length - 2; i++) {
    const code = letters.slice(i, i + 3);
    if (code.length === 3 && !usedCodes.has(code)) {
      return code;
    }
  }

  // Numerical suffix fallback
  for (let num = 1; num <= 99; num++) {
    const prefix = letters.slice(0, 1) || "T";
    const code = `${prefix}${num < 10 ? "0" + num : num}`;
    if (!usedCodes.has(code)) {
      return code;
    }
  }

  return `T${Math.floor(10 + Math.random() * 89)}`;
}

export interface TeamPreflightDecision {
  type: "matched_by_id" | "legacy_matched_by_name" | "new_insert";
  providerTeam: RawTeamData;
  existingDbTeam?: any;
}

/**
 * Validates and classifies all provider teams before performing database writes
 */
export function preflightTeamDecisions(
  providerTeams: RawTeamData[],
  existingTeams: any[]
): { decisions: TeamPreflightDecision[]; errors: string[] } {
  const decisions: TeamPreflightDecision[] = [];
  const errors: string[] = [];

  for (const pTeam of providerTeams) {
    // 1. Match by goal_api_id
    const byId = existingTeams.find((t) => t.goal_api_id === pTeam.goalApiId);
    if (byId) {
      decisions.push({
        type: "matched_by_id",
        providerTeam: pTeam,
        existingDbTeam: byId,
      });
      continue;
    }

    // 2. Exact name match (case-insensitive) where goal_api_id IS NULL
    const exactNameMatches = existingTeams.filter(
      (t) => t.name.toLowerCase().trim() === pTeam.name.toLowerCase().trim()
    );

    if (exactNameMatches.length === 1) {
      const match = exactNameMatches[0];
      if (match.goal_api_id && match.goal_api_id !== pTeam.goalApiId) {
        errors.push(
          `Konflikt tożsamości drużyny: "${pTeam.name}" ma w bazie przypisany inny goal_api_id (${match.goal_api_id} vs ${pTeam.goalApiId}).`
        );
      } else {
        decisions.push({
          type: "legacy_matched_by_name",
          providerTeam: pTeam,
          existingDbTeam: match,
        });
      }
      continue;
    }

    // 3. Normalized / Canonical key match where goal_api_id IS NULL
    const pKey = getCanonicalTeamKey(pTeam.name);
    const normMatches = existingTeams.filter((t) => {
      const dbKey = getCanonicalTeamKey(t.name);
      return (dbKey === pKey || dbKey.includes(pKey) || pKey.includes(dbKey)) && !t.goal_api_id;
    });

    if (normMatches.length === 1) {
      const match = normMatches[0];
      if (match.goal_api_id && match.goal_api_id !== pTeam.goalApiId) {
        errors.push(
          `Konflikt tożsamości drużyny: "${pTeam.name}" (zmatchowany z "${match.name}") ma inny goal_api_id (${match.goal_api_id}).`
        );
      } else {
        decisions.push({
          type: "legacy_matched_by_name",
          providerTeam: pTeam,
          existingDbTeam: match,
        });
      }
      continue;
    }

    if (normMatches.length > 1) {
      errors.push(
        `Niejednoznaczne dopasowanie dla "${pTeam.name}": znaleziono ${normMatches.length} pasujących drużyn w bazie (${normMatches.map((m) => m.name).join(", ")}).`
      );
      continue;
    }

    // 4. Safe New Insert: Verify name does not collide with ANY team in DB
    const nameCollision = existingTeams.find(
      (t) => t.name.toLowerCase().trim() === pTeam.name.toLowerCase().trim()
    );
    if (nameCollision) {
      errors.push(
        `Kolizja nazwy dla nowego klubu "${pTeam.name}": drużyna o tej nazwie już istnieje w bazie (ID: ${nameCollision.id}).`
      );
      continue;
    }

    decisions.push({
      type: "new_insert",
      providerTeam: pTeam,
    });
  }

  return { decisions, errors };
}

/**
 * Synchronizes real UCL 2026/27 schedule from GOAL API idempotently
 */
export async function syncUclSchedule(client: GoalApiClient = new GoalApiClient()): Promise<UclScheduleSyncResult> {
  const adminSupabase = createAdminClient();

  // 1. Fetch UCL fixtures
  let allFixtures: GoalApiFixtureItem[] = [];
  try {
    allFixtures = await client.getUclFixtures();
  } catch (err: any) {
    return {
      success: false,
      error: `Nie udało się pobrać terminarza z GOAL API: ${err.message}`,
      teamsSyncedCount: 0,
      newTeamsCount: 0,
      updatedTeamsCount: 0,
      matchesSyncedCount: 0,
      newMatchesCount: 0,
      updatedMatchesCount: 0,
      qualifyingIgnoredCount: 0,
      manualOverridesSkippedCount: 0,
    };
  }

  // Filter League Phase fixtures ONLY
  const leaguePhaseFixtures = allFixtures.filter((f) => f.stageName === "League Phase");
  const qualifyingIgnoredCount = allFixtures.length - leaguePhaseFixtures.length;

  if (leaguePhaseFixtures.length === 0) {
    return {
      success: false,
      error: "Brak meczów fazy ligowej (League Phase) w odpowiedzi GOAL API.",
      teamsSyncedCount: 0,
      newTeamsCount: 0,
      updatedTeamsCount: 0,
      matchesSyncedCount: 0,
      newMatchesCount: 0,
      updatedMatchesCount: 0,
      qualifyingIgnoredCount,
      manualOverridesSkippedCount: 0,
    };
  }

  // 2. Collect unique teams from League Phase fixtures
  const teamsMap = new Map<string, RawTeamData>();

  for (const f of leaguePhaseFixtures) {
    if (f.homeTeamId && f.homeTeamName) {
      const badge = f.teamHomeBadge || f.homeTeam?.badge || null;
      teamsMap.set(f.homeTeamId, {
        goalApiId: f.homeTeamId,
        name: f.homeTeamName.trim(),
        badgeUrl: badge && String(badge).trim().length > 0 ? String(badge).trim() : null,
      });
    }
    if (f.awayTeamId && f.awayTeamName) {
      const badge = f.teamAwayBadge || f.awayTeam?.badge || null;
      teamsMap.set(f.awayTeamId, {
        goalApiId: f.awayTeamId,
        name: f.awayTeamName.trim(),
        badgeUrl: badge && String(badge).trim().length > 0 ? String(badge).trim() : null,
      });
    }
  }

  // Fetch existing teams from database
  const { data: existingTeamsRaw } = await adminSupabase.from("teams").select("*");
  const existingTeams = existingTeamsRaw || [];

  // 3. Preflight Check: Validate and classify all 36 teams before ANY DB write
  const providerTeamsList = Array.from(teamsMap.values());
  const { decisions, errors: preflightErrors } = preflightTeamDecisions(providerTeamsList, existingTeams);

  if (preflightErrors.length > 0) {
    return {
      success: false,
      error: `Wykryto błędy przed zapisem:\n${preflightErrors.join("\n")}`,
      teamsSyncedCount: 0,
      newTeamsCount: 0,
      updatedTeamsCount: 0,
      matchesSyncedCount: 0,
      newMatchesCount: 0,
      updatedMatchesCount: 0,
      qualifyingIgnoredCount,
      manualOverridesSkippedCount: 0,
    };
  }

  const usedCodes = new Set<string>(existingTeams.map((t) => t.code));
  const teamIdByGoalApiId = new Map<string, string>();

  let newTeamsCount = 0;
  let updatedTeamsCount = 0;

  // 4. Execute Team Upserts based on Preflight Decisions
  for (const decision of decisions) {
    const { type, providerTeam, existingDbTeam } = decision;

    if (type === "matched_by_id") {
      // Team already exists and is bound to goal_api_id -> update metadata
      await adminSupabase
        .from("teams")
        .update({
          name: providerTeam.name,
          short_name: existingDbTeam.short_name || providerTeam.name,
          logo_url: providerTeam.badgeUrl || existingDbTeam.logo_url || null,
        })
        .eq("id", existingDbTeam.id);

      teamIdByGoalApiId.set(providerTeam.goalApiId, existingDbTeam.id);
      updatedTeamsCount += 1;
    } else if (type === "legacy_matched_by_name") {
      // Legacy team (goal_api_id was null) -> bind goal_api_id, keep existing UUID & code intact
      await adminSupabase
        .from("teams")
        .update({
          name: providerTeam.name,
          short_name: existingDbTeam.short_name || providerTeam.name,
          goal_api_id: providerTeam.goalApiId,
          logo_url: providerTeam.badgeUrl || existingDbTeam.logo_url || null,
        })
        .eq("id", existingDbTeam.id);

      teamIdByGoalApiId.set(providerTeam.goalApiId, existingDbTeam.id);
      updatedTeamsCount += 1;
    } else if (type === "new_insert") {
      // Brand new team -> generate code and insert
      const code = generateTeamCode(providerTeam.name, usedCodes);
      usedCodes.add(code);

      const { data: inserted, error: insertErr } = await adminSupabase
        .from("teams")
        .insert({
          name: providerTeam.name,
          short_name: providerTeam.name,
          code,
          logo_url: providerTeam.badgeUrl || null,
          goal_api_id: providerTeam.goalApiId,
          uefa_coefficient: 0,
          disciplinary_points: 0,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        throw new Error(`Błąd tworzenia drużyny ${providerTeam.name}: ${insertErr?.message}`);
      }

      teamIdByGoalApiId.set(providerTeam.goalApiId, inserted.id);
      newTeamsCount += 1;
    }
  }

  // 5. Fetch existing matches to ensure idempotency & protect predictions
  const { data: existingMatchesRaw } = await adminSupabase
    .from("matches")
    .select("id, goal_api_fixture_id, is_manual_override, status, kickoff_at, home_team_id, away_team_id");
  const existingMatches = existingMatchesRaw || [];

  let newMatchesCount = 0;
  let updatedMatchesCount = 0;
  let manualOverridesSkippedCount = 0;

  // 6. Upsert League Phase Matches (Source of truth: goal_api_fixture_id)
  for (const f of leaguePhaseFixtures) {
    const homeDbId = teamIdByGoalApiId.get(f.homeTeamId || "");
    const awayDbId = teamIdByGoalApiId.get(f.awayTeamId || "");

    if (!homeDbId || !awayDbId) {
      console.warn(`Pominięto mecz ${f.id} z powodu braku powiązania drużyn (${f.homeTeamName} vs ${f.awayTeamName})`);
      continue;
    }

    const matchday = f.matchRound ? parseInt(f.matchRound, 10) || 1 : 1;
    const kickoffAt = new Date(f.kickoffUtc).toISOString(); // Exact UTC preservation

    let existing = existingMatches.find((m) => m.goal_api_fixture_id === f.id);

    // If not found by goal_api_fixture_id, match by unique (home_team_id, away_team_id) pair
    if (!existing) {
      existing = existingMatches.find(
        (m) => m.home_team_id === homeDbId && m.away_team_id === awayDbId
      );
    }

    if (existing) {
      if (existing.is_manual_override) {
        manualOverridesSkippedCount += 1;
        continue;
      }

      // Safe update: attach goal_api_fixture_id and update fixture data if match is scheduled
      if (existing.status === "scheduled") {
        await adminSupabase
          .from("matches")
          .update({
            goal_api_fixture_id: f.id,
            home_team_id: homeDbId,
            away_team_id: awayDbId,
            kickoff_at: kickoffAt,
            matchday,
            stage: "league",
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await adminSupabase
          .from("matches")
          .update({
            goal_api_fixture_id: f.id,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }

      updatedMatchesCount += 1;
    } else {
      // Insert new match if not existing in bootstrap
      const { error: matchInsertErr } = await adminSupabase.from("matches").insert({
        stage: "league",
        matchday,
        home_team_id: homeDbId,
        away_team_id: awayDbId,
        kickoff_at: kickoffAt,
        status: "scheduled",
        is_betting_locked: false,
        goal_api_fixture_id: f.id,
        is_manual_override: false,
        last_synced_at: new Date().toISOString(),
      });

      if (matchInsertErr) {
        throw new Error(`Błąd tworzenia meczu ${f.homeTeamName} vs ${f.awayTeamName}: ${matchInsertErr.message}`);
      }

      newMatchesCount += 1;
    }
  }

  // 7. Revalidate routes
  try {
    revalidatePath("/");
    revalidatePath("/mecze");
    revalidatePath("/tabela");
    revalidatePath("/ranking");
    revalidatePath("/admin");
  } catch {
    // Safe when invoked outside Next.js request context
  }

  return {
    success: true,
    teamsSyncedCount: teamsMap.size,
    newTeamsCount,
    updatedTeamsCount,
    matchesSyncedCount: leaguePhaseFixtures.length,
    newMatchesCount,
    updatedMatchesCount,
    qualifyingIgnoredCount,
    manualOverridesSkippedCount,
  };
}

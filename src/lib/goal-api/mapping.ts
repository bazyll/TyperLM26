import { createAdminClient } from "@/lib/supabase/admin";
import { GoalApiClient } from "./client";
import { MappingPreviewItem, GoalApiFixtureItem } from "./types";

export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\b(fc|cf|fk|nk|afc|bsc|ssc|rb|sk|gasp)\b/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function areTeamNamesMatching(nameA: string, nameB: string): boolean {
  const normA = normalizeTeamName(nameA);
  const normB = normalizeTeamName(nameB);

  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Common aliases
  const aliases: Record<string, string[]> = {
    "real madrid": ["real"],
    "manchester city": ["man city", "mci"],
    "manchester united": ["man utd", "manchester utd", "mun"],
    "bayern munich": ["bayern", "bayern munchen"],
    "paris saint germain": ["psg"],
    "inter milan": ["inter", "internazionale"],
    "ac milan": ["milan"],
    "borussia dortmund": ["dortmund", "bvb"],
    "atletico madrid": ["atletico"],
    "sporting cp": ["sporting", "sporting lisbon"],
    "benfica": ["sl benfica"],
    "red star belgrade": ["crvena zvezda"],
    "shakhtar donetsk": ["shakhtar"],
    "dinamo zagreb": ["zagreb"],
  };

  for (const [canonical, list] of Object.entries(aliases)) {
    const fullList = [canonical, ...list];
    const matchA = fullList.some((al) => normA === al || normA.includes(al));
    const matchB = fullList.some((al) => normB === al || normB.includes(al));
    if (matchA && matchB) return true;
  }

  return false;
}

/**
 * Builds a preview mapping of GOAL API fixtures against local TyperLM26 matches
 */
export async function getGoalApiMappingPreview(client: GoalApiClient = new GoalApiClient()): Promise<MappingPreviewItem[]> {
  const adminSupabase = createAdminClient();

  // 1. Fetch all local matches with team details
  const { data: rawMatches } = await adminSupabase
    .from("matches")
    .select(`
      id,
      stage,
      matchday,
      kickoff_at,
      status,
      goal_api_fixture_id,
      is_manual_override,
      home_team:teams!matches_home_team_id_fkey(id, name, short_name, code),
      away_team:teams!matches_away_team_id_fkey(id, name, short_name, code)
    `);

  const localMatches = (rawMatches || []).map((m: any) => ({
    id: m.id,
    kickoffAt: m.kickoff_at,
    status: m.status,
    goalApiFixtureId: m.goal_api_fixture_id,
    homeTeamName: m.home_team?.name || "",
    awayTeamName: m.away_team?.name || "",
  }));

  // 2. Fetch external UCL fixtures from GOAL API
  let externalFixtures: GoalApiFixtureItem[] = [];
  try {
    externalFixtures = await client.getUclFixtures();
  } catch (err) {
    console.error("Error fetching UCL fixtures for preview mapping:", err);
  }

  const previews: MappingPreviewItem[] = [];

  for (const ext of externalFixtures) {
    const extKickoff = new Date(ext.kickoffUtc).getTime();

    // Check if already mapped by goal_api_fixture_id
    const alreadyMapped = localMatches.find((m) => m.goalApiFixtureId === ext.id);
    if (alreadyMapped) {
      previews.push({
        goalApiFixtureId: ext.id,
        kickoffUtc: ext.kickoffUtc,
        goalApiHomeTeam: ext.homeTeamName,
        goalApiAwayTeam: ext.awayTeamName,
        status: ext.matchStatus,
        suggestedMatchId: alreadyMapped.id,
        suggestedHomeTeam: alreadyMapped.homeTeamName,
        suggestedAwayTeam: alreadyMapped.awayTeamName,
        confidence: "exact",
        isMapped: true,
      });
      continue;
    }

    // Try to match by team names and date window (+- 36 hours)
    let bestMatch: (typeof localMatches)[0] | null = null;
    let bestConfidence: "high" | "low" | "none" = "none";

    for (const loc of localMatches) {
      const locKickoff = new Date(loc.kickoffAt).getTime();
      const timeDiffHours = Math.abs(extKickoff - locKickoff) / (1000 * 60 * 60);

      const homeMatches = areTeamNamesMatching(ext.homeTeamName, loc.homeTeamName);
      const awayMatches = areTeamNamesMatching(ext.awayTeamName, loc.awayTeamName);

      if (homeMatches && awayMatches) {
        if (timeDiffHours <= 36) {
          bestMatch = loc;
          bestConfidence = "high";
          break;
        } else {
          bestMatch = loc;
          bestConfidence = "low";
        }
      }
    }

    previews.push({
      goalApiFixtureId: ext.id,
      kickoffUtc: ext.kickoffUtc,
      goalApiHomeTeam: ext.homeTeamName,
      goalApiAwayTeam: ext.awayTeamName,
      status: ext.matchStatus,
      suggestedMatchId: bestMatch?.id,
      suggestedHomeTeam: bestMatch?.homeTeamName,
      suggestedAwayTeam: bestMatch?.awayTeamName,
      confidence: bestConfidence,
      isMapped: false,
    });
  }

  return previews;
}

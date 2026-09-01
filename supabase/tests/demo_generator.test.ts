import { describe, it, expect } from "vitest";
import {
  DEMO_TEAMS,
  DEMO_TEAM_CODES,
  DEMO_SPECIAL_SLUGS,
  DEMO_PICKEM_SEASON,
  generateFullLeagueSchedule,
} from "../../scripts/demo-data";

describe("Demo Schedule Generator & Dataset Verification", () => {
  it("defines exactly 36 demo teams with reserved D01..D36 codes and isolated markers", () => {
    expect(DEMO_TEAMS).toHaveLength(36);
    expect(DEMO_TEAM_CODES).toHaveLength(36);

    const codes = new Set<string>();
    for (let i = 0; i < DEMO_TEAMS.length; i++) {
      const t = DEMO_TEAMS[i];
      const expectedCode = `D${String(i + 1).padStart(2, "0")}`;
      expect(t.code).toBe(expectedCode);

      expect(t.name).toBeTruthy();
      expect(t.short_name).toBeTruthy();
      expect(codes.has(t.code)).toBe(false);
      codes.add(t.code);

      expect(t.uefa_coefficient).toBeGreaterThan(0);
      expect(t.disciplinary_points).toBeGreaterThanOrEqual(0);
      expect(t.players.length).toBeGreaterThanOrEqual(2);
    }

    // Check special category slugs isolation
    expect(DEMO_SPECIAL_SLUGS).toHaveLength(6);
    DEMO_SPECIAL_SLUGS.forEach((slug) => {
      expect(slug.startsWith("demo-")).toBe(true);
    });

    // Check pickem season isolation
    expect(DEMO_PICKEM_SEASON).toContain("DEMO");
  });

  it("generates exactly 144 matches across 8 matchdays for 36 teams", () => {
    const mockTeamIds = DEMO_TEAMS.map((_, i) => `team-uuid-${i + 1}`);
    const schedule = generateFullLeagueSchedule(mockTeamIds);

    expect(schedule).toHaveLength(144);

    const matchesPerTeam = new Map<string, number>();
    const homeCount = new Map<string, number>();
    const awayCount = new Map<string, number>();
    const seenPairs = new Set<string>();

    mockTeamIds.forEach((id) => {
      matchesPerTeam.set(id, 0);
      homeCount.set(id, 0);
      awayCount.set(id, 0);
    });

    for (const m of schedule) {
      // No self-match
      expect(m.homeTeamId).not.toBe(m.awayTeamId);

      // No duplicate pair
      const pairKey = `${m.homeTeamId}__${m.awayTeamId}`;
      expect(seenPairs.has(pairKey)).toBe(false);
      seenPairs.add(pairKey);

      // Matchday between 1 and 8
      expect(m.matchday).toBeGreaterThanOrEqual(1);
      expect(m.matchday).toBeLessThanOrEqual(8);

      matchesPerTeam.set(m.homeTeamId, (matchesPerTeam.get(m.homeTeamId) || 0) + 1);
      matchesPerTeam.set(m.awayTeamId, (matchesPerTeam.get(m.awayTeamId) || 0) + 1);
      homeCount.set(m.homeTeamId, (homeCount.get(m.homeTeamId) || 0) + 1);
      awayCount.set(m.awayTeamId, (awayCount.get(m.awayTeamId) || 0) + 1);
    }

    // Every single team has exactly 8 matches total
    for (const id of mockTeamIds) {
      expect(matchesPerTeam.get(id)).toBe(8);
      expect(homeCount.get(id)).toBeGreaterThan(0);
      expect(awayCount.get(id)).toBeGreaterThan(0);
      expect((homeCount.get(id) || 0) + (awayCount.get(id) || 0)).toBe(8);
    }
  });
});

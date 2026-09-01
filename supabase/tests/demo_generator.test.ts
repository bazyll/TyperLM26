import { describe, it, expect } from "vitest";
import { DEMO_TEAMS, generateFullLeagueSchedule } from "../../scripts/demo-data";

describe("Demo Schedule Generator & Dataset Verification", () => {
  it("defines exactly 36 demo teams with valid attributes and players", () => {
    expect(DEMO_TEAMS).toHaveLength(36);

    const codes = new Set<string>();
    for (const t of DEMO_TEAMS) {
      expect(t.name).toBeTruthy();
      expect(t.short_name).toBeTruthy();
      expect(t.code).toBeTruthy();
      expect(codes.has(t.code)).toBe(false);
      codes.add(t.code);

      expect(t.uefa_coefficient).toBeGreaterThan(0);
      expect(t.disciplinary_points).toBeGreaterThanOrEqual(0);
      expect(t.players.length).toBeGreaterThanOrEqual(2);
    }
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

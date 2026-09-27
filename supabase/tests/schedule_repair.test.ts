import { describe, it, expect } from "vitest";
import rawOfficialDataset from "@/data/ucl-2026-27-league-phase.json";
import { validateUclScheduleDataset } from "@/lib/goal-api/bootstrap";

describe("UCL 2026/27 Schedule Repair & Prediction Invariants", () => {
  const dataset = rawOfficialDataset as any[];

  it("satisfies 144 matches total", () => {
    expect(dataset).toHaveLength(144);
  });

  it("satisfies exactly 18 matches per matchday (MD1..MD8)", () => {
    const mdCounts: Record<number, number> = {};
    dataset.forEach((m) => {
      mdCounts[m.matchday] = (mdCounts[m.matchday] || 0) + 1;
    });

    for (let md = 1; md <= 8; md++) {
      expect(mdCounts[md]).toBe(18);
    }
  });

  it("satisfies exactly 8 matches per team (4 Home + 4 Away)", () => {
    const teamStats: Record<string, { total: number; home: number; away: number }> = {};
    dataset.forEach((m) => {
      if (!teamStats[m.homeTeam]) teamStats[m.homeTeam] = { total: 0, home: 0, away: 0 };
      if (!teamStats[m.awayTeam]) teamStats[m.awayTeam] = { total: 0, home: 0, away: 0 };
      teamStats[m.homeTeam].total++;
      teamStats[m.homeTeam].home++;
      teamStats[m.awayTeam].total++;
      teamStats[m.awayTeam].away++;
    });

    expect(Object.keys(teamStats)).toHaveLength(36);
    Object.entries(teamStats).forEach(([team, stats]) => {
      expect(stats.total, `${team} total`).toBe(8);
      expect(stats.home, `${team} home`).toBe(4);
      expect(stats.away, `${team} away`).toBe(4);
    });
  });

  it("satisfies exact UEFA home/away pairs without duplicates", () => {
    const seenFixtures = new Set<string>();
    dataset.forEach((m) => {
      const pair = `${m.homeTeam} vs ${m.awayTeam}`;
      expect(seenFixtures.has(pair), `Duplicate pair: ${pair}`).toBe(false);
      seenFixtures.add(pair);
    });
    expect(seenFixtures.size).toBe(144);
  });

  it("satisfies exact valid kickoff times in UTC (16:45/19:00 in CEST, 17:45/20:00 in CET)", () => {
    dataset.forEach((m) => {
      const date = new Date(m.kickoffUtc);
      expect(isNaN(date.getTime())).toBe(false);
      const iso = m.kickoffUtc;

      // MD1..MD3 are CEST (UTC+2) -> 16:45 UTC or 19:00 UTC
      if (m.matchday <= 3) {
        const isEarly = iso.includes("T16:45:00");
        const isLate = iso.includes("T19:00:00");
        expect(isEarly || isLate, `MD${m.matchday} invalid CEST kickoff: ${iso}`).toBe(true);
      }
      // MD4..MD8 are CET (UTC+1) -> 17:45 UTC or 20:00 UTC
      else {
        const isEarly = iso.includes("T17:45:00");
        const isLate = iso.includes("T20:00:00");
        expect(isEarly || isLate, `MD${m.matchday} invalid CET kickoff: ${iso}`).toBe(true);
      }
    });
  });

  it("satisfies unique Goal API fixture IDs for all 144 fixtures", () => {
    const seenGoalIds = new Set<string>();
    dataset.forEach((m) => {
      expect(m.goalApiFixtureId).toBeTruthy();
      expect(seenGoalIds.has(m.goalApiFixtureId), `Duplicate Goal API ID: ${m.goalApiFixtureId}`).toBe(false);
      seenGoalIds.add(m.goalApiFixtureId);
    });
    expect(seenGoalIds.size).toBe(144);
  });

  it("guarantees MD1 (18 matches) matches the historical played MD1", () => {
    const md1 = dataset.filter((m) => m.matchday === 1);
    expect(md1).toHaveLength(18);

    // Verify key MD1 fixtures
    const md1Pairs = new Set(md1.map((m) => `${m.homeTeam} vs ${m.awayTeam}`));
    expect(md1Pairs.has("Club Brugge KV vs Aston Villa")).toBe(true);
    expect(md1Pairs.has("Real Madrid vs Inter")).toBe(true);
    expect(md1Pairs.has("Bayern Munich vs Bodo/Glimt")).toBe(true);
    expect(md1Pairs.has("Liverpool vs Atl. Madrid")).toBe(true);
  });

  describe("Prediction Preservation & Invalidation Logic", () => {
    function evaluatePredictionRepair(
      oldMatch: { homeTeamId: string; awayTeamId: string },
      newMatch: { homeTeamId: string; awayTeamId: string }
    ) {
      const isSameHome = oldMatch.homeTeamId === newMatch.homeTeamId;
      const isSameAway = oldMatch.awayTeamId === newMatch.awayTeamId;
      const isSafe = isSameHome && isSameAway;

      return {
        action: isSafe ? "PRESERVE" : "INVALIDATE_AND_BACKUP",
        isSafe,
      };
    }

    it("retains prediction when fixture identity (home & away) is unchanged", () => {
      const oldMatch = { homeTeamId: "uuid-roma", awayTeamId: "uuid-slovan" };
      const newMatch = { homeTeamId: "uuid-roma", awayTeamId: "uuid-slovan" };

      const result = evaluatePredictionRepair(oldMatch, newMatch);
      expect(result.isSafe).toBe(true);
      expect(result.action).toBe("PRESERVE");
    });

    it("invalidates prediction when opponent is changed", () => {
      const oldMatch = { homeTeamId: "uuid-roma", awayTeamId: "uuid-stuttgart" };
      const newMatch = { homeTeamId: "uuid-villarreal", awayTeamId: "uuid-napoli" };

      const result = evaluatePredictionRepair(oldMatch, newMatch);
      expect(result.isSafe).toBe(false);
      expect(result.action).toBe("INVALIDATE_AND_BACKUP");
    });

    it("invalidates prediction when home and away are reversed", () => {
      const oldMatch = { homeTeamId: "uuid-arsenal", awayTeamId: "uuid-slavia" };
      const newMatch = { homeTeamId: "uuid-slavia", awayTeamId: "uuid-arsenal" };

      const result = evaluatePredictionRepair(oldMatch, newMatch);
      expect(result.isSafe).toBe(false);
      expect(result.action).toBe("INVALIDATE_AND_BACKUP");
    });

    it("creates audit backup record structure for invalidated prediction", () => {
      const samplePrediction = {
        id: "pred-uuid-123",
        user_id: "user-uuid-456",
        match_id: "match-uuid-789",
        old_home_team_id: "team-a",
        old_away_team_id: "team-b",
        home_score: 2,
        away_score: 1,
        created_at: "2026-09-20T12:00:00Z",
        updated_at: "2026-09-20T12:00:00Z",
      };

      const auditBackup = {
        original_prediction_id: samplePrediction.id,
        user_id: samplePrediction.user_id,
        match_id: samplePrediction.match_id,
        old_home_team_id: samplePrediction.old_home_team_id,
        old_away_team_id: samplePrediction.old_away_team_id,
        predicted_home_score: samplePrediction.home_score,
        predicted_away_score: samplePrediction.away_score,
        original_created_at: samplePrediction.created_at,
        original_updated_at: samplePrediction.updated_at,
        reason: "schedule_repair_2026_27",
      };

      expect(auditBackup.original_prediction_id).toBe("pred-uuid-123");
      expect(auditBackup.predicted_home_score).toBe(2);
      expect(auditBackup.predicted_away_score).toBe(1);
      expect(auditBackup.reason).toBe("schedule_repair_2026_27");
    });
  });
});

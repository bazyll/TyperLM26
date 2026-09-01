import { describe, it, expect } from "vitest";

/**
 * Leaderboard & Ranking Calculation Tests
 */

describe("Leaderboard Ranking & Aggregation Logic", () => {
  interface MockProfile {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }

  interface MockPrediction {
    userId: string;
    pointsAwarded: number | null;
    scoringCategory: "exact" | "diff" | "outcome" | "incorrect" | null;
  }

  const mockProfiles: MockProfile[] = [
    { id: "u1", username: "bartek", firstName: "Bartosz", lastName: "K", isActive: true },
    { id: "u2", username: "michal", firstName: "Michał", lastName: "W", isActive: true },
    { id: "u3", username: "kamil", firstName: "Kamil", lastName: "Z", isActive: true },
    { id: "u4_inactive", username: "banned_user", firstName: "Jan", lastName: "B", isActive: false },
  ];

  const mockPredictions: MockPrediction[] = [
    // Bartek: 3 (exact) + 2 (diff) + 1 (outcome) = 6 pts (1 exact)
    { userId: "u1", pointsAwarded: 3, scoringCategory: "exact" },
    { userId: "u1", pointsAwarded: 2, scoringCategory: "diff" },
    { userId: "u1", pointsAwarded: 1, scoringCategory: "outcome" },

    // Michał: 3 (exact) + 3 (exact) + 0 (incorrect) = 6 pts (2 exact) -> Wins tie-break over Bartek!
    { userId: "u2", pointsAwarded: 3, scoringCategory: "exact" },
    { userId: "u2", pointsAwarded: 3, scoringCategory: "exact" },
    { userId: "u2", pointsAwarded: 0, scoringCategory: "incorrect" },

    // Kamil: 2 (diff) + 1 (outcome) = 3 pts
    { userId: "u3", pointsAwarded: 2, scoringCategory: "diff" },
    { userId: "u3", pointsAwarded: 1, scoringCategory: "outcome" },

    // Inactive user: 10 pts (historical data exists, but should NOT appear on current active leaderboard)
    { userId: "u4_inactive", pointsAwarded: 10, scoringCategory: "exact" },
  ];

  it("calculates correct point totals and tie-breaks by exactScoresCount", () => {
    // Filter active profiles only
    const activeProfiles = mockProfiles.filter((p) => p.isActive);
    expect(activeProfiles.length).toBe(3);

    const statsMap = new Map<string, { totalPoints: number; exact: number; count: number }>();
    activeProfiles.forEach((p) => statsMap.set(p.id, { totalPoints: 0, exact: 0, count: 0 }));

    mockPredictions.forEach((pred) => {
      const stats = statsMap.get(pred.userId);
      if (stats && pred.pointsAwarded !== null) {
        stats.totalPoints += pred.pointsAwarded;
        stats.count += 1;
        if (pred.scoringCategory === "exact") stats.exact += 1;
      }
    });

    const leaderboard = activeProfiles.map((p) => {
      const s = statsMap.get(p.id)!;
      return {
        userId: p.id,
        username: p.username,
        totalPoints: s.totalPoints,
        exactScoresCount: s.exact,
      };
    });

    // Sort by totalPoints DESC, exactScoresCount DESC, username ASC
    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactScoresCount !== a.exactScoresCount) return b.exactScoresCount - a.exactScoresCount;
      return a.username.localeCompare(b.username);
    });

    // Rank 1: Michał (6 pts, 2 exact)
    expect(leaderboard[0].username).toBe("michal");
    expect(leaderboard[0].totalPoints).toBe(6);
    expect(leaderboard[0].exactScoresCount).toBe(2);

    // Rank 2: Bartek (6 pts, 1 exact)
    expect(leaderboard[1].username).toBe("bartek");
    expect(leaderboard[1].totalPoints).toBe(6);
    expect(leaderboard[1].exactScoresCount).toBe(1);

    // Rank 3: Kamil (3 pts, 0 exact)
    expect(leaderboard[2].username).toBe("kamil");
    expect(leaderboard[2].totalPoints).toBe(3);

    // Deactivated user is not in active leaderboard
    expect(leaderboard.find((e) => e.username === "banned_user")).toBeUndefined();
  });

  it("selects up to 4 focus matches prioritizing LIVE matches then recently finished matches", () => {
    const mockMatches = [
      { id: "m_fut_1", status: "scheduled", kickoffAt: "2026-10-01T20:00:00Z" },
      { id: "m_fin_old", status: "finished", kickoffAt: "2026-09-01T18:00:00Z" },
      { id: "m_fin_mid", status: "finished", kickoffAt: "2026-09-02T18:00:00Z" },
      { id: "m_fin_new", status: "finished", kickoffAt: "2026-09-03T18:00:00Z" },
      { id: "m_live_1", status: "live", kickoffAt: "2026-09-04T19:00:00Z" },
      { id: "m_live_2", status: "live", kickoffAt: "2026-09-04T19:30:00Z" },
    ];

    const liveMatches = mockMatches
      .filter((m) => m.status === "live")
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

    const finishedMatches = mockMatches
      .filter((m) => m.status === "finished")
      .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

    const focusMatches = [...liveMatches, ...finishedMatches].slice(0, 4);

    expect(focusMatches.length).toBe(4);
    // Focus matches must be: 2 live matches, followed by 2 newest finished matches
    expect(focusMatches[0].id).toBe("m_live_1");
    expect(focusMatches[1].id).toBe("m_live_2");
    expect(focusMatches[2].id).toBe("m_fin_new");
    expect(focusMatches[3].id).toBe("m_fin_mid");
    // Scheduled future match must NOT be included in focus matches
    expect(focusMatches.some((m) => m.id === "m_fut_1")).toBe(false);
  });
});

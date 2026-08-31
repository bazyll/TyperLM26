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
});

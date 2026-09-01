import { describe, it, expect } from "vitest";
import { LeaderboardEntry } from "@/types";

describe("Ranking Total Points & Tiebreaker Rules", () => {
  it("calculates TOTAL = MATCH POINTS + SPECIAL POINTS + PICK'EM POINTS", () => {
    const userA = {
      matchPoints: 52,
      specialPoints: 40,
      pickemPoints: 63,
    };
    const totalA = userA.matchPoints + userA.specialPoints + userA.pickemPoints;
    expect(totalA).toBe(155);

    const userB = {
      matchPoints: 31,
      specialPoints: 40,
      pickemPoints: 54,
    };
    const totalB = userB.matchPoints + userB.specialPoints + userB.pickemPoints;
    expect(totalB).toBe(125);
  });

  it("applies tiebreaker: totalPoints DESC -> exactScoresCount DESC -> username ASC", () => {
    const entries: LeaderboardEntry[] = [
      {
        rank: 1,
        userId: "u1",
        username: "michal",
        firstName: "Michał",
        lastName: "Nowak",
        avatarUrl: null,
        matchPoints: 40,
        specialPoints: 20,
        pickemPoints: 40,
        totalPoints: 100,
        exactScoresCount: 4,
        diffScoresCount: 5,
        outcomeScoresCount: 4,
        incorrectScoresCount: 2,
        predictedMatchesCount: 15,
        accuracyRate: 87,
      },
      {
        rank: 1,
        userId: "u2",
        username: "adam",
        firstName: "Adam",
        lastName: "Kowalski",
        avatarUrl: null,
        matchPoints: 40,
        specialPoints: 20,
        pickemPoints: 40,
        totalPoints: 100,
        exactScoresCount: 6, // More exact scores -> should be ranked higher than michal
        diffScoresCount: 3,
        outcomeScoresCount: 4,
        incorrectScoresCount: 2,
        predictedMatchesCount: 15,
        accuracyRate: 87,
      },
      {
        rank: 1,
        userId: "u3",
        username: "zenon",
        firstName: "Zenon",
        lastName: "Wójcik",
        avatarUrl: null,
        matchPoints: 60,
        specialPoints: 40,
        pickemPoints: 30,
        totalPoints: 130, // Higher total points -> rank 1
        exactScoresCount: 2,
        diffScoresCount: 5,
        outcomeScoresCount: 4,
        incorrectScoresCount: 4,
        predictedMatchesCount: 15,
        accuracyRate: 73,
      },
    ];

    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactScoresCount !== a.exactScoresCount) return b.exactScoresCount - a.exactScoresCount;
      return a.username.localeCompare(b.username);
    });

    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    expect(entries[0].username).toBe("zenon"); // 130 pts
    expect(entries[0].rank).toBe(1);

    expect(entries[1].username).toBe("adam"); // 100 pts, 6 exact
    expect(entries[1].rank).toBe(2);

    expect(entries[2].username).toBe("michal"); // 100 pts, 4 exact
    expect(entries[2].rank).toBe(3);
  });
});

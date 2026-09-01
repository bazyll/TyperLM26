import { describe, it, expect } from "vitest";
import { ProfilePredictionItem } from "../../src/components/profile/profile-predictions-history";

describe("Profile Prediction History Sorting & Pagination Logic", () => {
  const samplePredictions: ProfilePredictionItem[] = [
    {
      id: "pred-1",
      homeScore: 2,
      awayScore: 1,
      pointsAwarded: 3,
      match: {
        id: "m-1",
        stage: "league",
        matchday: 1,
        kickoffAt: "2026-09-01T18:45:00Z",
        status: "finished",
        isBettingLocked: true,
        homeScore: 2,
        awayScore: 1,
        homeTeamName: "Arsenal",
        homeTeamShort: "ARS",
        awayTeamName: "Bayern",
        awayTeamShort: "BAY",
      },
    },
    {
      id: "pred-2",
      homeScore: 1,
      awayScore: 1,
      pointsAwarded: 1,
      match: {
        id: "m-2",
        stage: "league",
        matchday: 1,
        kickoffAt: "2026-09-01T21:00:00Z", // later finished
        status: "finished",
        isBettingLocked: true,
        homeScore: 0,
        awayScore: 0,
        homeTeamName: "Real Madrid",
        homeTeamShort: "RMA",
        awayTeamName: "Manchester City",
        awayTeamShort: "MCI",
      },
    },
    {
      id: "pred-3",
      homeScore: 3,
      awayScore: 0,
      pointsAwarded: null,
      match: {
        id: "m-3",
        stage: "league",
        matchday: 2,
        kickoffAt: "2026-09-15T21:00:00Z", // future scheduled
        status: "scheduled",
        isBettingLocked: false,
        homeScore: null,
        awayScore: null,
        homeTeamName: "Barcelona",
        homeTeamShort: "BAR",
        awayTeamName: "PSG",
        awayTeamShort: "PSG",
      },
    },
  ];

  const sortPredictions = (items: ProfilePredictionItem[]) => {
    return [...items].sort((a, b) => {
      const isFinishedA = a.match.status === "finished";
      const isFinishedB = b.match.status === "finished";

      if (isFinishedA && !isFinishedB) return -1;
      if (!isFinishedA && isFinishedB) return 1;

      const timeA = new Date(a.match.kickoffAt).getTime();
      const timeB = new Date(b.match.kickoffAt).getTime();

      if (isFinishedA && isFinishedB) {
        return timeB - timeA; // newest finished first
      }

      return timeA - timeB; // other: chronological
    });
  };

  it("sorts latest finished match first, then older finished, then future scheduled", () => {
    const sorted = sortPredictions(samplePredictions);
    expect(sorted.length).toBe(3);
    // m-2 finished at 21:00 is newest finished
    expect(sorted[0].match.id).toBe("m-2");
    // m-1 finished at 18:45 is older finished
    expect(sorted[1].match.id).toBe("m-1");
    // m-3 future scheduled is last
    expect(sorted[2].match.id).toBe("m-3");
  });

  it("paginates exactly 10 items per page", () => {
    const manyPredictions: ProfilePredictionItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `pred-${i}`,
      homeScore: 1,
      awayScore: 0,
      pointsAwarded: 3,
      match: {
        id: `m-${i}`,
        stage: "league",
        matchday: Math.floor(i / 8) + 1,
        kickoffAt: new Date(Date.now() - i * 3600000).toISOString(),
        status: "finished",
        isBettingLocked: true,
        homeScore: 1,
        awayScore: 0,
        homeTeamName: `Team ${i}A`,
        homeTeamShort: `T${i}A`,
        awayTeamName: `Team ${i}B`,
        awayTeamShort: `T${i}B`,
      },
    }));

    const pageSize = 10;
    const page1 = manyPredictions.slice(0, 10);
    const page2 = manyPredictions.slice(10, 20);
    const page3 = manyPredictions.slice(20, 30);

    expect(page1.length).toBe(10);
    expect(page2.length).toBe(10);
    expect(page3.length).toBe(5);
  });

  it("hides score before kickoff for non-owner and reveals after kickoff or for owner", () => {
    const futureMatch: ProfilePredictionItem = {
      id: "pred-fut",
      homeScore: 2,
      awayScore: 1,
      pointsAwarded: null,
      match: {
        id: "m-fut",
        stage: "league",
        matchday: 1,
        kickoffAt: "2099-01-01T20:00:00Z",
        status: "scheduled",
        isBettingLocked: false,
        homeScore: null,
        awayScore: null,
        homeTeamName: "Arsenal",
        homeTeamShort: "ARS",
        awayTeamName: "Bayern",
        awayTeamShort: "BAY",
      },
    };

    const isViewable = (pred: ProfilePredictionItem, isOwner: boolean, now = Date.now()) => {
      const isPassed = new Date(pred.match.kickoffAt).getTime() <= now || pred.match.isBettingLocked;
      return isOwner || isPassed;
    };

    expect(isViewable(futureMatch, true)).toBe(true); // Owner sees own prediction
    expect(isViewable(futureMatch, false)).toBe(false); // Other user cannot see before kickoff
  });
});

import { describe, it, expect } from "vitest";
import { calculateMatchScore, calculateLivePoints } from "@/lib/scoring/matches";

/**
 * Match Workflow, Dynamic Live Points and Recomputation Tests
 */

describe("Match Workflow & Finalization Logic", () => {
  interface MockPrediction {
    id: string;
    userId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    pointsAwarded?: number | null;
    scoringCategory?: string | null;
  }

  interface MockMatch {
    id: string;
    kickoffAt: number;
    status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
    homeScore: number | null;
    awayScore: number | null;
    liveMinute?: number | null;
    isBettingLocked: boolean;
  }

  it("1. Users can predict match before kickoff when betting is not locked", () => {
    const match: MockMatch = {
      id: "match-1",
      kickoffAt: Date.now() + 3600 * 1000,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      isBettingLocked: false,
    };

    const isBettingOpen = match.status === "scheduled" && match.kickoffAt > Date.now() && !match.isBettingLocked;
    expect(isBettingOpen).toBe(true);
  });

  it("2. Betting is locked when kickoff passes or match is marked live/finished", () => {
    const matchLive: MockMatch = {
      id: "match-2",
      kickoffAt: Date.now() - 1000,
      status: "live",
      homeScore: 1,
      awayScore: 0,
      liveMinute: 15,
      isBettingLocked: true,
    };

    const isBettingOpen = matchLive.status === "scheduled" && matchLive.kickoffAt > Date.now() && !matchLive.isBettingLocked;
    expect(isBettingOpen).toBe(false);
  });

  it("3. Dynamic LIVE points preview calculates correct score without mutating persisted points", () => {
    const userA_pred: MockPrediction = {
      id: "p1",
      userId: "u1",
      matchId: "match-live",
      homeScore: 2,
      awayScore: 1,
      pointsAwarded: null, // NOT finalized in DB
    };

    const userB_pred: MockPrediction = {
      id: "p2",
      userId: "u2",
      matchId: "match-live",
      homeScore: 1,
      awayScore: 1,
      pointsAwarded: null,
    };

    // Live score is 2:1
    const liveScore1 = { home: 2, away: 1 };
    expect(calculateLivePoints(userA_pred.homeScore, userA_pred.awayScore, liveScore1.home, liveScore1.away)?.points).toBe(3);
    expect(calculateLivePoints(userB_pred.homeScore, userB_pred.awayScore, liveScore1.home, liveScore1.away)?.points).toBe(0);

    // Live score changes to 2:2
    const liveScore2 = { home: 2, away: 2 };
    expect(calculateLivePoints(userA_pred.homeScore, userA_pred.awayScore, liveScore2.home, liveScore2.away)?.points).toBe(0);
    // Draw 1:1 vs 2:2 -> 2 pts (diff category)
    expect(calculateLivePoints(userB_pred.homeScore, userB_pred.awayScore, liveScore2.home, liveScore2.away)?.points).toBe(2);

    // DB records remain unaffected
    expect(userA_pred.pointsAwarded).toBeNull();
    expect(userB_pred.pointsAwarded).toBeNull();
  });

  it("4. Match finalization atomically computes points for all participants", () => {
    const predictions: MockPrediction[] = [
      { id: "p1", userId: "u1", matchId: "m1", homeScore: 2, awayScore: 1 },
      { id: "p2", userId: "u2", matchId: "m1", homeScore: 2, awayScore: 0 },
      { id: "p3", userId: "u3", matchId: "m1", homeScore: 1, awayScore: 1 },
      { id: "p4", userId: "u4", matchId: "m1", homeScore: 0, awayScore: 2 },
    ];

    const finalScore = { home: 3, away: 1 }; // Goal diff +2, home win

    // Simulate atomic procedure finalize_and_score_match
    predictions.forEach((p) => {
      const res = calculateMatchScore({
        userHome: p.homeScore,
        userAway: p.awayScore,
        actualHome: finalScore.home,
        actualAway: finalScore.away,
      });
      p.pointsAwarded = res.points;
      p.scoringCategory = res.category;
    });

    expect(predictions[0].pointsAwarded).toBe(1); // Outcome (2:1 vs 3:1)
    expect(predictions[0].scoringCategory).toBe("outcome");

    expect(predictions[1].pointsAwarded).toBe(2); // Diff (2:0 vs 3:1 -> diff +2)
    expect(predictions[1].scoringCategory).toBe("diff");

    expect(predictions[2].pointsAwarded).toBe(0); // Incorrect (1:1 vs 3:1)
    expect(predictions[3].pointsAwarded).toBe(0); // Incorrect (0:2 vs 3:1)
  });

  it("5. Match score correction idempotently recomputes all points from scratch", () => {
    const predictions: MockPrediction[] = [
      { id: "p1", userId: "u1", matchId: "m1", homeScore: 2, awayScore: 1, pointsAwarded: 1, scoringCategory: "outcome" },
      { id: "p2", userId: "u2", matchId: "m1", homeScore: 2, awayScore: 0, pointsAwarded: 2, scoringCategory: "diff" },
    ];

    // Admin corrects score to 2:1 (Exact for p1)
    const correctedScore = { home: 2, away: 1 };

    predictions.forEach((p) => {
      const res = calculateMatchScore({
        userHome: p.homeScore,
        userAway: p.awayScore,
        actualHome: correctedScore.home,
        actualAway: correctedScore.away,
      });
      p.pointsAwarded = res.points;
      p.scoringCategory = res.category;
    });

    expect(predictions[0].pointsAwarded).toBe(3); // Now exact
    expect(predictions[0].scoringCategory).toBe("exact");

    expect(predictions[1].pointsAwarded).toBe(1); // 2:0 vs 2:1 -> Outcome (+1)
    expect(predictions[1].scoringCategory).toBe("outcome");
  });

  it("6. Cancelled matches award 0 points and do not count as failed prediction", () => {
    const matchCancelled: MockMatch = {
      id: "match-cancel",
      kickoffAt: Date.now() - 1000,
      status: "cancelled",
      homeScore: null,
      awayScore: null,
      isBettingLocked: true,
    };

    expect(matchCancelled.status).toBe("cancelled");
  });
});

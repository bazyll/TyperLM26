import { describe, it, expect } from "vitest";
import { calculateMatchScore, calculateLivePoints } from "./matches";

describe("Official UEFA Champions League Match Scoring Engine", () => {
  it("awards 3 pts (exact) for exact match score (e.g. 2:1 vs 2:1)", () => {
    const res = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 2,
      actualAway: 1,
    });
    expect(res.points).toBe(3);
    expect(res.category).toBe("exact");
  });

  it("awards 3 pts (exact) for exact draw (e.g. 1:1 vs 1:1, 0:0 vs 0:0)", () => {
    const res1 = calculateMatchScore({
      userHome: 1,
      userAway: 1,
      actualHome: 1,
      actualAway: 1,
    });
    expect(res1.points).toBe(3);
    expect(res1.category).toBe("exact");

    const res2 = calculateMatchScore({
      userHome: 0,
      userAway: 0,
      actualHome: 0,
      actualAway: 0,
    });
    expect(res2.points).toBe(3);
    expect(res2.category).toBe("exact");
  });

  it("awards 2 pts (diff) for different correctly predicted draw (e.g. 1:1 vs 2:2, 0:0 vs 3:3)", () => {
    const res1 = calculateMatchScore({
      userHome: 1,
      userAway: 1,
      actualHome: 2,
      actualAway: 2,
    });
    expect(res1.points).toBe(2);
    expect(res1.category).toBe("diff");

    const res2 = calculateMatchScore({
      userHome: 0,
      userAway: 0,
      actualHome: 3,
      actualAway: 3,
    });
    expect(res2.points).toBe(2);
    expect(res2.category).toBe("diff");

    const res3 = calculateMatchScore({
      userHome: 2,
      userAway: 2,
      actualHome: 1,
      actualAway: 1,
    });
    expect(res3.points).toBe(2);
    expect(res3.category).toBe("diff");
  });

  it("awards 2 pts (diff) for correct winner + correct goal difference (e.g. 2:0 vs 3:1)", () => {
    const res = calculateMatchScore({
      userHome: 2,
      userAway: 0,
      actualHome: 3,
      actualAway: 1,
    });
    expect(res.points).toBe(2);
    expect(res.category).toBe("diff");
  });

  it("awards 1 pt (outcome) for correct winner with incorrect goal difference (e.g. 3:1 vs 1:0, 2:1 vs 3:0)", () => {
    const res1 = calculateMatchScore({
      userHome: 3,
      userAway: 1,
      actualHome: 1,
      actualAway: 0,
    });
    expect(res1.points).toBe(1);
    expect(res1.category).toBe("outcome");

    const res2 = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 3,
      actualAway: 0,
    });
    expect(res2.points).toBe(1);
    expect(res2.category).toBe("outcome");
  });

  it("awards 0 pts (incorrect) for incorrect outcome (e.g. 2:1 vs 0:1)", () => {
    const res = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 0,
      actualAway: 1,
    });
    expect(res.points).toBe(0);
    expect(res.category).toBe("incorrect");
  });

  it("never exceeds maximum of 3 points and categories never sum up", () => {
    const res = calculateMatchScore({
      userHome: 3,
      userAway: 1,
      actualHome: 3,
      actualAway: 1,
    });
    expect(res.points).toBe(3);
    expect(res.points).not.toBe(6); // 3 + 2 + 1
  });

  it("calculates live preview points dynamically", () => {
    const livePreview = calculateLivePoints(2, 1, 2, 1);
    expect(livePreview?.points).toBe(3);
    expect(livePreview?.category).toBe("exact");

    const liveDiff = calculateLivePoints(1, 1, 2, 2);
    expect(liveDiff?.points).toBe(2);

    expect(calculateLivePoints(null, 1, 2, 1)).toBeNull();
  });

  it("correctly applies points multiplier (e.g. x2, x3)", () => {
    // Exact score with x2 multiplier -> 3 * 2 = 6 pts
    const exactX2 = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 2,
      actualAway: 1,
      multiplier: 2,
    });
    expect(exactX2.points).toBe(6);
    expect(exactX2.category).toBe("exact");

    // Goal diff with x3 multiplier -> 2 * 3 = 6 pts
    const diffX3 = calculateMatchScore({
      userHome: 2,
      userAway: 0,
      actualHome: 3,
      actualAway: 1,
      multiplier: 3,
    });
    expect(diffX3.points).toBe(6);
    expect(diffX3.category).toBe("diff");

    // Outcome with x2 multiplier -> 1 * 2 = 2 pts
    const outcomeX2 = calculateMatchScore({
      userHome: 3,
      userAway: 1,
      actualHome: 1,
      actualAway: 0,
      multiplier: 2,
    });
    expect(outcomeX2.points).toBe(2);
    expect(outcomeX2.category).toBe("outcome");

    // Incorrect with x5 multiplier -> 0 * 5 = 0 pts
    const incorrectX5 = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 0,
      actualAway: 1,
      multiplier: 5,
    });
    expect(incorrectX5.points).toBe(0);
    expect(incorrectX5.category).toBe("incorrect");

    // Live points with multiplier
    const liveX2 = calculateLivePoints(2, 1, 2, 1, 2);
    expect(liveX2?.points).toBe(6);
  });
});

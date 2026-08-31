import { describe, it, expect } from "vitest";
import { calculateMatchScore } from "./matches";

describe("Match Scoring Logic (Max 3 points, No summing)", () => {
  it("awards 3 points for exact score (home win)", () => {
    const result = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 2,
      actualAway: 1,
    });
    expect(result.points).toBe(3);
    expect(result.category).toBe("exact");
  });

  it("awards 3 points for exact score (draw)", () => {
    const result = calculateMatchScore({
      userHome: 2,
      userAway: 2,
      actualHome: 2,
      actualAway: 2,
    });
    expect(result.points).toBe(3);
    expect(result.category).toBe("exact");
  });

  it("awards 2 points for correct goal difference (home win)", () => {
    // Prediction 2:0, Result 3:1 (both diff +2, home won)
    const result = calculateMatchScore({
      userHome: 2,
      userAway: 0,
      actualHome: 3,
      actualAway: 1,
    });
    expect(result.points).toBe(2);
    expect(result.category).toBe("diff");
  });

  it("awards 2 points for correct goal difference (away win)", () => {
    // Prediction 1:3, Result 0:2 (both diff -2, away won)
    const result = calculateMatchScore({
      userHome: 1,
      userAway: 3,
      actualHome: 0,
      actualAway: 2,
    });
    expect(result.points).toBe(2);
    expect(result.category).toBe("diff");
  });

  it("awards 1 point for correct winner with different goal difference", () => {
    // Prediction 2:1 (diff +1), Result 3:0 (diff +3) -> only 1 pt
    const result = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 3,
      actualAway: 0,
    });
    expect(result.points).toBe(1);
    expect(result.category).toBe("outcome");
  });

  it("awards 1 point for predicted draw when result is a different draw", () => {
    // Prediction 1:1, Result 2:2 -> 1 pt
    const result = calculateMatchScore({
      userHome: 1,
      userAway: 1,
      actualHome: 2,
      actualAway: 2,
    });
    expect(result.points).toBe(1);
    expect(result.category).toBe("outcome");
  });

  it("awards 0 points for completely wrong outcome", () => {
    // Prediction 2:1 (home win), Result 0:1 (away win)
    const result = calculateMatchScore({
      userHome: 2,
      userAway: 1,
      actualHome: 0,
      actualAway: 1,
    });
    expect(result.points).toBe(0);
    expect(result.category).toBe("incorrect");
  });

  it("awards 0 points when predicted draw but match had a winner", () => {
    // Prediction 1:1, Result 1:0
    const result = calculateMatchScore({
      userHome: 1,
      userAway: 1,
      actualHome: 1,
      actualAway: 0,
    });
    expect(result.points).toBe(0);
    expect(result.category).toBe("incorrect");
  });
});

import { describe, it, expect } from "vitest";
import { calculateSpecialPredictionScore } from "./special";

describe("Special Predictions Scoring Logic", () => {
  it("awards 20 points for exact team match", () => {
    const score = calculateSpecialPredictionScore({
      targetType: "team",
      userTeamId: "team-real-madrid",
      correctTeamId: "team-real-madrid",
    });
    expect(score).toBe(20);
  });

  it("awards 0 points for incorrect team match", () => {
    const score = calculateSpecialPredictionScore({
      targetType: "team",
      userTeamId: "team-arsenal",
      correctTeamId: "team-real-madrid",
    });
    expect(score).toBe(0);
  });

  it("awards 20 points for exact player match", () => {
    const score = calculateSpecialPredictionScore({
      targetType: "player",
      userPlayerId: "player-haaland",
      correctPlayerId: "player-haaland",
    });
    expect(score).toBe(20);
  });

  it("awards 0 points for incorrect player match", () => {
    const score = calculateSpecialPredictionScore({
      targetType: "player",
      userPlayerId: "player-kane",
      correctPlayerId: "player-haaland",
    });
    expect(score).toBe(0);
  });
});

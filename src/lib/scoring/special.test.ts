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

  it("awards 20 points when user's player choice is one of multiple joint winners (tie)", () => {
    // Both Vinicius and De Bruyne tied for most assists
    const score1 = calculateSpecialPredictionScore({
      targetType: "player",
      userPlayerId: "player-vinicius",
      correctPlayerIds: ["player-vinicius", "player-debruyne"],
    });
    expect(score1).toBe(20);

    const score2 = calculateSpecialPredictionScore({
      targetType: "player",
      userPlayerId: "player-debruyne",
      correctPlayerIds: ["player-vinicius", "player-debruyne"],
    });
    expect(score2).toBe(20);

    const score3 = calculateSpecialPredictionScore({
      targetType: "player",
      userPlayerId: "player-salah",
      correctPlayerIds: ["player-vinicius", "player-debruyne"],
    });
    expect(score3).toBe(0);
  });

  it("awards 20 points when user's team choice is one of multiple joint winners (tie)", () => {
    // Both Arsenal and Inter tied for most clean sheets
    const score1 = calculateSpecialPredictionScore({
      targetType: "team",
      userTeamId: "team-arsenal",
      correctTeamIds: ["team-arsenal", "team-inter"],
    });
    expect(score1).toBe(20);

    const score2 = calculateSpecialPredictionScore({
      targetType: "team",
      userTeamId: "team-inter",
      correctTeamIds: ["team-arsenal", "team-inter"],
    });
    expect(score2).toBe(20);

    const score3 = calculateSpecialPredictionScore({
      targetType: "team",
      userTeamId: "team-barcelona",
      correctTeamIds: ["team-arsenal", "team-inter"],
    });
    expect(score3).toBe(0);
  });
});

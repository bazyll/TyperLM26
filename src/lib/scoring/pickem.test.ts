import { describe, it, expect } from "vitest";
import { calculatePickemScore, validatePickemSubmission } from "./pickem";

describe("Pick'em Validation & Scoring Logic", () => {
  // Generate 36 mock team IDs: "team-1", "team-2", ..., "team-36"
  const mock36Teams = Array.from({ length: 36 }, (_, i) => `team-${i + 1}`);

  it("validates valid submission with 1 FIRST, 7 TOP 8, 8 OUT (all disjoint)", () => {
    const submission = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-29",
        "team-30",
        "team-31",
        "team-32",
        "team-33",
        "team-34",
        "team-35",
        "team-36",
      ],
    };

    const validation = validatePickemSubmission(submission, mock36Teams);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("rejects duplicate team between FIRST and TOP 8", () => {
    const submission = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-1", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-29",
        "team-30",
        "team-31",
        "team-32",
        "team-33",
        "team-34",
        "team-35",
        "team-36",
      ],
    };

    const validation = validatePickemSubmission(submission, mock36Teams);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("powtórzona w TOP 8"))).toBe(true);
  });

  it("rejects duplicate team between TOP 8 and OUT", () => {
    const submission = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-2", // Duplicate!
        "team-30",
        "team-31",
        "team-32",
        "team-33",
        "team-34",
        "team-35",
        "team-36",
      ],
    };

    const validation = validatePickemSubmission(submission, mock36Teams);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("jednocześnie w TOP 8 i OUT"))).toBe(true);
  });

  it("calculates perfect 100% Pick'em score correctly", () => {
    // Standings 1..36:
    // team-1: rank 1 (FIRST hit)
    // team-2..team-8: rank 2..8 (7 TOP8 hits)
    // team-9..team-24: rank 9..24 (16 MIDDLE hits in playoff zone)
    // team-25..team-36: rank 25..36 (8 OUT hits from user selection)
    const submission = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-29",
        "team-30",
        "team-31",
        "team-32",
        "team-33",
        "team-34",
        "team-35",
        "team-36",
      ],
    };

    const score = calculatePickemScore(submission, mock36Teams);
    expect(score.firstPlaceHit).toBe(true);
    expect(score.firstPlacePoints).toBe(3);
    expect(score.top8HitsCount).toBe(7);
    expect(score.top8Points).toBe(21); // 7 * 3
    expect(score.outHitsCount).toBe(8);
    expect(score.outPoints).toBe(24); // 8 * 3
    expect(score.middleHitsCount).toBe(16); // 16 teams correctly placed in ranks 9..24
    expect(score.middlePoints).toBe(48); // 16 * 3
    expect(score.totalPoints).toBe(96); // 3 + 21 + 24 + 48 = 96
  });

  it("calculates partial hits when standings vary", () => {
    // Reverse standings completely
    const reversedStandings = [...mock36Teams].reverse();
    const submission = {
      firstTeamId: "team-1", // actual rank is 36 (not rank 1) -> 0 pts
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-29",
        "team-30",
        "team-31",
        "team-32",
        "team-33",
        "team-34",
        "team-35",
        "team-36",
      ],
    };

    const score = calculatePickemScore(submission, reversedStandings);
    expect(score.firstPlaceHit).toBe(false);
    expect(score.firstPlacePoints).toBe(0);
  });

  it("applies points multiplier to Pick'em scoring (e.g. x2)", () => {
    const submission = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-29",
        "team-30",
        "team-31",
        "team-32",
        "team-33",
        "team-34",
        "team-35",
        "team-36",
      ],
    };

    const scoreX2 = calculatePickemScore(submission, mock36Teams, 2);
    expect(scoreX2.firstPlacePoints).toBe(6); // 3 * 2
    expect(scoreX2.top8Points).toBe(42); // 21 * 2
    expect(scoreX2.outPoints).toBe(48); // 24 * 2
    expect(scoreX2.middlePoints).toBe(96); // 48 * 2
    expect(scoreX2.totalPoints).toBe(192); // 96 * 2
  });
});

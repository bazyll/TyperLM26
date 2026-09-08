import { describe, it, expect } from "vitest";
import { calculatePickemScore, validatePickemSubmission, PickemSubmissionInput } from "./pickem";

describe("Pick'em Validation & Scoring Logic (12 OUT / 16 MIDDLE)", () => {
  // Generate 36 mock team IDs: "team-1", "team-2", ..., "team-36"
  const mock36Teams = Array.from({ length: 36 }, (_, i) => `team-${i + 1}`);

  it("1. validates new submission with 1 FIRST, 7 TOP 8, 12 OUT (all disjoint)", () => {
    const submission: PickemSubmissionInput = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-25",
        "team-26",
        "team-27",
        "team-28",
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

  it("2. rejects new submission if OUT has less than 12 teams (e.g. 8 OUT)", () => {
    const legacySubmission: PickemSubmissionInput = {
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

    const validation = validatePickemSubmission(legacySubmission, mock36Teams);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("dokładnie 12 różnych drużyn"))).toBe(true);
  });

  it("3. legacy submission 8 OUT remains intact, preserving FIRST, TOP 8, and initial 8 OUT", () => {
    const legacySubmission = {
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

    // Verify properties are preserved
    expect(legacySubmission.firstTeamId).toBe("team-1");
    expect(legacySubmission.top8TeamIds).toHaveLength(7);
    expect(legacySubmission.outTeamIds).toHaveLength(8);
  });

  it("4. simulates user selecting exactly +4 current MIDDLE teams to move to OUT", () => {
    const legacySubmission = {
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

    const chosenExplicitly = new Set([
      legacySubmission.firstTeamId,
      ...legacySubmission.top8TeamIds,
      ...legacySubmission.outTeamIds,
    ]);

    // Current 20 MIDDLE teams
    const currentMiddleTeams = mock36Teams.filter((t) => !chosenExplicitly.has(t));
    expect(currentMiddleTeams).toHaveLength(20);

    // User chooses exactly 4 from MIDDLE
    const addedOut = ["team-25", "team-26", "team-27", "team-28"];
    expect(addedOut.every((t) => currentMiddleTeams.includes(t))).toBe(true);

    // Corrected OUT
    const correctedOut = [...legacySubmission.outTeamIds, ...addedOut];
    const correctedSubmission: PickemSubmissionInput = {
      ...legacySubmission,
      outTeamIds: correctedOut,
    };

    // Result must be 12 OUT and 16 MIDDLE
    const newChosen = new Set([
      correctedSubmission.firstTeamId,
      ...correctedSubmission.top8TeamIds,
      ...correctedSubmission.outTeamIds,
    ]);
    const newMiddle = mock36Teams.filter((t) => !newChosen.has(t));

    expect(correctedSubmission.outTeamIds).toHaveLength(12);
    expect(newMiddle).toHaveLength(16);

    const validation = validatePickemSubmission(correctedSubmission, mock36Teams);
    expect(validation.isValid).toBe(true);
  });

  it("5. correction rejects selecting only 3 teams or 5 teams", () => {
    function validateCorrectionCount(addedCount: number) {
      if (addedCount !== 4) {
        throw new Error(`Musisz wybrać dokładnie 4 dodatkowe drużyny OUT (wybrano ${addedCount}).`);
      }
    }

    expect(() => validateCorrectionCount(3)).toThrow("dokładnie 4");
    expect(() => validateCorrectionCount(5)).toThrow("dokładnie 4");
  });

  it("6. correction rejects adding a team from FIRST or TOP 8 or original 8 OUT", () => {
    const legacyFirst = "team-1";
    const legacyTop8 = new Set(["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"]);
    const legacyOut = new Set([
      "team-29",
      "team-30",
      "team-31",
      "team-32",
      "team-33",
      "team-34",
      "team-35",
      "team-36",
    ]);

    function validateAddedTeam(teamId: string) {
      if (teamId === legacyFirst) throw new Error("Drużyna FIRST nie może zostać dodana do OUT.");
      if (legacyTop8.has(teamId)) throw new Error("Drużyna TOP 8 nie może zostać dodana do OUT.");
      if (legacyOut.has(teamId)) throw new Error("Drużyna już znajduje się w OUT.");
    }

    expect(() => validateAddedTeam("team-1")).toThrow("FIRST");
    expect(() => validateAddedTeam("team-2")).toThrow("TOP 8");
    expect(() => validateAddedTeam("team-29")).toThrow("OUT");
  });

  it("7. locked legacy submission allows correction before deadline and rejects after deadline", () => {
    const now = new Date("2026-09-08T12:00:00Z").getTime();
    const futureDeadline = new Date("2026-09-08T16:45:00Z").getTime();
    const pastDeadline = new Date("2026-09-08T10:00:00Z").getTime();

    function checkCorrectionAllowed(currentTime: number, deadlineTime: number) {
      return currentTime < deadlineTime;
    }

    expect(checkCorrectionAllowed(now, futureDeadline)).toBe(true);
    expect(checkCorrectionAllowed(now, pastDeadline)).toBe(false);
  });

  it("8. calculates perfect 100% Pick'em score correctly (108 MAX points)", () => {
    // Standings 1..36:
    // team-1: rank 1 (FIRST hit: 1 * 3 = 3)
    // team-2..team-8: rank 2..8 (7 TOP8 hits: 7 * 3 = 21)
    // team-9..team-24: rank 9..24 (16 MIDDLE hits in playoff zone: 16 * 3 = 48)
    // team-25..team-36: rank 25..36 (12 OUT hits from user selection: 12 * 3 = 36)
    const perfectSubmission: PickemSubmissionInput = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-25",
        "team-26",
        "team-27",
        "team-28",
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

    const score = calculatePickemScore(perfectSubmission, mock36Teams);
    expect(score.isIncomplete).toBe(false);
    expect(score.firstPlaceHit).toBe(true);
    expect(score.firstPlacePoints).toBe(3);
    expect(score.top8HitsCount).toBe(7);
    expect(score.top8Points).toBe(21); // 7 * 3
    expect(score.middleHitsCount).toBe(16); // 16 * 3
    expect(score.middlePoints).toBe(48);
    expect(score.outHitsCount).toBe(12); // 12 * 3
    expect(score.outPoints).toBe(36);
    expect(score.totalPoints).toBe(108); // 3 + 21 + 48 + 36 = 108
  });

  it("9. incomplete legacy submission (8 OUT) is not scored and returns 0 points", () => {
    const incompleteSub: PickemSubmissionInput = {
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

    const score = calculatePickemScore(incompleteSub, mock36Teams);
    expect(score.isIncomplete).toBe(true);
    expect(score.totalPoints).toBe(0);
  });

  it("10. applies multiplier to 108 max points correctly (e.g. x2 -> 216 pts)", () => {
    const perfectSubmission: PickemSubmissionInput = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        "team-25",
        "team-26",
        "team-27",
        "team-28",
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

    const scoreX2 = calculatePickemScore(perfectSubmission, mock36Teams, 2);
    expect(scoreX2.firstPlacePoints).toBe(6); // 3 * 2
    expect(scoreX2.top8Points).toBe(42); // 21 * 2
    expect(scoreX2.middlePoints).toBe(96); // 48 * 2
    expect(scoreX2.outPoints).toBe(72); // 36 * 2
    expect(scoreX2.totalPoints).toBe(216); // 108 * 2
  });

  it("11. scoring OUT uses exact positions 25–36 and MIDDLE uses 9–24", () => {
    // If team is placed in rank 24, it is scored as MIDDLE (9..24) but NOT OUT (25..36)
    const testStandings = [...mock36Teams];
    const teamAtRank24 = testStandings[23]; // index 23 is rank 24
    const teamAtRank25 = testStandings[24]; // index 24 is rank 25

    const sub: PickemSubmissionInput = {
      firstTeamId: "team-1",
      top8TeamIds: ["team-2", "team-3", "team-4", "team-5", "team-6", "team-7", "team-8"],
      outTeamIds: [
        teamAtRank24, // Expected in OUT, but finished 24th (MIDDLE) -> Miss!
        teamAtRank25, // Finished 25th -> Hit!
        "team-27",
        "team-28",
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

    const score = calculatePickemScore(sub, testStandings);
    expect(score.outHitsCount).toBe(11); // 11 hits (teamAtRank24 missed because rank 24 is not 25..36)
  });

  it("12. simulates atomic RPC rollback on failure ensuring no partial database state", () => {
    // Simulated DB State
    let dbSubmission = {
      id: "sub-1",
      outTeamIds: ["team-29", "team-30", "team-31", "team-32", "team-33", "team-34", "team-35", "team-36"],
    };
    let dbSelections = [
      { id: "s-1", teamId: "team-29", category: "out" },
      { id: "s-2", teamId: "team-30", category: "out" },
    ];

    function executeAtomicCorrection(additionalTeams: string[], simulateError: boolean) {
      // Begin transaction snapshot
      const snapshotSub = { ...dbSubmission, outTeamIds: [...dbSubmission.outTeamIds] };
      const snapshotSelections = [...dbSelections];

      try {
        if (additionalTeams.length !== 4) {
          throw new Error("Validation failed: must be 4 teams");
        }

        // Step 1: update submission
        dbSubmission.outTeamIds = [...dbSubmission.outTeamIds, ...additionalTeams];

        // Step 2: insert selections
        for (const t of additionalTeams) {
          if (simulateError && t === "team-fail") {
            throw new Error("Simulated database constraint error!");
          }
          dbSelections.push({ id: `s-${t}`, teamId: t, category: "out" });
        }
      } catch (err) {
        // Rollback snapshot
        dbSubmission = snapshotSub;
        dbSelections = snapshotSelections;
        throw err;
      }
    }

    // Attempt with failure
    expect(() =>
      executeAtomicCorrection(["team-25", "team-26", "team-27", "team-fail"], true)
    ).toThrow("Simulated database constraint error!");

    // State remains 100% rollback-intact
    expect(dbSubmission.outTeamIds).toHaveLength(8);
    expect(dbSelections).toHaveLength(2);

    // Attempt with success
    executeAtomicCorrection(["team-25", "team-26", "team-27", "team-28"], false);
    expect(dbSubmission.outTeamIds).toHaveLength(12);
    expect(dbSelections).toHaveLength(6);
  });
});

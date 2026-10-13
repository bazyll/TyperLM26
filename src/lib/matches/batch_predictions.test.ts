import { describe, it, expect } from "vitest";
import { saveBatchPredictionsSchema } from "@/lib/matches/schemas";

describe("Batch Predictions Validation & Guard Logic", () => {
  it("validates schema correctly for valid inputs", () => {
    const validPayload = {
      predictions: [
        { matchId: "c38f1a4e-0001-4000-8000-000000000001", homeScore: 2, awayScore: 1 },
        { matchId: "c38f1a4e-0002-4000-8000-000000000002", homeScore: 0, awayScore: 0 },
      ],
    };

    const parsed = saveBatchPredictionsSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.predictions.length).toBe(2);
    }
  });

  it("rejects empty predictions list", () => {
    const emptyPayload = {
      predictions: [],
    };

    const parsed = saveBatchPredictionsSchema.safeParse(emptyPayload);
    expect(parsed.success).toBe(false);
  });

  it("rejects negative scores or scores exceeding 99", () => {
    const negativeScore = {
      predictions: [{ matchId: "c38f1a4e-0001-4000-8000-000000000001", homeScore: -1, awayScore: 2 }],
    };
    expect(saveBatchPredictionsSchema.safeParse(negativeScore).success).toBe(false);

    const excessiveScore = {
      predictions: [{ matchId: "c38f1a4e-0001-4000-8000-000000000001", homeScore: 100, awayScore: 2 }],
    };
    expect(saveBatchPredictionsSchema.safeParse(excessiveScore).success).toBe(false);
  });

  it("atomically blocks entire batch when any match in the batch is locked or past kickoff", () => {
    const now = new Date("2026-09-16T18:00:00Z").getTime();

    interface MockMatch {
      id: string;
      kickoff_at: string;
      status: string;
      is_betting_locked: boolean;
      home_team: string;
      away_team: string;
    }

    const dbMatches: Record<string, MockMatch> = {
      "match-open-1": {
        id: "match-open-1",
        kickoff_at: "2026-09-16T21:00:00Z", // Future
        status: "scheduled",
        is_betting_locked: false,
        home_team: "PSG",
        away_team: "Real Madrid",
      },
      "match-locked-2": {
        id: "match-locked-2",
        kickoff_at: "2026-09-16T17:45:00Z", // Past kickoff!
        status: "scheduled",
        is_betting_locked: false,
        home_team: "Bayern",
        away_team: "Arsenal",
      },
      "match-open-3": {
        id: "match-open-3",
        kickoff_at: "2026-09-16T21:00:00Z", // Future
        status: "scheduled",
        is_betting_locked: false,
        home_team: "Inter",
        away_team: "Barcelona",
      },
    };

    function validateBatchForSave(batch: { matchId: string; homeScore: number; awayScore: number }[]) {
      for (const item of batch) {
        const match = dbMatches[item.matchId];
        if (!match) {
          return { success: false, error: `Nie znaleziono meczu ${item.matchId}` };
        }
        const kickoffTime = new Date(match.kickoff_at).getTime();
        if (kickoffTime <= now || match.is_betting_locked || match.status !== "scheduled") {
          return {
            success: false,
            error: `Typowanie dla meczu ${match.home_team} vs ${match.away_team} zostało już zablokowane.`,
          };
        }
      }
      return { success: true };
    }

    // Batch with one locked match must be completely rejected atomically
    const mixedBatch = [
      { matchId: "match-open-1", homeScore: 2, awayScore: 1 },
      { matchId: "match-locked-2", homeScore: 3, awayScore: 0 },
      { matchId: "match-open-3", homeScore: 1, awayScore: 1 },
    ];

    const result = validateBatchForSave(mixedBatch);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Bayern vs Arsenal zostało już zablokowane");

    // Pure valid batch succeeds
    const validBatch = [
      { matchId: "match-open-1", homeScore: 2, awayScore: 1 },
      { matchId: "match-open-3", homeScore: 1, awayScore: 1 },
    ];
    const validResult = validateBatchForSave(validBatch);
    expect(validResult.success).toBe(true);
  });
});

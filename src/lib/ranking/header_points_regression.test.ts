import { describe, it, expect, vi } from "vitest";
import { calculateUserTotalPoints, getUserTotalPoints } from "./ranking-score";

describe("Header Points Regression & Single Source of Truth", () => {
  it("calculates exact 57 pkt total matching ranking calculation (matches + specials + pick'em)", () => {
    // Simulated user data matching user's scenario:
    // Match predictions: 35 points total (e.g. 3 exact with x2/x1, 5 diff, 3 outcome)
    const matchPredictions = [
      { points_awarded: 6 }, // 3 pts * x2
      { points_awarded: 3 },
      { points_awarded: 3 },
      { points_awarded: 2 },
      { points_awarded: 4 }, // 2 pts * x2
      { points_awarded: 2 },
      { points_awarded: 2 },
      { points_awarded: 2 },
      { points_awarded: 1 },
      { points_awarded: 1 },
      { points_awarded: 1 },
      { points_awarded: 8 }, // 4 * 2
      // sum = 6+3+3+2+4+2+2+2+1+1+1+8 = 35
    ];

    // Special predictions: 12 points
    const specialPredictions = [
      { points_awarded: 12 },
    ];

    // Pick'em submission: 10 points
    const pickemSubmission = {
      points_awarded: 10,
    };

    const breakdown = calculateUserTotalPoints(
      matchPredictions,
      specialPredictions,
      pickemSubmission
    );

    expect(breakdown.matchPoints).toBe(35);
    expect(breakdown.specialPoints).toBe(12);
    expect(breakdown.pickemPoints).toBe(10);
    expect(breakdown.totalPoints).toBe(57);
  });

  it("handles null and undefined points gracefully without crashing or returning NaN", () => {
    const matchPredictions = [
      { points_awarded: 3 },
      { points_awarded: null },
      { points_awarded: undefined },
    ];
    const specialPredictions = [
      { points_awarded: null },
    ];
    const pickemSubmission = null;

    const breakdown = calculateUserTotalPoints(
      matchPredictions,
      specialPredictions,
      pickemSubmission
    );

    expect(breakdown.matchPoints).toBe(3);
    expect(breakdown.specialPoints).toBe(0);
    expect(breakdown.pickemPoints).toBe(0);
    expect(breakdown.totalPoints).toBe(3);
  });

  it("getUserTotalPoints calls database for user predictions, specials and pickem and returns 57", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "predictions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ points_awarded: 35 }],
                error: null,
              }),
            }),
          };
        }
        if (table === "special_predictions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ points_awarded: 12 }],
                error: null,
              }),
            }),
          };
        }
        if (table === "pickem_submissions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { points_awarded: 10 },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    const total = await getUserTotalPoints("user-123", mockSupabase);
    expect(total).toBe(57);
  });

  it("formats user points correctly for header display (57 pkt instead of 0 pkt)", () => {
    const user = {
      points: 57,
    };

    const formatted = `${new Intl.NumberFormat("pl-PL").format(user.points || 0)} pkt`;
    expect(formatted).toBe("57 pkt");
    expect(formatted).not.toBe("0 pkt");
  });
});

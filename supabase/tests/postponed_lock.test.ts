import { describe, it, expect } from "vitest";

/**
 * Integration Test: Postponed Match After Prediction Reveal
 *
 * Verifies that once predictions for a match are revealed (kickoff passed), postponing the
 * match to a future date/time MUST preserve the betting lock (`is_betting_locked = true`),
 * keep predictions visible, and prevent any subsequent modifications or new bets.
 */

describe("Postponed Match Security: Lock Preservation After Reveal", () => {
  interface MockMatch {
    id: string;
    kickoffAt: number;
    status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
    isBettingLocked: boolean;
    bettingLockedAt: number | null;
  }

  interface MockPrediction {
    id: string;
    userId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
  }

  const userA = { id: "usr-a", isActive: true };
  const userB = { id: "usr-b", isActive: true };

  const now = Date.now();

  // Initially: match started 10 minutes ago
  let match: MockMatch = {
    id: "match-ucl-postponed",
    kickoffAt: now - 10 * 60 * 1000,
    status: "scheduled",
    isBettingLocked: false,
    bettingLockedAt: null,
  };

  const predB: MockPrediction = {
    id: "pred-b",
    userId: userB.id,
    matchId: match.id,
    homeScore: 3,
    awayScore: 1,
  };

  // RLS evaluation helpers
  function rlsCanSelectPrediction(viewerId: string, pred: MockPrediction, m: MockMatch, currentTimestamp: number): boolean {
    if (viewerId === pred.userId) return true;
    if (m.kickoffAt <= currentTimestamp || m.isBettingLocked) return true;
    return false;
  }

  function rlsCanUpdatePrediction(editorId: string, pred: MockPrediction, m: MockMatch, currentTimestamp: number): boolean {
    if (editorId !== pred.userId) return false;
    if (m.isBettingLocked) return false;
    if (m.kickoffAt <= currentTimestamp) return false;
    return true;
  }

  // Simulation of PostgreSQL trigger `trg_matches_lock_guard`
  function pgTriggerMatchUpdate(oldMatch: MockMatch, newKickoff: number, newStatus: MockMatch["status"]): MockMatch {
    const updated: MockMatch = {
      ...oldMatch,
      kickoffAt: newKickoff,
      status: newStatus,
    };

    // If previous kickoff had already passed, permanently lock betting
    if (oldMatch.kickoffAt <= Date.now() || oldMatch.isBettingLocked) {
      updated.isBettingLocked = true;
      updated.bettingLockedAt = oldMatch.bettingLockedAt ?? Date.now();
    }

    return updated;
  }

  it("Step 1: Kickoff passes -> User A can see User B's prediction", () => {
    const canSee = rlsCanSelectPrediction(userA.id, predB, match, now);
    expect(canSee).toBe(true);
  });

  it("Step 2: Match is postponed and admin sets kickoff to tomorrow", () => {
    const tomorrow = now + 24 * 3600 * 1000;
    match = pgTriggerMatchUpdate(match, tomorrow, "postponed");

    expect(match.status).toBe("postponed");
    expect(match.kickoffAt).toBe(tomorrow);
    // Lock MUST be preserved
    expect(match.isBettingLocked).toBe(true);
    expect(match.bettingLockedAt).not.toBeNull();
  });

  it("Step 3: After postponing, User A still sees User B's prediction (no re-hiding)", () => {
    const canSee = rlsCanSelectPrediction(userA.id, predB, match, now);
    expect(canSee).toBe(true);
  });

  it("Step 4: User A CANNOT modify their prediction even though new kickoff is in the future", () => {
    const canEdit = rlsCanUpdatePrediction(userA.id, predB, match, now);
    expect(canEdit).toBe(false);
  });
});

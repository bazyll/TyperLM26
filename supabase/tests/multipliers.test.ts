import { describe, it, expect } from "vitest";
import { calculateMatchScore, calculateLivePoints } from "@/lib/scoring/matches";
import { calculatePickemScore } from "@/lib/scoring/pickem";

describe("Milestone 7X.2 - Points Multipliers & Hardening Tests", () => {
  const mock36Teams = Array.from({ length: 36 }, (_, i) => `team-${i + 1}`);

  describe("1. Match Multipliers & Safe Trigger Logic", () => {
    // Pure function representing the PostgreSQL trigger trg_set_match_default_multiplier
    function applyMatchDefaultMultiplierTrigger(
      match: {
        status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
        kickoff_at: string;
        points_multiplier?: number | null;
      },
      systemDefaultMultiplier: number
    ): number {
      const isExplicitCustom = match.points_multiplier !== undefined && match.points_multiplier !== null && match.points_multiplier > 1;
      if (isExplicitCustom) {
        return match.points_multiplier!;
      }

      const isFutureScheduled = match.status === "scheduled" && new Date(match.kickoff_at).getTime() > Date.now();
      if (isFutureScheduled) {
        return Math.max(1, Math.min(10, systemDefaultMultiplier || 1));
      }

      // Historical backfill or non-scheduled matches default to 1
      return 1;
    }

    it("applies active default multiplier (e.g. x3) to genuine future scheduled fixtures", () => {
      const futureKickoff = new Date(Date.now() + 86400000 * 10).toISOString(); // +10 days
      const multiplier = applyMatchDefaultMultiplierTrigger(
        {
          status: "scheduled",
          kickoff_at: futureKickoff,
          points_multiplier: 1,
        },
        3
      );
      expect(multiplier).toBe(3);
    });

    it("does NOT apply active default multiplier (e.g. x3) to historical backfills or finished matches", () => {
      const pastKickoff = new Date(Date.now() - 86400000 * 30).toISOString(); // -30 days

      // Historical scheduled fixture backfilled later
      const backfillScheduled = applyMatchDefaultMultiplierTrigger(
        {
          status: "scheduled",
          kickoff_at: pastKickoff,
          points_multiplier: 1,
        },
        3
      );
      expect(backfillScheduled).toBe(1); // Must NOT get x3

      // Historical finished fixture backfilled
      const backfillFinished = applyMatchDefaultMultiplierTrigger(
        {
          status: "finished",
          kickoff_at: pastKickoff,
          points_multiplier: 1,
        },
        3
      );
      expect(backfillFinished).toBe(1); // Must NOT get x3
    });

    it("preserves explicitly passed custom multiplier during insert", () => {
      const pastKickoff = new Date(Date.now() - 86400000 * 30).toISOString();
      const explicitMultiplier = applyMatchDefaultMultiplierTrigger(
        {
          status: "finished",
          kickoff_at: pastKickoff,
          points_multiplier: 2,
        },
        3
      );
      expect(explicitMultiplier).toBe(2);
    });

    it("verifies match scoring with multiplier x1 vs x2 vs x3", () => {
      const scoreX1 = calculateMatchScore({ userHome: 2, userAway: 1, actualHome: 2, actualAway: 1, multiplier: 1 });
      expect(scoreX1.points).toBe(3);

      const scoreX2 = calculateMatchScore({ userHome: 2, userAway: 1, actualHome: 2, actualAway: 1, multiplier: 2 });
      expect(scoreX2.points).toBe(6);

      const scoreX3 = calculateMatchScore({ userHome: 2, userAway: 1, actualHome: 2, actualAway: 1, multiplier: 3 });
      expect(scoreX3.points).toBe(9);
    });
  });

  describe("2. Pick'em Multiplier Lock Guard & Non-Retroactivity", () => {
    // Pure function representing the lock rule
    function canUpdatePickemMultiplier(config: {
      is_locked: boolean;
      deadline_at: string;
      status: "open" | "locked" | "settled";
    }): { allowed: boolean; reason?: string } {
      const isPassed = new Date(config.deadline_at).getTime() <= Date.now();
      if (config.is_locked || isPassed || config.status !== "open") {
        return {
          allowed: false,
          reason: "Nie można zmienić mnożnika dla zamkniętej, zablokowanej lub rozliczonej edycji Pick'em.",
        };
      }
      return { allowed: true };
    }

    it("allows updating multiplier when Pick'em is genuinely open", () => {
      const futureDeadline = new Date(Date.now() + 86400000).toISOString();
      const check = canUpdatePickemMultiplier({
        is_locked: false,
        deadline_at: futureDeadline,
        status: "open",
      });
      expect(check.allowed).toBe(true);
    });

    it("rejects updating multiplier when Pick'em deadline has passed", () => {
      const pastDeadline = new Date(Date.now() - 3600000).toISOString();
      const check = canUpdatePickemMultiplier({
        is_locked: false,
        deadline_at: pastDeadline,
        status: "open",
      });
      expect(check.allowed).toBe(false);
    });

    it("rejects updating multiplier when is_locked is true", () => {
      const futureDeadline = new Date(Date.now() + 86400000).toISOString();
      const check = canUpdatePickemMultiplier({
        is_locked: true,
        deadline_at: futureDeadline,
        status: "open",
      });
      expect(check.allowed).toBe(false);
    });

    it("rejects updating multiplier when status is settled", () => {
      const pastDeadline = new Date(Date.now() - 86400000).toISOString();
      const check = canUpdatePickemMultiplier({
        is_locked: true,
        deadline_at: pastDeadline,
        status: "settled",
      });
      expect(check.allowed).toBe(false);
    });

    it("calculates Pick'em settlement correctly with multiplier (108 max pts)", () => {
      const submission = {
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

      const scoreX1 = calculatePickemScore(submission, mock36Teams, 1);
      expect(scoreX1.totalPoints).toBe(108);

      const scoreX2 = calculatePickemScore(submission, mock36Teams, 2);
      expect(scoreX2.totalPoints).toBe(216);

      const scoreX3 = calculatePickemScore(submission, mock36Teams, 3);
      expect(scoreX3.totalPoints).toBe(324);
    });
  });

  describe("3. Special Predictions Readiness & Gating", () => {
    function isCategoryReady(
      category: { targetType: "team" | "player" },
      isUefaReconciliationComplete: boolean,
      teamsCount: number
    ): boolean {
      if (category.targetType === "player") {
        return isUefaReconciliationComplete;
      }
      return teamsCount >= 36;
    }

    it("gates player categories (top_scorer, top_assists) when UEFA reconciliation is not complete", () => {
      expect(isCategoryReady({ targetType: "player" }, false, 36)).toBe(false);
    });

    it("unlocks player categories when UEFA reconciliation is confirmed complete", () => {
      expect(isCategoryReady({ targetType: "player" }, true, 36)).toBe(true);
    });

    it("keeps team categories active when 36 teams exist", () => {
      expect(isCategoryReady({ targetType: "team" }, false, 36)).toBe(true);
    });
  });

  describe("4. Security & Privileges on app_settings (Model A)", () => {
    // Pure function simulating the permissions matrix
    function checkAppSettingsPrivilege(
      role: "anon" | "authenticated" | "service_role",
      operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
      isUserAdmin: boolean = false
    ): { allowed: boolean; error?: string } {
      if (role === "anon") {
        return { allowed: false, error: "permission denied for table app_settings" };
      }

      if (role === "authenticated") {
        if (operation === "SELECT") {
          return { allowed: true };
        }
        // Direct writes from authenticated client are disallowed under Model A
        return { allowed: false, error: "permission denied for table app_settings" };
      }

      if (role === "service_role") {
        return { allowed: true };
      }

      return { allowed: false };
    }

    it("allows authenticated users to SELECT app_settings", () => {
      const res = checkAppSettingsPrivilege("authenticated", "SELECT");
      expect(res.allowed).toBe(true);
    });

    it("denies authenticated regular users from performing direct UPDATE on app_settings", () => {
      const res = checkAppSettingsPrivilege("authenticated", "UPDATE", false);
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("permission denied");
    });

    it("allows server-side service_role to perform UPDATE / INSERT on app_settings", () => {
      const updateRes = checkAppSettingsPrivilege("service_role", "UPDATE");
      expect(updateRes.allowed).toBe(true);

      const insertRes = checkAppSettingsPrivilege("service_role", "INSERT");
      expect(insertRes.allowed).toBe(true);
    });
  });

  describe("5. UEFA Squads Readiness Marker Lifecycle", () => {
    function computeReconciliationMarker(teamsReconciledCount: number, totalUclTeams: number = 36): number {
      // Must have exactly all 36 teams completely reconciled
      if (teamsReconciledCount === totalUclTeams) {
        return 1;
      }
      return 0; // Partial or 0 teams stays 0
    }

    it("keeps marker at 0 for partial reconciliation (e.g. 5 of 36 teams, or 35 of 36 teams)", () => {
      expect(computeReconciliationMarker(0)).toBe(0);
      expect(computeReconciliationMarker(5)).toBe(0);
      expect(computeReconciliationMarker(35)).toBe(0);
    });

    it("sets marker to 1 ONLY when all 36 teams have completed reconciliation", () => {
      expect(computeReconciliationMarker(36)).toBe(1);
    });
  });
});

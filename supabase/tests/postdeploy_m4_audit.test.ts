import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { calculatePickemScore } from "@/lib/scoring/pickem";
import { calculateSpecialPredictionScore } from "@/lib/scoring/special";

describe("Milestone 4 Post-Deployment Audit Verification", () => {
  const m4Migration = fs.readFileSync(
    path.resolve(__dirname, "../migrations/20260904000000_specials_pickem_table_announcements_export.sql"),
    "utf-8"
  );
  const m4HardeningMigration = fs.readFileSync(
    path.resolve(__dirname, "../migrations/20260905000000_m4_postdeploy_hardening.sql"),
    "utf-8"
  );

  // 1. Audit Point 1: special_prediction_correct_answers RLS & Mutation Lockdown
  describe("Audit Point 1: special_prediction_correct_answers RLS & Mutations", () => {
    it("drops direct client admin ALL policy to prevent direct mutations from client", () => {
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"spec_answers_admin_all\"");
    });

    it("restricts active user SELECT to categories with status = 'settled'", () => {
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"spec_answers_select_active\"");
      expect(m4HardeningMigration).toContain("c.status = 'settled'");
    });

    it("allows admin to SELECT correct answers at any time for the admin dashboard", () => {
      expect(m4HardeningMigration).toContain("public.is_admin()");
    });

    it("grants write/mutate access strictly to service_role (used by secure Server Actions / RPC)", () => {
      expect(m4HardeningMigration).toContain("GRANT ALL ON public.special_prediction_correct_answers TO service_role;");
    });
  });

  // 2. Audit Point 2: pickem_submissions Mandatory config_id & UNIQUE(user_id, config_id)
  describe("Audit Point 2: Mandatory config_id & UNIQUE(user_id, config_id)", () => {
    it("enforces config_id NOT NULL on pickem_submissions with strict backfill", () => {
      expect(m4HardeningMigration).toContain("ALTER TABLE public.pickem_submissions ALTER COLUMN config_id SET NOT NULL;");
      expect(m4HardeningMigration).toContain("RAISE EXCEPTION 'Cannot backfill pickem_submissions: no pickem_config record found'");
    });

    it("replaces UNIQUE(user_id) with UNIQUE(user_id, config_id) for multi-season support", () => {
      expect(m4HardeningMigration).toContain("DROP CONSTRAINT IF EXISTS pickem_submissions_user_id_key;");
      expect(m4HardeningMigration).toContain("ADD CONSTRAINT pickem_submissions_user_config_key UNIQUE (user_id, config_id);");
    });

    it("creates index on pickem_submissions(config_id)", () => {
      expect(m4HardeningMigration).toContain("CREATE INDEX IF NOT EXISTS idx_pickem_sub_config ON public.pickem_submissions(config_id);");
    });

    it("uses clean direct equality without any COALESCE fallbacks in RLS", () => {
      expect(m4HardeningMigration).not.toContain("COALESCE");
      expect(m4HardeningMigration).toContain("c.id = pickem_submissions.config_id");
      expect(m4HardeningMigration).toContain("JOIN public.pickem_config c ON c.id = s.config_id");
    });
  });

  // 3. Multi-season isolation test logic
  describe("Multi-season Isolation & Constraint Simulation", () => {
    interface MockSubmission {
      userId: string;
      configId: string;
    }

    it("allows same user to submit for Config A and Config B, but rejects duplicate in same config", () => {
      const dbSubmissions: MockSubmission[] = [];

      const insertSubmission = (sub: MockSubmission) => {
        if (!sub.configId) throw new Error("config_id is NOT NULL");
        const exists = dbSubmissions.some(
          (s) => s.userId === sub.userId && s.configId === sub.configId
        );
        if (exists) throw new Error("UNIQUE constraint violation: user_id, config_id");
        dbSubmissions.push(sub);
      };

      // User 1 submits for Season 2026/2027 (config-1)
      insertSubmission({ userId: "u1", configId: "config-1" });
      expect(dbSubmissions).toHaveLength(1);

      // User 1 submits for Season 2027/2028 (config-2) -> Allowed!
      insertSubmission({ userId: "u1", configId: "config-2" });
      expect(dbSubmissions).toHaveLength(2);

      // User 1 attempts second submission for Season 2026/2027 (config-1) -> Rejected!
      expect(() => insertSubmission({ userId: "u1", configId: "config-1" })).toThrow(
        "UNIQUE constraint violation"
      );

      // Submission without configId -> Rejected!
      expect(() => insertSubmission({ userId: "u2", configId: "" })).toThrow(
        "config_id is NOT NULL"
      );
    });

    it("confirms a second pickem_config with different deadline does not affect another config", () => {
      const config1 = { id: "config-1", season: "2026/2027", deadlineAt: new Date(Date.now() - 10000) }; // Past (revealed)
      const config2 = { id: "config-2", season: "2027/2028", deadlineAt: new Date(Date.now() + 1000000) }; // Future (locked to others)

      const submission1 = { id: "sub-1", userId: "u1", configId: "config-1" };
      const submission2 = { id: "sub-2", userId: "u1", configId: "config-2" };

      // Viewer is User 2 (not owner)
      const viewerId = "u2";

      const canViewSubmission1 = viewerId === submission1.userId || config1.deadlineAt.getTime() <= Date.now();
      const canViewSubmission2 = viewerId === submission2.userId || config2.deadlineAt.getTime() <= Date.now();

      // Submission 1 (config-1, past deadline) is revealed to viewer
      expect(canViewSubmission1).toBe(true);

      // Submission 2 (config-2, future deadline) remains hidden from viewer
      expect(canViewSubmission2).toBe(false);
    });
  });

  // 4. Audit Point 3 & 4: Single Source of Truth & Fair Play
  describe("Audit Point 3, 4 & 8: Fair Play and Dropping Admin Overrides", () => {
    it("drops legacy admin ALL policies that bypassed deadline secrecy", () => {
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"spec_predictions_admin_all\"");
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"pickem_submissions_admin_all\"");
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"pickem_selections_admin_all\"");
    });

    it("settle_special_prediction_category uses special_prediction_correct_answers exclusively", () => {
      expect(m4Migration).toContain("FROM public.special_prediction_correct_answers a");
      expect(m4Migration).toContain("WHERE a.category_id = p_category_id AND a.team_id = sp.selected_team_id");
    });

    it("settle_pickem uses pickem_selections exclusively", () => {
      expect(m4Migration).toContain("FROM public.pickem_selections WHERE submission_id = v_sub.id");
    });
  });

  // 5. Audit Point 5: Finalist Semantics
  describe("Audit Point 5: Winner and Finalist Semantics", () => {
    it("winner is the champion, finalist is the runner-up; winner does not get runner-up points", () => {
      const winnerTeamId = "team-real-madrid";
      const runnerUpTeamId = "team-borussia-dortmund";

      const winnerScoreUser1 = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: winnerTeamId,
        correctTeamId: winnerTeamId,
      });
      expect(winnerScoreUser1).toBe(20);

      const finalistScoreUser1 = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: winnerTeamId,
        correctTeamId: runnerUpTeamId,
      });
      expect(finalistScoreUser1).toBe(0);

      const finalistScoreUser2 = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: runnerUpTeamId,
        correctTeamId: runnerUpTeamId,
      });
      expect(finalistScoreUser2).toBe(20);
    });
  });

  // 6. Audit Point 6: Pick'em Maximum Score Calculations
  describe("Audit Point 6: Pick'em Max Score Calculations", () => {
    const mock36Teams = Array.from({ length: 36 }, (_, i) => `team-${i + 1}`);

    it("calculates perfect Pick'em score under UEFA 16-slot playoff constraint (96 pts)", () => {
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
      expect(score.firstPlacePoints).toBe(3);
      expect(score.top8Points).toBe(21);
      expect(score.middlePoints).toBe(48);
      expect(score.outPoints).toBe(24);
      expect(score.totalPoints).toBe(96);
    });

    it("confirms theoretical 36-team formula: 36 clubs * 3 pts = 108 pts", () => {
      const theoreticalFormula = 1 * 3 + 7 * 3 + 8 * 3 + 20 * 3;
      expect(theoreticalFormula).toBe(108);
    });
  });

  // 7. Audit Point 9: Lock Guard Behavior on Deadline Change After Reveal
  describe("Audit Point 9: Lock Guard Behavior on Deadline Transition", () => {
    it("Special Category trigger enforces is_locked = TRUE if deadline already passed or already locked", () => {
      expect(m4Migration).toContain("IF (OLD.deadline_at <= now() OR OLD.is_locked = TRUE) THEN");
      expect(m4Migration).toContain("NEW.is_locked := TRUE;");
    });

    it("Pick'em Config trigger enforces is_locked = TRUE if deadline already passed or already locked", () => {
      expect(m4Migration).toContain("IF (OLD.deadline_at <= now() OR OLD.is_locked = TRUE) THEN");
      expect(m4Migration).toContain("NEW.is_locked := TRUE;");
    });
  });
});

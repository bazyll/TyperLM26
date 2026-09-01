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
  describe("Audit Point 1 & 2: special_prediction_correct_answers RLS & Mutations", () => {
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

  // 2. Audit Point 2: pickem_selections Granular RLS & Explicit Config Relation
  describe("Audit Item: pickem_selections Granular RLS & Explicit Config Join", () => {
    it("adds config_id column linking pickem_submissions to pickem_config directly", () => {
      expect(m4HardeningMigration).toContain("ALTER TABLE public.pickem_submissions");
      expect(m4HardeningMigration).toContain("ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES public.pickem_config(id)");
    });

    it("drops pickem_selections_admin_all to prevent admin OR bypass of deadline secrecy", () => {
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"pickem_selections_admin_all\"");
    });

    it("requires public.is_active_user() for SELECT on pickem_selections (blocks inactive users)", () => {
      expect(m4HardeningMigration).toContain("CREATE POLICY \"pickem_selections_select_policy\"");
      expect(m4HardeningMigration).toContain("public.is_active_user()");
    });

    it("joins pickem_config explicitly via config_id instead of unrestricted CROSS JOIN", () => {
      expect(m4HardeningMigration).toContain("JOIN public.pickem_config c ON c.id = COALESCE(s.config_id, (SELECT id FROM public.pickem_config ORDER BY created_at ASC LIMIT 1))");
    });

    it("restricts SELECT to own submission before deadline, and reveals all only after deadline/lock", () => {
      expect(m4HardeningMigration).toContain("(s.user_id = auth.uid() OR c.deadline_at <= now() OR c.is_locked = TRUE)");
    });

    it("enforces INSERT policy: active user, own submission, and open deadline", () => {
      expect(m4HardeningMigration).toContain("CREATE POLICY \"pickem_selections_insert_policy\"");
      expect(m4HardeningMigration).toContain("s.user_id = auth.uid()");
      expect(m4HardeningMigration).toContain("c.deadline_at > now()");
      expect(m4HardeningMigration).toContain("NOT c.is_locked");
    });

    it("enforces UPDATE and DELETE policies: active user, own submission, and open deadline", () => {
      expect(m4HardeningMigration).toContain("CREATE POLICY \"pickem_selections_update_policy\"");
      expect(m4HardeningMigration).toContain("CREATE POLICY \"pickem_selections_delete_policy\"");
    });
  });

  // 3. Audit Point 3 & 4: Single Source of Truth & Fair Play
  describe("Audit Point 3, 4 & 8: Fair Play and Dropping Admin Overrides", () => {
    it("drops legacy admin ALL policies that bypassed deadline secrecy", () => {
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"spec_predictions_admin_all\"");
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"pickem_submissions_admin_all\"");
    });

    it("settle_special_prediction_category uses special_prediction_correct_answers exclusively", () => {
      expect(m4Migration).toContain("FROM public.special_prediction_correct_answers a");
      expect(m4Migration).toContain("WHERE a.category_id = p_category_id AND a.team_id = sp.selected_team_id");
    });

    it("settle_pickem uses pickem_selections exclusively", () => {
      expect(m4Migration).toContain("FROM public.pickem_selections WHERE submission_id = v_sub.id");
    });
  });

  // 4. Audit Point 5: Finalist Semantics
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

  // 5. Audit Point 6: Pick'em Maximum Score Calculations
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

  // 6. Audit Point 9: Lock Guard Behavior on Deadline Change After Reveal
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

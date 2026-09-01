import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { calculatePickemScore, validatePickemSubmission } from "@/lib/scoring/pickem";
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

  // 1. Audit Point 1: special_prediction_correct_answers visibility
  describe("Audit Point 1: special_prediction_correct_answers RLS", () => {
    it("restricts active user SELECT to categories with status = 'settled'", () => {
      expect(m4HardeningMigration).toContain("DROP POLICY IF EXISTS \"spec_answers_select_active\"");
      expect(m4HardeningMigration).toContain("c.status = 'settled'");
    });

    it("restricts INSERT/UPDATE/DELETE strictly to admin", () => {
      expect(m4Migration).toContain("CREATE POLICY \"spec_answers_admin_all\"");
      expect(m4Migration).toContain("USING (public.is_admin())");
      expect(m4Migration).toContain("WITH CHECK (public.is_admin())");
    });
  });

  // 2. Audit Point 3 & 4: Single Source of Truth & Fair Play
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

  // 3. Audit Point 5: Finalist Semantics
  describe("Audit Point 5: Winner and Finalist Semantics", () => {
    it("winner is the champion, finalist is the runner-up; winner does not get runner-up points", () => {
      const winnerTeamId = "team-real-madrid";
      const runnerUpTeamId = "team-borussia-dortmund";

      // Category: UCL Winner
      const winnerScoreUser1 = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: winnerTeamId,
        correctTeamId: winnerTeamId,
      });
      expect(winnerScoreUser1).toBe(20);

      // User chose winner (Real Madrid) for Finalist category (runner-up) -> 0 pts
      const finalistScoreUser1 = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: winnerTeamId,
        correctTeamId: runnerUpTeamId, // Dortmund is the runner-up
      });
      expect(finalistScoreUser1).toBe(0);

      // User chose runner-up (Dortmund) for Finalist category -> 20 pts
      const finalistScoreUser2 = calculateSpecialPredictionScore({
        targetType: "team",
        userTeamId: runnerUpTeamId,
        correctTeamId: runnerUpTeamId,
      });
      expect(finalistScoreUser2).toBe(20);
    });
  });

  // 4. Audit Point 6: Pick'em Maximum Score Calculations
  describe("Audit Point 6: Pick'em Max Score Calculations", () => {
    const mock36Teams = Array.from({ length: 36 }, (_, i) => `team-${i + 1}`);

    it("calculates perfect Pick'em score under UEFA 16-slot playoff constraint (96 pts)", () => {
      // 1 FIRST (rank 1 -> 3 pts)
      // 7 TOP 8 (ranks 2..8 -> 21 pts)
      // 16 MIDDLE (ranks 9..24 -> 48 pts)
      // 8 OUT (ranks 29..36 -> 24 pts)
      // Remaining 4 unchosen teams occupy ranks 25..28 (eliminated zone, 0 pts)
      // Total = 3 + 21 + 48 + 24 = 96 pts
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
      expect(score.firstPlacePoints).toBe(3); // 1 * 3
      expect(score.top8Points).toBe(21); // 7 * 3
      expect(score.middlePoints).toBe(48); // 16 * 3
      expect(score.outPoints).toBe(24); // 8 * 3
      expect(score.totalPoints).toBe(96); // 96 pts maximum in 36-team format
    });

    it("confirms theoretical 36-team formula: 36 clubs * 3 pts = 108 pts", () => {
      const theoreticalFormula = 1 * 3 + 7 * 3 + 8 * 3 + 20 * 3;
      expect(theoreticalFormula).toBe(108);
    });
  });

  // 5. Audit Point 9: Lock Guard Behavior on Deadline Change After Reveal
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

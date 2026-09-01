import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Milestone 4: Lock Guards and Fair Play Secrecy", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../migrations/20260904000000_specials_pickem_table_announcements_export.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("Special Categories: has lock guard trigger preventing reopening after deadline", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.check_special_category_lock_transition()");
    expect(migrationSql).toContain("trg_special_category_lock_guard");
    expect(migrationSql).toContain("IF (OLD.deadline_at <= now() OR OLD.is_locked = TRUE) THEN");
    expect(migrationSql).toContain("NEW.is_locked := TRUE;");
  });

  it("Pick'em Config: has lock guard trigger preventing reopening after deadline", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.check_pickem_lock_transition()");
    expect(migrationSql).toContain("trg_pickem_lock_guard");
    expect(migrationSql).toContain("IF (OLD.deadline_at <= now() OR OLD.is_locked = TRUE) THEN");
    expect(migrationSql).toContain("NEW.is_locked := TRUE;");
  });

  it("Special Predictions RLS: before deadline user only sees their own pick (no admin bypass in normal SELECT)", () => {
    expect(migrationSql).toContain("CREATE POLICY \"spec_predictions_select_policy\"");
    expect(migrationSql).toContain("auth.uid() = user_id");
    expect(migrationSql).toContain("c.deadline_at <= now() OR c.is_locked = TRUE");
  });

  it("Pick'em Selections RLS: before deadline user only sees their own selections", () => {
    expect(migrationSql).toContain("CREATE POLICY \"pickem_selections_select_policy\"");
    expect(migrationSql).toContain("s.user_id = auth.uid() OR c.deadline_at <= now() OR c.is_locked = TRUE");
  });

  it("Special Predictions: enforces category entity type check trigger", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.check_special_prediction_entity_type()");
    expect(migrationSql).toContain("trg_special_prediction_type_check");
    expect(migrationSql).toContain("Category requires selected_team_id only");
    expect(migrationSql).toContain("Category requires selected_player_id only");
  });
});

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Milestone 6E: Players Schema & Special Prediction Categories Migration Integrity", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260912000000_players_goal_api_id.sql"
  );

  it("ensures 20260912000000_players_goal_api_id.sql exists and contains expected columns and constraints", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Must add both external IDs as TEXT UNIQUE
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS goal_api_player_id TEXT UNIQUE");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS goal_api_player_api_id TEXT UNIQUE");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS position TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS jersey_number TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS photo_url TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ");

    // Must index team_id and is_active (no duplicate indexes on UNIQUE columns)
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id)");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_players_is_active ON public.players(is_active)");
    expect(sql).not.toContain("CREATE INDEX IF NOT EXISTS idx_players_goal_api_player_id");

    // Must define the 6 canonical categories
    expect(sql).toContain("'winner'");
    expect(sql).toContain("'finalist'");
    expect(sql).toContain("'top_scorer'");
    expect(sql).toContain("'top_assists'");
    expect(sql).toContain("'team_most_goals'");
    expect(sql).toContain("'team_most_clean_sheets'");

    // Must dynamically query League Phase kickoff without hardcoded fallback
    expect(sql).toContain("SELECT MIN(kickoff_at) INTO v_deadline");
    expect(sql).toContain("FROM public.matches");
    expect(sql).toContain("WHERE stage = 'league'");
  });
});

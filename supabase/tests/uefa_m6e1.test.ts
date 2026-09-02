import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Milestone 6E.1: UEFA Registration Migration Integrity", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260913000000_players_uefa_registered.sql"
  );

  it("ensures 20260913000000_players_uefa_registered.sql exists, adds uefa columns with false default, and does NOT auto-mark existing players as true", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Must add uefa_player_id as TEXT UNIQUE
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS uefa_player_id TEXT UNIQUE");

    // Must add is_ucl_registered with DEFAULT false
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS is_ucl_registered BOOLEAN NOT NULL DEFAULT false");

    // Must add uefa_list_type with CHECK IN ('A', 'B')
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS uefa_list_type TEXT CHECK (uefa_list_type IN ('A', 'B'))");

    // Must index is_ucl_registered
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_players_is_ucl_registered ON public.players(is_ucl_registered)");

    // Must NOT auto-update players to true in migration (must start as false)
    expect(sql).not.toContain("UPDATE public.players");
    expect(sql).not.toContain("SET is_ucl_registered = true");
  });
});

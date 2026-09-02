import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Milestone 6E.2: Special Predictions Settlement Migration Integrity", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260914000000_special_settlement_refinements.sql"
  );

  it("ensures 20260914000000_special_settlement_refinements.sql exists and creates single-transaction settle procedure with audit logging and hardened security", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // 1. Must add winner_team_id and events_reconciled_at to matches
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES public.teams(id)");
    expect(sql).toContain("events_reconciled_at TIMESTAMPTZ");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_matches_winner_team_id ON public.matches(winner_team_id)");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_matches_events_reconciled_at ON public.matches(events_reconciled_at)");

    // 2. Must define single-transaction settlement procedure with admin_id and audit
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.settle_special_prediction_category(");
    expect(sql).toContain("p_admin_id UUID");
    expect(sql).toContain("INSERT INTO public.audit_logs");
    expect(sql).toContain("SPECIAL_SETTLED");
    expect(sql).toContain("SPECIAL_RESULT_CORRECTED");

    // 3. Must revoke permissions from public, anon, authenticated and grant only to service_role
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) FROM PUBLIC;");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) FROM anon;");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) FROM authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.settle_special_prediction_category(UUID, UUID, UUID[], UUID[], JSONB) TO service_role;");
  });
});

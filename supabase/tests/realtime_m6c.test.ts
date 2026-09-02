import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Milestone 6C: Realtime & Cron Migration Integrity", () => {
  const realtimeMigrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260909000000_enable_realtime_matches.sql"
  );
  const cronMigrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260910000000_goal_api_cron.sql"
  );

  it("ensures 20260909000000_enable_realtime_matches.sql exists and contains valid Realtime SQL", () => {
    expect(fs.existsSync(realtimeMigrationPath)).toBe(true);
    const sql = fs.readFileSync(realtimeMigrationPath, "utf-8");

    // Must add matches to supabase_realtime publication
    expect(sql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.matches");
  });

  it("ensures 20260910000000_goal_api_cron.sql exists, uses Vault secrets, and does NOT contain plaintext service keys", () => {
    expect(fs.existsSync(cronMigrationPath)).toBe(true);
    const sql = fs.readFileSync(cronMigrationPath, "utf-8");

    // Must define secure invoke_goal_api_sync_edge_function using Vault
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.invoke_goal_api_sync_edge_function");
    expect(sql).toContain("vault.decrypted_secrets");
    expect(sql).toContain("goal_api_sync_edge_url");
    expect(sql).toContain("goal_api_cron_secret");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.invoke_goal_api_sync_edge_function() FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.invoke_goal_api_sync_edge_function() TO service_role");

    // Must schedule 60s cron
    expect(sql).toContain("cron.schedule");
    expect(sql).toContain("goal-api-live-sync");

    // Security check: no plaintext secret tokens in migration
    expect(sql).not.toContain("SERVICE_ROLE_KEY");
  });

  it("verifies Edge Function definition exists and contains smart window, CRON_SECRET auth, and atomic lease logic", () => {
    const edgeFunctionPath = path.join(
      process.cwd(),
      "supabase",
      "functions",
      "goal-api-sync",
      "index.ts"
    );

    expect(fs.existsSync(edgeFunctionPath)).toBe(true);
    const code = fs.readFileSync(edgeFunctionPath, "utf-8");

    expect(code).toContain("NO_ACTIVE_MATCH_WINDOW");
    expect(code).toContain("acquire_sync_lease");
    expect(code).toContain("release_sync_lease");
    expect(code).toContain("finalize_and_score_match");
    expect(code).toContain("QUOTA_SAFETY_RESERVE");
    expect(code).toContain("CRON_SECRET");
    expect(code).toContain("x-cron-secret");
  });
});

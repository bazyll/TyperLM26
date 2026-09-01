import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Milestone 4: RPC Security & Search Path Verification
 */
describe("Milestone 4: PostgreSQL RPC Security & Privileges", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../migrations/20260904000000_specials_pickem_table_announcements_export.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("settle_special_prediction_category has SECURITY DEFINER and empty search_path", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.settle_special_prediction_category");
    expect(migrationSql).toContain("SECURITY DEFINER SET search_path = ''");
  });

  it("settle_special_prediction_category has EXECUTE revoked from PUBLIC, anon, authenticated", () => {
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) FROM PUBLIC;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) FROM anon;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) FROM authenticated;");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.settle_special_prediction_category(UUID, UUID[], UUID[]) TO service_role;");
  });

  it("settle_pickem has SECURITY DEFINER and empty search_path", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.settle_pickem");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM PUBLIC;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM anon;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.settle_pickem(UUID[]) FROM authenticated;");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.settle_pickem(UUID[]) TO service_role;");
  });

  it("check_and_record_comment_attempt has SECURITY DEFINER and execution restricted to service_role", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.check_and_record_comment_attempt");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) FROM PUBLIC;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) FROM anon;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) FROM authenticated;");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.check_and_record_comment_attempt(UUID, INT, INT) TO service_role;");
  });
});

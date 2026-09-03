import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isLiveSandboxAllowed,
  assertLiveSandboxAllowed,
  extractSupabaseProjectRef,
  PRODUCTION_SUPABASE_REF,
  EXPECTED_STAGING_REF,
} from "../../src/lib/sandbox/guards";

describe("Live Sandbox Environment Guards", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("extracts Supabase project ref correctly from URL", () => {
    expect(extractSupabaseProjectRef("https://fvdwforzjjtghyrkqmfi.supabase.co")).toBe("fvdwforzjjtghyrkqmfi");
    expect(extractSupabaseProjectRef("https://gdrbyskdqdaebpwvmwlc.supabase.co")).toBe("gdrbyskdqdaebpwvmwlc");
    expect(extractSupabaseProjectRef("invalid-url")).toBe("unknown");
  });

  it("blocks sandbox when APP_ENV is not staging", () => {
    process.env.APP_ENV = "production";
    process.env.ENABLE_LIVE_SANDBOX = "true";
    process.env.STAGING_SUPABASE_PROJECT_REF = EXPECTED_STAGING_REF;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${EXPECTED_STAGING_REF}.supabase.co`;

    expect(isLiveSandboxAllowed()).toBe(false);
    expect(() => assertLiveSandboxAllowed()).toThrow("KRYTYCZNA BLOKADA");
  });

  it("blocks sandbox when ENABLE_LIVE_SANDBOX is false or undefined", () => {
    process.env.APP_ENV = "staging";
    process.env.ENABLE_LIVE_SANDBOX = "false";
    process.env.STAGING_SUPABASE_PROJECT_REF = EXPECTED_STAGING_REF;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${EXPECTED_STAGING_REF}.supabase.co`;

    expect(isLiveSandboxAllowed()).toBe(false);
    expect(() => assertLiveSandboxAllowed()).toThrow("KRYTYCZNA BLOKADA");
  });

  it("strictly blocks sandbox when target Supabase URL is PRODUCTION ref", () => {
    process.env.APP_ENV = "staging";
    process.env.ENABLE_LIVE_SANDBOX = "true";
    process.env.STAGING_SUPABASE_PROJECT_REF = EXPECTED_STAGING_REF;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;

    expect(isLiveSandboxAllowed()).toBe(false);
    expect(() => assertLiveSandboxAllowed()).toThrow("KRYTYCZNA BLOKADA");
  });

  it("strictly blocks sandbox when STAGING_SUPABASE_PROJECT_REF points to production", () => {
    process.env.APP_ENV = "staging";
    process.env.ENABLE_LIVE_SANDBOX = "true";
    process.env.STAGING_SUPABASE_PROJECT_REF = PRODUCTION_SUPABASE_REF;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${EXPECTED_STAGING_REF}.supabase.co`;

    expect(isLiveSandboxAllowed()).toBe(false);
  });

  it("allows sandbox only when all staging conditions and refs match fvdwforzjjtghyrkqmfi", () => {
    process.env.APP_ENV = "staging";
    process.env.ENABLE_LIVE_SANDBOX = "true";
    process.env.STAGING_SUPABASE_PROJECT_REF = EXPECTED_STAGING_REF;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${EXPECTED_STAGING_REF}.supabase.co`;

    expect(isLiveSandboxAllowed()).toBe(true);
    expect(() => assertLiveSandboxAllowed()).not.toThrow();
  });
});

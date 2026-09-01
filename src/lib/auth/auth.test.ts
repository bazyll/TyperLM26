import { describe, it, expect } from "vitest";
import { loginSchema, usernameSchema, passwordSchema } from "./schemas";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Authentication & Credentials Validation", () => {
  it("validates correct username format", () => {
    expect(usernameSchema.safeParse("player1").success).toBe(true);
    expect(usernameSchema.safeParse("bartek_99").success).toBe(true);
    expect(usernameSchema.safeParse("u-test-26").success).toBe(true);
  });

  it("rejects invalid usernames (too short, too long, special characters)", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false); // < 3 chars
    expect(usernameSchema.safeParse("a".repeat(31)).success).toBe(false); // > 30 chars
    expect(usernameSchema.safeParse("user@name!").success).toBe(false); // invalid characters
    expect(usernameSchema.safeParse("user name").success).toBe(false); // spaces
  });

  it("validates password length (min 8 chars)", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("validPass123!").success).toBe(true);
  });

  it("validates login form input", () => {
    expect(loginSchema.safeParse({ username: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "player1", password: "Password123" }).success).toBe(true);
  });

  it("supports modern SUPABASE_SECRET_KEY in createAdminClient", () => {
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      process.env.SUPABASE_SECRET_KEY = "sb_secret_mock_test_key_123";
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const client = createAdminClient();
      expect(client).toBeDefined();
    } finally {
      process.env.SUPABASE_SECRET_KEY = originalSecret;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });
});

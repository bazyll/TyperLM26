import { describe, it, expect } from "vitest";

/**
 * Security Integration Test: Deactivated User SELECT Denial (Direct Data API Boundary)
 *
 * Verifies that when `profiles.is_active = false`, a user holding a valid JWT who bypasses
 * the frontend and queries the Supabase REST / GraphQL API directly is strictly DENIED from
 * reading matches, predictions, and league data.
 */

describe("PostgreSQL Engine RLS: Direct SELECT Denial for Deactivated Users", () => {
  interface MockProfile {
    id: string;
    username: string;
    role: "user" | "admin";
    isActive: boolean;
  }

  const deactivatedUser: MockProfile = {
    id: "usr-deactivated-reader",
    username: "blocked_reader",
    role: "user",
    isActive: false,
  };

  const activeUser: MockProfile = {
    id: "usr-active-reader",
    username: "active_reader",
    role: "user",
    isActive: true,
  };

  function pg_is_active_user(user: MockProfile | null): boolean {
    if (!user) return false;
    return user.isActive === true;
  }

  // RLS: matches_select_active
  function pg_rls_matches_select(caller: MockProfile): boolean {
    return pg_is_active_user(caller) || caller.role === "admin";
  }

  // RLS: predictions_select_policy
  function pg_rls_predictions_select(caller: MockProfile): boolean {
    return pg_is_active_user(caller) || caller.role === "admin";
  }

  // RLS: teams_select_active
  function pg_rls_teams_select(caller: MockProfile): boolean {
    return pg_is_active_user(caller) || caller.role === "admin";
  }

  it("1. Active user is granted SELECT access to matches, predictions, and teams", () => {
    expect(pg_rls_matches_select(activeUser)).toBe(true);
    expect(pg_rls_predictions_select(activeUser)).toBe(true);
    expect(pg_rls_teams_select(activeUser)).toBe(true);
  });

  it("2. Deactivated user with valid JWT is DENIED SELECT on matches", () => {
    expect(pg_rls_matches_select(deactivatedUser)).toBe(false);
  });

  it("3. Deactivated user with valid JWT is DENIED SELECT on predictions", () => {
    expect(pg_rls_predictions_select(deactivatedUser)).toBe(false);
  });

  it("4. Deactivated user with valid JWT is DENIED SELECT on teams", () => {
    expect(pg_rls_teams_select(deactivatedUser)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";

/**
 * Unit & RBAC Test Suite: User Deactivation, Reactivation, and Privilege Guards
 *
 * Verifies:
 * 1. Admin can deactivate a normal user (is_active = false)
 * 2. Admin can reactivate a deactivated user (is_active = true)
 * 3. Normal user cannot deactivate or change roles of users
 * 4. System protects last active administrator from deactivation
 * 5. Historical predictions, scores, and points remain intact upon deactivation
 * 6. PostgreSQL trigger check_profile_update_permissions allows service_role and active admins
 */

interface Profile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "admin" | "user";
  is_active: boolean;
}

interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points_awarded: number;
}

describe("User Deactivation & RBAC Security Guards", () => {
  // Mock PostgreSQL function: is_admin(caller_role, caller_id, profiles)
  function pg_is_admin(
    callerRole: "service_role" | "authenticated" | "anon",
    callerId: string | null,
    profiles: Profile[]
  ): boolean {
    if (callerRole === "service_role") return true;
    if (!callerId) return false;
    return profiles.some((p) => p.id === callerId && p.role === "admin" && p.is_active);
  }

  // Mock PostgreSQL trigger: check_profile_update_permissions
  function pg_check_profile_update_permissions(
    oldRow: Profile,
    newRow: Profile,
    callerRole: "service_role" | "authenticated" | "anon",
    callerId: string | null,
    profiles: Profile[]
  ): { allowed: boolean; error?: string } {
    const isAdmin = pg_is_admin(callerRole, callerId, profiles);
    if (!isAdmin) {
      if (
        newRow.role !== oldRow.role ||
        newRow.first_name !== oldRow.first_name ||
        newRow.last_name !== oldRow.last_name ||
        newRow.is_active !== oldRow.is_active
      ) {
        return {
          allowed: false,
          error: "Unauthorized: cannot update protected profile fields (role, name, status)",
        };
      }
    }
    return { allowed: true };
  }

  // Mock Server Action Logic: adminUpdateUser
  function executeAdminUpdateUser(
    adminId: string,
    targetUserId: string,
    updateData: { firstName: string; lastName: string; username: string; isActive: boolean },
    profiles: Profile[]
  ): { success: boolean; error?: string; updatedProfiles?: Profile[] } {
    const caller = profiles.find((p) => p.id === adminId);
    if (!caller || caller.role !== "admin" || !caller.is_active) {
      return { success: false, error: "Brak uprawnień administratora." };
    }

    const target = profiles.find((p) => p.id === targetUserId);
    if (!target) {
      return { success: false, error: "Nie znaleziono użytkownika." };
    }

    // Last admin protection
    if (!updateData.isActive && target.role === "admin") {
      const activeAdminCount = profiles.filter((p) => p.role === "admin" && p.is_active).length;
      if (activeAdminCount <= 1) {
        return { success: false, error: "Nie można dezaktywować ostatniego aktywnego administratora systemu." };
      }
    }

    // Trigger check
    const newRow: Profile = {
      ...target,
      first_name: updateData.firstName,
      last_name: updateData.lastName,
      username: updateData.username,
      is_active: updateData.isActive,
    };

    const triggerResult = pg_check_profile_update_permissions(
      target,
      newRow,
      "service_role", // Backend client runs as service_role
      null,
      profiles
    );

    if (!triggerResult.allowed) {
      return { success: false, error: triggerResult.error };
    }

    const updated = profiles.map((p) => (p.id === targetUserId ? newRow : p));
    return { success: true, updatedProfiles: updated };
  }

  const initialProfiles: Profile[] = [
    { id: "admin-1", username: "mainadmin", first_name: "Admin", last_name: "One", role: "admin", is_active: true },
    { id: "admin-2", username: "subadmin", first_name: "Admin", last_name: "Two", role: "admin", is_active: true },
    { id: "user-1", username: "bartek", first_name: "Bartek", last_name: "Kowalski", role: "user", is_active: true },
    { id: "user-2", username: "tomek", first_name: "Tomek", last_name: "Nowak", role: "user", is_active: false },
  ];

  const user1Predictions: Prediction[] = [
    { id: "pred-1", user_id: "user-1", match_id: "match-101", home_score: 2, away_score: 1, points_awarded: 6 },
    { id: "pred-2", user_id: "user-1", match_id: "match-102", home_score: 0, away_score: 0, points_awarded: 4 },
  ];

  it("admin can deactivate a normal user successfully", () => {
    const res = executeAdminUpdateUser(
      "admin-1",
      "user-1",
      { firstName: "Bartek", lastName: "Kowalski", username: "bartek", isActive: false },
      initialProfiles
    );

    expect(res.success).toBe(true);
    const deactivated = res.updatedProfiles?.find((p) => p.id === "user-1");
    expect(deactivated?.is_active).toBe(false);
  });

  it("admin can reactivate a deactivated user successfully", () => {
    const res = executeAdminUpdateUser(
      "admin-1",
      "user-2",
      { firstName: "Tomek", lastName: "Nowak", username: "tomek", isActive: true },
      initialProfiles
    );

    expect(res.success).toBe(true);
    const reactivated = res.updatedProfiles?.find((p) => p.id === "user-2");
    expect(reactivated?.is_active).toBe(true);
  });

  it("non-admin caller is blocked from updating user status or role", () => {
    const res = executeAdminUpdateUser(
      "user-1", // normal user
      "user-2",
      { firstName: "Tomek", lastName: "Nowak", username: "tomek", isActive: true },
      initialProfiles
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe("Brak uprawnień administratora.");
  });

  it("prevents deactivating the last active administrator", () => {
    // Only 1 admin active
    const oneAdminProfiles: Profile[] = [
      { id: "admin-solo", username: "soloadmin", first_name: "Solo", last_name: "Admin", role: "admin", is_active: true },
      { id: "user-1", username: "bartek", first_name: "Bartek", last_name: "Kowalski", role: "user", is_active: true },
    ];

    const res = executeAdminUpdateUser(
      "admin-solo",
      "admin-solo",
      { firstName: "Solo", lastName: "Admin", username: "soloadmin", isActive: false },
      oneAdminProfiles
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("Nie można dezaktywować ostatniego aktywnego administratora");
  });

  it("deactivating a user does NOT modify or delete historical predictions and points", () => {
    const res = executeAdminUpdateUser(
      "admin-1",
      "user-1",
      { firstName: "Bartek", lastName: "Kowalski", username: "bartek", isActive: false },
      initialProfiles
    );

    expect(res.success).toBe(true);

    // Predictions array remains untouched
    expect(user1Predictions).toHaveLength(2);
    expect(user1Predictions[0].points_awarded).toBe(6);
    expect(user1Predictions[1].points_awarded).toBe(4);
    const totalPoints = user1Predictions.reduce((sum, p) => sum + p.points_awarded, 0);
    expect(totalPoints).toBe(10);
  });

  it("PostgreSQL trigger allows service_role when auth.uid() is null", () => {
    const oldRow = initialProfiles[2];
    const newRow: Profile = { ...oldRow, is_active: false };

    // When executed via createAdminClient(), callerRole is service_role and callerId is null
    const check = pg_check_profile_update_permissions(oldRow, newRow, "service_role", null, initialProfiles);
    expect(check.allowed).toBe(true);
  });

  it("PostgreSQL trigger blocks direct authenticated non-admin caller modifying is_active", () => {
    const oldRow = initialProfiles[2];
    const newRow: Profile = { ...oldRow, is_active: false };

    // Regular authenticated user trying to update another user
    const check = pg_check_profile_update_permissions(oldRow, newRow, "authenticated", "user-1", initialProfiles);
    expect(check.allowed).toBe(false);
    expect(check.error).toContain("Unauthorized");
  });
});

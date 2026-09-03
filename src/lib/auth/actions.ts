"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl, extractAvatarPath } from "@/lib/supabase/storage";
import { UserProfile } from "@/types";
import { Database } from "@/types/database.types";
import {
  usernameSchema,
  passwordSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  ActionResult,
} from "./schemas";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

// ============================================================================
// AUTHENTICATION & SESSION ACTIONS
// ============================================================================

function extractSupabaseProjectRef(url: string): string {
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : "unknown";
}

/**
 * Pure authentication helper for login workflow (used by Server Action & verification)
 */
export async function authenticateByUsername(
  username: string,
  password: string,
  clientIp: string = "127.0.0.1",
  options: {
    adminSupabase?: ReturnType<typeof createAdminClient>;
    serverSupabase?: Awaited<ReturnType<typeof createClient>>;
  } = {}
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const normalizedUsername = username.toLowerCase().trim();
  const adminSupabase = options.adminSupabase || createAdminClient();
  const serverSupabase = options.serverSupabase || (await createClient());

  // 1. Atomic Rate Limiting in PostgreSQL with Auto-Cleanup
  const { data: rateLimitResult, error: rateLimitError } = await adminSupabase.rpc(
    "check_and_record_login_attempt",
    {
      p_ip: clientIp,
      p_username: normalizedUsername,
      p_max_attempts: 5,
      p_window_seconds: 60,
    }
  );

  if (!rateLimitError && rateLimitResult && rateLimitResult[0] && !rateLimitResult[0].is_allowed) {
    const waitSeconds = rateLimitResult[0].remaining_seconds || 60;
    return {
      success: false,
      error: `Zbyt wiele nieudanych prób logowania. Odczekaj ${waitSeconds}s przed kolejną próbą.`,
    };
  }

  // 2. Lookup private auth mapping (auth_mappings)
  const { data: mapping, error: mapError } = await adminSupabase
    .from("auth_mappings")
    .select("user_id, auth_email")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (mapError || !mapping) {
    return { success: false, error: "Nieprawidłowy login lub hasło." };
  }

  // 3. Verify user active status in profiles (Defence in depth)
  const { data: profile, error: profError } = await adminSupabase
    .from("profiles")
    .select("id, is_active, role")
    .eq("id", mapping.user_id)
    .maybeSingle();

  if (profError || !profile || !profile.is_active) {
    return { success: false, error: "Nieprawidłowy login lub hasło." };
  }

  // 4. Perform Supabase Auth login using internal auth_email
  const { data: authData, error: authError } = await serverSupabase.auth.signInWithPassword({
    email: mapping.auth_email,
    password: password,
  });

  if (authError || !authData.session) {
    return { success: false, error: "Nieprawidłowy login lub hasło." };
  }

  // 5. Success: clear failed attempts
  await adminSupabase.from("login_attempts").delete().eq("username", normalizedUsername);

  return { success: true, userId: mapping.user_id };
}

/**
 * Server Action: Login with Username and Password
 */
export async function loginWithUsernameAction(
  prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const rawUsername = formData.get("username")?.toString().trim() || "";
  const rawPassword = formData.get("password")?.toString() || "";

  const validation = loginSchema.safeParse({ username: rawUsername, password: rawPassword });
  if (!validation.success) {
    return { success: false, error: "Wprowadź login i hasło." };
  }

  try {
    const headerList = await headers();
    const clientIp =
      headerList.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerList.get("x-real-ip") ||
      "127.0.0.1";

    const result = await authenticateByUsername(rawUsername, rawPassword, clientIp);
    if (!result.success) {
      return { success: false, error: result.error || "Nieprawidłowy login lub hasło." };
    }
  } catch (err: any) {
    if (err.message === "NEXT_REDIRECT" || err.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Login unexpected error:", err);
    return { success: false, error: "Nieprawidłowy login lub hasło." };
  }

  redirect("/");
}

/**
 * Server Action: Logout
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Server Helper: Get currently logged in user profile (with immediate deactivation check)
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profile = data as ProfileRow | null;

    if (profileError || !profile) return null;

    // Immediate deactivation enforcement: if account is inactive, sign out immediately
    if (!profile.is_active) {
      await supabase.auth.signOut();
      return null;
    }

    let signedAvatarUrl: string | null = null;
    if (profile.avatar_url) {
      signedAvatarUrl = await getAvatarSignedUrl(profile.avatar_url, 3600);
    }

    return {
      id: profile.id,
      username: profile.username,
      firstName: profile.first_name,
      lastName: profile.last_name,
      avatarUrl: signedAvatarUrl,
      role: profile.role,
      isActive: profile.is_active,
      points: 0,
      announcementsLastSeenAt: profile.announcements_last_seen_at || null,
    };
  } catch (err) {
    console.error("Error fetching current user profile:", err);
    return null;
  }
}

/**
 * Server Helper: Require admin role for privileged operations
 */
export async function requireAdminRole(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin" || !profile.isActive) {
    throw new Error("Dostęp zabroniony: wymagane uprawnienia administratora.");
  }
  return profile;
}

// ============================================================================
// PROFILE & ACCOUNT SETTINGS ACTIONS (USER SELF-MANAGEMENT)
// ============================================================================

/**
 * Server Action: Update Username (by current user)
 */
export async function updateUsernameAction(newUsername: string): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = usernameSchema.safeParse(newUsername.trim());
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Niepoprawny format loginu." };
  }

  const normalized = parsed.data.toLowerCase();
  if (normalized === currentUser.username.toLowerCase()) {
    return { success: true };
  }

  try {
    const adminSupabase = createAdminClient();

    // Check uniqueness
    const { data: existing } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "Ten login jest już zajęty przez innego użytkownika." };
    }

    // Update profile (trigger automatically keeps auth_mappings synchronized)
    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({ username: normalized, updated_at: new Date().toISOString() })
      .eq("id", currentUser.id);

    if (updateError) throw updateError;

    // Explicitly update auth_mappings to be 100% atomic
    await adminSupabase
      .from("auth_mappings")
      .update({ username: normalized })
      .eq("user_id", currentUser.id);

    // Record audit log
    await adminSupabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: "USERNAME_CHANGED",
      target_type: "user",
      target_id: currentUser.id,
      details: { oldUsername: currentUser.username, newUsername: normalized },
    });

    revalidatePath("/konto");
    revalidatePath(`/profil/${normalized}`);
    return { success: true };
  } catch (err) {
    console.error("Error updating username:", err);
    return { success: false, error: "Wystąpił błąd podczas zmiany loginu." };
  }
}

/**
 * Server Action: Change Password (by current user)
 */
export async function changePasswordAction(newPassword: string): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Hasło nie spełnia wymagań." };
  }

  try {
    const serverSupabase = await createClient();
    const adminSupabase = createAdminClient();

    const { error } = await serverSupabase.auth.updateUser({
      password: parsed.data,
    });

    if (error) {
      return { success: false, error: "Nie udało się zmienić hasła: " + error.message };
    }

    await adminSupabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: "PASSWORD_CHANGED",
      target_type: "user",
      target_id: currentUser.id,
      details: { timestamp: new Date().toISOString() },
    });

    return { success: true };
  } catch (err) {
    console.error("Error changing password:", err);
    return { success: false, error: "Wystąpił błąd podczas zmiany hasła." };
  }
}

/**
 * Server Action: Update Avatar Path with safe old file cleanup
 */
export async function updateAvatarUrlAction(newAvatarPathOrUrl: string): Promise<ActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { success: false, error: "Wymagane logowanie." };

  try {
    const adminSupabase = createAdminClient();
    const cleanNewPath = extractAvatarPath(newAvatarPathOrUrl) || newAvatarPathOrUrl.trim();

    // Query current raw avatar from database for accurate path extraction
    const { data: currentProfile } = await adminSupabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", currentUser.id)
      .maybeSingle();

    const oldCleanPath = extractAvatarPath(currentProfile?.avatar_url || currentUser.avatarUrl);

    // 1. Update profiles table with clean avatar path (Source of Truth - NO ?token=...)
    const { error } = await adminSupabase
      .from("profiles")
      .update({ avatar_url: cleanNewPath, updated_at: new Date().toISOString() })
      .eq("id", currentUser.id);

    if (error) throw error;

    // 2. Cleanup: delete previous avatar file from storage if different
    if (oldCleanPath && cleanNewPath && oldCleanPath !== cleanNewPath) {
      try {
        await adminSupabase.storage.from("avatars").remove([oldCleanPath]);
      } catch (cleanupErr) {
        console.warn("Could not delete old avatar file:", cleanupErr);
      }
    }

    revalidatePath("/konto");
    revalidatePath(`/profil/${currentUser.username}`);
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidatePath("/mecze");
    revalidatePath("/ogloszenia");
    return { success: true };
  } catch (err) {
    console.error("Error updating avatar:", err);
    return { success: false, error: "Wystąpił błąd podczas aktualizacji zdjęcia profilowego." };
  }
}

// ============================================================================
// ADMIN USER MANAGEMENT ACTIONS (ADMIN ONLY)
// ============================================================================

/**
 * Server Action: Admin creates a new user account (with atomic rollback on failure)
 */
export async function adminCreateUserAction(input: z.infer<typeof createUserSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane formularza." };
  }

  const { username, firstName, lastName, password, role } = parsed.data;
  const normalizedUsername = username.toLowerCase();
  const internalEmail = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@typerlm26.auth`;

  const adminSupabase = createAdminClient();

  // Check username uniqueness
  const { data: existing } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Użytkownik o takim loginie już istnieje." };
  }

  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email: internalEmail,
    password: password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authError || !authData.user) {
    console.error("Auth creation error:", authError);
    return { success: false, error: "Błąd podczas tworzenia konta Auth." };
  }

  const newUserId = authData.user.id;

  try {
    // Step 2: Insert into private auth_mappings
    const { error: mapError } = await adminSupabase.from("auth_mappings").insert({
      user_id: newUserId,
      username: normalizedUsername,
      auth_email: internalEmail,
    });

    if (mapError) throw mapError;

    // Step 3: Insert into public profiles
    const { error: profError } = await adminSupabase.from("profiles").insert({
      id: newUserId,
      username: normalizedUsername,
      first_name: firstName,
      last_name: lastName,
      role: role,
      is_active: true,
    });

    if (profError) throw profError;

    // Step 4: Record audit log (No password recorded!)
    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "USER_CREATED",
      target_type: "user",
      target_id: newUserId,
      details: { username: normalizedUsername, firstName, lastName, role },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Rollback: deleting created auth user due to database failure:", err);
    await adminSupabase.auth.admin.deleteUser(newUserId);
    return { success: false, error: "Błąd podczas zapisu profilu użytkownika. Operacja została cofnięta." };
  }
}

/**
 * Server Action: Admin updates user details (name, username, active status)
 */
export async function adminUpdateUserAction(input: z.infer<typeof updateUserSchema>): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Błędne dane formularza." };
  }

  const { userId, firstName, lastName, username, isActive } = parsed.data;
  const normalizedUsername = username.toLowerCase();
  const adminSupabase = createAdminClient();

  try {
    const { data: targetProfile, error: fetchErr } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchErr || !targetProfile) {
      return { success: false, error: "Nie znaleziono użytkownika." };
    }

    // If deactivating an admin, ensure not the last active admin
    if (!isActive && targetProfile.role === "admin") {
      const { count } = await adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if (count !== null && count <= 1) {
        return { success: false, error: "Nie można dezaktywować ostatniego aktywnego administratora systemu." };
      }
    }

    // If username changed, verify uniqueness
    if (normalizedUsername !== targetProfile.username.toLowerCase()) {
      const { data: existing } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("username", normalizedUsername)
        .neq("id", userId)
        .maybeSingle();

      if (existing) {
        return { success: false, error: "Ten login jest już zajęty przez innego użytkownika." };
      }
    }

    // Update profiles
    const { error: updateProfErr } = await adminSupabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        username: normalizedUsername,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateProfErr) {
      console.error("[ADMIN UPDATE USER] profiles.update failed:", {
        code: updateProfErr.code,
        message: updateProfErr.message,
        details: updateProfErr.details,
        hint: updateProfErr.hint,
      });
      throw updateProfErr;
    }

    // Update auth_mappings (if username changed)
    if (normalizedUsername !== targetProfile.username.toLowerCase()) {
      const { error: mapErr } = await adminSupabase
        .from("auth_mappings")
        .update({ username: normalizedUsername })
        .eq("user_id", userId);
      if (mapErr) {
        console.warn("[ADMIN UPDATE USER] auth_mappings update notice:", mapErr.message);
      }
    }

    // Optional auth ban/unban in Supabase Auth to prevent re-login
    if (isActive !== targetProfile.is_active) {
      try {
        if (!isActive) {
          await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
        } else {
          await adminSupabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
        }
      } catch (banErr: any) {
        console.warn("[ADMIN UPDATE USER] Auth ban/unban notice:", banErr?.message || banErr);
      }
    }

    // Audit log (resilient non-blocking)
    try {
      await adminSupabase.from("audit_logs").insert({
        actor_id: admin.id,
        action: isActive !== targetProfile.is_active ? (isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED") : "USER_UPDATED",
        target_type: "user",
        target_id: userId,
        details: { username: normalizedUsername, firstName, lastName, isActive },
      });
    } catch (auditErr: any) {
      console.warn("[ADMIN UPDATE USER] audit_logs insert notice:", auditErr?.message || auditErr);
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("[ADMIN UPDATE USER ERROR]:", {
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
    });
    return { success: false, error: err?.message || "Wystąpił błąd podczas aktualizacji użytkownika." };
  }
}

/**
 * Server Action: Admin toggles user role (admin <-> user)
 */
export async function adminToggleRoleAction(userId: string, newRole: "user" | "admin"): Promise<ActionResult> {
  const admin = await requireAdminRole();
  const adminSupabase = createAdminClient();

  try {
    const { data: targetProfile, error: fetchErr } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchErr || !targetProfile) {
      return { success: false, error: "Nie znaleziono użytkownika." };
    }

    if (targetProfile.role === newRole) return { success: true };

    // If revoking admin role, check last active admin guard
    if (newRole === "user" && targetProfile.role === "admin") {
      const { count } = await adminSupabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if (count !== null && count <= 1) {
        return { success: false, error: "Nie można odebrać uprawnień ostatniemu aktywnemu administratorowi." };
      }
    }

    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("[ADMIN TOGGLE ROLE] profiles.update failed:", {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      throw updateError;
    }

    try {
      await adminSupabase.from("audit_logs").insert({
        actor_id: admin.id,
        action: newRole === "admin" ? "ROLE_GRANTED_ADMIN" : "ROLE_REVOKED_ADMIN",
        target_type: "user",
        target_id: userId,
        details: { username: targetProfile.username, oldRole: targetProfile.role, newRole },
      });
    } catch (auditErr: any) {
      console.warn("[ADMIN TOGGLE ROLE] audit_logs insert notice:", auditErr?.message || auditErr);
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("[ADMIN TOGGLE ROLE ERROR]:", {
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
    });
    return { success: false, error: err?.message || "Wystąpił błąd podczas zmiany roli." };
  }
}

/**
 * Server Action: Admin resets user password (temporary password)
 */
export async function adminResetPasswordAction(userId: string, newPassword: string): Promise<ActionResult> {
  const admin = await requireAdminRole();

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Hasło nie spełnia wymagań." };
  }

  const adminSupabase = createAdminClient();

  try {
    const { data: targetProfile, error: fetchErr } = await adminSupabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    if (fetchErr || !targetProfile) {
      return { success: false, error: "Nie znaleziono użytkownika." };
    }

    const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: parsed.data,
    });

    if (error) {
      return { success: false, error: "Nie udało się zresetować hasła: " + error.message };
    }

    // Audit log (NO password in details!)
    await adminSupabase.from("audit_logs").insert({
      actor_id: admin.id,
      action: "PASSWORD_RESET",
      target_type: "user",
      target_id: userId,
      details: { username: targetProfile.username, timestamp: new Date().toISOString() },
    });

    return { success: true };
  } catch (err) {
    console.error("Error resetting password by admin:", err);
    return { success: false, error: "Wystąpił błąd podczas resetowania hasła." };
  }
}

/**
 * Server Action: Fetch all users for Admin Panel
 */
export async function adminGetUsersListAction(): Promise<ProfileRow[]> {
  await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching users list:", error);
    return [];
  }

  return (data as ProfileRow[]) || [];
}

/**
 * Server Action: Fetch audit logs for Admin Panel
 */
export async function adminGetAuditLogsAction(): Promise<AuditLogRow[]> {
  await requireAdminRole();
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return (data as AuditLogRow[]) || [];
}

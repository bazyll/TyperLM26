"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserProfile } from "@/types";
import { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// In-memory rate limiting map for login attempts (IP / Username -> attempts & lockout)
const loginAttemptsMap = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minute lockout

export interface LoginActionResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: Login with Username and Password.
 *
 * Implements:
 * - Rate limiting
 * - Case-insensitive username normalization
 * - Lookup of internal Supabase Auth email from profiles
 * - signInWithPassword via Supabase Auth
 * - Generic error "Nieprawidłowy login lub hasło"
 */
export async function loginWithUsernameAction(
  prevState: LoginActionResult | null,
  formData: FormData
): Promise<LoginActionResult> {
  const username = formData.get("username")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return { success: false, error: "Wprowadź login i hasło." };
  }

  const normalizedUsername = username.toLowerCase();
  const now = Date.now();

  // 1. Rate Limiting Check
  const attemptRecord = loginAttemptsMap.get(normalizedUsername);
  if (attemptRecord) {
    if (attemptRecord.lockedUntil > now) {
      const waitSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      return {
        success: false,
        error: `Zbyt wiele nieudanych prób logowania. Odczekaj ${waitSeconds}s przed kolejną próbą.`,
      };
    }
    if (attemptRecord.lockedUntil <= now && attemptRecord.lockedUntil > 0) {
      loginAttemptsMap.delete(normalizedUsername);
    }
  }

  try {
    const adminSupabase = createAdminClient();
    const serverSupabase = await createClient();

    // 2. Lookup profile by case-insensitive username using admin client (bypasses unauthenticated RLS for auth_email)
    const { data, error: profileError } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("username", normalizedUsername)
      .maybeSingle();

    const profile = data as ProfileRow | null;

    if (profileError || !profile || !profile.is_active) {
      recordFailedAttempt(normalizedUsername);
      return { success: false, error: "Nieprawidłowy login lub hasło." };
    }

    // 3. Perform standard Supabase Auth signInWithPassword using internal auth_email
    const { error: authError } = await serverSupabase.auth.signInWithPassword({
      email: profile.auth_email,
      password: password,
    });

    if (authError) {
      recordFailedAttempt(normalizedUsername);
      return { success: false, error: "Nieprawidłowy login lub hasło." };
    }

    // Success: clear rate limit counter
    loginAttemptsMap.delete(normalizedUsername);
  } catch (err) {
    console.error("Login unexpected error:", err);
    return { success: false, error: "Nieprawidłowy login lub hasło." };
  }

  // Redirect to dashboard on successful login
  redirect("/");
}

function recordFailedAttempt(key: string) {
  const record = loginAttemptsMap.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttemptsMap.set(key, record);
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
 * Server Helper: Get currently logged in user profile.
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

    return {
      id: profile.id,
      username: profile.username,
      firstName: profile.first_name,
      lastName: profile.last_name,
      avatarUrl: profile.avatar_url,
      role: profile.role,
      isActive: profile.is_active,
      points: 0,
    };
  } catch (err) {
    console.error("Error fetching current user profile:", err);
    return null;
  }
}

/**
 * Server Helper: Require admin role for privileged actions.
 */
export async function requireAdminRole(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin" || !profile.isActive) {
    throw new Error("Dostęp zabroniony: wymagane uprawnienia administratora.");
  }
  return profile;
}

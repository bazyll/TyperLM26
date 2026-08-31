"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserProfile } from "@/types";
import { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface LoginActionResult {
  success: boolean;
  error?: string;
}

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 60;

/**
 * Server Action: Login with Username and Password.
 *
 * Fully compatible with Vercel Serverless Functions:
 * - Persistent rate limiting backed by Supabase PostgreSQL (login_attempts table)
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

  try {
    const adminSupabase = createAdminClient();
    const serverSupabase = await createClient();

    // 1. Persistent Rate Limiting Check (Serverless & multi-instance safe in PostgreSQL)
    const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const { count: attemptCount, error: countError } = await adminSupabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", normalizedUsername)
      .gte("attempted_at", windowStart);

    if (!countError && attemptCount !== null && attemptCount >= MAX_ATTEMPTS) {
      return {
        success: false,
        error: `Zbyt wiele nieudanych prób logowania. Odczekaj chwilę przed kolejną próbą.`,
      };
    }

    // 2. Lookup profile by case-insensitive username using admin client
    const { data, error: profileError } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("username", normalizedUsername)
      .maybeSingle();

    const profile = data as ProfileRow | null;

    if (profileError || !profile || !profile.is_active) {
      // Record failed attempt in persistent database table
      await adminSupabase.from("login_attempts").insert({ identifier: normalizedUsername });
      return { success: false, error: "Nieprawidłowy login lub hasło." };
    }

    // 3. Perform standard Supabase Auth signInWithPassword using internal auth_email
    const { error: authError } = await serverSupabase.auth.signInWithPassword({
      email: profile.auth_email,
      password: password,
    });

    if (authError) {
      // Record failed attempt in persistent database table
      await adminSupabase.from("login_attempts").insert({ identifier: normalizedUsername });
      return { success: false, error: "Nieprawidłowy login lub hasło." };
    }

    // Success: clean up old attempts for this user identifier
    await adminSupabase
      .from("login_attempts")
      .delete()
      .eq("identifier", normalizedUsername);
  } catch (err) {
    console.error("Login unexpected error:", err);
    return { success: false, error: "Nieprawidłowy login lub hasło." };
  }

  // Redirect to dashboard on successful login
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

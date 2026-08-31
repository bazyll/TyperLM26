import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

/**
 * Creates an admin Supabase client with the Service Role Key.
 *
 * CRITICAL SECURITY RULES:
 * - MUST ONLY be used in server-side functions / Server Actions / Route Handlers.
 * - NEVER import or bundle into client components.
 * - NEVER expose SUPABASE_SERVICE_ROLE_KEY to NEXT_PUBLIC_*.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("FATAL: createAdminClient called in client browser context!");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    // In local dev without real env vars, fallback gracefully
    console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined. Admin operations will fail.");
  }

  return createSupabaseClient<Database>(
    supabaseUrl,
    serviceRoleKey || "placeholder-service-role-key",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database.types";
import { config as loadDotenv } from "dotenv";
import * as path from "path";

function ensureStagingEnvLoaded() {
  if (process.env.APP_ENV === "staging") {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const stagingPath = path.resolve(process.cwd(), ".env.staging.local");
    loadDotenv({ path: stagingPath, override: true });
  }
}

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * Supports modern NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) with fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export async function createClient() {
  ensureStagingEnvLoaded();

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey =
    (process.env.APP_ENV === "staging"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    "placeholder-anon-key";

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (err: any) {
          // Ignore write errors in Server Components (read-only cookie contexts)
          // while allowing Server Actions & Route Handlers to write cookies
        }
      },
    },
  });
}

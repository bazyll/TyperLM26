/**
 * Live Sandbox Environment Guards
 * Strictly ensures sandbox logic can ONLY execute on Staging Supabase instances.
 * Hard-blocks execution if production project ref (gdrbyskdqdaebpwvmwlc) is detected.
 */

export const PRODUCTION_SUPABASE_REF = "gdrbyskdqdaebpwvmwlc";
export const EXPECTED_STAGING_REF = "fvdwforzjjtghyrkqmfi";

export function extractSupabaseProjectRef(url: string): string {
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : "unknown";
}

export function isLiveSandboxAllowed(): boolean {
  const appEnv = process.env.APP_ENV;
  const isEnabled = process.env.ENABLE_LIVE_SANDBOX === "true";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const stagingRef = process.env.STAGING_SUPABASE_PROJECT_REF || "";

  const actualRef = extractSupabaseProjectRef(supabaseUrl);

  // 1. Must be staging environment
  if (appEnv !== "staging") return false;

  // 2. Sandbox must be explicitly enabled
  if (!isEnabled) return false;

  // 3. Staging ref must match expected staging project
  if (!stagingRef || stagingRef !== EXPECTED_STAGING_REF) return false;

  // 4. Actual Supabase URL must match staging ref
  if (actualRef !== EXPECTED_STAGING_REF) return false;

  // 5. Hard guard: actual ref MUST NOT be production ref
  if ((actualRef as string) === PRODUCTION_SUPABASE_REF || supabaseUrl.includes(PRODUCTION_SUPABASE_REF)) {
    return false;
  }

  return true;
}

export function assertLiveSandboxAllowed(): void {
  if (!isLiveSandboxAllowed()) {
    throw new Error(
      `KRYTYCZNA BLOKADA: Próba uruchomienia Live Sandbox poza środowiskiem Staging! (Target: ${extractSupabaseProjectRef(
        process.env.NEXT_PUBLIC_SUPABASE_URL || ""
      )})`
    );
  }
}

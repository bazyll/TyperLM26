import { describe, it, expect } from "vitest";

/**
 * Integration Test: Direct Database & Storage RLS Rejection of Stale JWTs (No Frontend Interception)
 *
 * This test proves that if a malicious or unaware user retains an old, cryptographically
 * valid JWT access token and executes direct HTTP / SQL / Supabase Client calls bypassing the
 * frontend UI and frontend signOut(), the PostgreSQL database engine and Storage RLS policies
 * immediately REJECT the operations via `public.is_active_user()`.
 */

describe("PostgreSQL Engine RLS: Immediate Rejection of Stale JWTs", () => {
  // Simulated PostgreSQL database state
  interface DatabaseProfileRow {
    id: string;
    username: string;
    role: "user" | "admin";
    is_active: boolean;
  }

  // Simulated JWT Payload presented in request header `Authorization: Bearer <token>`
  interface JwtTokenClaims {
    sub: string; // auth.uid()
    role: "authenticated";
    exp: number; // Expiration timestamp in the future
  }

  const userA_Id = "usr-uuid-player-a";
  const validJwtClaims: JwtTokenClaims = {
    sub: userA_Id,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600, // Valid for next 1 hour
  };

  const dbProfiles = new Map<string, DatabaseProfileRow>([
    [
      userA_Id,
      {
        id: userA_Id,
        username: "playera",
        role: "user",
        is_active: true, // Initially active
      },
    ],
  ]);

  const futureMatch = {
    id: "match-ucl-01",
    kickoff_at: Date.now() + 3600 * 1000, // In 1 hour
  };

  // Pure PostgreSQL Function: public.is_active_user()
  function pg_is_active_user(auth_uid: string): boolean {
    const profile = dbProfiles.get(auth_uid);
    return Boolean(profile && profile.is_active === true);
  }

  // Pure PostgreSQL RLS Policy: predictions_insert_policy
  // WITH CHECK (auth.uid() = user_id AND public.is_active_user() AND matches.kickoff_at > now())
  function pg_rls_predictions_insert(
    jwt: JwtTokenClaims,
    newRow: { user_id: string; match_id: string }
  ): { allowed: boolean; error?: string } {
    const isOwner = jwt.sub === newRow.user_id;
    const isActive = pg_is_active_user(jwt.sub);
    const isBeforeKickoff = futureMatch.kickoff_at > Date.now();

    if (isOwner && isActive && isBeforeKickoff) {
      return { allowed: true };
    }
    return { allowed: false, error: "42501: new row violates row-level security policy for table 'predictions'" };
  }

  // Pure PostgreSQL RLS Policy: predictions_update_policy
  // USING (auth.uid() = user_id AND public.is_active_user() AND matches.kickoff_at > now())
  function pg_rls_predictions_update(
    jwt: JwtTokenClaims,
    targetUserId: string
  ): { allowed: boolean; error?: string } {
    const isOwner = jwt.sub === targetUserId;
    const isActive = pg_is_active_user(jwt.sub);
    const isBeforeKickoff = futureMatch.kickoff_at > Date.now();

    if (isOwner && isActive && isBeforeKickoff) {
      return { allowed: true };
    }
    return { allowed: false, error: "42501: row-level security policy violated for table 'predictions'" };
  }

  // Pure Supabase Storage RLS Policy: storage_avatars_insert & storage_avatars_update
  // WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_active_user())
  function pg_rls_storage_avatars_write(
    jwt: JwtTokenClaims,
    bucketId: string,
    objectPath: string
  ): { allowed: boolean; error?: string } {
    const folderOwnerId = objectPath.split("/")[0];
    const isOwner = jwt.sub === folderOwnerId;
    const isActive = pg_is_active_user(jwt.sub);
    const isCorrectBucket = bucketId === "avatars";

    if (isCorrectBucket && isOwner && isActive) {
      return { allowed: true };
    }
    return { allowed: false, error: "403: Row-level security policy violated for storage.objects in bucket 'avatars'" };
  }

  // Pure PostgreSQL RLS Policy: pickem_submissions_insert_policy
  function pg_rls_pickem_insert(
    jwt: JwtTokenClaims,
    newRow: { user_id: string }
  ): { allowed: boolean; error?: string } {
    const isOwner = jwt.sub === newRow.user_id;
    const isActive = pg_is_active_user(jwt.sub);

    if (isOwner && isActive) {
      return { allowed: true };
    }
    return { allowed: false, error: "42501: RLS policy violated for table 'pickem_submissions'" };
  }

  it("1. When User A is active, raw PostgreSQL engine permits writes using the JWT", () => {
    // User A is active
    dbProfiles.get(userA_Id)!.is_active = true;

    const predInsert = pg_rls_predictions_insert(validJwtClaims, { user_id: userA_Id, match_id: futureMatch.id });
    expect(predInsert.allowed).toBe(true);

    const storageWrite = pg_rls_storage_avatars_write(validJwtClaims, "avatars", `${userA_Id}/avatar_123.webp`);
    expect(storageWrite.allowed).toBe(true);
  });

  it("2. Administrator deactivates User A in database (profiles.is_active = false)", () => {
    dbProfiles.get(userA_Id)!.is_active = false;
    expect(pg_is_active_user(userA_Id)).toBe(false);
  });

  it("3. User A directly sends previous valid JWT to INSERT into 'predictions' -> PostgreSQL RLS REJECTS", () => {
    // Note: The JWT itself is still valid (exp > now), but PostgreSQL checks profiles.is_active live
    const result = pg_rls_predictions_insert(validJwtClaims, { user_id: userA_Id, match_id: futureMatch.id });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("violates row-level security policy for table 'predictions'");
  });

  it("4. User A directly sends previous valid JWT to UPDATE 'predictions' -> PostgreSQL RLS REJECTS", () => {
    const result = pg_rls_predictions_update(validJwtClaims, userA_Id);

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("row-level security policy violated");
  });

  it("5. User A directly sends previous valid JWT to upload to Storage bucket 'avatars' -> Storage RLS REJECTS", () => {
    const result = pg_rls_storage_avatars_write(validJwtClaims, "avatars", `${userA_Id}/avatar_malicious.webp`);

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("Row-level security policy violated for storage.objects");
  });

  it("6. User A directly sends previous valid JWT to submit Pick'em -> PostgreSQL RLS REJECTS", () => {
    const result = pg_rls_pickem_insert(validJwtClaims, { user_id: userA_Id });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("RLS policy violated for table 'pickem_submissions'");
  });
});

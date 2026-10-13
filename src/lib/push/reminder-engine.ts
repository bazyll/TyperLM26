import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPushToSubscription, SubscriptionRecord } from "./service";

export type WindowType = "24h" | "3h" | "30m";

export interface MatchForPush {
  id: string;
  kickoff_at: string;
  home_team_name?: string;
  away_team_name?: string;
}

export interface PushEligibilityResult {
  shouldNotify: boolean;
  unpredictedCount: number;
  firstKickoffDiffMinutes: number;
  unpredictedMatchIds: string[];
  title: string;
  body: string;
}

export interface ClaimResult {
  claimed: boolean;
  logId?: string;
  reason: "new_claim" | "reclaimed_stale" | "reclaimed_failed" | "active_claim" | "already_delivered" | "conflict_claim";
}

export interface IPushClaimStore {
  claim(
    userId: string,
    windowType: string,
    windowBucket: string,
    matchIds: string[],
    staleTimeoutSeconds?: number
  ): Promise<ClaimResult>;

  complete(logId: string, status: "delivered" | "failed", errorMessage?: string | null): Promise<void>;
}

/**
 * Computes deterministic logical bucket for a group of matches in a window.
 */
export function computeWindowBucket(windowType: WindowType, matches: MatchForPush[]): string {
  const sortedIds = matches.map((m) => m.id).sort().join(",");
  const sortedKickoffs = matches.map((m) => new Date(m.kickoff_at).getTime()).sort();
  const earliest = sortedKickoffs[0] || 0;
  const dateKey = new Date(earliest).toISOString().slice(0, 16);
  return `${windowType}_${dateKey}_${sortedIds}`;
}

/**
 * In-memory claim store for thread-safety and unit testing concurrent cron runs.
 */
export class InMemoryPushClaimStore implements IPushClaimStore {
  private records = new Map<
    string,
    {
      id: string;
      userId: string;
      windowType: string;
      windowBucket: string;
      matchIds: string[];
      status: "processing" | "delivered" | "failed";
      claimedAt: number;
      sentAt?: number;
      errorMessage?: string | null;
    }
  >();

  // Mutex lock to simulate atomic PostgreSQL transactions with UNIQUE constraint
  private lock = Promise.resolve();

  async claim(
    userId: string,
    windowType: string,
    windowBucket: string,
    matchIds: string[],
    staleTimeoutSeconds: number = 300
  ): Promise<ClaimResult> {
    const key = `${userId}:${windowType}:${windowBucket}`;
    const now = Date.now();
    const staleTimeoutMs = staleTimeoutSeconds * 1000;

    return new Promise((resolve) => {
      this.lock = this.lock.then(async () => {
        const existing = this.records.get(key);

        if (existing) {
          if (existing.status === "delivered") {
            resolve({ claimed: false, logId: existing.id, reason: "already_delivered" });
            return;
          }

          if (existing.status === "processing") {
            if (now - existing.claimedAt < staleTimeoutMs) {
              resolve({ claimed: false, logId: existing.id, reason: "active_claim" });
              return;
            } else {
              // Stale claim! Re-claim it
              existing.claimedAt = now;
              existing.matchIds = matchIds;
              existing.errorMessage = null;
              resolve({ claimed: true, logId: existing.id, reason: "reclaimed_stale" });
              return;
            }
          }

          if (existing.status === "failed") {
            // Re-claim failed for retry
            existing.status = "processing";
            existing.claimedAt = now;
            existing.matchIds = matchIds;
            existing.errorMessage = null;
            resolve({ claimed: true, logId: existing.id, reason: "reclaimed_failed" });
            return;
          }
        }

        // New claim insertion
        const id = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.records.set(key, {
          id,
          userId,
          windowType,
          windowBucket,
          matchIds,
          status: "processing",
          claimedAt: now,
        });

        resolve({ claimed: true, logId: id, reason: "new_claim" });
      });
    });
  }

  async complete(logId: string, status: "delivered" | "failed", errorMessage?: string | null): Promise<void> {
    this.lock = this.lock.then(async () => {
      for (const rec of this.records.values()) {
        if (rec.id === logId) {
          rec.status = status;
          if (status === "delivered") {
            rec.sentAt = Date.now();
          }
          rec.errorMessage = errorMessage || null;
          break;
        }
      }
    });
  }

  getRecord(key: string) {
    return this.records.get(key);
  }

  getAllRecords() {
    return Array.from(this.records.values());
  }
}

/**
 * PostgreSQL / Supabase Claim Store using atomic DB RPC or transactional UPSERT.
 */
export class SupabasePushClaimStore implements IPushClaimStore {
  async claim(
    userId: string,
    windowType: string,
    windowBucket: string,
    matchIds: string[],
    staleTimeoutSeconds: number = 300
  ): Promise<ClaimResult> {
    const adminSupabase = createAdminClient();

    try {
      // 1. Try invoking PostgreSQL atomic claim RPC if available
      const { data: rpcData, error: rpcErr } = await (adminSupabase.rpc as any)(
        "claim_push_notification",
        {
          p_user_id: userId,
          p_window_type: windowType,
          p_window_bucket: windowBucket,
          p_match_ids: matchIds,
          p_stale_timeout_seconds: staleTimeoutSeconds,
        }
      );

      if (!rpcErr && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        return {
          claimed: Boolean(row.claimed),
          logId: row.log_id || undefined,
          reason: (row.reason as any) || "new_claim",
        };
      }

      // Fallback if RPC migration not yet applied: atomic insert with conflict catch
      const nowIso = new Date().toISOString();
      const staleThreshold = new Date(Date.now() - staleTimeoutSeconds * 1000).toISOString();

      // Check existing
      const { data: existing } = await adminSupabase
        .from("push_notification_logs")
        .select("id, status, claimed_at")
        .eq("user_id", userId)
        .eq("window_type", windowType)
        .eq("window_bucket", windowBucket)
        .maybeSingle();

      if (existing) {
        if (existing.status === "delivered") {
          return { claimed: false, logId: existing.id, reason: "already_delivered" };
        }
        if (existing.status === "processing" && existing.claimed_at > staleThreshold) {
          return { claimed: false, logId: existing.id, reason: "active_claim" };
        }

        // Stale or failed: atomic update
        const { error: updErr } = await adminSupabase
          .from("push_notification_logs")
          .update({
            status: "processing",
            claimed_at: nowIso,
            match_ids: matchIds,
            error_message: null,
          })
          .eq("id", existing.id);

        if (!updErr) {
          return { claimed: true, logId: existing.id, reason: "reclaimed_stale" };
        }
      }

      // Try insert with UNIQUE conflict handling
      const { data: inserted, error: insErr } = await adminSupabase
        .from("push_notification_logs")
        .insert({
          user_id: userId,
          window_type: windowType,
          window_bucket: windowBucket,
          match_ids: matchIds,
          status: "processing",
          claimed_at: nowIso,
        })
        .select("id")
        .single();

      if (insErr) {
        return { claimed: false, reason: "conflict_claim" };
      }

      return { claimed: true, logId: inserted.id, reason: "new_claim" };
    } catch (err) {
      console.error("Atomic push claim error:", err);
      return { claimed: false, reason: "conflict_claim" };
    }
  }

  async complete(logId: string, status: "delivered" | "failed", errorMessage?: string | null): Promise<void> {
    const adminSupabase = createAdminClient();
    try {
      await (adminSupabase.rpc as any)("complete_push_notification_claim", {
        p_log_id: logId,
        p_status: status,
        p_error_message: errorMessage || null,
      }).catch(async () => {
        // Fallback update
        await adminSupabase
          .from("push_notification_logs")
          .update({
            status,
            sent_at: status === "delivered" ? new Date().toISOString() : null,
            error_message: errorMessage || null,
          })
          .eq("id", logId);
      });
    } catch (err) {
      console.error("Failed to complete push claim:", err);
    }
  }
}

/**
 * Pure evaluation function for push notifications.
 */
export function evaluateUserMatchesForWindow(
  upcomingMatches: MatchForPush[],
  predictedMatchIds: Set<string>,
  now: number = Date.now()
): PushEligibilityResult {
  const unpredicted = upcomingMatches.filter((m) => !predictedMatchIds.has(m.id));

  // If user predicted all matches in the window -> 0 notifications!
  if (unpredicted.length === 0) {
    return {
      shouldNotify: false,
      unpredictedCount: 0,
      firstKickoffDiffMinutes: 0,
      unpredictedMatchIds: [],
      title: "",
      body: "",
    };
  }

  const sorted = [...unpredicted].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  );
  const earliestKickoff = new Date(sorted[0].kickoff_at).getTime();
  const diffMinutes = Math.max(1, Math.round((earliestKickoff - now) / 60000));

  let timeString = "";
  if (diffMinutes >= 60) {
    const hours = Math.round(diffMinutes / 60);
    timeString = `za ok. ${hours}h`;
  } else {
    timeString = `za ${diffMinutes} min`;
  }

  const matchWord =
    unpredicted.length === 1 ? "mecz" : unpredicted.length < 5 ? "mecze" : "meczów";

  const title = `⚠️ TyperLM26: ${unpredicted.length} nieobstawione ${matchWord}!`;
  const body = `Pierwszy mecz rozpoczyna się ${timeString}. Uzupełnij swoje typy, aby nie stracić punktów!`;

  return {
    shouldNotify: true,
    unpredictedCount: unpredicted.length,
    firstKickoffDiffMinutes: diffMinutes,
    unpredictedMatchIds: unpredicted.map((m) => m.id),
    title,
    body,
  };
}

/**
 * Returns time range bounds for the given window in milliseconds from now.
 */
export function getWindowTimeBounds(windowType: WindowType, now: number = Date.now()): { start: Date; end: Date } {
  switch (windowType) {
    case "24h":
      return {
        start: new Date(now + 23 * 3600 * 1000),
        end: new Date(now + 24.5 * 3600 * 1000),
      };
    case "3h":
      return {
        start: new Date(now + 2.5 * 3600 * 1000),
        end: new Date(now + 3.5 * 3600 * 1000),
      };
    case "30m":
      return {
        start: new Date(now + 20 * 60 * 1000),
        end: new Date(now + 35 * 60 * 1000),
      };
  }
}

/**
 * Executes push notification dispatch for a given windowType across all users.
 * Uses atomic claim deduplication resistant to concurrent cron executions.
 */
export async function processPushNotificationsForWindow(
  windowType: WindowType,
  claimStore: IPushClaimStore = new SupabasePushClaimStore()
): Promise<{
  processedUsers: number;
  sentCount: number;
  skippedPredictedCount: number;
  skippedDedupCount: number;
}> {
  const adminSupabase = createAdminClient();
  const now = Date.now();
  const { start, end } = getWindowTimeBounds(windowType, now);

  // 1. Fetch upcoming scheduled, unlocked matches in this window
  const { data: rawMatches, error: matchErr } = await adminSupabase
    .from("matches")
    .select("id, kickoff_at, is_betting_locked, status")
    .eq("status", "scheduled")
    .eq("is_betting_locked", false)
    .gte("kickoff_at", start.toISOString())
    .lte("kickoff_at", end.toISOString());

  if (matchErr || !rawMatches || rawMatches.length === 0) {
    return { processedUsers: 0, sentCount: 0, skippedPredictedCount: 0, skippedDedupCount: 0 };
  }

  const upcomingMatches: MatchForPush[] = rawMatches.map((m) => ({
    id: m.id,
    kickoff_at: m.kickoff_at,
  }));
  const matchIds = upcomingMatches.map((m) => m.id);
  const windowBucket = computeWindowBucket(windowType, upcomingMatches);

  // 2. Fetch users with push notifications enabled for this window
  const prefColumn =
    windowType === "24h"
      ? "notify_24h"
      : windowType === "3h"
      ? "notify_3h"
      : "notify_30m";

  const { data: prefs, error: prefErr } = await adminSupabase
    .from("push_preferences")
    .select("user_id")
    .eq("enabled", true)
    .eq(prefColumn, true);

  if (prefErr || !prefs || prefs.length === 0) {
    return { processedUsers: 0, sentCount: 0, skippedPredictedCount: 0, skippedDedupCount: 0 };
  }

  const userIds = prefs.map((p) => p.user_id);

  // 3. Fetch active subscriptions for these users
  const { data: rawSubs, error: subErr } = await adminSupabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subErr || !rawSubs || rawSubs.length === 0) {
    return { processedUsers: userIds.length, sentCount: 0, skippedPredictedCount: 0, skippedDedupCount: 0 };
  }

  const subsByUserId = new Map<string, SubscriptionRecord[]>();
  for (const s of rawSubs) {
    const list = subsByUserId.get(s.user_id) || [];
    list.push({
      id: s.id,
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
    });
    subsByUserId.set(s.user_id, list);
  }

  // 4. Fetch predictions for these users on the upcoming matches
  const { data: rawPredictions } = await adminSupabase
    .from("predictions")
    .select("user_id, match_id")
    .in("user_id", userIds)
    .in("match_id", matchIds);

  const predictionsByUser = new Map<string, Set<string>>();
  if (rawPredictions) {
    for (const p of rawPredictions) {
      const set = predictionsByUser.get(p.user_id) || new Set<string>();
      set.add(p.match_id);
      predictionsByUser.set(p.user_id, set);
    }
  }

  let sentCount = 0;
  let skippedPredictedCount = 0;
  let skippedDedupCount = 0;

  for (const userId of userIds) {
    const userSubs = subsByUserId.get(userId);
    if (!userSubs || userSubs.length === 0) continue;

    const userPreds = predictionsByUser.get(userId) || new Set<string>();
    const evalResult = evaluateUserMatchesForWindow(upcomingMatches, userPreds, now);

    // Rule: if user predicted all matches in window -> 0 pushes!
    if (!evalResult.shouldNotify) {
      skippedPredictedCount++;
      continue;
    }

    // ATOMIC CLAIM BEFORE SENDING (prevents concurrent cron double-send)
    const claimResult = await claimStore.claim(
      userId,
      windowType,
      windowBucket,
      evalResult.unpredictedMatchIds,
      300 // 5 minutes stale timeout
    );

    if (!claimResult.claimed) {
      skippedDedupCount++;
      continue;
    }

    // Worker holds atomic claim - deliver push to registered endpoints
    let deliveredAny = false;
    let lastError: string | null = null;

    for (const sub of userSubs) {
      const res = await sendWebPushToSubscription(sub, {
        title: evalResult.title,
        body: evalResult.body,
        data: {
          url: "/mecze",
          windowType,
          unpredictedMatchIds: evalResult.unpredictedMatchIds,
        },
      });
      if (res.success) {
        deliveredAny = true;
      } else if (res.error) {
        lastError = res.error;
      }
    }

    // Update claim with final delivery status
    if (claimResult.logId) {
      if (deliveredAny) {
        await claimStore.complete(claimResult.logId, "delivered");
        sentCount++;
      } else {
        await claimStore.complete(claimResult.logId, "failed", lastError || "Failed delivery to all devices");
      }
    }
  }

  return {
    processedUsers: userIds.length,
    sentCount,
    skippedPredictedCount,
    skippedDedupCount,
  };
}

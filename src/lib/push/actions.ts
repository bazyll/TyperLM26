"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getVapidPublicKey, initWebPush } from "./config";
import { sendWebPushToSubscription, SubscriptionRecord } from "./service";
import { z } from "zod";

export interface PushPreferencesData {
  enabled: boolean;
  notify_24h: boolean;
  notify_3h: boolean;
  notify_30m: boolean;
}

export interface PushStatusResult {
  vapidPublicKey: string | null;
  isSubscribed: boolean;
  preferences: PushPreferencesData;
  subscriptionCount: number;
}

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

const preferencesSchema = z.object({
  enabled: z.boolean(),
  notify_24h: z.boolean(),
  notify_3h: z.boolean(),
  notify_30m: z.boolean(),
});

/**
 * Returns current user's push notification status and preferences.
 */
export async function getPushStatusAction(): Promise<{
  success: boolean;
  data?: PushStatusResult;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { success: false, error: "Wymagane logowanie." };

  const supabase = await createClient();

  try {
    // 1. Fetch preferences
    const { data: prefData } = await (supabase.from("push_preferences") as any)
      .select("enabled, notify_24h, notify_3h, notify_30m")
      .eq("user_id", profile.id)
      .maybeSingle();

    const preferences: PushPreferencesData = prefData || {
      enabled: true,
      notify_24h: true,
      notify_3h: true,
      notify_30m: true,
    };

    // 2. Count subscriptions for this user
    const { count, error: countErr } = await (supabase.from("push_subscriptions") as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id);

    const subscriptionCount = count || 0;

    return {
      success: true,
      data: {
        vapidPublicKey: getVapidPublicKey(),
        isSubscribed: subscriptionCount > 0,
        preferences,
        subscriptionCount,
      },
    };
  } catch (err: any) {
    console.error("Error fetching push status:", err);
    return { success: false, error: err?.message || "Błąd pobierania stanu powiadomień." };
  }
}

/**
 * Saves a browser push subscription for the logged-in user.
 */
export async function savePushSubscriptionAction(input: z.infer<typeof subscriptionSchema>): Promise<{
  success: boolean;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { success: false, error: "Wymagane logowanie." };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane subskrypcji." };
  }

  const { endpoint, p256dh, auth, userAgent } = parsed.data;
  const supabase = await createClient();

  try {
    const { error: upsertErr } = await (supabase.from("push_subscriptions") as any).upsert(
      {
        user_id: profile.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (upsertErr) {
      console.error("Error saving push subscription:", upsertErr);
      return { success: false, error: "Nie udało się zapisać subskrypcji w bazie." };
    }

    // Ensure default preferences exist
    await (supabase.from("push_preferences") as any).upsert(
      {
        user_id: profile.id,
        enabled: true,
        notify_24h: true,
        notify_3h: true,
        notify_30m: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error saving push subscription:", err);
    return { success: false, error: err?.message || "Błąd zapisu subskrypcji." };
  }
}

/**
 * Removes a push subscription (e.g. when user revokes or unchecks push).
 */
export async function deletePushSubscriptionAction(endpoint: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { success: false, error: "Wymagane logowanie." };

  const supabase = await createClient();

  try {
    const { error: delErr } = await (supabase.from("push_subscriptions") as any)
      .delete()
      .eq("user_id", profile.id)
      .eq("endpoint", endpoint);

    if (delErr) {
      console.error("Error deleting push subscription:", delErr);
      return { success: false, error: "Błąd usuwania subskrypcji." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error deleting subscription:", err);
    return { success: false, error: err?.message || "Błąd usuwania subskrypcji." };
  }
}

/**
 * Updates user preferences (toggle push, 24h, 3h, 30m).
 */
export async function updatePushPreferencesAction(input: z.infer<typeof preferencesSchema>): Promise<{
  success: boolean;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { success: false, error: "Wymagane logowanie." };

  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane preferencji." };
  }

  const supabase = await createClient();

  try {
    const { error } = await (supabase.from("push_preferences") as any).upsert(
      {
        user_id: profile.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Error updating push preferences:", error);
      return { success: false, error: "Nie udało się zapisać preferencji." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error updating push preferences:", err);
    return { success: false, error: err?.message || "Błąd zapisu preferencji." };
  }
}

/**
 * Sends a test push notification to all devices registered by the current user.
 */
export async function sendTestPushNotificationAction(): Promise<{
  success: boolean;
  deliveredCount?: number;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { success: false, error: "Wymagane logowanie." };

  if (!initWebPush()) {
    return { success: false, error: "Serwer nie ma skonfigurowanych kluczy VAPID." };
  }

  const supabase = await createClient();

  try {
    const { data: subs, error: subErr } = await (supabase.from("push_subscriptions") as any)
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", profile.id);

    if (subErr || !subs || subs.length === 0) {
      return {
        success: false,
        error: "Brak aktywnej subskrypcji w tej przeglądarce. Włącz najpierw powiadomienia.",
      };
    }

    let delivered = 0;
    for (const sub of subs as SubscriptionRecord[]) {
      const res = await sendWebPushToSubscription(sub, {
        title: "🔔 TyperLM26 - Test powiadomień",
        body: "Gratulacje! Twoja przeglądarka poprawnie odbiera powiadomienia Push.",
        data: { url: "/konto", windowType: "test" },
      });
      if (res.success) delivered++;
    }

    // Record in push logs
    await (supabase.from("push_notification_logs") as any).insert({
      user_id: profile.id,
      window_type: "test",
      match_ids: [],
      status: delivered > 0 ? "sent" : "failed",
    });

    if (delivered === 0) {
      return {
        success: false,
        error: "Subskrypcja wygasła w przeglądarce. Wyłącz i włącz powiadomienia ponownie.",
      };
    }

    return { success: true, deliveredCount: delivered };
  } catch (err: any) {
    console.error("Error sending test push:", err);
    return { success: false, error: err?.message || "Błąd podczas wysyłania testu." };
  }
}

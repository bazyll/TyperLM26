import webpush from "web-push";
import { initWebPush } from "./config";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    windowType?: string;
    [key: string]: unknown;
  };
}

export interface SubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a web push notification to a specific subscription.
 * If the subscription is no longer valid (status 404 or 410), it deletes it from DB.
 */
export async function sendWebPushToSubscription(
  sub: SubscriptionRecord,
  payload: PushNotificationPayload
): Promise<{ success: boolean; shouldDelete?: boolean; error?: string }> {
  if (!initWebPush()) {
    return { success: false, error: "VAPID is not configured on the server." };
  }

  const pushSubscription: webpush.PushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/logo.png",
    badge: payload.badge || "/favicon.ico",
    data: payload.data || { url: "/mecze" },
  });

  try {
    await webpush.sendNotification(pushSubscription, payloadString);
    return { success: true };
  } catch (err: any) {
    const statusCode = err?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Subscription has expired or unsubscribed
      try {
        const adminSupabase = createAdminClient();
        await adminSupabase.from("push_subscriptions").delete().eq("id", sub.id);
      } catch (delErr) {
        console.error("Failed to delete expired subscription:", delErr);
      }
      return { success: false, shouldDelete: true, error: "Subscription expired." };
    }
    return { success: false, error: err?.message || "Failed to send notification." };
  }
}

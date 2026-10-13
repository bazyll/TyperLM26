/**
 * Helper to convert URL-safe base64 string to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    // Check for updates
    await reg.update().catch(() => {});
    return reg;
  } catch (err) {
    console.error("Service worker registration failed:", err);
    return null;
  }
}

export async function subscribeToPush(
  vapidPublicKey: string
): Promise<{ endpoint: string; p256dh: string; auth: string } | null> {
  if (!isPushNotificationSupported()) {
    throw new Error("Powiadomienia Push nie są wspierane przez tę przeglądarkę.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Brak zgody na powiadomienia w przeglądarce.");
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    throw new Error("Nie udało się zarejestrować Service Workera.");
  }

  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey as unknown as BufferSource,
    });
  }

  const rawKey = subscription.getKey("p256dh");
  const rawAuth = subscription.getKey("auth");

  if (!rawKey || !rawAuth) {
    throw new Error("Błąd pobierania kluczy szyfrujących subskrypcji.");
  }

  const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
  const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  };
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      return endpoint;
    }
  } catch (err) {
    console.error("Error unsubscribing:", err);
  }
  return null;
}

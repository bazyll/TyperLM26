// ==============================================================================
// Service Worker for TyperLM26 Web Push Notifications
// RULE: NO HTML caching for authenticated sessions to ensure fresh prediction states.
// ==============================================================================

self.addEventListener("install", (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// Network-only for navigations and API requests - NO stale caching of dynamic typer data
self.addEventListener("fetch", (event) => {
  // Pass through directly to network
  return;
});

// Push notification received
self.addEventListener("push", (event) => {
  let data = {
    title: "TyperLM26 - Przypomnienie",
    body: "Zbliża się mecz! Nie zapomnij uzupełnić typów.",
    icon: "/logo.png",
    badge: "/favicon.ico",
    data: {
      url: "/mecze",
    },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || data.data,
      };
    } catch (e) {
      // Fallback if data is plain text
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/mecze";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If a window is already open with the target URL, focus it
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

/* Service worker for pick reminders.
 *
 * Deliberately minimal: no offline caching, because every page in this app is
 * live data and a stale cached scoreboard would be worse than no page at all.
 * Its only job is receiving a push and opening the picks page.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Pick'em";
  const options = {
    body: payload.body || "Du hast noch offene Spiele.",
    tag: payload.tag || "pickem-reminder",
    renotify: true,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: { url: payload.url || "/picks" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/picks";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an already-open tab rather than piling up new ones.
      for (const client of clients) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "navigate" in clients[0]) {
        return clients[0].navigate(target).then((c) => c && c.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});

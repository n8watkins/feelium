/**
 * Service worker for the Progressive Web App (PRD 18).
 *
 * Responsibilities:
 *  - Basic static-asset caching (stale-while-revalidate for immutable build output).
 *  - Web Push: show the daily reminder notification (PRD 17).
 *  - Deep link: focus/open the check-in screen when the notification is tapped.
 *
 * Offline data entry is intentionally out of scope for this MVP, so HTML navigations are
 * NOT cached - authenticated pages always come fresh from the network to avoid serving a
 * stale or wrong-user view. Only same-origin static assets are cached.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `bt-static-${CACHE_VERSION}`;

// Small, stable app-shell assets worth precaching. Hashed /_next/static/* chunks are
// cached lazily at runtime instead (their names are unknown at install time).
const PRECACHE_URLS = ["/icon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

// Where a tapped notification should land. PRD 17: tapping opens the check-in screen.
const DEFAULT_NOTIFICATION_URL = "/checkin/new";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Best-effort precache: a single missing asset must not fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("bt-static-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** True for same-origin GETs that are safe to cache (static build output / assets). */
function isCacheableAsset(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/api/")) return false;
  return /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isCacheableAsset(request, url)) return; // let the network handle everything else

  // Stale-while-revalidate: serve cache immediately when present, refresh in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "Ready for a quick check-in?";
  const options = {
    body: payload.body || "Take a moment to record what you did and how you felt.",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || "daily-reminder",
    renotify: false,
    requireInteraction: false,
    data: { url: payload.url || DEFAULT_NOTIFICATION_URL },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || DEFAULT_NOTIFICATION_URL;
  const targetPath = new URL(targetUrl, self.location.origin).pathname;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Reuse an existing app window when one is open; navigate it to the deep link.
      for (const client of clientList) {
        if (new URL(client.url).pathname === targetPath && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then((focused) => focused.navigate(targetUrl));
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});

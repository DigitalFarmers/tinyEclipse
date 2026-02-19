// TinyEclipse Service Worker — PWA + Push Notifications
const CACHE_NAME = "tinyeclipse-v2";
const STATIC_ASSETS = ["/portal", "/portal/events", "/portal/ai", "/portal/monitoring", "/portal/modules", "/portal/conversations"];

// Install — cache shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push Notifications
self.addEventListener("push", (e) => {
  let data = { title: "TinyEclipse", body: "Er is iets gebeurd op je website.", icon: "/icon-192.png" };
  try {
    data = e.data.json();
  } catch {}

  const options = {
    body: data.body || data.description || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/portal/events" },
    actions: [
      { action: "open", title: "Bekijken" },
      { action: "dismiss", title: "Sluiten" },
    ],
    tag: data.type || "general",
    renotify: true,
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/portal/events";

  if (e.action === "dismiss") return;

  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/portal") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

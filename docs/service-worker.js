const CACHE_NAME = "next-step-v2";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map(scopedUrl))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match(scopedUrl("./")));
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const client = clientList.find((item) => "focus" in item);
      if (client) return client.focus();
      if (clients.openWindow) return clients.openWindow(self.registration.scope);
      return undefined;
    })
  );
});

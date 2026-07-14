const NEXT_STEP_CACHE_PREFIX = "next-step";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(NEXT_STEP_CACHE_PREFIX))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => {
        const target = new URL("./docs/", self.registration.scope).toString();
        return Promise.all(
          clients.map((client) => {
            if (client.url === self.registration.scope && "navigate" in client) {
              return client.navigate(target);
            }
            return undefined;
          })
        );
      })
      .then(() => self.registration.unregister())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

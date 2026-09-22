const CACHE_NAME = "tuklass-static-v9-4-20260922";
const STATIC_ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "tuklass-config.js?v=20260922-v9-4",
  "tuklass-install.js?v=20260922-v9-4",
  "tuklass-spa.css?v=20260922-v9-4",
  "tuklass-v4.css?v=20260905",
  "tuklass-v5.css?v=20260906-v8",
  "tuklass-v6.css?v=20260906-v8",
  "tuklass-v7.css?v=20260922-v9-4",
  "tuklass-v94.css?v=20260922-v9-4",
  "tuklass-spa.js?v=20260922-v9-4",
  "tuklass-v4.js?v=20260906-v8",
  "tuklass-v5.js?v=20260906-v8",
  "images/Logo1.png",
  "images/Logo3.1.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(STATIC_ASSETS.map(asset => cache.add(asset).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("tuklass-static-") && key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isDocument = request.mode === "navigate" || request.destination === "document";
  if (isDocument) {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then(hit => hit || caches.match("index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      const update = fetch(request).then(response => {
        if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => hit);
      return hit || update;
    })
  );
});

/* Offline fallback only. Successful requests, including redirects, keep the
   network response. Exercise pages, scripts, audio and Supabase calls are not cached. */
const CACHE = "jm-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("jm-offline-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(navigate(request));
});

async function navigate(request) {
  try {
    const response = await fetch(request);
    // A followed redirect must be handed back as a new redirect. Returning the
    // followed body would keep the pre-redirect URL and can break relative links.
    if (response.redirected && response.url) return Response.redirect(response.url, 302);
    return response;
  } catch (_) {
    const cached = await caches.match(OFFLINE_URL);
    return cached || Response.error();
  }
}

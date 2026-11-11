/* Service Worker mínimo (ADR-003): permite abrir la pantalla de registro de cosechas sin señal si ya se visitó.
   No cachea respuestas de API ni de mutaciones; las ventas nunca se sirven desde la caché. */
const CACHE = "finca-v1";
const RUTAS_OFFLINE = ["/cosechas/nueva"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const esEstatico = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/");
  const esPaginaOffline = request.mode === "navigate" && RUTAS_OFFLINE.includes(url.pathname);

  if (esEstatico) {
    e.respondWith(
      caches.match(request).then(
        (c) => c || fetch(request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((x) => x.put(request, copia)); return r; }),
      ),
    );
  } else if (esPaginaOffline) {
    e.respondWith(
      fetch(request)
        .then((r) => { const copia = r.clone(); caches.open(CACHE).then((x) => x.put(request, copia)); return r; })
        .catch(() => caches.match(request)),
    );
  }
});

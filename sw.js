// ================================================
// SpiderMac — Service Worker (PWA)
// ================================================

const CACHE    = "spidermac-v1";
const PRECACHE = ["/", "/index.html", "/app.js", "/manifest.json"];

// Instalar: cachear archivos estáticos
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejas
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first para la API, Cache-first para assets
self.addEventListener("fetch", e => {
  const url = e.request.url;

  // API de Google → siempre red (nunca cachear)
  if (url.includes("script.google.com")) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: "Sin conexión" }), {
        headers: { "Content-Type": "application/json" }
      })
    ));
    return;
  }

  // Assets propios → Cache-first, actualizar en background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});

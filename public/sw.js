/* Минимальный сервис-воркер: сначала сеть, при отсутствии связи берём последнюю сохранённую копию страницы. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.headers.has('range')) return;   // видео грузится кусками, их не сохраняем
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const c = r.clone(); caches.open('sp1').then(x => x.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});

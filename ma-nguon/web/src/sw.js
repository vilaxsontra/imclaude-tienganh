const C = 'ta-__VER__';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/kho.json', '/manifest.webmanifest', '/icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && !k.startsWith('am-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/am/') || u.pathname === '/kho.json') { // giọng đọc và kho câu: lấy từ bộ nhớ máy trước, không có mới tải
    const cn = u.pathname === '/kho.json' ? C : 'am-1';
    e.respondWith(caches.open(cn).then(c => c.match(e.request).then(r => r || fetch(e.request).then(n => { if (n.ok) c.put(e.request, n.clone()); return n; }))));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request.mode === 'navigate' ? '/' : e.request, cp)); return r; }).catch(() => caches.match(e.request.mode === 'navigate' ? '/' : e.request).then(r => r || caches.match('/'))));
});

// Service Worker بسيط: الصفحات والملفات الثابتة تشتغل حتى لو النت ضعيف،
// وطلبات الذكاء الاصطناعي (Netlify functions) ما بتنخزّن أبداً.
const CACHE = 'ecowasteai-v1';
const CORE = ['/', '/manifest.webmanifest', '/logo.png', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/.netlify/')) return; // لا تخزّن الـ API

  // الصفحات: الشبكة أولاً، وإذا فشلت نعرض النسخة المخزّنة
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // باقي الملفات (صور، CSS، JS): المخزّن أولاً ثم نحدّثه بالخلفية
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

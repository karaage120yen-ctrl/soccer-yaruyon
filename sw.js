// サッカーやるよん：オフラインでも開けるようにするサービスワーカー
// ゲームを更新したら CACHE の番号を1つ上げる（v1 → v2）
const CACHE = 'yaruyon-v17';
const SHELL = ['./', './index.html', './fb.js', './firebase-config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Firebase などは触らない
  // 画面（HTML）と設定はネット優先：更新がすぐ届く。つながらないときだけ保存分を使う
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('firebase-config.js') || url.pathname.endsWith('fb.js')) {
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
    return;
  }
  // アイコンなどは保存分を優先
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});

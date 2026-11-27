// 🌸 JS語錄產生器 Service Worker
// ⚠️ 每次更新 index.html 或 quotes.js 時，請把下面的版本號改成當天日期（例：v261117，同一天第二次改 v261117b），並和 index.html 的 APP_VERSION 一致，並一起上傳（index.html、sw.js，有改的話再加 quotes.js）
const VERSION = 'v261127b';

const CORE_CACHE = 'core-' + VERSION;   // 網頁本體與圖示（隨版本更新）
const IMG_CACHE = 'images-v22';         // 背景圖：看過才存，跨版本保留。換圖若沿用舊檔名，要把這個名稱改版（v22→v23…），舊的會在啟用時刪掉
const FONT_CACHE = 'fonts';             // 楷體字型：跨版本保留

const CORE_FILES = [
  './',
  'index.html',
  'quotes.js',
  'manifest.json',
  'avatar.jpg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => (k.startsWith('core-') && k !== CORE_CACHE) || (k.startsWith('images') && k !== IMG_CACHE)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1. 網頁本體：先抓網路（有網路就是最新版），沒網路才用快取
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CORE_CACHE).then(c => c.put('index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('index.html', { ignoreSearch: true }))
    );
    return;
  }

  // 2. 背景圖：先用快取，沒有才下載並存起來（只存看過的）
  if (url.origin === location.origin && url.pathname.includes('/images/')) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // 3. 字型檔：先用快取
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // 4. 字型樣式表：先回快取，背景再更新
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(cached => {
          const net = fetch(req).then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }

  // 5. 其他同網域檔案（金句檔 quotes.js、圖示等）：先網路，失敗用快取；
  //    quotes.js 每次都向伺服器確認有沒有更新（no-cache），改了金句後使用者很快就會看到新的
  if (url.origin === location.origin) {
    const opts = url.pathname.endsWith('/quotes.js') ? { cache: 'no-cache' } : undefined;
    event.respondWith(
      fetch(req, opts).catch(() => caches.match(req, { ignoreSearch: true }))
    );
  }
});

function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      });
    })
  );
}

const CACHE_NAME = 'resonance-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/playlist.png',
  '/kalpana.ttf',
  '/manifest.json',
  'https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(name => {
        if (name !== CACHE_NAME) return caches.delete(name);
      })
    ))
  );
});

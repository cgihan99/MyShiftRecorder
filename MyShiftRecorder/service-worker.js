const CACHE_NAME = 'shift-recorder-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json',
  // Add icons if present
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
}); 
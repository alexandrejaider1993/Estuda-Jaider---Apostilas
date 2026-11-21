const prefix = 'estuda-jaider-' + self.registration.scope + '-';
const cacheName = prefix + "7c019f45cbe44b";
const assets = ["./", "./index.html", "./fig/capa.svg", "./fig/logo-estuda-jaider.png", "./fig/sl09linha.png", "./fig/sl19selecao.png", "./fig/sl20mecres.jpg", "./fig/sl26gram.png", "./fig/sl32mecacao.jpg"];
self.addEventListener('install', event => event.waitUntil(
  caches.open(cacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(cacheName).then(cache => cache.match(event.request))
    .then(hit => hit || fetch(event.request)));
});

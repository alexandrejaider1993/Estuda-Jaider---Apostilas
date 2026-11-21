/* Cache de leitura offline · Estuda Jaider v6.3 */
const PREFIXO = 'estuda-jaider-' + self.registration.scope + '-';
const NOME = PREFIXO + "af9f0134b030af";
const ARQUIVOS = ["./", "./index.html", "./fig/capa.png", "./fig/familias.png", "./fig/parede.png", "./fig/resistencia.png"];
self.addEventListener('install', evento => evento.waitUntil(caches.open(NOME).then(c => c.addAll(ARQUIVOS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', evento => evento.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIXO) && k !== NOME).map(k => caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', evento => {
  if (evento.request.method !== 'GET' || new URL(evento.request.url).origin !== self.location.origin) return;
  evento.respondWith(caches.match(evento.request).then(hit => hit || fetch(evento.request)));
});

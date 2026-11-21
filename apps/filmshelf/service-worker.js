/**
 * service-worker.js — FilmShelf
 *
 * Serve a installare l'app sulla Home e a tenerne una copia dei file (HTML, CSS, JS, icone).
 * NON tocca mai i dati: le richieste a Supabase passano sempre dalla rete.
 *
 * Strategia: prima la rete (ogni modifica pubblicata si vede subito), la copia in cache
 * serve solo se la rete non risponde.
 *
 * CACHE_VERSION: incrementala (filmshelf-app-v1 → v2) quando aggiungi, rinomini o togli file
 * dell'app, aggiornando anche l'elenco CORE. All'attivazione vengono cancellate solo le vecchie
 * cache con prefisso "filmshelf-app-" (mai quelle delle altre app).
 */
const CACHE_VERSION = 'filmshelf-app-v1';
const APP_CACHE_PREFIX = 'filmshelf-app-';

const CORE = [
  './',
  './app.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './icons/maskable.svg',
  './index.html',
  './js/actions.js',
  './js/components.js',
  './js/config.js',
  './js/db.js',
  './js/store.js',
  './js/tmdb.js',
  './js/ui.js',
  './js/views/add.js',
  './js/views/altro.js',
  './js/views/films.js',
  './js/views/key.js',
  './manifest.json',
  './styles.css',
  '../../assets/css/app-nav.css',
  '../../assets/js/toolbox-config.js',
  '../../assets/js/toolbox-auth.js',
  '../../assets/js/toolbox-guard.js',
];

/** Libreria di accesso caricata da toolbox-auth.js (versione bloccata nell'indirizzo: non cambia mai). */
const CDN_PREFIX = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(CORE.map(async u => {
      try {
        const res = await fetch(new Request(u, { cache: 'reload' }));
        if (res.ok) await cache.put(u, res);
      } catch (e) { /* verrà salvato al primo utilizzo */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(APP_CACHE_PREFIX) && k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Libreria con versione nell'indirizzo: prima la cache
  if (req.url.startsWith(CDN_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Solo i file del sito (stessa origine); tutto il resto (Supabase compreso) va in rete senza passare di qui
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      throw e;
    }
  })());
});

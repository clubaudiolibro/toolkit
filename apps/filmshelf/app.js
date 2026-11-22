/**
 * app.js — avvio di FilmShelf e navigazione tra le schermate (indirizzi con #/...).
 * Stessa struttura di GymLog: barra delle sezioni in basso sul telefono, in alto sul PC.
 */
import { initDb, schemaVersion, DbError } from './js/db.js';
import * as store from './js/store.js';
import * as tags from './js/tags.js';
import { SCHEMA_VERSION } from './js/config.js';
import { el, icon, confirmDialog } from './js/ui.js';
import * as films from './js/views/films.js';
import * as film from './js/views/film.js';
import * as add from './js/views/add.js';
import * as altro from './js/views/altro.js';
import * as stats from './js/views/stats.js';
import * as importLetterboxd from './import-letterboxd/import.js';   // import Letterboxd (sezione rimovibile)

const TABS = [
  { id: 'visti', label: 'Visti', icon: 'film' },
  { id: 'watchlist', label: 'Watchlist', icon: 'bookmark' },
  { id: 'aggiungi', label: 'Aggiungi', icon: 'plus' },
  { id: 'statistiche', label: 'Statistiche', icon: 'stats' },
  { id: 'altro', label: 'Altro', icon: 'more' },
];

/** Rotte: [espressione, modulo, tab]. I gruppi catturati diventano params. */
const ROUTES = [
  [/^visti$/, films, 'visti'],
  [/^watchlist$/, films, 'watchlist'],
  [/^film\/([0-9a-f-]{36})$/, film, null],
  [/^aggiungi$/, add, 'aggiungi'],
  [/^statistiche$/, stats, 'statistiche'],
  [/^altro$/, altro, 'altro'],
  [/^altro\/importa-letterboxd$/, importLetterboxd, 'altro'],   // import Letterboxd (sezione rimovibile)
];

const $ = id => document.getElementById(id);
let leaveGuard = null;      // funzione che restituisce true se ci sono modifiche non salvate
let cleanup = null;         // funzione chiamata quando si lascia la schermata corrente
let currentHash = null;
let ready = false;

function renderTabs() {
  for (const navId of ['tabs-bottom', 'tabs-desktop']) {
    const nav = $(navId);
    nav.textContent = '';
    for (const t of TABS) {
      nav.appendChild(el('a', { href: '#/' + t.id, dataset: { tab: t.id } }, icon(t.icon), el('span', { text: t.label })));
    }
  }
}

function setActiveTab(tab) {
  document.querySelectorAll('.tabs a').forEach(a => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function homeLink() {
  return el('a', { class: 'home-link', href: '../../index.html', title: 'Torna alla Toolbox' },
    icon('back'), el('span', { class: 'home-label', text: 'Toolbox' }));
}

/** Contesto passato a ogni schermata. */
function makeCtx(params, path) {
  return {
    params,
    path,
    view: $('view'),
    setTitle(t) { $('top-title').textContent = t; document.title = t === 'FilmShelf' ? 'FilmShelf' : t + ' · FilmShelf'; },
    /** back: indirizzo a cui torna la freccia; se assente compare il link alla Toolbox. */
    setBack(back) {
      const box = $('top-left');
      box.textContent = '';
      box.appendChild(back
        ? el('a', { class: 'icon-btn', href: back, 'aria-label': 'Indietro' }, icon('back'))
        : homeLink());
    },
    setActions(...nodes) { const box = $('top-right'); box.textContent = ''; nodes.forEach(n => n && box.appendChild(n)); },
    setLeaveGuard(fn) { leaveGuard = fn; },
    onLeave(fn) { cleanup = fn; },
    go(hash) { location.hash = hash; },
    rerender() { route(true); },
  };
}

async function route(force = false) {
  if (!ready) return;
  const hash = location.hash || '#/visti';
  if (!force && hash === currentHash) return;

  if (leaveGuard && currentHash && hash !== currentHash && leaveGuard()) {
    const target = hash;
    history.replaceState(null, '', currentHash);          // resta qui finché non si conferma
    const ok = await confirmDialog({
      title: 'Uscire senza salvare?', text: 'Hai fatto modifiche che non sono state salvate.',
      ok: 'Esci senza salvare', danger: true,
    });
    if (!ok) return;
    leaveGuard = null;
    location.hash = target;
    return;
  }

  const path = hash.replace(/^#\/?/, '');
  let match = null;
  for (const [re, mod, tab] of ROUTES) {
    const m = path.match(re);
    if (m) { match = { mod, tab, params: m.slice(1) }; break; }
  }
  if (!match) { location.replace('#/visti'); return; }

  const sameScreen = currentHash === hash;
  currentHash = hash;
  leaveGuard = null;
  if (cleanup) { try { cleanup(); } catch (e) { /* niente */ } cleanup = null; }
  // la scheda di un film resta sotto la sezione da cui si arriva (visti o watchlist)
  if (match.tab === null) {
    const f = store.get(match.params[0]);
    match.tab = f && f.stato === 'watchlist' ? 'watchlist' : 'visti';
  }
  setActiveTab(match.tab);
  const ctx = makeCtx(match.params, path);
  ctx.setBack(null);
  ctx.setActions();
  ctx.setTitle('FilmShelf');
  const view = $('view');
  const y = window.scrollY;
  view.textContent = '';
  try {
    await match.mod.render(ctx);
  } catch (e) {
    console.error(e);
    view.textContent = '';
    view.appendChild(el('div', { class: 'placeholder' },
      el('strong', { text: 'Qualcosa non ha funzionato' }),
      el('p', { text: 'Controlla la connessione e riprova.' }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Riprova', on: { click: () => route(true) } })));
  }
  if (sameScreen) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

function showSetup(current) {
  const view = $('view');
  view.textContent = '';
  view.appendChild(el('div', { class: 'card setup', style: 'padding:18px' },
    el('h2', { style: 'margin-top:0', text: current ? 'Database da aggiornare' : 'Database da preparare' }),
    el('p', { text: current
      ? 'Questa versione di FilmShelf ha bisogno di un piccolo aggiornamento del database. I tuoi film restano tutti: basta rieseguire lo stesso file.'
      : 'Prima di usare FilmShelf bisogna creare le sue tabelle su Supabase (una volta sola, meglio dal PC):' }),
    el('ol', {},
      el('li', { html: 'Apri <strong>supabase.com</strong>, entra nel tuo progetto e scegli <strong>SQL Editor</strong> nel menu a sinistra.' }),
      el('li', { html: 'Premi <strong>New query</strong>.' }),
      el('li', { html: 'Apri il file <a href="https://github.com/clubaudiolibro/toolkit/blob/main/supabase/filmshelf.sql" target="_blank" rel="noopener"><code>supabase/filmshelf.sql</code></a> e copialo tutto (icona «Copy raw file» in alto a destra).' }),
      el('li', { html: 'Incollalo nella query vuota e premi <strong>Run</strong>: in fondo devono comparire 2 righe con <code>true</code>.' }),
      el('li', { text: 'Torna qui e ricarica la pagina.' })),
    el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Ricarica', on: { click: () => location.reload() } })));
}

function watchConnection() {
  const banner = $('offline-banner');
  const update = () => { banner.hidden = navigator.onLine && !store.isOffline(); };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
  return update;
}

/** Altezza della barra in alto in una variabile CSS: serve alla barra di ricerca che resta attaccata sotto. */
function trackHeaderHeight() {
  const top = document.querySelector('.top');
  const set = () => document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
  set();
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(top);
  else window.addEventListener('resize', set);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./service-worker.js').catch(e => console.warn('Service worker non registrato', e));
}

/** Senza rete: se c'è una copia dei film salvata nel browser la mostra in sola lettura. */
function tryOffline() {
  if (!store.loadCache()) return false;
  tags.load({ offline: true });
  return true;
}

async function start() {
  // gli errori del database sono già stati mostrati con un avviso: non serve altro
  window.addEventListener('unhandledrejection', e => { if (e.reason instanceof DbError) e.preventDefault(); });
  registerServiceWorker();
  renderTabs();
  trackHeaderHeight();
  const updateBanner = watchConnection();
  const view = $('view');
  try {
    if (!(await initDb())) return;            // rimandato alla home per il login
    const v = await schemaVersion();
    if (v == null || v < SCHEMA_VERSION) { showSetup(v); return; }
    await store.loadAll();
    await tags.load();
  } catch (e) {
    console.warn('Supabase non raggiungibile:', e.message);
    if (!tryOffline()) {
      view.textContent = '';
      view.appendChild(el('div', { class: 'placeholder' },
        el('strong', { text: 'Impossibile caricare i dati' }),
        el('p', { text: 'Controlla la connessione (rete dati attiva?) e riprova.' }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Riprova', on: { click: () => location.reload() } })));
      return;
    }
  }
  updateBanner();
  ready = true;
  window.addEventListener('hashchange', () => route());
  window.addEventListener('beforeunload', e => { if (leaveGuard && leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });
  route();
}

start();

/**
 * app.js — avvio di GymLog e navigazione tra le schermate (indirizzi con #/...).
 */
import { initDb, schemaVersion } from './js/db.js';
import { loadAll } from './js/store.js';
import { SCHEMA_VERSION } from './js/config.js';
import { el, icon, confirmDialog } from './js/ui.js';
import * as exercises from './js/views/exercises.js';
import * as exerciseEdit from './js/views/exercise-edit.js';
import * as more from './js/views/more.js';
import * as lists from './js/views/lists.js';
import * as trash from './js/views/trash.js';
import * as workouts from './js/views/workouts.js';
import * as workoutEdit from './js/views/workout-edit.js';
import * as groupEdit from './js/views/group-edit.js';
import * as today from './js/views/today.js';
import * as run from './js/views/run.js';
import * as diary from './js/views/diary.js';
import * as activities from './js/views/activities.js';
import * as stats from './js/views/stats.js';
import * as settings from './js/views/settings.js';
import { initTimer } from './js/timer.js';
import { initInstall } from './js/install.js';

const TABS = [
  { id: 'oggi', label: 'Oggi', icon: 'today' },
  { id: 'diario', label: 'Diario', icon: 'diary' },
  { id: 'allenamenti', label: 'Allenamenti', icon: 'workouts' },
  { id: 'esercizi', label: 'Esercizi', icon: 'dumbbell' },
  { id: 'altro', label: 'Altro', icon: 'more' },
];

/** Rotte: [espressione, modulo, tab]. I gruppi catturati diventano params. */
const ROUTES = [
  [/^oggi$/, today, 'oggi'],
  [/^esegui\/([0-9a-f-]{36})$/, run, 'oggi'],
  [/^diario$/, diary, 'diario'],
  [/^allenamenti$/, workouts, 'allenamenti'],
  [/^allenamenti\/gruppi$/, workouts, 'allenamenti'],
  [/^allenamenti\/gruppi\/([0-9a-f-]{36})$/, groupEdit, 'allenamenti'],
  [/^allenamenti\/([0-9a-f-]{36})$/, workoutEdit, 'allenamenti'],
  [/^esercizi$/, exercises, 'esercizi'],
  [/^esercizi\/nuovo$/, exerciseEdit, 'esercizi'],
  [/^esercizi\/([0-9a-f-]{36})$/, exerciseEdit, 'esercizi'],
  [/^altro$/, more, 'altro'],
  [/^altro\/(muscoli|attrezzi)$/, lists, 'altro'],
  [/^altro\/cestino$/, trash, 'altro'],
  [/^altro\/attivita$/, activities, 'altro'],
  [/^altro\/statistiche$/, stats, 'altro'],
  [/^altro\/impostazioni$/, settings, 'altro'],
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
    setTitle(t) { $('top-title').textContent = t; document.title = t === 'GymLog' ? 'GymLog' : t + ' · GymLog'; },
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
  const hash = location.hash || '#/oggi';
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
  if (!match) { location.replace('#/oggi'); return; }

  currentHash = hash;
  leaveGuard = null;
  if (cleanup) { try { cleanup(); } catch (e) { /* niente */ } cleanup = null; }
  setActiveTab(match.tab);
  const ctx = makeCtx(match.params, path);
  ctx.setBack(null);
  ctx.setActions();
  ctx.setTitle('GymLog');
  const view = $('view');
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
  if (!force) window.scrollTo(0, 0);
}

function showSetup(current) {
  const view = $('view');
  view.textContent = '';
  view.appendChild(el('div', { class: 'card setup', style: 'padding:18px' },
    el('h2', { style: 'margin-top:0', text: current ? 'Database da aggiornare' : 'Database da preparare' }),
    el('p', { text: current
      ? 'Questa versione di GymLog ha bisogno di un piccolo aggiornamento del database. I tuoi dati restano tutti: basta rieseguire lo stesso file.'
      : 'Prima di usare GymLog bisogna creare le sue tabelle su Supabase (una volta sola):' }),
    el('ol', {},
      el('li', { html: 'Apri <strong>supabase.com</strong>, entra nel tuo progetto e scegli <strong>SQL Editor</strong> nel menu a sinistra.' }),
      el('li', { html: 'Premi <strong>New query</strong>.' }),
      el('li', { html: 'Incolla tutto il contenuto del file <code>supabase/gymlog.sql</code> e premi <strong>Run</strong>.' }),
      el('li', { text: 'Torna qui e ricarica la pagina.' })),
    el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Ricarica', on: { click: () => location.reload() } })));
}

function watchConnection() {
  const banner = $('offline-banner');
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./service-worker.js').catch(e => console.warn('Service worker non registrato', e));
}

async function start() {
  registerServiceWorker();
  initInstall();
  renderTabs();
  watchConnection();
  const view = $('view');
  try {
    if (!(await initDb())) return;            // rimandato alla home per il login
    const v = await schemaVersion();
    if (v == null || v < SCHEMA_VERSION) { showSetup(v); return; }
    await loadAll();
  } catch (e) {
    console.error(e);
    view.textContent = '';
    view.appendChild(el('div', { class: 'placeholder' },
      el('strong', { text: 'Impossibile caricare i dati' }),
      el('p', { text: 'Controlla la connessione (rete dati attiva?) e riprova.' }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Riprova', on: { click: () => location.reload() } })));
    return;
  }
  ready = true;
  initTimer();
  window.addEventListener('hashchange', () => route());
  window.addEventListener('beforeunload', e => { if (leaveGuard && leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });
  route();
}

start();

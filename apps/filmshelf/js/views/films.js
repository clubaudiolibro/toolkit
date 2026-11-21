/**
 * views/films.js — elenco dei film visti o della watchlist.
 *
 * Tre modalità di visualizzazione, scelte con il selettore sempre visibile in alto a destra
 * (l'ultima scelta viene ricordata in questo dispositivo):
 *   - griglia: solo le copertine;
 *   - lista:   una riga per film (miniatura, titolo, anno, voto, data);
 *   - schede:  una scheda per film con quasi tutti i dati.
 * Toccando un film si apre la scheda di dettaglio (views/film.js).
 * Sopra l'elenco: ricerca per titolo (italiano e originale) e ordinamento, sempre a portata.
 */
import { el, icon, fmtDate, fmtVoto, fmtDurata, norm } from '../ui.js';
import { poster } from '../components.js';
import { markAsSeen } from '../actions.js';
import { KEYS } from '../config.js';
import * as store from '../store.js';

export const MODES = [
  { id: 'griglia', label: 'Griglia', icon: 'grid' },
  { id: 'lista', label: 'Lista', icon: 'list' },
  { id: 'schede', label: 'Schede', icon: 'cards' },
];

/** Ordinamenti: per ogni campo il verso predefinito (desc = dal più alto/recente). */
const SORTS = {
  visto: [
    { id: 'data', label: 'Data di visione', key: f => f.data_visione, desc: true },
    { id: 'voto', label: 'Voto', key: f => f.voto, desc: true },
    { id: 'titolo', label: 'Titolo', key: f => norm(f.titolo_it), desc: false },
    { id: 'anno', label: 'Anno di uscita', key: f => f.anno, desc: true },
  ],
  watchlist: [
    { id: 'aggiunta', label: 'Data di aggiunta', key: f => f.creato_il, desc: true },
    { id: 'titolo', label: 'Titolo', key: f => norm(f.titolo_it), desc: false },
    { id: 'anno', label: 'Anno di uscita', key: f => f.anno, desc: true },
    { id: 'durata', label: 'Durata', key: f => f.durata_min, desc: false },
  ],
};

/* Stato che resta finché la pagina è aperta: testo cercato e posizione di scorrimento. */
const memory = { visto: { q: '', y: 0 }, watchlist: { q: '', y: 0 } };

function getMode() {
  const m = localStorage.getItem(KEYS.view);
  return MODES.some(x => x.id === m) ? m : 'griglia';
}
function getSort(stato) {
  try {
    const s = JSON.parse(localStorage.getItem(KEYS.sort + '.' + stato) || 'null');
    const def = SORTS[stato].find(x => x.id === (s && s.id));
    if (def) return { id: def.id, desc: typeof s.desc === 'boolean' ? s.desc : def.desc };
  } catch (e) { /* valore rovinato: si usa quello predefinito */ }
  return { id: SORTS[stato][0].id, desc: SORTS[stato][0].desc };
}
function saveSort(stato, s) { localStorage.setItem(KEYS.sort + '.' + stato, JSON.stringify(s)); }

/** Ordina una copia dei film; i valori mancanti vanno sempre in fondo. A parità, per titolo. */
export function sortFilms(films, stato, sort) {
  const def = SORTS[stato].find(x => x.id === sort.id) || SORTS[stato][0];
  const byTitle = (a, b) => a.titolo_it.localeCompare(b.titolo_it, 'it', { sensitivity: 'base' });
  return films.slice().sort((a, b) => {
    const ka = def.key(a), kb = def.key(b);
    const na = ka == null || ka === '', nb = kb == null || kb === '';
    if (na || nb) return na === nb ? byTitle(a, b) : (na ? 1 : -1);
    let c = typeof ka === 'number' ? ka - kb : String(ka).localeCompare(String(kb), 'it');
    if (sort.desc) c = -c;
    return c || byTitle(a, b);
  });
}

/** Filtra per titolo italiano o originale (senza badare a maiuscole e accenti). */
export function searchFilms(films, q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return films;
  return films.filter(f => {
    const hay = norm(f.titolo_it + ' ' + (f.titolo_originale || ''));
    return words.every(w => hay.includes(w));
  });
}

/** Selettore della modalità (va nella barra in alto, sempre visibile). */
function modeSwitch(current, onChange) {
  return el('div', { class: 'mode-switch', role: 'group', 'aria-label': 'Modalità di visualizzazione' },
    MODES.map(m => el('button', {
      type: 'button', class: 'mode-btn', title: m.label, 'aria-label': m.label, 'aria-pressed': String(m.id === current),
      on: { click: () => onChange(m.id) },
    }, icon(m.icon))));
}

const sub = (...parts) => parts.filter(p => p != null && p !== '').join(' · ');

function gridItem(f, href) {
  return el('a', { class: 'grid-item', href, title: f.titolo_it },
    el('div', { class: 'grid-poster' },
      poster(f.poster_path, { alt: f.titolo_it }),
      f.voto != null ? el('span', { class: 'grid-voto', text: fmtVoto(f.voto) }) : null),
    el('span', { class: 'grid-title', text: f.titolo_it }),
    el('span', { class: 'grid-year', text: f.anno ? String(f.anno) : '' }));
}

function listItem(f, href, stato) {
  return el('li', {}, el('a', { class: 'row compact', href },
    poster(f.poster_path, { cls: 'poster poster-xs' }),
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: f.titolo_it }),
      el('div', { class: 'row-sub', text: stato === 'visto'
        ? sub(f.anno, f.data_visione ? fmtDate(f.data_visione) : null)
        : sub(f.anno, fmtDurata(f.durata_min)) })),
    f.voto != null ? el('span', { class: 'voto-badge', text: fmtVoto(f.voto) }) : null));
}

function cardItem(f, href, stato, ctx) {
  const orig = f.titolo_originale && f.titolo_originale !== f.titolo_it ? f.titolo_originale : null;
  return el('li', { class: 'film-card' },
    el('a', { class: 'film-card-link', href },
      poster(f.poster_path, { cls: 'poster poster-md', alt: f.titolo_it }),
      el('div', { class: 'film-card-body' },
        el('div', { class: 'film-card-top' },
          el('div', { class: 'film-card-title', text: f.titolo_it }),
          f.voto != null ? el('span', { class: 'voto-badge', text: fmtVoto(f.voto) }) : null),
        orig ? el('div', { class: 'row-sub', text: orig }) : null,
        el('div', { class: 'row-sub', text: sub(f.anno, fmtDurata(f.durata_min), (f.generi || []).join(', ')) }),
        stato === 'visto' && (f.data_visione || (f.luoghi || []).length)
          ? el('div', { class: 'film-card-meta' },
            f.data_visione ? el('span', { text: 'Visto il ' + fmtDate(f.data_visione) }) : null,
            (f.luoghi || []).map(l => el('span', { class: 'tag', text: l })))
          : null,
        f.trama ? el('p', { class: 'film-card-plot', text: f.trama }) : null)),
    stato === 'watchlist' && !store.isOffline()
      ? el('button', { type: 'button', class: 'btn btn-sm btn-seen', on: { click: async () => {
        if (await markAsSeen(f)) ctx.rerender();
      } } }, icon('eye'), 'Segna come visto')
      : null);
}

export async function render(ctx) {
  const stato = ctx.path.startsWith('watchlist') ? 'watchlist' : 'visto';
  const mem = memory[stato];
  ctx.setTitle(stato === 'visto' ? 'Film visti' : 'Watchlist');
  let mode = getMode();
  let sort = getSort(stato);
  const all = store.byStato(stato);

  if (!all.length) {
    ctx.view.appendChild(el('div', { class: 'empty' }, icon(stato === 'visto' ? 'film' : 'bookmark'),
      el('p', { text: stato === 'visto' ? 'Nessun film visto, per ora.' : 'La watchlist è vuota.' }),
      store.isOffline() ? null : el('a', { class: 'btn btn-primary', href: '#/aggiungi' }, icon('plus'), 'Aggiungi un film')));
    return;
  }

  const switcher = () => modeSwitch(mode, m => {
    mode = m;
    localStorage.setItem(KEYS.view, m);
    ctx.setActions(switcher());
    draw();
  });
  ctx.setActions(switcher());

  // Barra di ricerca e ordinamento (resta attaccata in alto scorrendo)
  const input = el('input', {
    type: 'search', placeholder: 'Cerca per titolo', value: mem.q, autocomplete: 'off', enterkeyhint: 'search',
    'aria-label': 'Cerca per titolo', on: { input: () => { mem.q = input.value; draw(); } },
  });
  const clear = el('button', { type: 'button', class: 'search-clear', 'aria-label': 'Cancella la ricerca', on: { click: () => { input.value = ''; mem.q = ''; draw(); input.focus(); } } }, icon('close'));
  const select = el('select', {
    class: 'sort-select', 'aria-label': 'Ordina per', value: sort.id,
    on: { change: () => {
      const def = SORTS[stato].find(x => x.id === select.value);
      sort = { id: def.id, desc: def.desc };
      saveSort(stato, sort); updateDir(); draw();
    } },
  }, SORTS[stato].map(s => el('option', { value: s.id, text: s.label })));
  const dir = el('button', { type: 'button', class: 'btn btn-sm sort-dir', on: { click: () => {
    sort = { ...sort, desc: !sort.desc }; saveSort(stato, sort); updateDir(); draw();
  } } });
  function updateDir() {
    const isText = sort.id === 'titolo';
    dir.textContent = sort.desc ? (isText ? 'Z→A' : '↓') : (isText ? 'A→Z' : '↑');
    const labels = { data: ['dalla più recente', 'dalla meno recente'], aggiunta: ['dalla più recente', 'dalla meno recente'], voto: ['dal più alto', 'dal più basso'], anno: ['dal più recente', 'dal più vecchio'], durata: ['dal più lungo', 'dal più corto'], titolo: ['dalla Z alla A', 'dalla A alla Z'] };
    const l = labels[sort.id] || ['decrescente', 'crescente'];
    dir.title = 'Ordine: ' + (sort.desc ? l[0] : l[1]) + ' (tocca per invertire)';
    dir.setAttribute('aria-label', dir.title);
  }
  updateDir();

  const count = el('p', { class: 'count', 'aria-live': 'polite' });
  const box = el('div', { class: 'films' });
  ctx.view.append(
    el('div', { class: 'toolbar' },
      el('label', { class: 'search' }, icon('search'), input, clear),
      el('div', { class: 'sort' }, icon('sort'), select, dir)),
    count, box);

  function draw() {
    clear.hidden = !mem.q;
    const list = sortFilms(searchFilms(all, mem.q), stato, sort);
    count.textContent = mem.q
      ? (list.length === 1 ? '1 film trovato' : list.length + ' film trovati') + ' su ' + all.length
      : (all.length === 1 ? '1 film' : all.length + ' film');
    box.textContent = '';
    if (!list.length) {
      box.appendChild(el('p', { class: 'empty', text: 'Nessun film con questo titolo.' }));
      return;
    }
    const href = f => '#/film/' + f.id;
    if (mode === 'griglia') box.appendChild(el('div', { class: 'poster-grid' }, list.map(f => gridItem(f, href(f)))));
    else if (mode === 'lista') box.appendChild(el('ul', { class: 'list' }, list.map(f => listItem(f, href(f), stato))));
    else box.appendChild(el('ul', { class: 'cards' }, list.map(f => cardItem(f, href(f), stato, ctx))));
  }
  draw();

  // torna alla stessa posizione quando si rientra dalla scheda di un film
  if (mem.y) requestAnimationFrame(() => window.scrollTo(0, mem.y));
  ctx.onLeave(() => { mem.y = window.scrollY; });
}

/**
 * views/films.js — elenco dei film visti o della watchlist.
 *
 * Tre modalità di visualizzazione, scelte con il selettore sempre visibile in alto a destra
 * (l'ultima scelta viene ricordata in questo dispositivo):
 *   - griglia: solo le copertine;
 *   - lista:   una riga per film (miniatura, titolo, anno, voto, data);
 *   - schede:  una scheda per film con quasi tutti i dati.
 * Toccando un film si apre la scheda di dettaglio (views/film.js).
 * Sopra l'elenco: ricerca per titolo (italiano e originale), ordinamento e, nei film visti, filtro per tag
 * (uno o più, con scelta tra «almeno uno» e «tutti»), sempre a portata.
 */
import { el, icon, fmtDate, fmtVoto, fmtDurata, norm, customSheet } from '../ui.js';
import { poster } from '../components.js';
import { markAsSeen } from '../actions.js';
import { KEYS } from '../config.js';
import * as store from '../store.js';
import * as tags from '../tags.js';

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
const memory = {
  visto: { q: '', y: 0, tags: [], all: false, none: false },      // tags: tag scelti per il filtro; all: true = servono tutti; none: true = solo film senza tag
  watchlist: { q: '', y: 0, tags: [], all: false, none: false },
};

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

/** Filtra per tag: con all = false basta uno dei tag scelti, con all = true servono tutti.
 *  Con none = true (e nessun tag scelto) restano solo i film senza alcun tag. */
export function filterByTags(films, chosen, all = false, none = false) {
  if (!chosen.length) return none ? films.filter(f => !(f.luoghi || []).length) : films;
  return films.filter(f => {
    const t = f.luoghi || [];
    return all ? chosen.every(c => t.includes(c)) : chosen.some(c => t.includes(c));
  });
}

/** Foglio per scegliere i tag del filtro. Restituisce { tags, all, none } oppure null se annullato.
 *  «Applica» senza alcun tag scelto = mostra i film senza tag (none); «Azzera» = nessun filtro. */
function tagFilterSheet(current, currentAll) {
  return customSheet((sheet, close) => {
    const chosen = new Set(current);
    let all = currentAll;
    const list = tags.all();
    const chips = el('div', { class: 'chips' }, list.map(t => el('button', {
      type: 'button', class: 'chip', text: t, 'aria-pressed': String(chosen.has(t)),
      on: { click: e => { chosen.has(t) ? chosen.delete(t) : chosen.add(t); e.currentTarget.setAttribute('aria-pressed', String(chosen.has(t))); updateHint(); } },
    })));
    const modeBtns = [[false, 'Almeno uno'], [true, 'Tutti']].map(([v, label]) => el('button', {
      type: 'button', class: 'chip', text: label, 'aria-pressed': String(all === v),
      on: { click: () => { all = v; modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === all))); updateHint(); } },
    }));
    const hint = el('p', { class: 'small muted-text' });
    function updateHint() {
      const n = chosen.size;
      hint.textContent = n === 0 ? 'Senza tag scelti, «Applica» mostra i film senza tag.'
        : n < 2 ? '' : (all ? 'Mostro i film che hanno tutti i tag scelti.' : 'Mostro i film che hanno almeno uno dei tag scelti.');
    }
    updateHint();
    sheet.append(
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title', text: 'Filtra per tag' }),
        el('button', { type: 'button', class: 'icon-btn muted', 'aria-label': 'Chiudi', on: { click: () => close(null) } }, icon('close'))),
      el('div', { class: 'form sheet-form-gap' },
        el('div', { class: 'field' },
          el('span', { class: 'field-label' }, 'Tag ', el('span', { class: 'opt', text: '(uno o più)' })),
          chips),
        el('div', { class: 'field' },
          el('span', { class: 'field-label', text: 'Quando ne scegli più di uno' }),
          el('div', { class: 'chips' }, modeBtns),
          hint)),
      el('div', { class: 'sheet-actions' },
        el('button', { type: 'button', class: 'btn', text: 'Azzera', on: { click: () => close({ tags: [], all: false, none: false }) } }),
        el('button', { type: 'button', class: 'btn btn-primary', text: 'Applica', on: { click: () => {
          const picked = list.filter(t => chosen.has(t));
          close({ tags: picked, all, none: picked.length === 0 });
        } } })));
  }).then(v => v || null);
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

  // Filtro per tag (solo film visti: la watchlist non ha tag)
  const withTags = stato === 'visto';
  const filterBtn = withTags ? el('button', {
    type: 'button', class: 'btn btn-sm filter-btn', on: { click: async () => {
      const r = await tagFilterSheet(mem.tags.filter(t => tags.all().includes(t)), mem.all);
      if (!r) return;
      mem.tags = r.tags; mem.all = r.all; mem.none = r.none; draw();
    } },
  }) : null;
  const activeTags = el('div', { class: 'chips small active-tags' });
  function updateFilter() {
    if (!withTags) return;
    // se un tag scelto non esiste più lo si toglie dal filtro
    const known = tags.all();
    mem.tags = mem.tags.filter(t => known.includes(t));
    filterBtn.textContent = '';
    filterBtn.appendChild(icon('tag'));
    filterBtn.appendChild(document.createTextNode('Tag'));
    if (mem.tags.length) filterBtn.appendChild(el('span', { class: 'filter-badge', text: String(mem.tags.length) }));
    filterBtn.setAttribute('aria-label', mem.tags.length ? 'Filtra per tag (' + mem.tags.length + ' scelti)' : (mem.none ? 'Filtra per tag (film senza tag)' : 'Filtra per tag'));
    filterBtn.classList.toggle('active', mem.tags.length > 0 || mem.none);
    activeTags.textContent = '';
    activeTags.hidden = !mem.tags.length && !mem.none;
    if (mem.none && !mem.tags.length) activeTags.appendChild(el('button', {
      type: 'button', class: 'tag tag-removable', title: 'Togli il filtro «Senza tag»', 'aria-label': 'Togli il filtro Senza tag',
      on: { click: () => { mem.none = false; draw(); } },
    }, 'Senza tag', icon('close')));
    mem.tags.forEach(t => activeTags.appendChild(el('button', {
      type: 'button', class: 'tag tag-removable', title: 'Togli il filtro «' + t + '»', 'aria-label': 'Togli il filtro ' + t,
      on: { click: () => { mem.tags = mem.tags.filter(x => x !== t); draw(); } },
    }, t, icon('close'))));
    if (mem.tags.length > 1) activeTags.prepend(el('span', { class: 'row-sub', text: mem.all ? 'Tutti:' : 'Almeno uno:' }));
  }

  const count = el('p', { class: 'count', 'aria-live': 'polite' });
  const box = el('div', { class: 'films' });
  ctx.view.append(
    el('div', { class: 'toolbar' },
      el('div', { class: 'search-row' },
        el('label', { class: 'search' }, icon('search'), input, clear),
        filterBtn),
      el('div', { class: 'sort' }, icon('sort'), select, dir)),
    withTags ? activeTags : null,
    count, box);

  function draw() {
    clear.hidden = !mem.q;
    updateFilter();
    const filtered = withTags && (mem.tags.length > 0 || mem.none);
    const list = sortFilms(filterByTags(searchFilms(all, mem.q), withTags ? mem.tags : [], mem.all, withTags && mem.none), stato, sort);
    count.textContent = mem.q || filtered
      ? (list.length === 1 ? '1 film trovato' : list.length + ' film trovati') + ' su ' + all.length
      : (all.length === 1 ? '1 film' : all.length + ' film');
    box.textContent = '';
    if (!list.length) {
      box.appendChild(el('p', { class: 'empty', text: filtered ? (mem.tags.length ? 'Nessun film con questi tag' : 'Nessun film senza tag') + (mem.q ? ' e questo titolo.' : '.') : 'Nessun film con questo titolo.' }));
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

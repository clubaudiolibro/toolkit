/**
 * views/add.js — «Aggiungi»: ricerca su TMDB mentre si scrive e aggiunta del film scelto.
 */
import { el, icon } from '../ui.js';
import { poster } from '../components.js';
import { searchMovies, hasKey, loadKey } from '../tmdb.js';
import { addFromSearch } from '../actions.js';
import { TMDB } from '../config.js';
import * as store from '../store.js';
import { keySetupCard } from './key.js';

export async function render(ctx) {
  ctx.setTitle('Aggiungi film');
  const view = ctx.view;

  if (store.isOffline()) {
    view.appendChild(el('div', { class: 'placeholder' },
      el('strong', { text: 'Serve la connessione' }),
      el('p', { text: 'Per cercare e aggiungere film attiva la rete dati e ricarica la pagina.' })));
    return;
  }
  try { await loadKey(); } catch (e) { /* gestito sotto: senza chiave si mostra la guida */ }
  if (!hasKey()) {
    view.appendChild(keySetupCard(() => ctx.rerender()));
    return;
  }

  const input = el('input', {
    type: 'search', placeholder: 'Scrivi il titolo del film…', autocomplete: 'off', enterkeyhint: 'search',
    'aria-label': 'Titolo del film da cercare',
  });
  const status = el('p', { class: 'hint', 'aria-live': 'polite' });
  const list = el('ul', { class: 'list results', hidden: true });

  view.append(
    el('label', { class: 'search search-big' }, icon('search'), input),
    status, list);

  let timer = null;
  let controller = null;
  let lastQuery = '';

  async function doSearch(q) {
    if (controller) controller.abort();
    controller = new AbortController();
    const mine = controller;
    status.textContent = 'Cerco…';
    try {
      const results = await searchMovies(q, { signal: mine.signal });
      if (mine !== controller) return;              // nel frattempo è partita un'altra ricerca
      showResults(results);
    } catch (e) {
      if (e.name === 'AbortError') return;
      list.hidden = true;
      status.textContent = e.message || 'Ricerca non riuscita.';
    }
  }

  function showResults(results) {
    list.textContent = '';
    if (!results.length) {
      list.hidden = true;
      status.textContent = 'Nessun film trovato. Prova con il titolo originale o con meno parole.';
      return;
    }
    status.textContent = results.length === 1 ? '1 risultato' : results.length + ' risultati: tocca quello giusto.';
    for (const r of results) {
      const have = store.findByTmdb(r.tmdb_id);
      const orig = r.titolo_originale && r.titolo_originale !== r.titolo_it ? r.titolo_originale : null;
      list.appendChild(el('li', {},
        el('button', {
          type: 'button', class: 'row result',
          on: { click: async () => {
            const row = await addFromSearch(r, { openFilm: f => ctx.go('#/film/' + f.id) });
            if (row) showResults(results);          // aggiorna le etichette «Già visto» / «In watchlist»
          } },
        },
          poster(r.poster_path, { cls: 'poster poster-xs' }),
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: r.titolo_it }),
            orig ? el('div', { class: 'row-sub', text: orig }) : null,
            el('div', { class: 'row-sub', text: r.anno ? String(r.anno) : 'Anno sconosciuto' })),
          have ? el('span', { class: 'tag ' + (have.stato === 'visto' ? 'tag-seen' : 'tag-wl'), text: have.stato === 'visto' ? 'Già visto' : 'In watchlist' }) : null)));
    }
    list.hidden = false;
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 2) {
      if (controller) controller.abort();
      list.hidden = true; list.textContent = '';
      status.textContent = q ? 'Scrivi almeno 2 lettere.' : '';
      lastQuery = '';
      return;
    }
    if (q === lastQuery) return;
    timer = setTimeout(() => { lastQuery = q; doSearch(q); }, TMDB.searchDelay);
  });
  ctx.onLeave(() => { clearTimeout(timer); if (controller) controller.abort(); });
  setTimeout(() => input.focus(), 50);
}

/**
 * views/films.js — elenco dei film visti o della watchlist.
 * (Fase 1: elenco semplice; griglia, lista, schede, ricerca e ordinamento arrivano nella fase 2.)
 */
import { el, icon, fmtDate, fmtVoto } from '../ui.js';
import { poster } from '../components.js';
import * as store from '../store.js';

export async function render(ctx) {
  const stato = ctx.path.startsWith('watchlist') ? 'watchlist' : 'visto';
  ctx.setTitle(stato === 'visto' ? 'Film visti' : 'Watchlist');
  const films = store.byStato(stato).slice().sort((a, b) => String(b.creato_il).localeCompare(String(a.creato_il)));
  if (!films.length) {
    ctx.view.appendChild(el('div', { class: 'empty' }, icon(stato === 'visto' ? 'film' : 'bookmark'),
      el('p', { text: stato === 'visto' ? 'Nessun film visto, per ora.' : 'La watchlist è vuota.' }),
      el('a', { class: 'btn btn-primary', href: '#/aggiungi' }, icon('plus'), 'Aggiungi un film')));
    return;
  }
  ctx.view.appendChild(el('ul', { class: 'list' }, films.map(f => el('li', {},
    el('div', { class: 'row' },
      poster(f.poster_path, { cls: 'poster poster-xs' }),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: f.titolo_it }),
        el('div', { class: 'row-sub', text: [f.anno, f.data_visione ? fmtDate(f.data_visione) : null].filter(Boolean).join(' · ') })),
      f.voto != null ? el('span', { class: 'voto-badge', text: fmtVoto(f.voto) }) : null)))));
}

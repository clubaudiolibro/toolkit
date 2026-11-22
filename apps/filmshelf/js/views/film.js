/**
 * views/film.js — scheda di dettaglio di un film: tutti i dati, modifica ed eliminazione (con conferma).
 * Per i film in watchlist c'è «Segna come visto».
 */
import { el, icon, toast, confirmDialog, fmtDateLong, fmtVoto, fmtDurata } from '../ui.js';
import { poster, vistoSheet } from '../components.js';
import { markAsSeen } from '../actions.js';
import { TMDB } from '../config.js';
import * as store from '../store.js';

function info(label, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  return el('div', { class: 'info-row' },
    el('dt', { text: label }),
    el('dd', {}, value));
}

export async function render(ctx) {
  const f = store.get(ctx.params[0]);
  const listHash = f && f.stato === 'watchlist' ? '#/watchlist' : '#/visti';
  ctx.setBack(listHash);
  if (!f) {
    ctx.setTitle('Film');
    ctx.view.appendChild(el('div', { class: 'placeholder' },
      el('strong', { text: 'Film non trovato' }),
      el('p', { text: 'Forse è stato eliminato.' }),
      el('a', { class: 'btn btn-primary', href: '#/visti', text: 'Torna ai film visti' })));
    return;
  }
  ctx.setTitle(f.stato === 'watchlist' ? 'Watchlist' : 'Film visto');
  const offline = store.isOffline();
  const orig = f.titolo_originale && f.titolo_originale !== f.titolo_it ? f.titolo_originale : null;

  async function edit() {
    const v = await vistoSheet(f, { data_visione: f.data_visione, voto: f.voto, note: f.note, luoghi: f.luoghi },
      { title: 'Modifica', ok: 'Salva le modifiche' });
    if (!v) return;
    await store.updateFilm(f.id, v);
    toast('Modifiche salvate.', 'ok');
    ctx.rerender();
  }

  async function remove() {
    const ok = await confirmDialog({
      title: 'Eliminare il film?',
      text: '«' + f.titolo_it + '» verrà tolto ' + (f.stato === 'watchlist' ? 'dalla watchlist' : 'dai film visti') + ' insieme a voto, data e note. Non si può annullare.',
      ok: 'Elimina', danger: true,
    });
    if (!ok) return;
    await store.deleteFilm(f.id);
    toast('«' + f.titolo_it + '» eliminato.', 'ok');
    ctx.go(listHash);
  }

  async function toWatchlist() {
    const ok = await confirmDialog({
      title: 'Spostare in watchlist?',
      text: 'Data di visione, voto e tag verranno tolti; le note restano.',
      ok: 'Sposta in watchlist',
    });
    if (!ok) return;
    await store.updateFilm(f.id, { stato: 'watchlist', data_visione: null, voto: null, luoghi: [] });
    toast('Spostato in watchlist.', 'ok');
    ctx.rerender();
  }

  const isSeen = f.stato === 'visto';
  ctx.view.appendChild(el('article', { class: 'detail' },
    el('div', { class: 'detail-hero' },
      poster(f.poster_path, { size: TMDB.big, cls: 'poster poster-lg', alt: 'Locandina di ' + f.titolo_it }),
      el('div', { class: 'detail-head' },
        el('h2', { class: 'detail-title', text: f.titolo_it }),
        orig ? el('div', { class: 'detail-orig', text: orig }) : null,
        el('div', { class: 'row-sub', text: [f.anno, fmtDurata(f.durata_min)].filter(Boolean).join(' · ') }),
        (f.generi || []).length ? el('div', { class: 'chips small' }, f.generi.map(g => el('span', { class: 'tag', text: g }))) : null,
        isSeen ? el('div', { class: 'detail-voto' },
          el('span', { class: 'voto-value' + (f.voto == null ? ' empty' : ''), text: f.voto == null ? '—' : fmtVoto(f.voto) }),
          el('span', { class: 'voto-max', text: f.voto == null ? 'senza voto' : '/ 10' })) : el('span', { class: 'tag tag-wl', text: 'In watchlist' }))),

    !offline ? el('div', { class: 'detail-actions' },
      isSeen
        ? el('button', { type: 'button', class: 'btn btn-primary', on: { click: edit } }, icon('edit'), 'Modifica')
        : el('button', { type: 'button', class: 'btn btn-primary', on: { click: async () => { if (await markAsSeen(f)) ctx.rerender(); } } }, icon('eye'), 'Segna come visto'),
      el('button', { type: 'button', class: 'btn btn-ghost-danger', on: { click: remove } }, icon('trash'), 'Elimina'))
      : el('p', { class: 'hint', text: 'Senza connessione le modifiche non sono possibili.' }),

    el('dl', { class: 'card pad info-list' },
      isSeen ? info('Visto il', f.data_visione ? fmtDateLong(f.data_visione) : 'data non indicata') : null,
      isSeen ? info('Tag', (f.luoghi || []).join(', ')) : null,
      info('Note', f.note ? el('span', { class: 'pre', text: f.note }) : null),
      info('Trama', f.trama),
      info('Generi', (f.generi || []).join(', ')),
      info('Durata', fmtDurata(f.durata_min)),
      info('Anno di uscita', f.anno ? String(f.anno) : null),
      info('Titolo originale', f.titolo_originale),
      info('Aggiunto il', fmtDateLong(f.creato_il)),
      f.aggiornato_il && f.aggiornato_il !== f.creato_il ? info('Ultima modifica', fmtDateLong(f.aggiornato_il)) : null,
      info('TMDB', el('a', { href: 'https://www.themoviedb.org/movie/' + f.tmdb_id, target: '_blank', rel: 'noopener', text: 'Apri la pagina su TMDB' }))),

    isSeen && !offline ? el('div', { class: 'danger-zone' },
      el('button', { type: 'button', class: 'btn btn-sm', on: { click: toWatchlist } }, icon('bookmark'), 'Sposta in watchlist')) : null));
}

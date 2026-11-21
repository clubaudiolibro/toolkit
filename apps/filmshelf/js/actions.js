/**
 * actions.js — operazioni sui film usate da più schermate:
 * aggiungere un film scelto dalla ricerca TMDB, segnare come visto un film della watchlist.
 */
import { el, icon, toast, customSheet, confirmDialog } from './ui.js';
import { filmHead, vistoSheet } from './components.js';
import { movieDetails } from './tmdb.js';
import * as store from './store.js';

/** Foglio con la scelta «Visto» / «Watchlist». Restituisce 'visto', 'watchlist' o null. */
function chooseStato(film) {
  return customSheet((sheet, close) => {
    sheet.append(
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title', text: 'Aggiungi film' }),
        el('button', { type: 'button', class: 'icon-btn muted', 'aria-label': 'Chiudi', on: { click: () => close(null) } }, icon('close'))),
      filmHead(film),
      film.trama ? el('p', { class: 'sheet-text clamp', text: film.trama }) : null,
      el('div', { class: 'choice' },
        el('button', { type: 'button', class: 'btn btn-primary btn-big', autofocus: true, on: { click: () => close('visto') } }, icon('eye'), 'Visto'),
        el('button', { type: 'button', class: 'btn btn-big', on: { click: () => close('watchlist') } }, icon('bookmark'), 'Watchlist')),
    );
  }).then(v => v || null);
}

/** Apre il modulo «Visto» per un film della watchlist e lo sposta tra i visti. */
export async function markAsSeen(film) {
  const v = await vistoSheet(film, {}, { title: 'Segna come visto' });
  if (!v) return null;
  const row = await store.updateFilm(film.id, { ...v, stato: 'visto' });
  toast('«' + row.titolo_it + '» spostato tra i visti.', 'ok');
  return row;
}

/**
 * Aggiunge il film scelto tra i risultati di ricerca (r = risultato di searchMovies).
 * - già tra i visti: lo dice e propone di aprire la scheda;
 * - già in watchlist: propone di spostarlo tra i visti;
 * - nuovo: legge i dettagli da TMDB, chiede «Visto» o «Watchlist» e salva.
 * Restituisce la riga salvata (o quella già esistente) oppure null.
 */
export async function addFromSearch(r, { openFilm } = {}) {
  const existing = store.findByTmdb(r.tmdb_id);
  if (existing && existing.stato === 'visto') {
    const open = await confirmDialog({
      title: 'Film già tra i visti',
      text: '«' + existing.titolo_it + '» è già nel tuo archivio dei film visti. Se l’hai rivisto, apri la scheda e aggiorna data e voto.',
      ok: 'Apri la scheda', cancel: 'Chiudi',
    });
    if (open && openFilm) openFilm(existing);
    return existing;
  }
  if (existing && existing.stato === 'watchlist') {
    const move = await confirmDialog({
      title: 'Film già in watchlist',
      text: '«' + existing.titolo_it + '» è nella tua watchlist. Vuoi spostarlo tra i visti?',
      ok: 'Sposta tra i visti', cancel: 'Lascia in watchlist',
    });
    return move ? markAsSeen(existing) : existing;
  }

  let details;
  try {
    details = await movieDetails(r.tmdb_id);
  } catch (e) {
    toast(e.message || 'Non riesco a leggere i dettagli da TMDB.', 'error');
    return null;
  }
  const stato = await chooseStato(details);
  if (!stato) return null;
  let extra = {};
  if (stato === 'visto') {
    const v = await vistoSheet(details, {}, { title: 'Visto' });
    if (!v) return null;
    extra = v;
  }
  const row = await store.addFilm({ ...details, ...extra, stato });
  toast(stato === 'visto' ? '«' + row.titolo_it + '» aggiunto ai visti.' : '«' + row.titolo_it + '» aggiunto alla watchlist.', 'ok');
  return row;
}

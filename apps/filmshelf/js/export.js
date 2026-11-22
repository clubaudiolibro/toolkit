/**
 * export.js — «Esporta CSV»: tutti i film con tutti i dati, come copia di sicurezza.
 * File filmshelf-AAAA-MM-GG.csv, separatore ";", UTF-8 con BOM (si apre direttamente in Excel in italiano),
 * voto con la virgola, elenchi (generi, tag) separati da " | ".
 */
import { buildCsv, download } from './csv.js';
import { todayIso } from './ui.js';
import * as store from './store.js';

/** La colonna «luoghi» contiene i tag (nome storico, tenuto per non rompere i backup già fatti). */
export const COLUMNS = ['titolo_it', 'titolo_originale', 'anno', 'stato', 'data_visione', 'voto', 'luoghi', 'note',
  'durata_min', 'generi', 'trama', 'tmdb_id', 'poster_path', 'creato_il', 'aggiornato_il', 'id'];

function value(f, k) {
  const v = f[k];
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(' | ');
  if (k === 'voto') return String(Number(v)).replace('.', ',');
  return v;
}

/** Crea il CSV e lo fa scaricare. Restituisce il numero di film esportati. */
export function exportCsv() {
  const films = store.all().slice().sort((a, b) =>
    a.stato.localeCompare(b.stato) || a.titolo_it.localeCompare(b.titolo_it, 'it', { sensitivity: 'base' }));
  const csv = buildCsv(COLUMNS, films.map(f => COLUMNS.map(k => value(f, k))));
  download(csv, 'filmshelf-' + todayIso() + '.csv');
  return films.length;
}

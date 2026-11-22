/**
 * import-csv.js — «Importa da CSV»: legge un file nel formato di «Esporta CSV» (ripristino da copia di sicurezza)
 * e prepara i film da salvare. Qui non si tocca il database: la logica è tutta in parseFilmCsv(),
 * che controlla ogni riga e dice cosa importare e cosa no (e perché).
 *
 * Regole:
 * - serve almeno tmdb_id (il database non accetta film senza) e un titolo;
 * - i film già presenti nell'archivio (stesso tmdb_id) non vengono toccati né duplicati;
 * - un film ripetuto nel file conta una volta sola (vale la prima riga);
 * - valori fuori regola (voto non da 1 a 10 a passi di 0,5, data o anno non validi)
 *   non bloccano il film: quel campo viene lasciato vuoto.
 */
import { parseCsv } from './csv.js';
import { TAG_MAX } from './config.js';

/** Colonne indispensabili: senza, il file non è un CSV di FilmShelf. */
const REQUIRED = ['titolo_it', 'tmdb_id', 'stato'];

const splitList = s => String(s || '').split('|').map(x => x.trim()).filter(Boolean);

function toInt(s) {
  const t = String(s || '').trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

function toVoto(s) {
  const t = String(s || '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 1 && n <= 10 && n * 2 === Math.trunc(n * 2) ? n : null;
}

function toDate(s) {
  const t = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
}

function toTimestamp(s) {
  const t = String(s || '').trim();
  return t && !Number.isNaN(new Date(t).getTime()) ? t : null;
}

/**
 * text = contenuto del file; existingIds = insieme dei tmdb_id già nell'archivio.
 * Restituisce { error } se il file non è un CSV di FilmShelf, altrimenti
 * { total, rows (da importare), already (n. già presenti), skipped: [{ titolo, motivo }] }.
 */
export function parseFilmCsv(text, existingIds = new Set()) {
  const raw = parseCsv(text);
  if (!raw.length) return { error: 'Il file è vuoto o non contiene film.' };
  const cols = Object.keys(raw[0]);
  const missing = REQUIRED.filter(c => !cols.includes(c));
  if (missing.length) {
    return { error: 'Non sembra un CSV di FilmShelf: mancano le colonne ' + missing.join(', ') + '. Usa un file creato con «Esporta CSV».' };
  }

  const rows = [], skipped = [];
  const seen = new Set();
  let already = 0;

  for (const r of raw) {
    const titolo = r.titolo_it || r.titolo_originale || '';
    const label = titolo || '(senza titolo)';
    const tmdb = toInt(r.tmdb_id);
    if (!titolo) { skipped.push({ titolo: label, motivo: 'manca il titolo' }); continue; }
    if (!tmdb) { skipped.push({ titolo: label, motivo: 'manca l’id TMDB' }); continue; }
    if (r.stato !== 'visto' && r.stato !== 'watchlist') { skipped.push({ titolo: label, motivo: 'stato non riconosciuto' }); continue; }
    if (seen.has(tmdb)) { skipped.push({ titolo: label, motivo: 'ripetuto nel file' }); continue; }
    seen.add(tmdb);
    if (existingIds.has(tmdb)) { already++; continue; }

    const anno = toInt(r.anno);
    // la colonna si chiama ancora «luoghi» (compatibilità con i vecchi backup): contiene i tag, anche quelli creati dall'utente
    const luoghi = splitList(r.luoghi).map(l => l.slice(0, TAG_MAX));
    const row = {
      tmdb_id: tmdb,
      titolo_it: titolo,
      titolo_originale: r.titolo_originale || null,
      anno: anno && anno >= 1870 && anno <= 2100 ? anno : null,
      durata_min: toInt(r.durata_min),
      generi: splitList(r.generi),
      trama: r.trama || null,
      poster_path: r.poster_path || null,
      stato: r.stato,
      data_visione: toDate(r.data_visione),
      voto: toVoto(r.voto),
      note: r.note || null,
      luoghi: [...new Map(luoghi.map(l => [l.toLocaleLowerCase('it'), l])).values()],
    };
    const creato = toTimestamp(r.creato_il);
    if (creato) row.creato_il = creato;       // mantiene l'ordine «aggiunti di recente» del backup
    rows.push(row);
  }
  return { total: raw.length, rows, already, skipped };
}

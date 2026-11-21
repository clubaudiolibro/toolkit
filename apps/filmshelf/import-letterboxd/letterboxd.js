/**
 * import-letterboxd/letterboxd.js — lettura dell'export di Letterboxd e abbinamento con TMDB.
 * Solo calcoli (nessuna interfaccia), così è facile da verificare.
 *
 * File dell'export di Letterboxd (riconosciuti dalle colonne, non dal nome):
 *   watched.csv  Date, Name, Year, Letterboxd URI                    → elenco dei film visti (la base)
 *   ratings.csv  Date, Name, Year, Letterboxd URI, Rating            → voti da 0,5 a 5
 *   diary.csv    Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date → date di visione
 * Il collegamento tra i file si fa con titolo + anno (nel diario l'indirizzo Letterboxd è quello
 * della singola voce, non del film).
 */
import { parseCsv } from '../js/csv.js';

/** Che tipo di file è? 'watched' | 'ratings' | 'diary' | null (dalle colonne). */
export function detectKind(rows) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const has = c => cols.includes(c);
  if (!has('Name')) return null;
  if (has('Watched Date')) return 'diary';
  if (has('Rating')) return 'ratings';
  if (has('Letterboxd URI') || has('Year')) return 'watched';
  return null;
}

/** Chiave per collegare i file: titolo in minuscolo + anno. */
export const keyOf = (name, year) => String(name || '').trim().toLowerCase() + '|' + (year || '');

/** Voto Letterboxd (0,5–5) → scala 1–10 a passi di 0,5. Valori non validi → null. */
export function convertRating(r) {
  const n = Number(String(r || '').replace(',', '.'));
  if (!n || n < 0.5 || n > 5) return null;
  const v = Math.round(n * 2 * 2) / 2;          // ×2, arrotondato al mezzo punto
  return Math.min(10, Math.max(1, v));
}

const isoDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);

/**
 * Unisce i file letti ({ watched, ratings, diary }: array di righe) in un elenco di film:
 * [{ key, name, year, voto, data }]. Base = watched; si aggiungono anche i film presenti solo
 * nei voti o nel diario. Dal diario si prende la visione più recente (e il suo voto, se manca in ratings).
 */
export function mergeLetterboxd({ watched = [], ratings = [], diary = [] }) {
  const films = new Map();
  const add = r => {
    const name = (r.Name || '').trim();
    if (!name) return null;
    const year = /^\d{4}$/.test(r.Year || '') ? Number(r.Year) : null;
    const key = keyOf(name, year);
    if (!films.has(key)) films.set(key, { key, name, year, voto: null, data: null, votoDiario: null });
    return films.get(key);
  };
  watched.forEach(add);
  for (const r of ratings) { const f = add(r); if (f) f.voto = convertRating(r.Rating); }
  for (const r of diary) {
    const f = add(r);
    if (!f) continue;
    const d = isoDate(r['Watched Date']) || null;
    if (d && (!f.data || d > f.data)) {
      f.data = d;
      if (r.Rating) f.votoDiario = convertRating(r.Rating);
    } else if (!f.data && f.votoDiario == null && r.Rating) f.votoDiario = convertRating(r.Rating);
  }
  return [...films.values()].map(({ votoDiario, ...f }) => ({ ...f, voto: f.voto != null ? f.voto : votoDiario }));
}

/**
 * Legge i testi dei CSV e li smista per tipo. Restituisce { watched, ratings, diary, ignored: [nomi], found }.
 * Conta il nome del file (watched / ratings / diary, anche «watched (1).csv») e deve corrispondere alle colonne:
 * watchlist.csv e likes/films.csv hanno le stesse colonne di watched.csv ma NON sono film visti, e lo zip contiene
 * anche le cartelle deleted/ e orphaned/ con file omonimi: tutto ciò che sta in una sottocartella viene ignorato.
 */
export function readFiles(files) {
  const out = { watched: [], ratings: [], diary: [], ignored: [], found: [] };
  for (const { name, text } of files) {
    const n = String(name).toLowerCase();
    const byName = n.includes('/') ? null : (n.match(/^(watched|ratings|diary)\b/) || [])[1] || null;
    const rows = byName ? parseCsv(text, ',') : [];
    const kind = byName && detectKind(rows) === byName ? byName : null;
    if (!kind) { out.ignored.push(name); continue; }
    out[kind] = out[kind].concat(rows);
    out.found.push({ name, kind, rows: rows.length });
  }
  return out;
}

/** Titolo semplificato per il confronto: minuscole, senza accenti né punteggiatura, "&" = "and". */
export function simplify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Decide se il risultato della ricerca TMDB è univoco ed esatto:
 * esattamente un film con lo stesso anno e lo stesso titolo (originale o italiano).
 * Restituisce { match, candidates } — match è il risultato scelto oppure null (da rivedere).
 */
export function classify(item, results) {
  const t = simplify(item.name);
  const exact = item.year == null ? [] : results.filter(r =>
    r.anno === item.year && (simplify(r.titolo_originale) === t || simplify(r.titolo_it) === t));
  if (exact.length === 1) return { match: exact[0], candidates: [] };
  // da rivedere: prima quelli esatti, poi quelli dello stesso anno, poi gli altri
  const score = r => (exact.includes(r) ? 0 : r.anno === item.year ? 1 : (item.year && Math.abs((r.anno || 0) - item.year) === 1) ? 2 : 3);
  const candidates = results.slice().sort((a, b) => score(a) - score(b)).slice(0, 6);
  return { match: null, candidates };
}

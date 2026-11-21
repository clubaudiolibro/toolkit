/**
 * tmdb.js — tutto quello che riguarda TMDB (The Movie Database).
 *
 * La chiave TMDB NON è scritta nel codice: sta nella tabella Supabase filmshelf_impostazioni
 * (protetta da RLS, leggibile solo dall'utente collegato). Viene letta dopo il login e tenuta
 * solo in memoria. Si accettano entrambi i tipi di chiave che TMDB fornisce:
 *   - "Chiave API" (32 caratteri)          → inviata come ?api_key=...
 *   - "Token di accesso in lettura" (eyJ…) → inviato come Authorization: Bearer ...
 *
 * Tutte le chiamate passano da una coda che lascia almeno TMDB.minGap ms tra una e l'altra,
 * per restare sotto il limite di TMDB (circa 40 richieste ogni 10 secondi).
 */
import { run } from './db.js';
import { TMDB } from './config.js';

let key = null;          // chiave in memoria (undefined finché non letta)
let loaded = false;

export class TmdbError extends Error {}

/* ---------- Chiave ---------- */

/** Legge la chiave da Supabase (una volta sola). Restituisce la chiave o null se non impostata. */
export async function loadKey(force = false) {
  if (loaded && !force) return key;
  const rows = await run(c => c.from('filmshelf_impostazioni').select('tmdb_key').limit(1),
    { action: 'la lettura della chiave TMDB', quiet: true });
  key = (rows && rows[0] && rows[0].tmdb_key) || null;
  loaded = true;
  return key;
}

export const hasKey = () => !!key;

/** Controlla la forma della chiave e la prova su TMDB; se va bene la salva su Supabase. */
export async function saveKey(raw) {
  const k = String(raw || '').trim().replace(/\s+/g, '');
  if (!k) throw new TmdbError('Incolla la chiave.');
  if (!/^[0-9a-f]{32}$/i.test(k) && !/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k)) {
    throw new TmdbError('Non sembra una chiave TMDB: deve essere la «Chiave API» (32 caratteri) oppure il «Token di accesso in lettura» (inizia con eyJ).');
  }
  const prev = key;
  key = k;
  try {
    await request('/configuration');
  } catch (e) {
    key = prev;
    if (e.status === 401) throw new TmdbError('TMDB ha rifiutato la chiave: controlla di averla copiata tutta.');
    throw e;
  }
  await run(c => c.from('filmshelf_impostazioni').upsert({ tmdb_key: k }, { onConflict: 'user_id' }),
    { action: 'il salvataggio della chiave' });
  loaded = true;
}

/** Cancella la chiave da Supabase. */
export async function removeKey() {
  await run(c => c.from('filmshelf_impostazioni').update({ tmdb_key: null }).not('user_id', 'is', null),
    { action: 'la rimozione della chiave' });
  key = null;
}

/* ---------- Richieste ---------- */

let last = 0;
let queue = Promise.resolve();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Mette in coda una funzione rispettando la pausa minima tra le chiamate. */
function throttled(fn) {
  const p = queue.then(async () => {
    const wait = last + TMDB.minGap - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
  }).then(fn);
  queue = p.catch(() => {});
  return p;
}

/**
 * Chiamata GET all'API di TMDB. params: oggetto con i parametri; opts.signal per annullare.
 * Se TMDB risponde 429 (troppe richieste) aspetta e riprova fino a 3 volte.
 */
export async function request(path, params = {}, opts = {}) {
  if (!key) throw new TmdbError('Manca la chiave TMDB.');
  const url = new URL(TMDB.api + path);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v);
  const headers = { accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  else url.searchParams.set('api_key', key);

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await throttled(() => fetch(url, { headers, signal: opts.signal }));
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new TmdbError('TMDB non risponde: controlla la connessione.');
    }
    if (res.status === 429 && attempt < 3) {
      const s = Number(res.headers.get('retry-after')) || 2;
      await sleep(s * 1000);
      continue;
    }
    if (!res.ok) {
      const err = new TmdbError(res.status === 401 ? 'La chiave TMDB non è valida.' : 'TMDB ha risposto con un errore (' + res.status + ').');
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
}

/* ---------- Ricerca e dettagli ---------- */

/** Anno da "AAAA-MM-GG" (null se manca). */
export const yearOf = d => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);

/**
 * Cerca film per titolo (search/movie). year facoltativo.
 * Restituisce [{ tmdb_id, titolo_it, titolo_originale, anno, poster_path, popolarita }].
 */
export async function searchMovies(query, { year = null, signal } = {}) {
  const data = await request('/search/movie', {
    query, language: TMDB.lang, include_adult: 'false', year: year || null,
  }, { signal });
  return (data.results || []).map(r => ({
    tmdb_id: r.id,
    titolo_it: r.title || r.original_title || '',
    titolo_originale: r.original_title || '',
    anno: yearOf(r.release_date),
    poster_path: r.poster_path || null,
    popolarita: r.popularity || 0,
  }));
}

/**
 * Dettagli di un film (movie/{id}) pronti da salvare: titolo italiano e originale, anno, durata,
 * generi in italiano, trama (se manca in italiano si usa quella inglese), poster_path.
 */
export async function movieDetails(tmdbId) {
  const d = await request('/movie/' + Number(tmdbId), { language: TMDB.lang, append_to_response: 'translations' });
  let trama = (d.overview || '').trim();
  if (!trama) {
    const tr = (d.translations && d.translations.translations) || [];
    const en = tr.find(t => t.iso_639_1 === 'en' && t.data && t.data.overview);
    trama = en ? en.data.overview.trim() : '';
  }
  return {
    tmdb_id: d.id,
    titolo_it: d.title || d.original_title || '',
    titolo_originale: d.original_title || null,
    anno: yearOf(d.release_date),
    durata_min: d.runtime || null,
    generi: (d.genres || []).map(g => g.name),
    trama: trama || null,
    poster_path: d.poster_path || null,
  };
}

/** URL dell'immagine della locandina (null se il film non ha locandina). */
export function posterUrl(path, size = TMDB.thumb) {
  return path ? TMDB.img + size + path : null;
}

/**
 * store.js — i film in memoria, sempre allineati con Supabase.
 *
 * All'avvio si leggono tutti i film (loadAll); ogni modifica va subito su Supabase e poi
 * aggiorna la copia in memoria. Una copia viene salvata anche nel browser (localStorage),
 * così senza rete i dati restano visibili (solo lettura).
 */
import { run, fetchAll } from './db.js';
import { KEYS } from './config.js';

const TABLE = 'filmshelf_film';

/** Colonne che l'app scrive (id, user_id e date di sistema le gestisce il database). */
export const FIELDS = ['tmdb_id', 'titolo_it', 'titolo_originale', 'anno', 'durata_min', 'generi', 'trama',
  'poster_path', 'stato', 'data_visione', 'voto', 'note', 'luoghi'];

let films = [];
let offline = false;      // true se i dati vengono dalla copia locale

export const isOffline = () => offline;
export const all = () => films;
export const byStato = stato => films.filter(f => f.stato === stato);
export const get = id => films.find(f => f.id === id) || null;
export const findByTmdb = tmdbId => films.find(f => f.tmdb_id === Number(tmdbId)) || null;

function saveCache() {
  try { localStorage.setItem(KEYS.cache, JSON.stringify({ saved_at: new Date().toISOString(), films })); }
  catch (e) { /* spazio pieno: pazienza, la copia locale è solo una comodità */ }
}

/** Legge tutti i film da Supabase. */
export async function loadAll() {
  films = await fetchAll(TABLE);
  offline = false;
  saveCache();
}

/** Usa la copia salvata nel browser. Restituisce false se non c'è. */
export function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(KEYS.cache) || 'null');
    if (!c || !Array.isArray(c.films)) return false;
    films = c.films;
    offline = true;
    return true;
  } catch (e) { return false; }
}

function pick(data) {
  const out = {};
  for (const k of FIELDS) if (k in data) out[k] = data[k];
  return out;
}

function replace(row) {
  const i = films.findIndex(f => f.id === row.id);
  if (i >= 0) films[i] = row; else films.push(row);
  saveCache();
  return row;
}

/** Aggiunge un film. data = campi di FIELDS. Restituisce la riga salvata. */
export async function addFilm(data) {
  const row = await run(c => c.from(TABLE).insert(pick(data)).select().single(), { action: 'il salvataggio' });
  return replace(row);
}

/** Modifica un film. Restituisce la riga aggiornata. */
export async function updateFilm(id, data) {
  const row = await run(c => c.from(TABLE).update(pick(data)).eq('id', id).select().single(), { action: 'il salvataggio' });
  return replace(row);
}

/** Elimina definitivamente un film. */
export async function deleteFilm(id) {
  await run(c => c.from(TABLE).delete().eq('id', id), { action: "l'eliminazione" });
  films = films.filter(f => f.id !== id);
  saveCache();
}

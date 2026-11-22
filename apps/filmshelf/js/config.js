/**
 * config.js — impostazioni di FilmShelf.
 * APP_VERSION va tenuta uguale al campo version di "filmshelf" in assets/js/apps.js.
 * SCHEMA_VERSION deve corrispondere a filmshelf_schema_version() in supabase/filmshelf.sql.
 */
export const APP_VERSION = '1.7';
export const SCHEMA_VERSION = 2;

/** Tag di partenza (finché non se ne crea uno nuovo); l'elenco vero sta nel database, vedi js/tags.js. */
export const TAG_PREDEFINITI = ['Cinema', 'The Space Pass', 'Casa'];
/** Lunghezza massima di un tag. */
export const TAG_MAX = 30;

/** TMDB: indirizzi dell'API e delle immagini, lingua. */
export const TMDB = {
  api: 'https://api.themoviedb.org/3',
  img: 'https://image.tmdb.org/t/p/',
  lang: 'it-IT',
  thumb: 'w185',          // griglia e lista
  big: 'w500',            // scheda del film
  searchDelay: 300,       // attesa (ms) dopo l'ultima lettera prima di cercare
  minGap: 260,            // pausa minima tra due chiamate (≈ 38 ogni 10 secondi)
};

/** Nomi delle chiavi in localStorage (solo dati di questo dispositivo). */
export const KEYS = {
  cache: 'filmshelf.cache',      // copia dei film per vederli anche senza rete
  view: 'filmshelf.view',        // ultima modalità di visualizzazione scelta
  sort: 'filmshelf.sort',        // ultimo ordinamento scelto
  tags: 'filmshelf.tags',        // copia dell'elenco dei tag per l'uso senza rete
};

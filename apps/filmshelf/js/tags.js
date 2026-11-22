/**
 * tags.js — i tag dei film (Cinema, The Space Pass, Casa e quelli creati dall'utente).
 *
 * Nel database la colonna dei film si chiama ancora «luoghi» (così i backup CSV restano compatibili),
 * ma nell'app si parla sempre di «tag». L'elenco dei tag disponibili sta in
 * filmshelf_impostazioni.tag_elenco; se non è mai stato salvato valgono i tre tag di partenza.
 * L'elenco mostrato è sempre: tag salvati + eventuali tag usati dai film ma mancanti nell'elenco.
 */
import { run } from './db.js';
import { KEYS, TAG_PREDEFINITI, TAG_MAX } from './config.js';
import * as store from './store.js';

let saved = null;          // elenco salvato (null = mai salvato)

function readLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(KEYS.tags) || 'null');
    return Array.isArray(v) ? v : null;
  } catch (e) { return null; }
}
function writeLocal() {
  try { localStorage.setItem(KEYS.tags, JSON.stringify(saved)); } catch (e) { /* pazienza */ }
}

/** Legge l'elenco da Supabase. Senza rete usa la copia del dispositivo. */
export async function load({ offline = false } = {}) {
  if (!offline) {
    try {
      const rows = await run(c => c.from('filmshelf_impostazioni').select('tag_elenco').limit(1),
        { action: "la lettura dei tag", quiet: true });
      saved = rows && rows[0] && Array.isArray(rows[0].tag_elenco) && rows[0].tag_elenco.length ? rows[0].tag_elenco : null;
      writeLocal();
      return;
    } catch (e) { /* rete assente: si usa la copia locale */ }
  }
  saved = readLocal();
}

/** Tutti i tag disponibili, nell'ordine in cui sono stati creati. */
export function all() {
  const out = (saved || TAG_PREDEFINITI).slice();
  const have = new Set(out.map(t => t.toLocaleLowerCase('it')));
  for (const f of store.all()) {
    for (const t of f.luoghi || []) {
      const k = t.toLocaleLowerCase('it');
      if (!have.has(k)) { have.add(k); out.push(t); }
    }
  }
  return out;
}

/** Pulisce un nome di tag (spazi doppi, lunghezza); il carattere | è riservato ai file CSV. */
export const clean = s => String(s || '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TAG_MAX);

/** Se esiste già un tag con lo stesso nome (senza badare alle maiuscole) lo restituisce. */
export const find = name => {
  const k = clean(name).toLocaleLowerCase('it');
  return all().find(t => t.toLocaleLowerCase('it') === k) || null;
};

/**
 * Crea un tag nuovo e lo salva. Restituisce { tag, created }: se esisteva già (anche con altre maiuscole)
 * restituisce quello esistente con created = false. Lancia un errore se il nome non è valido.
 */
export async function add(name) {
  const n = clean(name);
  if (!n) { const e = new Error('Scrivi il nome del tag.'); e.validation = true; throw e; }
  const existing = find(n);
  if (existing) return { tag: existing, created: false };
  const next = [...all(), n];
  await run(c => c.from('filmshelf_impostazioni').upsert({ tag_elenco: next }, { onConflict: 'user_id' }),
    { action: 'il salvataggio del tag' });
  saved = next;
  writeLocal();
  return { tag: n, created: true };
}

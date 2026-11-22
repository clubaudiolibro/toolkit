/**
 * util.js — funzioni di servizio comuni ai moduli del backup globale.
 * Nessun modulo di questa cartella importa codice delle app (solo le loro costanti in config.js):
 * il backup globale non può quindi cambiare il comportamento degli strumenti.
 */

export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/** Dimensione leggibile: 1,2 MB. */
export function fmtBytes(n) {
  n = Number(n) || 0;
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i === 0 ? String(Math.round(n)) : n.toFixed(n >= 100 ? 0 : 1).replace('.', ',')) + ' ' + u[i];
}

/** Data locale AAAA-MM-GG (per i nomi dei file). */
export function stamp(d = new Date()) {
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Messaggio comprensibile per un errore di rete o di Supabase. */
export function describeError(e) {
  const m = String((e && (e.message || e.details)) || e || '');
  if (!navigator.onLine || /failed to fetch|networkerror|network request failed|load failed/i.test(m)) {
    return 'Nessuna connessione: controlla la rete e riprova.';
  }
  if (e && (e.code === 'PGRST301' || /jwt/i.test(m))) return 'Sessione scaduta: esci e accedi di nuovo dalla home.';
  return m || 'Errore sconosciuto.';
}

/** Trasforma l'errore di Supabase in un Error con messaggio in italiano. */
export function dbError(error) {
  const e = new Error(describeError(error));
  e.code = error && error.code;
  return e;
}

/** Operazione fermata dall'utente (pulsante «Interrompi»). */
export class Interrupted extends Error {}

const SCHEMA_MISSING = ['PGRST202', '42883', 'PGRST205', '42P01'];

/** Versione dello schema nel database; null se il file SQL dell'app non è ancora stato eseguito. */
export async function schemaVersion(client, fn) {
  const res = await client.rpc(fn);
  if (res.error) {
    if (SCHEMA_MISSING.includes(res.error.code) || res.status === 404) return null;
    throw dbError(res.error);
  }
  return res.data;
}

/** Legge tutte le righe di una tabella (a pagine da 1000). */
export async function fetchAll(client, table, select = '*', order = 'created_at') {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await client.from(table).select(select).order(order, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw dbError(error);
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

/** Numero di righe di una tabella, senza scaricarle. */
export async function headCount(client, table) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw dbError(error);
  return count || 0;
}

/** Inserisce righe a gruppi (200 alla volta). */
export async function insertRows(client, table, rows, size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await client.from(table).insert(rows.slice(i, i + size));
    if (error) throw dbError(error);
  }
}

/** Toglie user_id: nel file non serve, al ripristino lo mette il database. */
export const stripUser = rows => rows.map(r => { const { user_id, ...rest } = r; return rest; });

/** Legge un file JSON dentro lo zip. */
export async function readJson(folder, name) {
  const f = folder.file(name);
  if (!f) throw new Error('Nel backup manca il file «' + name + '».');
  try { return JSON.parse(await f.async('string')); }
  catch (e) { throw new Error('Il file «' + name + '» del backup è rovinato.'); }
}

/**
 * Esegue fn su ogni elemento con al massimo `size` operazioni in parallelo.
 * Al primo errore smette di avviarne di nuove e rilancia l'errore; ctx.check() ferma tutto se l'utente interrompe.
 */
export async function pool(items, size, fn, ctx) {
  let next = 0;
  let failed = null;
  const worker = async () => {
    while (!failed) {
      try {
        ctx.check();
        const k = next++;
        if (k >= items.length) return;
        await fn(items[k], k);
      } catch (e) { failed = failed || e; return; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  if (failed) throw failed;
}

export const lc = s => String(s || '').toLocaleLowerCase('it');

/**
 * db.js — collegamento a Supabase tramite il login unico della Toolbox
 * (assets/js/toolbox-auth.js → window.Toolbox). Nessun dato di collegamento è duplicato qui.
 *
 * Tutte le richieste passano da run(): se qualcosa va storto mostra un avviso
 * (in particolare se manca la rete) e lancia l'errore, così l'operazione si ferma.
 */
import { toast } from './ui.js';

let client = null;
let userId = null;

export class DbError extends Error {}

function homeRedirect() {
  const home = window.Toolbox ? window.Toolbox.homeUrl() : '../../index.html';
  location.replace(home + '?next=' + encodeURIComponent('apps/gymlog/'));
}

/** Prepara il client. Restituisce false (e rimanda alla home) se non c'è un utente collegato. */
export async function initDb() {
  if (!window.Toolbox) throw new Error('Manca il file di accesso della Toolbox.');
  client = await window.Toolbox.getClient();
  if (!client) { homeRedirect(); return false; }
  const user = await window.Toolbox.getUser();
  if (!user) { homeRedirect(); return false; }
  userId = user.id;
  return true;
}

export function uid() { return userId; }

function isNetworkError(err) {
  if (!navigator.onLine) return true;
  const m = String((err && (err.message || err.details)) || '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(m) && !err.code;
}

export function errorMessage(err, action) {
  if (isNetworkError(err)) {
    return 'Nessuna connessione: ' + (action || 'il salvataggio') + ' non è riuscito. Attiva la rete dati e riprova.';
  }
  if (err && (err.code === 'PGRST301' || /jwt/i.test(err.message || ''))) {
    return 'Sessione scaduta: torna alla Toolbox e accedi di nuovo.';
  }
  if (err && err.code === '23505') return 'Esiste già una voce con questo nome.';
  return 'Errore: ' + ((err && err.message) || 'operazione non riuscita') + '.';
}

/**
 * Esegue una richiesta. fn riceve il client e restituisce il "builder" di supabase-js.
 * opts.action: testo per l'avviso ("il salvataggio", "il caricamento", ...).
 */
export async function run(fn, opts = {}) {
  let res;
  try {
    res = await fn(client);
  } catch (e) {
    toast(errorMessage(e, opts.action), 'error');
    throw new DbError(e.message || 'Errore di rete');
  }
  if (res && res.error) {
    if (!opts.quiet) toast(errorMessage(res.error, opts.action), 'error');
    const e = new DbError(res.error.message || 'Errore');
    e.code = res.error.code;
    throw e;
  }
  return res ? res.data : null;
}

/** Legge tutte le righe di una tabella (a pagine da 1000). */
export async function fetchAll(table, select = '*', order = 'created_at') {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const data = await run(c => c.from(table).select(select).order(order, { ascending: true })
      .range(from, from + size - 1), { action: 'il caricamento' });
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

/** Versione dello schema nel database; null se il file SQL non è ancora stato eseguito. */
export async function schemaVersion() {
  try {
    const res = await client.rpc('gym_schema_version');
    if (res.error) {
      if (['PGRST202', '42883', 'PGRST205', '42P01'].includes(res.error.code) || res.status === 404) return null;
      toast(errorMessage(res.error, 'il caricamento'), 'error');
      throw new DbError(res.error.message);
    }
    return res.data;
  } catch (e) {
    if (e instanceof DbError) throw e;
    toast(errorMessage(e, 'il caricamento'), 'error');
    throw new DbError(e.message);
  }
}

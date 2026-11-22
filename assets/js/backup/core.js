/**
 * core.js — backup globale della Toolbox.
 *
 * Il file è uno .zip con questa forma:
 *   manifest.json          indice: data, versione della Toolbox, un elemento per ogni strumento incluso
 *   LEGGIMI.txt            spiegazione in italiano
 *   <id-strumento>/…       i dati di ogni strumento, scritti dal suo adattatore (cartella assets/js/backup/adapters)
 *
 * Qui non c'è nessuna logica specifica dei singoli strumenti: createBackup() chiede a ogni adattatore
 * di scrivere i suoi file, openArchive() legge un backup, restoreItems() chiede agli adattatori di ripristinare.
 */
import { stamp, describeError, Interrupted } from './util.js';

export const FORMAT = 1;
const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js';
export const LAST_KEY = 'toolbox.lastBackup';

let zipLib = null;
/** Carica jszip (stessa versione di TabShelf) la prima volta che serve. */
export function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (zipLib) return zipLib;
  zipLib = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP_URL; s.crossOrigin = 'anonymous';
    s.onload = () => (window.JSZip ? resolve(window.JSZip) : reject(new Error('Libreria per gli zip non disponibile.')));
    s.onerror = () => { zipLib = null; reject(new Error('Impossibile caricare la libreria per gli zip: controlla la connessione.')); };
    document.head.appendChild(s);
  });
  return zipLib;
}

/** Collegamento a Supabase + segnale di interruzione, condivisi da tutti gli adattatori. */
export async function makeContext() {
  if (!window.Toolbox) throw new Error('Manca il file di accesso della Toolbox.');
  let client = null, user = null;
  try {
    client = await window.Toolbox.getClient();
    user = client ? await window.Toolbox.getUser() : null;
  } catch (e) { /* senza rete: restano disponibili solo gli strumenti che salvano nel browser */ }
  const signal = { aborted: false };
  return {
    client, user, userId: user ? user.id : null, signal,
    abort() { signal.aborted = true; },
    check() { if (signal.aborted) throw new Interrupted('Interrotto.'); },
  };
}

/** Versione attuale della Toolbox (ultima riga «toolbox» del registro delle versioni). */
function toolboxVersion() {
  try {
    const e = (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []).find(x => x.app === 'toolbox');
    return e ? e.version : null;
  } catch (e) { return null; }
}
function appVersion(id) {
  try { const a = (typeof APPS !== 'undefined' ? APPS : []).find(x => x.id === id); return a ? a.version : null; } catch (e) { return null; }
}

/* ------------------------------------------------------------------ salvataggio */

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

/** Salva un file: su iPhone con l'app sulla Home si passa dal foglio «Condividi», altrove è un normale download. */
export async function saveBlob(blob, name) {
  if (isIOS() && isStandalone() && navigator.canShare) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

/** Su PC (Chrome/Edge) chiede subito dove salvare e scrive lo zip su disco mentre lo crea. */
async function askSaveTarget(fileName) {
  if (!window.showSaveFilePicker) return { writable: null };
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName, types: [{ description: 'Archivio ZIP', accept: { 'application/zip': ['.zip'] } }],
    });
    return { writable: await handle.createWritable() };
  } catch (e) {
    if (e && e.name === 'AbortError') return { cancelled: true };
    return { writable: null };                       // si ripiega sul download normale
  }
}

async function writeZip(zip, fileName, writable, onPercent) {
  const opts = { streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 6 } };
  if (writable) {
    await new Promise((resolve, reject) => {
      const stream = zip.generateInternalStream({ type: 'uint8array', ...opts });
      let chain = Promise.resolve();
      stream.on('data', (chunk, meta) => {
        stream.pause();                              // si aspetta che il pezzo sia su disco: memoria sempre bassa
        chain = chain.then(() => writable.write(chunk)).then(() => stream.resume(), reject);
        onPercent(meta.percent);
      });
      stream.on('error', reject);
      stream.on('end', () => chain.then(resolve, reject));
      stream.resume();
    });
    await writable.close();
    return 'disco';
  }
  const blob = await zip.generateAsync({ type: 'blob', ...opts }, meta => onPercent(meta.percent));
  const saved = await saveBlob(blob, fileName);
  if (!saved) return null;
  return 'download';
}

/* ------------------------------------------------------------------ creazione */

const README = [
  'BACKUP DELLA TOOLBOX DI ALESSANDRO',
  '',
  'Questo file contiene i dati degli strumenti della Toolbox.',
  'Per ripristinarlo: apri la Toolbox, accedi, poi «Ripristina…» nella sezione Backup e scegli questo file.',
  '',
  'Cartelle:',
  '  manifest.json    indice del backup',
  '  gymlog/          GymLog (gymlog.json è anche un backup valido per «Altro → Backup» di GymLog)',
  '  filmshelf/       FilmShelf (film e tag; la chiave TMDB non è inclusa)',
  '  tabshelf/        TabShelf (dati, file delle tablature e miniature; il cestino non è incluso)',
  '  audiolibri/, citazioni/, postcard-audiolibri/   impostazioni e template salvati nel browser',
  '',
  'Non condividere questo file: contiene i tuoi dati personali.',
  '',
].join('\r\n');

/**
 * Crea il backup degli adattatori scelti e lo salva. Va chiamata direttamente dal clic dell'utente
 * (il browser chiede dove salvare solo in risposta a un clic).
 * onProgress(frazione 0–1, testo).
 * Restituisce null se l'utente annulla la scelta del file, altrimenti { items, fileName, savedAs, complete }.
 */
export async function createBackup({ adapters, ctx, onProgress, prefix = 'toolbox-backup' }) {
  const fileName = prefix + '-' + stamp() + '.zip';
  const target = await askSaveTarget(fileName);
  if (target.cancelled) return null;

  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const totalWeight = adapters.reduce((s, a) => s + (a.weight || 1), 0);
  const ADAPT = 0.85;                                 // il resto dell'avanzamento è la scrittura dello zip
  let before = 0;
  const items = [];

  try {
    for (const a of adapters) {
      ctx.check();
      const w = (a.weight || 1) / totalWeight;
      const start = before;
      const progress = (f, text) => onProgress(ADAPT * (start + w * Math.min(1, Math.max(0, f))), text);
      progress(0, a.title + '…');
      try {
        const r = await a.export(ctx, zip.folder(a.id), progress);
        items.push({ id: a.id, title: a.title, ok: true, summary: r.summary, warning: r.warning || null,
          app_version: appVersion(a.id), counts: r.counts || {} });
      } catch (e) {
        if (e instanceof Interrupted) throw e;
        zip.remove(a.id);                              // niente file a metà
        items.push({ id: a.id, title: a.title, ok: false, error: describeError(e) });
      }
      before += w;
    }

    const included = items.filter(i => i.ok);
    if (!included.length) throw new Error('Nessuno strumento è stato salvato: ' + (items[0] ? items[0].error : 'nulla da salvare') );

    zip.file('manifest.json', JSON.stringify({
      app: 'toolbox-backup', format: FORMAT, created_at: new Date().toISOString(), toolbox_version: toolboxVersion(),
      items: included.map(i => ({ id: i.id, title: i.title, app_version: i.app_version, summary: i.summary, counts: i.counts })),
    }, null, 1));
    zip.file('LEGGIMI.txt', README);

    const savedAs = await writeZip(zip, fileName, target.writable, pct => onProgress(ADAPT + (1 - ADAPT) * (pct / 100), 'Creazione del file zip…'));
    if (!savedAs) return null;
    onProgress(1, 'Backup completato.');
    const complete = items.every(i => i.ok);
    return { items, fileName, savedAs, complete };
  } catch (e) {
    // a metà strada: il file su disco, se c'è, va chiuso e non è valido
    if (target.writable) { try { await target.writable.abort(); } catch (x) { try { await target.writable.close(); } catch (y) { /* niente */ } } }
    throw e;
  }
}

/* ------------------------------------------------------------------ lettura e ripristino */

/** Apre un backup e controlla l'indice. Lancia un Error con un messaggio comprensibile. */
export async function openArchive(file) {
  const JSZip = await loadJSZip();
  let zip;
  try { zip = await JSZip.loadAsync(file); }
  catch (e) { throw new Error('Il file scelto non è uno zip valido.'); }
  const mf = zip.file('manifest.json');
  if (!mf) throw new Error('Questo zip non è un backup della Toolbox (manca manifest.json).');
  let manifest;
  try { manifest = JSON.parse(await mf.async('string')); }
  catch (e) { throw new Error('L’indice del backup (manifest.json) è rovinato.'); }
  if (!manifest || manifest.app !== 'toolbox-backup' || !Array.isArray(manifest.items)) {
    throw new Error('Questo zip non è un backup della Toolbox.');
  }
  if (manifest.format !== FORMAT) throw new Error('Questo backup è stato creato da una versione più recente della Toolbox: aggiorna la pagina e riprova.');
  return { zip, manifest };
}

/**
 * Ripristina gli strumenti scelti, uno dopo l'altro. Un errore su uno strumento non ferma gli altri,
 * tranne l'interruzione voluta dall'utente.
 * Restituisce [{ id, title, ok, message }].
 */
export async function restoreItems({ archive, adapters, ctx, onProgress }) {
  const results = [];
  const n = adapters.length;
  for (let i = 0; i < n; i++) {
    const a = adapters[i];
    const item = archive.manifest.items.find(x => x.id === a.id);
    const progress = (f, text) => onProgress((i + Math.min(1, Math.max(0, f))) / n, text);
    try {
      ctx.check();
      progress(0, a.title + '…');
      const message = await a.restore(ctx, archive.zip.folder(a.id), item, progress);
      results.push({ id: a.id, title: a.title, ok: true, message });
    } catch (e) {
      const interrupted = e instanceof Interrupted;
      results.push({ id: a.id, title: a.title, ok: false, interrupted, message: describeError(e) });
      if (interrupted) {
        adapters.slice(i + 1).forEach(b => results.push({ id: b.id, title: b.title, ok: false, interrupted: true, message: 'Non eseguito.' }));
        break;
      }
    }
  }
  onProgress(1, 'Ripristino terminato.');
  return results;
}

export function markBackupDone() {
  try { localStorage.setItem(LAST_KEY, new Date().toISOString()); } catch (e) { /* pazienza */ }
}
export function lastBackupAt() {
  try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; }
}

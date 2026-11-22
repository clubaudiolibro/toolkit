/**
 * local-apps.js — adattatori per gli strumenti che non hanno un database: salvano solo nel browser
 * (localStorage per impostazioni e template, IndexedDB per le copertine).
 *
 *   Diario degli Audiolibri   preferenze, mappatura delle colonne, filtri. Il CSV memorizzato NON è incluso:
 *                             i dati arrivano ogni notte da Notion e si ricaricano da soli.
 *   Citazioni in Immagine     impostazioni, template e copertine.
 *   Postcard audiolibri       impostazioni, template e copertine.
 *
 * Tutti gli strumenti stanno sullo stesso indirizzo, quindi la home può leggere e scrivere questi dati.
 * Sono dati DI QUESTO BROWSER: il backup fatto dal telefono contiene quelli del telefono.
 * Il ripristino li sostituisce (le copertine con lo stesso titolo vengono sostituite, le altre restano).
 * Per questo, prima di ripristinarli, la home scarica una copia di sicurezza di quelli attuali.
 */
import { plural } from '../util.js';

/** Apre il database delle copertine con la stessa struttura usata dalle app (lo crea se non c'è). */
function openCovers(name) {
  return new Promise(resolve => {
    try {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('covers');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

function readCovers(db) {
  return new Promise(resolve => {
    if (!db) return resolve([]);
    const out = [];
    try {
      const req = db.transaction('covers', 'readonly').objectStore('covers').openCursor();
      req.onsuccess = () => { const cur = req.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else resolve(out); };
      req.onerror = () => resolve(out);
    } catch (e) { resolve(out); }
  });
}

function writeCovers(db, entries) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Impossibile aprire l’archivio delle copertine di questo browser.'));
    try {
      const tx = db.transaction('covers', 'readwrite');
      const st = tx.objectStore('covers');
      entries.forEach(([k, v]) => st.put(v, k));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Scrittura delle copertine non riuscita.'));
      tx.onabort = () => reject(tx.error || new Error('Scrittura delle copertine non riuscita.'));
    } catch (e) { reject(e); }
  });
}

const getLS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

function localApp({ id, title, keys, coversDb = null, note }) {
  const present = () => keys.filter(k => getLS(k) != null);
  return {
    id, title,
    kind: 'overwrite',
    weight: 1,
    restoreNote: note,

    async check() {
      const n = present().length;
      let covers = 0;
      if (coversDb) { const db = await openCovers(coversDb); covers = (await readCovers(db)).length; if (db) db.close(); }
      if (!n && !covers) return { ok: false, reason: 'Nessun dato salvato in questo browser.' };
      return { ok: true, summary: 'Impostazioni di questo browser' + (covers ? ' · ' + plural(covers, 'copertina', 'copertine') : '') };
    },

    async export(ctx, folder, progress) {
      progress(0.1, title + ': lettura…');
      const storage = {};
      present().forEach(k => { storage[k] = getLS(k); });
      const covers = [];
      if (coversDb) {
        const db = await openCovers(coversDb);
        const entries = await readCovers(db);
        if (db) db.close();
        let i = 0;
        for (const [key, blob] of entries) {
          ctx.check();
          if (!(blob instanceof Blob)) continue;
          const file = 'copertine/' + (++i) + '.jpg';
          folder.file(file, blob, { binary: true, compression: 'STORE' });
          covers.push({ key, file, type: blob.type || 'image/jpeg' });
        }
      }
      folder.file('impostazioni.json', JSON.stringify({
        app: id, format: 1, created_at: new Date().toISOString(), storage, covers,
      }, null, 1));
      const counts = { settings: Object.keys(storage).length, covers: covers.length };
      return { summary: 'Impostazioni' + (covers.length ? ' · ' + plural(covers.length, 'copertina', 'copertine') : ''), counts };
    },

    async prepare(ctx, folder) {
      const obj = await this._read(folder);
      return { summary: 'Impostazioni' + (obj.covers.length ? ' · ' + plural(obj.covers.length, 'copertina', 'copertine') : '') };
    },

    async _read(folder) {
      const f = folder.file('impostazioni.json');
      if (!f) throw new Error('Nel backup mancano le impostazioni di ' + title + '.');
      let obj;
      try { obj = JSON.parse(await f.async('string')); } catch (e) { throw new Error('Le impostazioni di ' + title + ' nel backup sono rovinate.'); }
      if (!obj || obj.app !== id || typeof obj.storage !== 'object' || !Array.isArray(obj.covers)) {
        throw new Error('Le impostazioni di ' + title + ' nel backup non sono valide.');
      }
      if (obj.format !== 1) throw new Error('Il backup di ' + title + ' è di una versione più recente: aggiorna la pagina e riprova.');
      return obj;
    },

    async restore(ctx, folder, item, progress) {
      const obj = await this._read(folder);
      progress(0.2, title + ': ripristino delle impostazioni…');
      let n = 0;
      for (const k of keys) {                       // solo le chiavi note di questa app, mai altre
        if (typeof obj.storage[k] !== 'string') continue;
        try { localStorage.setItem(k, obj.storage[k]); n++; }
        catch (e) { throw new Error('Memoria del browser piena: impossibile salvare le impostazioni.'); }
      }
      let c = 0;
      if (coversDb && obj.covers.length) {
        const entries = [];
        for (const cv of obj.covers) {
          ctx.check();
          const f = folder.file(cv.file);
          if (!f) continue;
          entries.push([cv.key, new Blob([await f.async('arraybuffer')], { type: cv.type || 'image/jpeg' })]);
        }
        progress(0.6, title + ': ripristino delle copertine…');
        const db = await openCovers(coversDb);
        try { await writeCovers(db, entries); } finally { if (db) db.close(); }
        c = entries.length;
      }
      return 'Ripristinate le impostazioni' + (c ? ' e ' + plural(c, 'copertina', 'copertine') : '') + '. Riapri lo strumento per vederle.';
    },
  };
}

const NOTE = 'Sostituisce le impostazioni salvate in questo browser con quelle del backup.';
const NOTE_COVERS = 'Sostituisce impostazioni e template salvati in questo browser; le copertine con lo stesso titolo vengono sostituite, le altre restano.';

export const audiolibri = localApp({
  id: 'audiolibri', title: 'Diario degli Audiolibri',
  keys: ['adb.prefs.v1', 'adb.mapping.v1', 'adb.filters.v1'], note: NOTE,
});
export const citazioni = localApp({
  id: 'citazioni', title: 'Citazioni in Immagine',
  keys: ['citazioni-settings-v2', 'citazioni-templates-v2'], coversDb: 'citazioni-covers', note: NOTE_COVERS,
});
export const postcard = localApp({
  id: 'postcard-audiolibri', title: 'Postcard audiolibri',
  keys: ['postcard-settings-v3', 'postcard-templates-v3'], coversDb: 'postcard-covers', note: NOTE_COVERS,
});

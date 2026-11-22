/**
 * tabshelf.js — adattatore del backup globale per TabShelf.
 *
 * Nel backup (escluso il cestino):
 *   tabshelf/tabshelf.json     categorie, tag, documenti, associazioni, raccolte
 *   tabshelf/documenti/…       i file delle tablature, così come sono nello storage
 *   tabshelf/miniature/…       le miniature (così la libreria si vede subito dopo il ripristino)
 *
 * Ripristino = UNIONE, non sostituzione: non cancella e non modifica niente di ciò che c'è già.
 *   - categorie e tag: quelli già presenti (stesso id, o stesso nome nella stessa categoria) si riusano;
 *   - ogni tablatura mancante viene prima caricata nello storage e solo dopo registrata nel database;
 *     se qualcosa va storto i file appena caricati vengono tolti, quindi non restano file orfani né schede vuote;
 *   - se il ripristino si interrompe basta rifarlo: le tablature già aggiunte vengono saltate e si riparte dalle altre.
 * Prima di cominciare (prepare) si controlla che lo spazio nel piano gratuito di Supabase basti.
 */
import { APP_VERSION, SCHEMA_VERSION, BUCKET, SPACE } from '../../../../apps/tabshelf/js/config.js';
import { fetchAll, schemaVersion, readJson, insertRows, pool, plural, fmtBytes, dbError, describeError, lc } from '../util.js';

const CONCURRENCY = 3;

/** Nome di file sicuro per Windows. */
function safeName(s, max = 80) {
  return String(s || '').normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '')
    .slice(0, max).trim() || 'documento';
}
const extOf = p => { const m = String(p || '').match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : 'bin'; };
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', pdf: 'application/pdf' };
const mimeOf = ext => MIME[ext] || 'application/octet-stream';

const DOC_FIELDS = ['id', 'title', 'artist', 'notes', 'link_url', 'link_label', 'original_name', 'file_type',
  'file_size', 'thumb_size', 'status', 'mastery', 'created_at'];
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k] ?? null]));

async function readBackup(folder) {
  const obj = await readJson(folder, 'tabshelf.json');
  const d = obj && obj.data;
  if (!obj || obj.app !== 'tabshelf' || !d || !['categories', 'tags', 'documents', 'document_tags', 'collections'].every(k => Array.isArray(d[k]))) {
    throw new Error('Il file di TabShelf nel backup non è valido.');
  }
  if (obj.format !== 1) throw new Error('Il backup di TabShelf è di una versione più recente: aggiorna la pagina e riprova.');
  return obj;
}

/** Tablature del backup da aggiungere (con file e non ancora nel database) e spazio che occuperebbero. */
async function plan(ctx, d) {
  const cur = await fetchAll(ctx.client, 'documents', 'id,file_size,thumb_size', 'created_at');
  const have = new Set(cur.map(r => r.id));
  const used = cur.reduce((s, r) => s + (Number(r.file_size) || 0) + (Number(r.thumb_size) || 0), 0);
  const todo = d.documents.filter(x => x.file && !have.has(x.id));
  const bytes = todo.reduce((s, x) => s + (Number(x.file_size) || 0) + (Number(x.thumb_size) || 0), 0);
  const missingFile = d.documents.filter(x => !x.file).length;
  return { todo, bytes, used, free: SPACE.quotaBytes - used, missingFile, present: d.documents.length - todo.length - missingFile };
}

export default {
  id: 'tabshelf',
  title: 'TabShelf',
  kind: 'merge',
  weight: 12,           // pesa molto sull'avanzamento: scarica tutti i file
  heavy: true,
  restoreNote: 'Aggiunge categorie, tag, raccolte e tablature mancanti. Non modifica né cancella niente; il cestino non è incluso. Se si interrompe, ripeti il ripristino: riparte dalle tablature che mancano.',

  async check(ctx) {
    if (!ctx.client) return { ok: false, reason: 'Non sei collegato a Supabase.' };
    try {
      if ((await schemaVersion(ctx.client, 'tabshelf_schema_version')) == null) {
        return { ok: false, reason: 'Database non ancora preparato (apps/tabshelf/supabase/setup.sql).' };
      }
      const docs = (await fetchAll(ctx.client, 'documents', 'id,file_size,thumb_size,deleted_at', 'created_at')).filter(x => !x.deleted_at);
      const bytes = docs.reduce((s, x) => s + (Number(x.file_size) || 0) + (Number(x.thumb_size) || 0), 0);
      return { ok: true, summary: plural(docs.length, 'tablatura', 'tablature') + ' · ' + fmtBytes(bytes), bytes };
    } catch (e) { return { ok: false, reason: describeError(e) }; }
  },

  async export(ctx, folder, progress) {
    const c = ctx.client;
    progress(0, 'TabShelf: lettura dell’elenco…');
    const [cats, tags, docs, links, cols] = await Promise.all([
      fetchAll(c, 'categories'), fetchAll(c, 'tags'), fetchAll(c, 'documents'),
      fetchAll(c, 'document_tags', 'document_id,tag_id', 'created_at'), fetchAll(c, 'collections'),
    ]);
    const activeCats = cats.filter(x => !x.deleted_at);
    const catIds = new Set(activeCats.map(x => x.id));
    const activeTags = tags.filter(t => !t.deleted_at && catIds.has(t.category_id));
    const tagIds = new Set(activeTags.map(t => t.id));
    const activeDocs = docs.filter(x => !x.deleted_at).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const docIds = new Set(activeDocs.map(x => x.id));
    const docLinks = links.filter(l => docIds.has(l.document_id) && tagIds.has(l.tag_id));

    // nomi dei file nello zip: leggibili, con le prime 8 lettere dell'id per evitare doppioni
    const used = new Set();
    const unique = name => {
      while (used.has(name.toLowerCase())) name = name.replace(/(\.[a-z0-9]+)$/i, '_$1');
      used.add(name.toLowerCase());
      return name;
    };
    const jobs = [];
    const rows = activeDocs.map(d => {
      const base = (d.title && d.title.trim()) || String(d.original_name || '').replace(/\.[a-z0-9]{1,5}$/i, '') || 'documento';
      const stem = safeName(base) + ' - ' + d.id.slice(0, 8);
      const file = d.file_path ? unique('documenti/' + stem + '.' + extOf(d.file_path)) : null;
      const thumb = d.thumb_path ? unique('miniature/' + stem + '.' + extOf(d.thumb_path)) : null;
      if (file) jobs.push({ path: d.file_path, name: file });
      if (thumb) jobs.push({ path: d.thumb_path, name: thumb });
      return { ...pick(d, DOC_FIELDS), file, thumb };
    });

    const failed = [];
    let done = 0;
    await pool(jobs, 4, async job => {
      try {
        const { data, error } = await c.storage.from(BUCKET).download(job.path);
        if (error) throw error;
        // immagini e PDF sono già compressi: si archiviano senza ricomprimerli
        folder.file(job.name, data, { binary: true, compression: 'STORE' });
      } catch (e) { failed.push(job.name); }
      done++;
      progress(0.02 + 0.98 * (done / Math.max(1, jobs.length)), 'TabShelf: file ' + done + ' di ' + jobs.length + '…');
    }, ctx);
    if (failed.length) {
      // le schede il cui file non si è scaricato restano nell'elenco ma senza file: il ripristino le salta
      const lost = new Set(failed);
      rows.forEach(r => { if (lost.has(r.file)) r.file = null; if (lost.has(r.thumb)) r.thumb = null; });
      folder.file('FILE-MANCANTI.txt', 'File che non è stato possibile scaricare:\r\n' + failed.join('\r\n') + '\r\n');
    }

    const counts = { documents: rows.length, categories: activeCats.length, tags: activeTags.length, collections: cols.length, failed: failed.length };
    folder.file('tabshelf.json', JSON.stringify({
      app: 'tabshelf', format: 1, created_at: new Date().toISOString(),
      app_version: APP_VERSION, schema_version: SCHEMA_VERSION, counts,
      data: {
        categories: activeCats.map(x => pick(x, ['id', 'name', 'sort_order', 'created_at'])),
        tags: activeTags.map(x => pick(x, ['id', 'category_id', 'name', 'color', 'sort_order', 'created_at'])),
        documents: rows,
        document_tags: docLinks,
        collections: cols.map(x => ({ ...pick(x, ['id', 'name', 'created_at']), filter: x.filter || {} })),
      },
    }, null, 1));
    return {
      summary: plural(rows.length, 'tablatura', 'tablature') + ', ' + plural(activeTags.length, 'tag', 'tag'),
      counts,
      warning: failed.length ? failed.length + ' file non scaricati (elenco in FILE-MANCANTI.txt)' : null,
    };
  },

  async prepare(ctx, folder) {
    const b = await readBackup(folder);
    const p = await plan(ctx, b.data);
    const parts = ['Da aggiungere: ' + p.todo.length + ' tablature su ' + b.data.documents.length + ' (' + fmtBytes(p.bytes) + ')'];
    if (p.present) parts.push('già presenti: ' + p.present);
    if (p.missingFile) parts.push('senza file nel backup: ' + p.missingFile);
    if (p.bytes > p.free) {
      return {
        summary: parts.join(' · '), blocked: true,
        reason: 'Spazio insufficiente: servono ' + fmtBytes(p.bytes) + ', ne restano ' + fmtBytes(Math.max(0, p.free)) +
          '. Libera spazio da TabShelf (Cestino) e riprova.',
      };
    }
    if (p.todo.length && p.bytes > p.free * 0.9) {
      return { summary: parts.join(' · '), warning: 'Spazio quasi al limite: dopo il ripristino ne resteranno ' + fmtBytes(p.free - p.bytes) + '.' };
    }
    return { summary: parts.join(' · ') + (p.todo.length ? ' · spazio sufficiente' : '') };
  },

  async restore(ctx, folder, item, progress) {
    const c = ctx.client;
    const uid = ctx.userId;
    const b = await readBackup(folder);
    const d = b.data;
    progress(0.01, 'TabShelf: controllo i dati attuali…');
    const [curCats, curTags, curCols] = await Promise.all([
      fetchAll(c, 'categories', 'id,name,deleted_at'), fetchAll(c, 'tags', 'id,category_id,name,deleted_at'),
      fetchAll(c, 'collections', 'id')]);
    const p = await plan(ctx, d);
    if (p.bytes > p.free) throw new Error('Spazio insufficiente per ripristinare le tablature (servono ' + fmtBytes(p.bytes) + ').');

    // 1) categorie: id nel backup → id nel database
    const catMap = new Map();
    const catIds = new Set(curCats.map(x => x.id));
    const catByName = new Map(curCats.filter(x => !x.deleted_at).map(x => [lc(x.name), x.id]));
    const newCats = [];
    for (const k of d.categories) {
      if (catIds.has(k.id)) { catMap.set(k.id, k.id); continue; }
      const same = catByName.get(lc(k.name));
      if (same) { catMap.set(k.id, same); continue; }
      newCats.push({ id: k.id, name: k.name, sort_order: k.sort_order ?? 0, created_at: k.created_at });
      catMap.set(k.id, k.id); catByName.set(lc(k.name), k.id);
    }
    if (newCats.length) await insertRows(c, 'categories', newCats);
    ctx.check();

    // 2) tag
    const tagMap = new Map();
    const tagIds = new Set(curTags.map(x => x.id));
    const tagByKey = new Map(curTags.filter(x => !x.deleted_at).map(x => [x.category_id + '|' + lc(x.name), x.id]));
    const newTags = [];
    for (const t of d.tags) {
      const cat = catMap.get(t.category_id);
      if (!cat) continue;
      if (tagIds.has(t.id)) { tagMap.set(t.id, t.id); continue; }
      const key = cat + '|' + lc(t.name);
      const same = tagByKey.get(key);
      if (same) { tagMap.set(t.id, same); continue; }
      newTags.push({ id: t.id, category_id: cat, name: t.name, color: t.color, sort_order: t.sort_order ?? 0, created_at: t.created_at });
      tagMap.set(t.id, t.id); tagByKey.set(key, t.id);
    }
    if (newTags.length) await insertRows(c, 'tags', newTags);
    ctx.check();

    // 3) raccolte (i filtri puntano ai tag: si traducono gli id)
    const colIds = new Set(curCols.map(x => x.id));
    const mapIds = arr => (Array.isArray(arr) ? arr.map(id => tagMap.get(id)).filter(Boolean) : arr);
    const newCols = d.collections.filter(x => !colIds.has(x.id)).map(x => {
      const f = { ...(x.filter || {}) };
      if ('include' in f) f.include = mapIds(f.include);
      if ('exclude' in f) f.exclude = mapIds(f.exclude);
      return { id: x.id, name: x.name, filter: f, created_at: x.created_at };
    });
    if (newCols.length) await insertRows(c, 'collections', newCols);
    progress(0.04, 'TabShelf: categorie, tag e raccolte pronti.');

    // 4) tablature: file nello storage, poi riga nel database, poi i tag
    const linksByDoc = new Map();
    for (const l of d.document_tags) {
      if (!linksByDoc.has(l.document_id)) linksByDoc.set(l.document_id, []);
      linksByDoc.get(l.document_id).push(l.tag_id);
    }
    const bucket = c.storage.from(BUCKET);
    let added = 0;
    try {
      await pool(p.todo, CONCURRENCY, async doc => {
        const v = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const base = uid + '/' + doc.id;
        const uploaded = [];
        let rowSaved = false;
        try {
          const fileEntry = folder.file(doc.file);
          if (!fileEntry) throw new Error('File «' + doc.file + '» mancante nel backup.');
          const ext = extOf(doc.file);
          const fileBlob = new Blob([await fileEntry.async('arraybuffer')], { type: mimeOf(ext) });
          const filePath = base + '/file-' + v + '.' + ext;
          let r = await bucket.upload(filePath, fileBlob, { contentType: mimeOf(ext), cacheControl: '31536000', upsert: false });
          if (r.error) throw dbError(r.error);
          uploaded.push(filePath);

          let thumbPath = null, thumbSize = null;
          const thumbEntry = doc.thumb ? folder.file(doc.thumb) : null;
          if (thumbEntry) {
            const tExt = extOf(doc.thumb);
            const thumbBlob = new Blob([await thumbEntry.async('arraybuffer')], { type: mimeOf(tExt) });
            thumbPath = base + '/thumb-' + v + '.' + tExt;
            r = await bucket.upload(thumbPath, thumbBlob, { contentType: mimeOf(tExt), cacheControl: '31536000', upsert: false });
            if (r.error) throw dbError(r.error);
            uploaded.push(thumbPath);
            thumbSize = thumbBlob.size;
          }
          await insertRows(c, 'documents', [{
            id: doc.id, title: doc.title, artist: doc.artist, notes: doc.notes, link_url: doc.link_url, link_label: doc.link_label,
            original_name: doc.original_name, file_path: filePath, thumb_path: thumbPath, file_type: doc.file_type,
            file_size: fileBlob.size, thumb_size: thumbSize, status: doc.status || 'da_fare', mastery: doc.mastery, created_at: doc.created_at,
          }]);
          rowSaved = true;
          const tagList = [...new Set((linksByDoc.get(doc.id) || []).map(t => tagMap.get(t)).filter(Boolean))];
          if (tagList.length) await insertRows(c, 'document_tags', tagList.map(tag_id => ({ document_id: doc.id, tag_id })));
          added++;
          progress(0.04 + 0.96 * (added / p.todo.length), 'TabShelf: ' + added + ' di ' + p.todo.length + ' tablature…');
        } catch (e) {
          // senza riga nel database i file appena caricati sarebbero orfani: si tolgono
          if (!rowSaved && uploaded.length) await bucket.remove(uploaded).catch(() => {});
          throw e;
        }
      }, ctx);
    } catch (e) {
      const partial = added < p.todo.length;
      e.message = (added && partial ? 'Aggiunte ' + added + ' tablature su ' + p.todo.length + ', poi: ' : '') + e.message.replace(/\.?$/, '.') +
        (partial ? ' Per continuare ripeti lo stesso ripristino: riparte dalle tablature che mancano.' : '');
      throw e;
    }
    const extras = [];
    if (newCats.length) extras.push(plural(newCats.length, 'categoria nuova', 'categorie nuove'));
    if (newTags.length) extras.push(plural(newTags.length, 'tag nuovo', 'tag nuovi'));
    if (newCols.length) extras.push(plural(newCols.length, 'raccolta aggiunta', 'raccolte aggiunte'));
    if (p.present) extras.push(plural(p.present, 'tablatura già presente', 'tablature già presenti'));
    if (p.missingFile) extras.push(p.missingFile + ' senza file nel backup');
    return 'Aggiunte ' + plural(added, 'tablatura', 'tablature') + (extras.length ? ' · ' + extras.join(' · ') : '') + '.';
  },
};

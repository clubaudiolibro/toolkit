/**
 * filmshelf.js — adattatore del backup globale per FilmShelf.
 *
 * Nel backup: tutti i film (visti e watchlist) con id e date originali, più l'elenco dei tag.
 * NON c'è la chiave TMDB (è un segreto e resta solo nel database).
 * Il ripristino AGGIUNGE i film mancanti (stesso id o stesso id TMDB = già presente) e unisce i tag:
 * non modifica e non cancella nulla di ciò che c'è già.
 */
import { APP_VERSION, SCHEMA_VERSION } from '../../../../apps/filmshelf/js/config.js';
import { fetchAll, headCount, schemaVersion, stripUser, readJson, insertRows, plural, dbError, describeError, lc } from '../util.js';

const TABLE = 'filmshelf_film';
const COLS = ['id', 'tmdb_id', 'titolo_it', 'titolo_originale', 'anno', 'durata_min', 'generi', 'trama', 'poster_path',
  'stato', 'data_visione', 'voto', 'note', 'luoghi', 'creato_il', 'aggiornato_il'];

const summary = c => plural(c.films, 'film', 'film') + ' (' + c.visti + ' visti, ' + c.watchlist + ' in watchlist)';

async function readBackup(folder) {
  const obj = await readJson(folder, 'filmshelf.json');
  if (!obj || obj.app !== 'filmshelf' || !obj.data || !Array.isArray(obj.data.films)) throw new Error('Il file di FilmShelf nel backup non è valido.');
  if (obj.format !== 1) throw new Error('Il backup di FilmShelf è di una versione più recente: aggiorna la pagina e riprova.');
  return obj;
}

/** Film del backup che mancano nell'archivio (per id o per id TMDB). */
async function missingFilms(ctx, films) {
  const existing = await fetchAll(ctx.client, TABLE, 'id,tmdb_id', 'creato_il');
  const ids = new Set(existing.map(r => r.id));
  const tmdb = new Set(existing.map(r => r.tmdb_id));
  const seen = new Set();
  const todo = [];
  for (const f of films) {
    if (!f || ids.has(f.id) || tmdb.has(f.tmdb_id) || seen.has(f.tmdb_id)) continue;
    seen.add(f.tmdb_id);
    const row = {};
    for (const k of COLS) if (f[k] !== undefined) row[k] = f[k];
    todo.push(row);
  }
  return todo;
}

export default {
  id: 'filmshelf',
  title: 'FilmShelf',
  kind: 'merge',
  weight: 1,
  restoreNote: 'Aggiunge i film mancanti e unisce i tag. Non modifica né cancella i film già presenti.',

  async check(ctx) {
    if (!ctx.client) return { ok: false, reason: 'Non sei collegato a Supabase.' };
    try {
      if ((await schemaVersion(ctx.client, 'filmshelf_schema_version')) == null) {
        return { ok: false, reason: 'Database non ancora preparato (supabase/filmshelf.sql).' };
      }
      return { ok: true, summary: plural(await headCount(ctx.client, TABLE), 'film', 'film') };
    } catch (e) { return { ok: false, reason: describeError(e) }; }
  },

  async export(ctx, folder, progress) {
    progress(0.1, 'FilmShelf: lettura dei film…');
    const films = stripUser(await fetchAll(ctx.client, TABLE, '*', 'creato_il'));
    ctx.check();
    const { data: rows, error } = await ctx.client.from('filmshelf_impostazioni').select('tag_elenco').limit(1);
    if (error) throw dbError(error);
    const tagElenco = rows[0] && Array.isArray(rows[0].tag_elenco) ? rows[0].tag_elenco : null;
    const counts = {
      films: films.length,
      visti: films.filter(f => f.stato === 'visto').length,
      watchlist: films.filter(f => f.stato === 'watchlist').length,
    };
    folder.file('filmshelf.json', JSON.stringify({
      app: 'filmshelf', format: 1, created_at: new Date().toISOString(),
      app_version: APP_VERSION, schema_version: SCHEMA_VERSION, counts,
      data: { films, tag_elenco: tagElenco },
    }, null, 1));
    return { summary: summary(counts), counts };
  },

  async prepare(ctx, folder) {
    const b = await readBackup(folder);
    const todo = await missingFilms(ctx, b.data.films);
    const total = b.data.films.length;
    return { summary: 'Da aggiungere: ' + todo.length + ' su ' + total + ' (già presenti: ' + (total - todo.length) + ')' };
  },

  async restore(ctx, folder, item, progress) {
    const b = await readBackup(folder);
    progress(0.05, 'FilmShelf: controllo i film già presenti…');
    const todo = await missingFilms(ctx, b.data.films);
    let done = 0;
    try {
      for (let i = 0; i < todo.length; i += 200) {
        ctx.check();
        const chunk = todo.slice(i, i + 200);
        await insertRows(ctx.client, TABLE, chunk, 200);
        done += chunk.length;
        progress(0.1 + 0.8 * (done / todo.length), 'FilmShelf: ' + done + ' di ' + todo.length + ' film…');
      }
    } catch (e) {
      e.message = (done ? 'Aggiunti ' + done + ' film su ' + todo.length + ', poi: ' : '') + e.message.replace(/\.?$/, '.')
        + (done ? ' Ripeti il ripristino per aggiungere gli altri.' : '');
      throw e;
    }

    // tag: unione tra quelli attuali (o i tre di partenza) e quelli del backup
    let tagNote = '';
    const wanted = b.data.tag_elenco;
    if (Array.isArray(wanted) && wanted.length) {
      const { data: rows, error } = await ctx.client.from('filmshelf_impostazioni').select('tag_elenco').limit(1);
      if (error) throw dbError(error);
      const current = rows[0] && Array.isArray(rows[0].tag_elenco) && rows[0].tag_elenco.length ? rows[0].tag_elenco : null;
      // elenco mai salvato: si riprende quello del backup così com'è; altrimenti si aggiungono solo i tag che mancano
      const merged = [...(current || [])];
      const have = new Set(merged.map(lc));
      for (const t of wanted) if (!have.has(lc(t))) { have.add(lc(t)); merged.push(t); }
      if (!current || merged.length !== current.length) {
        const { error: e2 } = await ctx.client.from('filmshelf_impostazioni').upsert({ tag_elenco: merged }, { onConflict: 'user_id' });
        if (e2) throw dbError(e2);
        tagNote = ' Elenco dei tag aggiornato.';
      }
    }
    const skipped = b.data.films.length - todo.length;
    return 'Aggiunti ' + plural(done, 'film', 'film') + (skipped ? ' (' + (skipped === 1 ? '1 era già presente' : skipped + ' erano già presenti') + ')' : '') + '.' + tagNote;
  },
};

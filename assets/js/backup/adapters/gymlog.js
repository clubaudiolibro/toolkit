/**
 * gymlog.js — adattatore del backup globale per GymLog.
 *
 * Nel file «gymlog/gymlog.json» dello zip c'è lo STESSO formato del backup JSON di GymLog
 * (app 'gymlog', format 1): si può quindi usare anche con «Altro → Backup → Ripristina» dell'app.
 * Il ripristino passa dalla funzione del database gym_restore(payload): un'unica operazione,
 * se si interrompe non cambia niente.
 *
 * Non importa codice di GymLog (solo le costanti di config.js). TABLES è lo specchio di quello in
 * apps/gymlog/js/backup.js: se lì si aggiunge una tabella, va aggiunta anche qui.
 */
import { APP_VERSION, SCHEMA_VERSION } from '../../../../apps/gymlog/js/config.js';
import { fetchAll, headCount, schemaVersion, stripUser, readJson, plural, dbError, describeError } from '../util.js';

/** Chiave nel file → [tabella, colonna per l'ordinamento]. */
const TABLES = {
  muscles: ['gym_muscles', 'created_at'],
  equipment: ['gym_equipment', 'created_at'],
  activity_types: ['gym_activity_types', 'created_at'],
  exercises: ['gym_exercises', 'created_at'],
  exercise_muscles: ['gym_exercise_muscles', 'exercise_id'],
  groups: ['gym_groups', 'created_at'],
  group_items: ['gym_group_items', 'created_at'],
  workouts: ['gym_workouts', 'created_at'],
  workout_items: ['gym_workout_items', 'created_at'],
  diary: ['gym_diary', 'created_at'],
  measurements: ['gym_measurements', 'created_at'],
};

const n = (data, k) => (Array.isArray(data[k]) ? data[k].length : 0);

function countsOf(data) {
  return {
    exercises: n(data, 'exercises'), groups: n(data, 'groups'), workouts: n(data, 'workouts'),
    diary: n(data, 'diary'), activity_types: n(data, 'activity_types'), measurements: n(data, 'measurements'),
    muscles: n(data, 'muscles'), equipment: n(data, 'equipment'),
  };
}

function summary(c) {
  return [
    plural(c.exercises, 'esercizio', 'esercizi'),
    plural(c.workouts, 'allenamento', 'allenamenti'),
    plural(c.diary, 'voce di diario', 'voci di diario'),
    plural(c.measurements || 0, 'misura corporea', 'misure corporee'),
  ].join(', ');
}

/** Legge e controlla il file «gymlog/gymlog.json» (stesse regole dell'app). */
async function readBackup(folder) {
  const obj = await readJson(folder, 'gymlog.json');
  if (!obj || obj.app !== 'gymlog' || !obj.data || typeof obj.data !== 'object') throw new Error('Il file di GymLog nel backup non è valido.');
  if (obj.format !== 1) throw new Error('Il backup di GymLog è di una versione più recente: aggiorna la pagina e riprova.');
  for (const k of Object.keys(TABLES)) {
    if (obj.data[k] != null && !Array.isArray(obj.data[k])) throw new Error('Il backup di GymLog è rovinato (sezione «' + k + '»).');
  }
  obj.counts = countsOf(obj.data);
  return obj;
}

export default {
  id: 'gymlog',
  title: 'GymLog',
  kind: 'replace',
  weight: 1,
  restoreNote: 'Sostituisce tutti i dati attuali di GymLog con quelli del backup (se si interrompe non cambia niente).',

  async check(ctx) {
    if (!ctx.client) return { ok: false, reason: 'Non sei collegato a Supabase.' };
    try {
      if ((await schemaVersion(ctx.client, 'gym_schema_version')) == null) {
        return { ok: false, reason: 'Database non ancora preparato (supabase/gymlog.sql).' };
      }
      const [ex, wo, di] = await Promise.all([
        headCount(ctx.client, 'gym_exercises'), headCount(ctx.client, 'gym_workouts'), headCount(ctx.client, 'gym_diary')]);
      return { ok: true, summary: [plural(ex, 'esercizio', 'esercizi'), plural(wo, 'allenamento', 'allenamenti'),
        plural(di, 'voce di diario', 'voci di diario')].join(', ') };
    } catch (e) { return { ok: false, reason: describeError(e) }; }
  },

  async export(ctx, folder, progress) {
    const keys = Object.keys(TABLES);
    const lists = [];
    for (let i = 0; i < keys.length; i++) {
      ctx.check();
      progress(i / (keys.length + 1), 'GymLog: lettura dei dati…');
      lists.push(await fetchAll(ctx.client, TABLES[keys[i]][0], '*', TABLES[keys[i]][1]));
    }
    const { data: settingsRows, error } = await ctx.client.from('gym_settings').select('timer_presets').limit(1);
    if (error) throw dbError(error);
    const data = {};
    keys.forEach((k, i) => { data[k] = stripUser(lists[i]); });
    data.settings = settingsRows[0] ? { timer_presets: settingsRows[0].timer_presets } : {};
    const counts = countsOf(data);
    const backup = {
      app: 'gymlog', format: 1, created_at: new Date().toISOString(),
      app_version: APP_VERSION, schema_version: SCHEMA_VERSION, counts, data,
    };
    folder.file('gymlog.json', JSON.stringify(backup, null, 1));
    return { summary: summary(counts), counts };
  },

  async prepare(ctx, folder) {
    const b = await readBackup(folder);
    return { summary: summary(b.counts) };
  },

  async restore(ctx, folder, item, progress) {
    const backup = await readBackup(folder);
    ctx.check();
    progress(0.3, 'GymLog: ripristino in corso…');
    const { error } = await ctx.client.rpc('gym_restore', { payload: backup.data });
    if (error) throw dbError(error);
    return 'Ripristinati ' + summary(backup.counts) + '.';
  },
};

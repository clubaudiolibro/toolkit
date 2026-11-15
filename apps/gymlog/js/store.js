/**
 * store.js — dati di GymLog in memoria + operazioni sul database.
 * Ogni operazione scrive subito su Supabase; solo se riesce aggiorna i dati in memoria.
 */
import { run, fetchAll, uid } from './db.js';
import { DEFAULT_MUSCLES, DEFAULT_EQUIPMENT } from './config.js';
import { byName } from './ui.js';

export const state = {
  muscles: [],          // { id, name, sort_order }
  equipment: [],        // { id, name, sort_order }
  exercises: [],        // tutti, anche quelli nel cestino (deleted_at)
  exMuscles: new Map(), // exercise_id -> Set(muscle_id)
  settings: null,
};

const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  }));
const nowIso = () => new Date().toISOString();
const sortList = list => list.sort((a, b) => (a.sort_order - b.sort_order) || byName(a, b));

/* ---------------------------------------------------------------------
   Avvio: voci predefinite + caricamento
   --------------------------------------------------------------------- */

/** Al primo avvio inserisce gruppi muscolari e attrezzi predefiniti. */
async function ensureSeed() {
  const rows = await run(c => c.from('gym_settings').select('*').limit(1), { action: 'il caricamento' });
  const settings = rows[0] || null;
  if (settings && settings.seeded_at) { state.settings = settings; return; }

  const existingM = await run(c => c.from('gym_muscles').select('id').limit(1), { action: 'il caricamento' });
  if (!existingM.length) {
    await run(c => c.from('gym_muscles').insert(
      DEFAULT_MUSCLES.map((name, i) => ({ name, sort_order: (i + 1) * 10 }))), { action: 'la preparazione' });
  }
  const existingE = await run(c => c.from('gym_equipment').select('id').limit(1), { action: 'il caricamento' });
  if (!existingE.length) {
    await run(c => c.from('gym_equipment').insert(
      DEFAULT_EQUIPMENT.map((name, i) => ({ name, sort_order: (i + 1) * 10 }))), { action: 'la preparazione' });
  }
  const saved = await run(c => c.from('gym_settings')
    .upsert({ user_id: uid(), seeded_at: nowIso(), updated_at: nowIso() }, { onConflict: 'user_id' })
    .select().single(), { action: 'la preparazione' });
  state.settings = saved;
}

export async function loadAll() {
  await ensureSeed();
  const [muscles, equipment, exercises, links] = await Promise.all([
    fetchAll('gym_muscles', 'id,name,sort_order,created_at'),
    fetchAll('gym_equipment', 'id,name,sort_order,created_at'),
    fetchAll('gym_exercises'),
    fetchAll('gym_exercise_muscles', 'exercise_id,muscle_id', 'exercise_id'),
  ]);
  state.muscles = sortList(muscles);
  state.equipment = sortList(equipment);
  state.exercises = exercises;
  state.exMuscles = new Map();
  for (const l of links) {
    if (!state.exMuscles.has(l.exercise_id)) state.exMuscles.set(l.exercise_id, new Set());
    state.exMuscles.get(l.exercise_id).add(l.muscle_id);
  }
}

/* ---------------------------------------------------------------------
   Lettura
   --------------------------------------------------------------------- */

export const activeExercises = () => state.exercises.filter(e => !e.deleted_at).sort(byName);
export const getExercise = id => state.exercises.find(e => e.id === id) || null;
export const getMuscle = id => state.muscles.find(m => m.id === id) || null;
export const getEquipment = id => state.equipment.find(e => e.id === id) || null;

/** Gruppi muscolari di un esercizio, nell'ordine della lista. */
export function exerciseMuscles(exId) {
  const set = state.exMuscles.get(exId);
  if (!set) return [];
  return state.muscles.filter(m => set.has(m.id));
}

/* ---------------------------------------------------------------------
   Esercizi
   --------------------------------------------------------------------- */

function cleanExercise(d) {
  return {
    name: d.name.trim(),
    equipment_id: d.equipment_id || null,
    efficacy: d.efficacy || null,
    description: (d.description || '').trim() || null,
    video_url: (d.video_url || '').trim() || null,
    notes: (d.notes || '').trim() || null,
  };
}

async function setExerciseMuscles(exId, muscleIds) {
  const before = state.exMuscles.get(exId) || new Set();
  const after = new Set(muscleIds);
  const toAdd = [...after].filter(id => !before.has(id));
  const toRemove = [...before].filter(id => !after.has(id));
  if (toRemove.length) {
    await run(c => c.from('gym_exercise_muscles').delete().eq('exercise_id', exId).in('muscle_id', toRemove));
  }
  if (toAdd.length) {
    await run(c => c.from('gym_exercise_muscles').insert(toAdd.map(muscle_id => ({ exercise_id: exId, muscle_id }))));
  }
  state.exMuscles.set(exId, after);
}

export async function createExercise(data) {
  const row = { id: newId(), ...cleanExercise(data) };
  const saved = await run(c => c.from('gym_exercises').insert(row).select().single());
  state.exercises.push(saved);
  await setExerciseMuscles(saved.id, data.muscle_ids || []);
  return saved;
}

export async function updateExercise(id, data) {
  const patch = { ...cleanExercise(data), updated_at: nowIso() };
  const saved = await run(c => c.from('gym_exercises').update(patch).eq('id', id).select().single());
  Object.assign(getExercise(id), saved);
  if (data.muscle_ids) await setExerciseMuscles(id, data.muscle_ids);
  return saved;
}

/** Aggiorna solo le note (usato anche dalla schermata dell'allenamento). */
export async function updateExerciseNotes(id, notes) {
  const value = (notes || '').trim() || null;
  await run(c => c.from('gym_exercises').update({ notes: value, updated_at: nowIso() }).eq('id', id));
  getExercise(id).notes = value;
}

export async function trashExercise(id) {
  const t = nowIso();
  await run(c => c.from('gym_exercises').update({ deleted_at: t }).eq('id', id));
  getExercise(id).deleted_at = t;
}
export async function restoreExercise(id) {
  await run(c => c.from('gym_exercises').update({ deleted_at: null }).eq('id', id), { action: 'il ripristino' });
  getExercise(id).deleted_at = null;
}
/** Eliminazione definitiva (dal cestino): toglie anche l'esercizio da gruppi e allenamenti. */
export async function purgeExercise(id) {
  await run(c => c.from('gym_exercises').delete().eq('id', id), { action: "l'eliminazione" });
  state.exercises = state.exercises.filter(e => e.id !== id);
  state.exMuscles.delete(id);
}

/* ---------------------------------------------------------------------
   Liste personalizzabili: gruppi muscolari e attrezzi
   --------------------------------------------------------------------- */

const LISTS = {
  muscles: { table: 'gym_muscles' },
  equipment: { table: 'gym_equipment' },
};

export async function addListItem(kind, name) {
  const list = state[kind];
  const sort_order = list.reduce((m, x) => Math.max(m, x.sort_order), 0) + 10;
  const saved = await run(c => c.from(LISTS[kind].table).insert({ name: name.trim(), sort_order })
    .select('id,name,sort_order,created_at').single());
  list.push(saved);
  sortList(list);
  return saved;
}

export async function renameListItem(kind, id, name) {
  await run(c => c.from(LISTS[kind].table).update({ name: name.trim() }).eq('id', id));
  state[kind].find(x => x.id === id).name = name.trim();
  sortList(state[kind]);
}

/** Quanti esercizi (anche nel cestino) usano questa voce. */
export function listItemUsage(kind, id) {
  if (kind === 'equipment') return state.exercises.filter(e => e.equipment_id === id).length;
  let n = 0;
  for (const set of state.exMuscles.values()) if (set.has(id)) n++;
  return n;
}

export async function deleteListItem(kind, id) {
  await run(c => c.from(LISTS[kind].table).delete().eq('id', id), { action: "l'eliminazione" });
  state[kind] = state[kind].filter(x => x.id !== id);
  if (kind === 'equipment') {
    for (const e of state.exercises) if (e.equipment_id === id) e.equipment_id = null;
  } else {
    for (const set of state.exMuscles.values()) set.delete(id);
  }
}

/* ---------------------------------------------------------------------
   Cestino
   --------------------------------------------------------------------- */

/** Elementi nel cestino, dal più recente. type: 'exercise' (poi anche gruppi, allenamenti, attività). */
export function trashItems() {
  const items = state.exercises.filter(e => e.deleted_at)
    .map(e => ({ type: 'exercise', id: e.id, name: e.name, deleted_at: e.deleted_at }));
  return items.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
}

const TRASH_OPS = {
  exercise: { restore: restoreExercise, purge: purgeExercise },
};
export const restoreItem = item => TRASH_OPS[item.type].restore(item.id);
export const purgeItem = item => TRASH_OPS[item.type].purge(item.id);

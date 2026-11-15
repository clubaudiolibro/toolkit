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
  groups: [],           // gruppi di esercizi (anche nel cestino)
  groupItems: [],       // esercizi dentro i gruppi, con i valori
  workouts: [],         // allenamenti (anche nel cestino)
  workoutItems: [],     // elementi degli allenamenti
  activities: [],       // tipi di attività (es. Corsa), anche nel cestino
  diary: [],            // voci del diario
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
  const [muscles, equipment, exercises, links, groups, groupItems, workouts, workoutItems, activities, diary] = await Promise.all([
    fetchAll('gym_muscles', 'id,name,sort_order,created_at'),
    fetchAll('gym_equipment', 'id,name,sort_order,created_at'),
    fetchAll('gym_exercises'),
    fetchAll('gym_exercise_muscles', 'exercise_id,muscle_id', 'exercise_id'),
    fetchAll('gym_groups'),
    fetchAll('gym_group_items'),
    fetchAll('gym_workouts'),
    fetchAll('gym_workout_items'),
    fetchAll('gym_activity_types'),
    fetchAll('gym_diary'),
  ]);
  state.activities = activities;
  state.diary = diary.map(tagEntry);
  state.groups = groups;
  state.groupItems = groupItems.map(numify);
  state.workouts = workouts;
  state.workoutItems = workoutItems.map(numify);
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
  state.groupItems = state.groupItems.filter(i => i.exercise_id !== id);
  state.workoutItems = state.workoutItems.filter(i => i.exercise_id !== id);
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
  const pick = (list, type) => list.filter(e => e.deleted_at)
    .map(e => ({ type, id: e.id, name: e.name, deleted_at: e.deleted_at }));
  const items = [
    ...pick(state.exercises, 'exercise'),
    ...pick(state.groups, 'group'),
    ...pick(state.workouts, 'workout'),
    ...pick(state.activities, 'activity'),
  ];
  return items.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
}

const TRASH_OPS = {
  exercise: { restore: restoreExercise, purge: purgeExercise },
  group: { restore: restoreGroup, purge: purgeGroup },
  workout: { restore: restoreWorkout, purge: purgeWorkout },
  activity: { restore: restoreActivity, purge: purgeActivity },
};
export const restoreItem = item => TRASH_OPS[item.type].restore(item.id);
export const purgeItem = item => TRASH_OPS[item.type].purge(item.id);

/* ---------------------------------------------------------------------
   Valori (serie, ripetizioni, peso, riscaldamento)
   --------------------------------------------------------------------- */

export const VALUE_FIELDS = ['sets', 'reps', 'weight', 'wu_sets', 'wu_reps', 'wu_weight'];

/** PostgREST può restituire i numeric come testo: li riporta a numero. */
function numify(row) {
  for (const k of ['weight', 'wu_weight']) if (row[k] != null) row[k] = Number(row[k]);
  return row;
}

/** Riscaldamento presente? */
export const hasWarmup = it => it.wu_sets != null || it.wu_reps != null || it.wu_weight != null;

/** Salva subito uno o più valori di un esercizio dentro un gruppo ('group') o un allenamento ('workout'). */
export async function updateItemValues(kind, itemId, patch) {
  const table = kind === 'group' ? 'gym_group_items' : 'gym_workout_items';
  const list = kind === 'group' ? state.groupItems : state.workoutItems;
  const clean = {};
  for (const k of VALUE_FIELDS) if (k in patch) clean[k] = patch[k];
  await run(c => c.from(table).update(clean).eq('id', itemId));
  Object.assign(list.find(i => i.id === itemId), clean);
}

/** Aggiorna le posizioni secondo l'ordine di ids (solo le righe cambiate). */
async function savePositions(table, list, ids) {
  const changed = [];
  ids.forEach((id, i) => {
    const row = list.find(x => x.id === id);
    if (row && row.position !== (i + 1) * 10) changed.push({ row, position: (i + 1) * 10 });
  });
  await Promise.all(changed.map(ch => run(c => c.from(table).update({ position: ch.position }).eq('id', ch.row.id),
    { action: "il salvataggio dell'ordine" })));
  changed.forEach(ch => { ch.row.position = ch.position; });
}
const nextPos = list => list.reduce((m, x) => Math.max(m, x.position || 0), 0) + 10;
const byPos = (a, b) => (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at));

/* ---------------------------------------------------------------------
   Gruppi di esercizi
   --------------------------------------------------------------------- */

export const activeGroups = () => state.groups.filter(g => !g.deleted_at).sort(byName);
export const getGroup = id => state.groups.find(g => g.id === id) || null;

/** Esercizi del gruppo (solo quelli non nel cestino), in ordine. */
export function groupItems(groupId) {
  return state.groupItems
    .filter(i => i.group_id === groupId && isLiveExercise(i.exercise_id))
    .sort(byPos);
}
const isLiveExercise = id => { const e = getExercise(id); return !!(e && !e.deleted_at); };

/** Allenamenti (non nel cestino) che usano il gruppo. */
export function groupUsage(groupId) {
  const ids = new Set(state.workoutItems.filter(i => i.group_id === groupId).map(i => i.workout_id));
  return activeWorkouts().filter(w => ids.has(w.id));
}

/** Gruppi (non nel cestino) e allenamenti che contengono l'esercizio. */
export function exerciseUsage(exId) {
  const groups = activeGroups().filter(g => state.groupItems.some(i => i.group_id === g.id && i.exercise_id === exId));
  const workouts = activeWorkouts().filter(w => state.workoutItems.some(i => i.workout_id === w.id && i.exercise_id === exId));
  return { groups, workouts };
}

export async function createGroup(name) {
  const saved = await run(c => c.from('gym_groups').insert({ id: newId(), name: name.trim() }).select().single());
  state.groups.push(saved);
  return saved;
}
export async function renameGroup(id, name) {
  await run(c => c.from('gym_groups').update({ name: name.trim() }).eq('id', id));
  getGroup(id).name = name.trim();
}
export async function trashGroup(id) {
  const t = nowIso();
  await run(c => c.from('gym_groups').update({ deleted_at: t }).eq('id', id));
  getGroup(id).deleted_at = t;
}
export async function restoreGroup(id) {
  await run(c => c.from('gym_groups').update({ deleted_at: null }).eq('id', id), { action: 'il ripristino' });
  getGroup(id).deleted_at = null;
}
export async function purgeGroup(id) {
  await run(c => c.from('gym_groups').delete().eq('id', id), { action: "l'eliminazione" });
  state.groups = state.groups.filter(g => g.id !== id);
  state.groupItems = state.groupItems.filter(i => i.group_id !== id);
  state.workoutItems = state.workoutItems.filter(i => i.group_id !== id);
}

export async function addExerciseToGroup(groupId, exId) {
  const row = { id: newId(), group_id: groupId, exercise_id: exId,
    position: nextPos(state.groupItems.filter(i => i.group_id === groupId)) };
  const saved = numify(await run(c => c.from('gym_group_items').insert(row).select().single()));
  state.groupItems.push(saved);
  return saved;
}
export async function removeGroupItem(itemId) {
  await run(c => c.from('gym_group_items').delete().eq('id', itemId), { action: "l'eliminazione" });
  state.groupItems = state.groupItems.filter(i => i.id !== itemId);
}
export const reorderGroupItems = ids => savePositions('gym_group_items', state.groupItems, ids);

/* ---------------------------------------------------------------------
   Allenamenti
   --------------------------------------------------------------------- */

/** Allenamenti non nel cestino, nell'ordine della lista (usato anche per il suggerimento di oggi). */
export const activeWorkouts = () => state.workouts.filter(w => !w.deleted_at).sort(byPos);
export const getWorkout = id => state.workouts.find(w => w.id === id) || null;

/** Elementi dell'allenamento, in ordine, senza quelli che puntano a gruppi/esercizi nel cestino. */
export function workoutItems(workoutId) {
  return state.workoutItems
    .filter(i => i.workout_id === workoutId)
    .filter(i => (i.kind === 'group' ? (getGroup(i.group_id) && !getGroup(i.group_id).deleted_at) : isLiveExercise(i.exercise_id)))
    .sort(byPos);
}

export async function createWorkout(name) {
  const row = { id: newId(), name: name.trim(), position: nextPos(state.workouts) };
  const saved = await run(c => c.from('gym_workouts').insert(row).select().single());
  state.workouts.push(saved);
  return saved;
}
export async function renameWorkout(id, name) {
  await run(c => c.from('gym_workouts').update({ name: name.trim() }).eq('id', id));
  getWorkout(id).name = name.trim();
}
export const reorderWorkouts = ids => savePositions('gym_workouts', state.workouts, ids);

/** Duplica un allenamento: stessi gruppi (condivisi) e copie degli esercizi singoli con i loro valori. */
export async function duplicateWorkout(id, name) {
  const src = getWorkout(id);
  const copy = await run(c => c.from('gym_workouts').insert({ id: newId(), name: name.trim(), position: nextPos(state.workouts) }).select().single());
  state.workouts.push(copy);
  const items = state.workoutItems.filter(i => i.workout_id === src.id).sort(byPos).map(i => {
    const r = { id: newId(), workout_id: copy.id, position: i.position, kind: i.kind, group_id: i.group_id, exercise_id: i.exercise_id };
    for (const k of VALUE_FIELDS) r[k] = i[k];
    return r;
  });
  if (items.length) {
    const saved = await run(c => c.from('gym_workout_items').insert(items).select());
    state.workoutItems.push(...saved.map(numify));
  }
  return copy;
}

export async function trashWorkout(id) {
  const t = nowIso();
  await run(c => c.from('gym_workouts').update({ deleted_at: t }).eq('id', id));
  getWorkout(id).deleted_at = t;
}
export async function restoreWorkout(id) {
  await run(c => c.from('gym_workouts').update({ deleted_at: null }).eq('id', id), { action: 'il ripristino' });
  getWorkout(id).deleted_at = null;
}
export async function purgeWorkout(id) {
  await run(c => c.from('gym_workouts').delete().eq('id', id), { action: "l'eliminazione" });
  state.workouts = state.workouts.filter(w => w.id !== id);
  state.workoutItems = state.workoutItems.filter(i => i.workout_id !== id);
}

/** Aggiunge un gruppo o un esercizio singolo all'allenamento. */
export async function addWorkoutItem(workoutId, kind, refId) {
  const row = { id: newId(), workout_id: workoutId, kind,
    group_id: kind === 'group' ? refId : null, exercise_id: kind === 'exercise' ? refId : null,
    position: nextPos(state.workoutItems.filter(i => i.workout_id === workoutId)) };
  const saved = numify(await run(c => c.from('gym_workout_items').insert(row).select().single()));
  state.workoutItems.push(saved);
  return saved;
}
export async function removeWorkoutItem(itemId) {
  await run(c => c.from('gym_workout_items').delete().eq('id', itemId), { action: "l'eliminazione" });
  state.workoutItems = state.workoutItems.filter(i => i.id !== itemId);
}
export const reorderWorkoutItems = ids => savePositions('gym_workout_items', state.workoutItems, ids);

/* ---------------------------------------------------------------------
   Tipi di attività (es. Corsa): non sono allenamenti e non contano per il suggerimento
   --------------------------------------------------------------------- */

export const activeActivities = () => state.activities.filter(a => !a.deleted_at).sort(byName);
export const getActivity = id => state.activities.find(a => a.id === id) || null;

export async function createActivity(name) {
  const saved = await run(c => c.from('gym_activity_types').insert({ id: newId(), name: name.trim() }).select().single());
  state.activities.push(saved);
  return saved;
}
export async function renameActivity(id, name) {
  await run(c => c.from('gym_activity_types').update({ name: name.trim() }).eq('id', id));
  getActivity(id).name = name.trim();
}
export async function trashActivity(id) {
  const t = nowIso();
  await run(c => c.from('gym_activity_types').update({ deleted_at: t }).eq('id', id));
  getActivity(id).deleted_at = t;
}
export async function restoreActivity(id) {
  await run(c => c.from('gym_activity_types').update({ deleted_at: null }).eq('id', id), { action: 'il ripristino' });
  getActivity(id).deleted_at = null;
}
export async function purgeActivity(id) {
  await run(c => c.from('gym_activity_types').delete().eq('id', id), { action: "l'eliminazione" });
  state.activities = state.activities.filter(a => a.id !== id);
  for (const d of state.diary) if (d.activity_id === id) d.activity_id = null;   // il diario conserva il nome
}

/* ---------------------------------------------------------------------
   Diario
   --------------------------------------------------------------------- */

/** Voce di attività (true) o di allenamento (false)? Il tipo è salvato nella voce (colonna kind). */
export const isActivityEntry = d => d.kind === 'activity';

function tagEntry(d) {
  if (!d.kind) d.kind = d.activity_id ? 'activity' : 'workout';
  return d;
}

/** Voci in ordine cronologico inverso (più recente prima). */
export function diarySorted() {
  return state.diary.map(tagEntry).slice().sort((a, b) => b.day.localeCompare(a.day) || String(b.created_at).localeCompare(String(a.created_at)));
}
export const diaryByDay = day => diarySorted().filter(d => d.day === day).reverse();

/** Ultimi n allenamenti completati (le attività non contano). */
export const lastWorkouts = (n = 3) => diarySorted().filter(d => !isActivityEntry(d)).slice(0, n);

/**
 * Nuova voce. entry: { day, workout_id } oppure { day, activity_id }; il nome viene salvato al momento.
 */
export async function addDiaryEntry({ day, workout_id = null, activity_id = null, stars = null }) {
  const name = workout_id ? getWorkout(workout_id).name : getActivity(activity_id).name;
  const row = { id: newId(), day, workout_id, activity_id, name, stars, kind: activity_id ? 'activity' : 'workout' };
  const saved = await run(c => c.from('gym_diary').insert(row).select().single());
  state.diary.push(saved);
  return saved;
}
export async function setDiaryStars(id, stars) {
  await run(c => c.from('gym_diary').update({ stars }).eq('id', id));
  state.diary.find(d => d.id === id).stars = stars;
}
export async function deleteDiaryEntry(id) {
  await run(c => c.from('gym_diary').delete().eq('id', id), { action: "l'eliminazione" });
  state.diary = state.diary.filter(d => d.id !== id);
}

/**
 * Allenamento suggerito per oggi: quello che segue, nell'ordine della lista, l'ultimo completato
 * (ciclico: dopo l'ultimo si riparte dal primo). Si guarda l'ultimo completato che è ancora nella lista.
 * Restituisce { workout, after } (after = voce del diario di riferimento, o null).
 */
export function suggestedWorkout() {
  const list = activeWorkouts();
  if (!list.length) return null;
  const done = diarySorted().filter(d => !isActivityEntry(d) && d.workout_id);
  for (const d of done) {
    const i = list.findIndex(w => w.id === d.workout_id);
    if (i >= 0) return { workout: list[(i + 1) % list.length], after: d };
  }
  return { workout: list[0], after: null };
}

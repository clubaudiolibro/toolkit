/**
 * progress.js — spunte dell'allenamento in corso, salvate SOLO su questo telefono (localStorage).
 * Restano anche chiudendo l'app; si azzerano con «Allenamento completato» o a mano.
 */
const KEY = 'gymlog.progress';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
}
function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* memoria piena o disattivata */ }
}

/** Insieme delle chiavi spuntate per un allenamento. */
export function getChecked(workoutId) {
  const p = readAll()[workoutId];
  return new Set(p && Array.isArray(p.checked) ? p.checked : []);
}

export function setChecked(workoutId, key, on) {
  const all = readAll();
  const set = new Set((all[workoutId] && all[workoutId].checked) || []);
  if (on) set.add(key); else set.delete(key);
  if (set.size) all[workoutId] = { checked: [...set], updated: new Date().toISOString() };
  else delete all[workoutId];
  writeAll(all);
}

export function clearProgress(workoutId) {
  const all = readAll();
  delete all[workoutId];
  writeAll(all);
}

/** Allenamenti con almeno una spunta, dal più recente: [{ workoutId, count, updated }]. */
export function inProgress() {
  const all = readAll();
  return Object.entries(all)
    .map(([workoutId, p]) => ({ workoutId, count: (p.checked || []).length, updated: p.updated || '' }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

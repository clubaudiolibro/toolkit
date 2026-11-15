/**
 * backup.js — esportazione e ripristino dei dati di GymLog.
 *
 * File JSON (il backup vero): { app: 'gymlog', format: 1, created_at, app_version, schema_version, counts, data }
 * dove data contiene una lista per ogni tabella (cestino compreso), con gli id originali.
 * Il ripristino passa per la funzione del database gym_restore(payload): tutto in un'unica
 * operazione, quindi se si interrompe non cambia niente.
 *
 * File CSV: solo da leggere in Excel (separatore ";", UTF-8 con BOM).
 */
import { run, fetchAll, uid } from './db.js';
import { APP_VERSION, SCHEMA_VERSION } from './config.js';
import { state, loadAll } from './store.js';
import { fmtDate, todayIso } from './ui.js';
import { isIOS, isStandalone } from './install.js';

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
};

export const BACKUP_MAX_DAYS = 30;

/* ---------------------------------------------------------------------
   Data dell'ultimo backup e avviso
   --------------------------------------------------------------------- */

export const lastBackupAt = () => (state.settings && state.settings.last_backup_at) || null;

/** Giorni dall'ultimo backup (null = mai fatto). */
export function daysSinceBackup() {
  const t = lastBackupAt();
  if (!t) return null;
  return Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
}

/** Serve l'avviso? Solo se c'è qualcosa da salvare e il backup manca o è più vecchio di 30 giorni. */
export function backupOverdue() {
  const hasData = state.exercises.length || state.workouts.length || state.diary.length;
  if (!hasData) return false;
  const d = daysSinceBackup();
  return d == null || d > BACKUP_MAX_DAYS;
}

/** Testo tipo «Ultimo backup: 15.11.26 (oggi)». */
export function backupStatusText() {
  const t = lastBackupAt();
  if (!t) return 'Nessun backup fatto finora';
  const d = daysSinceBackup();
  const ago = d <= 0 ? 'oggi' : d === 1 ? 'ieri' : d + ' giorni fa';
  return 'Ultimo backup: ' + fmtDate(t) + ' (' + ago + ')';
}

/* ---------------------------------------------------------------------
   Lettura completa dal database
   --------------------------------------------------------------------- */

const stripUser = rows => rows.map(r => { const { user_id, ...rest } = r; return rest; });

/** Legge tutti i dati dal database (non dalla memoria) e costruisce l'oggetto del backup. */
export async function buildBackup() {
  const keys = Object.keys(TABLES);
  const lists = await Promise.all(keys.map(k => fetchAll(TABLES[k][0], '*', TABLES[k][1])));
  const settingsRows = await run(c => c.from('gym_settings').select('timer_presets,last_backup_at').limit(1),
    { action: 'il backup' });
  const data = {};
  keys.forEach((k, i) => { data[k] = stripUser(lists[i]); });
  data.settings = settingsRows[0] ? { timer_presets: settingsRows[0].timer_presets } : {};
  return {
    app: 'gymlog',
    format: 1,
    created_at: new Date().toISOString(),
    app_version: APP_VERSION,
    schema_version: SCHEMA_VERSION,
    counts: countsOf(data),
    data,
  };
}

function countsOf(data) {
  const n = k => (Array.isArray(data[k]) ? data[k].length : 0);
  return {
    exercises: n('exercises'), groups: n('groups'), workouts: n('workouts'),
    diary: n('diary'), activity_types: n('activity_types'),
    muscles: n('muscles'), equipment: n('equipment'),
  };
}

/* ---------------------------------------------------------------------
   Salvataggio dei file sul telefono
   --------------------------------------------------------------------- */

const stamp = () => fmtDate(todayIso()).replace(/\./g, '-');   // 15-11-26 (i punti nei nomi file confondono)

/**
 * Salva un file. Su iPhone con l'app installata sulla Home lo scaricamento diretto non funziona:
 * lì si apre il foglio «Condividi» (da cui si sceglie «Salva su File»).
 */
async function saveFile(name, blob) {
  if (isIOS() && isStandalone() && navigator.canShare) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; /* altrimenti prova lo scaricamento */ }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

/** Scarica il file JSON. prefix cambia il nome (es. per la copia di sicurezza prima del ripristino). */
export function saveBackupFile(backup, prefix = 'gymlog-backup') {
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  return saveFile(prefix + '-' + stamp() + '.json', blob);
}

/** Registra la data del backup (in gym_settings.last_backup_at). */
export async function markBackupDone() {
  const t = new Date().toISOString();
  await run(c => c.from('gym_settings').update({ last_backup_at: t, updated_at: t }).eq('user_id', uid()),
    { action: 'il salvataggio della data del backup' });
  if (state.settings) state.settings.last_backup_at = t;
}

/** Esporta: legge tutto, scarica il JSON e registra la data. */
export async function exportBackup() {
  const backup = await buildBackup();
  const saved = await saveBackupFile(backup);
  if (!saved) return null;
  await markBackupDone();
  return backup;
}

/* ---------------------------------------------------------------------
   CSV per Excel
   --------------------------------------------------------------------- */

function csvCell(v) {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;                  // Excel non lo tratta come formula
  if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
const csvLine = cells => cells.map(csvCell).join(';');
const num = v => (v == null || v === '' ? '' : String(Number(v)).replace('.', ','));   // 22,5 per Excel italiano

/** Costruisce il CSV dai dati in memoria: diario, esercizi, valori di gruppi e allenamenti. */
export function buildCsv() {
  const lines = [];
  const name = (list, id) => { const x = list.find(r => r.id === id); return x ? x.name : ''; };
  const trashed = x => (x && x.deleted_at ? 'sì' : '');

  lines.push('DIARIO');
  lines.push(csvLine(['Data', 'Tipo', 'Nome', 'Stelline']));
  const diary = state.diary.slice().sort((a, b) => b.day.localeCompare(a.day) || String(b.created_at).localeCompare(String(a.created_at)));
  for (const d of diary) {
    lines.push(csvLine([fmtDate(d.day), d.kind === 'activity' ? 'Attività' : 'Allenamento', d.name, d.stars || '']));
  }

  lines.push('', 'ESERCIZI');
  lines.push(csvLine(['Nome', 'Gruppi muscolari', 'Attrezzo', 'Efficacia', 'Descrizione', 'Video', 'Note', 'Nel cestino']));
  const exs = state.exercises.slice().sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
  for (const e of exs) {
    const set = state.exMuscles.get(e.id) || new Set();
    const muscles = state.muscles.filter(m => set.has(m.id)).map(m => m.name).join(', ');
    lines.push(csvLine([e.name, muscles, name(state.equipment, e.equipment_id), e.efficacy || '',
      e.description, e.video_url, e.notes, trashed(e)]));
  }

  const byPos = (a, b) => (a.position - b.position);
  const values = it => [num(it.sets), num(it.reps), num(it.weight), num(it.wu_sets), num(it.wu_reps), num(it.wu_weight)];
  const valueHead = ['Serie', 'Ripetizioni', 'Peso (kg)', 'Risc. serie', 'Risc. ripetizioni', 'Risc. peso (kg)'];

  lines.push('', 'GRUPPI DI ESERCIZI');
  lines.push(csvLine(['Gruppo', 'Esercizio', ...valueHead, 'Nel cestino']));
  for (const g of state.groups.slice().sort((a, b) => a.name.localeCompare(b.name, 'it'))) {
    for (const it of state.groupItems.filter(i => i.group_id === g.id).sort(byPos)) {
      lines.push(csvLine([g.name, name(state.exercises, it.exercise_id), ...values(it), trashed(g)]));
    }
  }

  lines.push('', 'ALLENAMENTI');
  lines.push(csvLine(['Allenamento', 'Elemento', 'Tipo', ...valueHead, 'Nel cestino']));
  for (const w of state.workouts.slice().sort(byPos)) {
    for (const it of state.workoutItems.filter(i => i.workout_id === w.id).sort(byPos)) {
      const isGroup = it.kind === 'group';
      lines.push(csvLine([w.name, isGroup ? name(state.groups, it.group_id) : name(state.exercises, it.exercise_id),
        isGroup ? 'Gruppo' : 'Esercizio', ...(isGroup ? ['', '', '', '', '', ''] : values(it)), trashed(w)]));
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function exportCsv() {
  const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' });
  return saveFile('gymlog-' + stamp() + '.csv', blob);
}

/* ---------------------------------------------------------------------
   Ripristino
   --------------------------------------------------------------------- */

/**
 * Legge e controlla il file scelto. Restituisce l'oggetto del backup o lancia un Error
 * con un messaggio comprensibile.
 */
export async function readBackupFile(file) {
  if (!file) throw new Error('Nessun file scelto.');
  if (/\.csv$/i.test(file.name)) throw new Error('Questo è il file per Excel: per il ripristino serve il file .json.');
  let obj;
  try { obj = JSON.parse(await file.text()); }
  catch (e) { throw new Error('Il file non è un backup di GymLog (non si riesce a leggerlo).'); }
  if (!obj || obj.app !== 'gymlog' || !obj.data || typeof obj.data !== 'object') {
    throw new Error('Il file non è un backup di GymLog.');
  }
  if (obj.format !== 1) throw new Error('Questo backup è stato creato da una versione di GymLog più recente: aggiorna la pagina e riprova.');
  for (const k of Object.keys(TABLES)) {
    if (obj.data[k] != null && !Array.isArray(obj.data[k])) throw new Error('Il file di backup è rovinato (sezione «' + k + '»).');
  }
  obj.counts = countsOf(obj.data);
  return obj;
}

/** Sostituisce tutti i dati con quelli del backup e ricarica la memoria. */
export async function restoreBackup(backup) {
  await run(c => c.rpc('gym_restore', { payload: backup.data }), { action: 'il ripristino' });
  await loadAll();
}

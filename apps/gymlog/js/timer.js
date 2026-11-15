/**
 * timer.js — timer di riposo: pulsante sempre visibile + pannello con i preset.
 * Solo conto alla rovescia a schermo (niente suono né vibrazione).
 * Il tempo si calcola dall'ORARIO DI FINE (salvato sul telefono): resta esatto anche se il telefono
 * mette in pausa la pagina o la si ricarica.
 */
import { el, icon, customSheet, promptDialog, toast } from './ui.js';
import { timerPresets, saveTimerPresets } from './store.js';
import { hold, release } from './wakelock.js';

const KEY = 'gymlog.timer';           // { end: ms, total: s } | { done: ms }
let fab = null;
let ticker = null;
let onTick = null;                    // aggiornamento del pannello aperto

function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function write(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* niente */ } }

/** Secondi in formato m:ss. */
export const fmtTime = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
/** Nome del preset: 45 s, 1 min, 1 min 30. */
export const presetLabel = s => (s < 60 ? s + ' s' : Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) : ''));

/** Stato attuale: { running, remaining, total, done }. */
function status() {
  const t = read();
  if (!t) return { running: false, done: false };
  if (t.end) {
    const remaining = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    if (remaining > 0) return { running: true, remaining, total: t.total };
    write({ done: t.end });                       // finito mentre la pagina era in pausa o aperta
    return { running: false, done: true };
  }
  if (t.done) return { running: false, done: Date.now() - t.done < 5 * 60 * 1000 };   // "finito" resta visibile 5 minuti
  return { running: false, done: false };
}

function start(seconds) {
  write({ end: Date.now() + seconds * 1000, total: seconds });
  refresh();
}
function add(delta) {
  const t = read();
  if (!t || !t.end) return;
  t.end = Math.max(Date.now() + 1000, t.end + delta * 1000);
  t.total = Math.max(1, (t.total || 0) + delta);
  write(t);
  refresh();
}
function stop() { write(null); refresh(); }

/** Aggiorna pulsante, pannello e schermo acceso; tiene vivo il "ticchettio" solo se serve. */
function refresh() {
  const st = status();
  if (fab) {
    fab.classList.toggle('running', st.running);
    fab.classList.toggle('done', st.done);
    fab.textContent = '';
    if (st.running) fab.append(el('span', { class: 'fab-time', text: fmtTime(st.remaining) }));
    else {
      fab.append(icon('timer'));
      if (st.done) fab.append(el('span', { class: 'fab-time', text: 'Fine' }));
    }
    fab.setAttribute('aria-label', st.running ? 'Timer: mancano ' + fmtTime(st.remaining) : 'Apri il timer di riposo');
  }
  if (onTick) onTick(st);
  if (st.running) hold('timer'); else release('timer');
  if (st.running && !ticker) ticker = setInterval(refresh, 250);
  if (!st.running && ticker) { clearInterval(ticker); ticker = null; }
}

/** Crea il pulsante flottante (una volta, all'avvio). */
export function initTimer() {
  fab = el('button', { type: 'button', class: 'timer-fab', id: 'timer-fab', on: { click: openPanel } });
  document.body.appendChild(fab);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('storage', e => { if (e.key === KEY) refresh(); });   // altra scheda aperta
  refresh();
}

/** Legge un tempo scritto come "75", "1:15" o "1.15". */
function parseTime(raw) {
  const s = raw.trim().replace(/\s/g, '').replace('.', ':');
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d{1,4})$/);
  return m ? Number(m[1]) : null;
}

function openPanel() {
  hold('timer-panel');
  let editing = false;
  customSheet((sheet, close) => {
    sheet.classList.add('timer-sheet');
    const display = el('div', { class: 'timer-display', role: 'timer', 'aria-live': 'off' });
    const state = el('div', { class: 'timer-state' });
    const bar = el('div', { class: 'timer-bar' }, el('span'));
    const controls = el('div', { class: 'timer-controls' });
    const presetsBox = el('div', { class: 'timer-presets' });

    const drawControls = st => {
      controls.textContent = '';
      if (!st.running) return;
      controls.append(
        el('button', { type: 'button', class: 'btn', text: '−15 s', on: { click: () => add(-15) } }),
        el('button', { type: 'button', class: 'btn btn-danger', text: 'Ferma', on: { click: stop } }),
        el('button', { type: 'button', class: 'btn', text: '+15 s', on: { click: () => add(15) } }));
    };
    let lastRunning = null;
    onTick = st => {
      display.textContent = st.running ? fmtTime(st.remaining) : '0:00';
      display.classList.toggle('done', !st.running && st.done);
      display.classList.toggle('idle', !st.running && !st.done);
      state.textContent = st.running ? 'Riposo in corso' : (st.done ? 'Riposo finito' : 'Scegli un tempo per iniziare');
      bar.firstChild.style.width = st.running && st.total ? Math.min(100, (1 - st.remaining / st.total) * 100) + '%' : (st.done ? '100%' : '0%');
      if (st.running !== lastRunning) { drawControls(st); lastRunning = st.running; }
    };

    const drawPresets = () => {
      presetsBox.textContent = '';
      for (const s of timerPresets()) {
        presetsBox.appendChild(editing
          ? el('button', { type: 'button', class: 'preset editing', 'aria-label': 'Elimina il preset ' + presetLabel(s), on: { click: async () => {
            const list = timerPresets().filter(x => x !== s);
            if (!list.length) { toast('Serve almeno un preset.', 'error'); return; }
            try { await saveTimerPresets(list); drawPresets(); } catch (e) { /* avviso già mostrato */ }
          } } }, presetLabel(s), icon('close'))
          : el('button', { type: 'button', class: 'preset', text: presetLabel(s), on: { click: () => start(s) } }));
      }
      if (editing) {
        presetsBox.appendChild(el('button', { type: 'button', class: 'preset add', on: { click: async () => {
          const raw = await promptDialog({ title: 'Nuovo preset', label: 'Secondi (es. 75) oppure minuti:secondi (es. 1:15)', placeholder: '1:15', ok: 'Aggiungi', type: 'text' });
          if (raw == null) return;
          const sec = parseTime(raw);
          if (!sec || sec > 3600) { toast('Tempo non valido: usa ad esempio 75 oppure 1:15 (massimo 60 minuti).', 'error'); return; }
          try { await saveTimerPresets([...timerPresets(), sec]); drawPresets(); } catch (e) { /* avviso già mostrato */ }
        } } }, icon('plus'), 'Aggiungi'));
      }
      editBtn.textContent = editing ? 'Fatto' : 'Modifica preset';
    };
    const editBtn = el('button', { type: 'button', class: 'link-btn', on: { click: () => { editing = !editing; drawPresets(); } } });

    sheet.append(
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title', text: 'Timer di riposo' }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi', on: { click: () => close() } }, icon('close'))),
      display, state, bar, controls, presetsBox,
      el('div', { class: 'timer-foot' }, editBtn));
    drawPresets();
    refresh();
  }).then(() => {
    onTick = null;
    release('timer-panel');
    const st = status();
    if (!st.running && st.done) write(null);           // chiuso dopo la fine: si torna all'icona
    refresh();
  });
}

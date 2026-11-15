/**
 * diary.js — diario: calendario (predefinito) o elenco. Ogni voce è data + nome (allenamento o attività),
 * con stelline facoltative. Un giorno può avere più voci.
 */
import { el, icon, fmtDate, todayIso, confirmDialog, customSheet, toast } from '../ui.js';
import { diarySorted, diaryByDay, lastWorkouts, isActivityEntry, activeWorkouts, activeActivities,
  addDiaryEntry, setDiaryStars, deleteDiaryEntry } from '../store.js';
import { starsText, starsInput, askStars, pickFromList } from '../components.js';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const VIEW_KEY = 'gymlog.diaryView';

let month = null;     // primo giorno del mese mostrato (resta finché l'app è aperta)

const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);
const longDay = day => { const d = new Date(day + 'T12:00:00'); return DAYS[d.getDay()] + ' ' + fmtDate(day); };

function getMode() { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cal'; } catch (e) { return 'cal'; } }
function setMode(m) { try { localStorage.setItem(VIEW_KEY, m); } catch (e) { /* niente */ } }

export function render(ctx) {
  ctx.setTitle('Diario');
  ctx.setActions(el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Aggiungi una voce a oggi',
    on: { click: () => daySheet(ctx, todayIso()) } }, icon('plus'), el('span', { text: 'Oggi' })));
  if (!month) { const n = new Date(); month = new Date(n.getFullYear(), n.getMonth(), 1); }

  const mode = getMode();
  const mk = (key, label) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(mode === key), text: label,
    on: { click: () => { setMode(key); ctx.rerender(); } } });
  ctx.view.appendChild(el('div', { class: 'segmented switch' }, mk('cal', 'Calendario'), mk('list', 'Elenco')));

  if (mode === 'cal') renderCalendar(ctx); else renderList(ctx);
}

/* ---------------------------------------------------------------------
   Calendario
   --------------------------------------------------------------------- */
function renderCalendar(ctx) {
  const y = month.getFullYear(), m = month.getMonth();
  const today = todayIso();
  const byDay = new Map();
  for (const d of diarySorted()) {
    if (!d.day.startsWith(y + '-' + pad(m + 1))) continue;
    if (!byDay.has(d.day)) byDay.set(d.day, []);
    byDay.get(d.day).push(d);
  }

  const shift = delta => { month = new Date(y, m + delta, 1); ctx.rerender(); };
  const head = el('div', { class: 'cal-head' },
    el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mese precedente', on: { click: () => shift(-1) } }, icon('back')),
    el('button', { type: 'button', class: 'cal-title', title: 'Torna al mese corrente',
      on: { click: () => { const n = new Date(); month = new Date(n.getFullYear(), n.getMonth(), 1); ctx.rerender(); } } },
      MONTHS[m] + ' ' + y),
    el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mese successivo', on: { click: () => shift(1) } }, icon('chevron')));

  const grid = el('div', { class: 'cal-grid', role: 'grid' });
  ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach(d => grid.appendChild(el('div', { class: 'cal-dow', text: d, 'aria-hidden': 'true' })));
  const first = (new Date(y, m, 1).getDay() + 6) % 7;        // lunedì = 0
  const days = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first; i++) grid.appendChild(el('div', { class: 'cal-empty' }));
  for (let d = 1; d <= days; d++) {
    const day = iso(y, m, d);
    const entries = byDay.get(day) || [];
    const label = longDay(day) + (entries.length ? ': ' + entries.map(e => e.name).join(', ') : '');
    grid.appendChild(el('button', {
      type: 'button', class: 'cal-day' + (day === today ? ' today' : '') + (entries.length ? ' has' : '') + (day > today ? ' future' : ''),
      'aria-label': label, on: { click: () => daySheet(ctx, day) },
    },
      el('span', { class: 'cal-num', text: String(d) }),
      el('span', { class: 'cal-dots' }, entries.slice(0, 3).map(e => el('span', { class: 'dot ' + (isActivityEntry(e) ? 'act' : 'wk') })))));
  }

  const last = lastWorkouts(3);
  ctx.view.append(
    el('div', { class: 'card cal' }, head, grid,
      el('div', { class: 'legend' },
        el('span', {}, el('span', { class: 'dot wk' }), 'Allenamento'),
        el('span', {}, el('span', { class: 'dot act' }), 'Attività'))),
    el('h2', { class: 'section-title', text: 'Ultimi 3 allenamenti' }),
    last.length
      ? el('div', { class: 'card last3' }, last.map(d => el('button', { type: 'button', class: 'last3-row', on: { click: () => entrySheet(ctx, d) } },
        el('span', { class: 'last3-date', text: fmtDate(d.day) + ':' }), el('span', { class: 'last3-name', text: d.name }),
        d.stars ? el('span', { class: 'stars-text', text: starsText(d.stars) }) : null)))
      : el('p', { class: 'hint', text: 'Ancora nessun allenamento completato.' }));
}

/* ---------------------------------------------------------------------
   Elenco
   --------------------------------------------------------------------- */
function renderList(ctx) {
  const all = diarySorted();
  if (!all.length) {
    ctx.view.appendChild(el('div', { class: 'placeholder' }, icon('diary'), el('strong', { text: 'Diario vuoto' }),
      el('p', { text: 'Le voci arrivano da «Allenamento completato» o toccando un giorno del calendario.' })));
    return;
  }
  let current = null, ul = null;
  for (const d of all) {
    const key = d.day.slice(0, 7);
    if (key !== current) {
      current = key;
      ctx.view.appendChild(el('h2', { class: 'section-title', text: MONTHS[Number(key.slice(5)) - 1] + ' ' + key.slice(0, 4) }));
      ul = el('ul', { class: 'list' });
      ctx.view.appendChild(ul);
    }
    ul.appendChild(el('li', {}, el('button', { type: 'button', class: 'row', on: { click: () => entrySheet(ctx, d) } },
      el('span', { class: 'dot ' + (isActivityEntry(d) ? 'act' : 'wk') }),
      el('span', { class: 'list-date', text: fmtDate(d.day) }),
      el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: d.name })),
      d.stars ? el('span', { class: 'stars-text', text: starsText(d.stars) }) : null)));
  }
}

/* ---------------------------------------------------------------------
   Fogli: giorno e singola voce
   --------------------------------------------------------------------- */

/** Voci di un giorno + aggiunta di un allenamento o di un'attività. */
async function daySheet(ctx, day) {
  const choice = await customSheet((sheet, close) => {
    const entries = diaryByDay(day);
    sheet.append(
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title', text: longDay(day) }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi', on: { click: () => close(null) } }, icon('close'))),
      entries.length
        ? el('ul', { class: 'list', style: 'margin:10px 0' }, entries.map(d => el('li', {},
          el('button', { type: 'button', class: 'row', on: { click: () => close({ edit: d }) } },
            el('span', { class: 'dot ' + (isActivityEntry(d) ? 'act' : 'wk') }),
            el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: d.name })),
            d.stars ? el('span', { class: 'stars-text', text: starsText(d.stars) }) : null,
            icon('chevron', 'ico chev')))))
        : el('p', { class: 'sheet-text', text: 'Nessuna voce in questo giorno.' }),
      el('div', { class: 'sheet-actions' },
        el('button', { type: 'button', class: 'btn', on: { click: () => close({ add: 'workout' }) } }, el('span', { class: 'dot wk' }), 'Allenamento'),
        el('button', { type: 'button', class: 'btn', on: { click: () => close({ add: 'activity' }) } }, el('span', { class: 'dot act' }), 'Attività')));
  });
  if (!choice) return;
  if (choice.edit) { await entrySheet(ctx, choice.edit, () => daySheet(ctx, day)); return; }

  if (choice.add === 'workout') {
    const id = await pickFromList({ title: 'Quale allenamento?', items: activeWorkouts().map(w => ({ id: w.id, name: w.name })),
      empty: 'Nessun allenamento: crealo nella sezione Allenamenti.' });
    if (!id) return;
    try {
      const entry = await addDiaryEntry({ day, workout_id: id });
      ctx.rerender();
      const stars = await askStars({ title: 'Com\'è andata?', text: entry.name + ' · ' + fmtDate(day) });
      if (stars) { await setDiaryStars(entry.id, stars); ctx.rerender(); }
    } catch (e) { /* avviso già mostrato */ }
  } else {
    const id = await pickFromList({ title: 'Quale attività?', items: activeActivities().map(a => ({ id: a.id, name: a.name })),
      empty: 'Nessuna attività: creala in Altro → Attività (es. Corsa).',
      footer: close => el('a', { class: 'btn btn-block', style: 'margin-top:12px', href: '#/altro/attivita', on: { click: () => close(null) } }, icon('edit'), 'Gestisci le attività') });
    if (!id) return;
    try { await addDiaryEntry({ day, activity_id: id }); toast('Attività aggiunta', 'ok'); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
  }
}

/** Una voce: stelline (anche dopo) ed eliminazione. back() riapre il foglio precedente. */
async function entrySheet(ctx, d, back) {
  const act = await customSheet((sheet, close) => {
    sheet.append(
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title' }, el('span', { class: 'dot ' + (isActivityEntry(d) ? 'act' : 'wk') }), ' ', d.name),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi', on: { click: () => close(null) } }, icon('close'))),
      el('p', { class: 'sheet-text', text: longDay(d.day) + (isActivityEntry(d) ? ' · attività' : ' · allenamento') }),
      el('p', { class: 'field-label', text: 'Stelline' }),
      starsInput(d.stars, n => close({ stars: n })),
      el('div', { class: 'sheet-actions' },
        d.stars ? el('button', { type: 'button', class: 'btn', text: 'Togli stelle', on: { click: () => close({ stars: null }) } }) : null,
        el('button', { type: 'button', class: 'btn btn-ghost-danger', on: { click: () => close({ del: true }) } }, icon('trash'), 'Elimina voce')));
  });
  if (!act) { if (back) back(); return; }
  try {
    if ('stars' in act) {
      if (act.stars !== d.stars) { await setDiaryStars(d.id, act.stars); toast('Stelline salvate', 'ok'); }
    } else if (act.del) {
      const ok = await confirmDialog({ title: 'Eliminare la voce?', text: '«' + d.name + '» del ' + fmtDate(d.day) + ' verrà tolta dal diario.', ok: 'Elimina', danger: true });
      if (!ok) return;
      await deleteDiaryEntry(d.id);
      toast('Voce eliminata', 'ok');
    }
    ctx.rerender();
  } catch (e) { /* avviso già mostrato */ }
}

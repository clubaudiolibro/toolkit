/** today.js — «Cosa allenare oggi»: allenamento suggerito, scelta di un altro, allenamento in corso. */
import { el, icon, fmtDate, todayIso } from '../ui.js';
import { activeWorkouts, getWorkout, suggestedWorkout, diaryByDay, isActivityEntry } from '../store.js';
import { pickFromList, starsText } from '../components.js';
import { inProgress } from '../progress.js';
import { workoutCount } from './workouts.js';
import { backupBanner } from './backup.js';
import { backupOverdue } from '../backup.js';

const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export function render(ctx) {
  ctx.setTitle('Oggi');
  const now = new Date();
  ctx.view.appendChild(el('p', { class: 'today-date', text: DAYS[now.getDay()] + ' ' + fmtDate(now) }));
  if (backupOverdue()) ctx.view.appendChild(backupBanner());

  const list = activeWorkouts();
  if (!list.length) {
    ctx.view.appendChild(el('div', { class: 'placeholder' }, icon('workouts'),
      el('strong', { text: 'Nessun allenamento' }),
      el('p', { text: 'Crea il tuo primo allenamento: poi qui troverai ogni giorno quello da fare.' }),
      el('a', { class: 'btn btn-primary', href: '#/allenamenti', text: 'Vai agli allenamenti' })));
    return;
  }

  // Allenamento lasciato a metà (spunte salvate sul telefono)
  const running = inProgress().map(p => ({ ...p, w: getWorkout(p.workoutId) })).find(p => p.w && !p.w.deleted_at);
  if (running) {
    ctx.view.appendChild(el('a', { class: 'resume', href: '#/esegui/' + running.w.id },
      el('div', { class: 'row-main' },
        el('div', { class: 'resume-label', text: 'In corso' }),
        el('div', { class: 'row-title', text: running.w.name }),
        el('div', { class: 'row-sub', text: running.count + ' di ' + workoutCount(running.w.id) + ' esercizi spuntati' })),
      el('span', { class: 'btn btn-sm', text: 'Riprendi' })));
  }

  const sug = suggestedWorkout();
  const w = sug.workout;
  const n = workoutCount(w.id);
  ctx.view.appendChild(el('a', { class: 'suggest', href: '#/esegui/' + w.id },
    el('div', { class: 'suggest-label', text: 'Cosa allenare oggi' }),
    el('div', { class: 'suggest-name', text: w.name }),
    el('div', { class: 'suggest-sub', text: (sug.after
      ? 'Viene dopo «' + sug.after.name + '» del ' + fmtDate(sug.after.day)
      : 'Primo della lista') + ' · ' + n + (n === 1 ? ' esercizio' : ' esercizi') }),
    el('span', { class: 'suggest-go' }, icon('play'), 'Inizia')));

  if (list.length > 1) {
    ctx.view.appendChild(el('ul', { class: 'list', style: 'margin-top:14px' }, el('li', {},
      el('button', { type: 'button', class: 'row', on: { click: async () => {
        const id = await pickFromList({ title: 'Scegli l\'allenamento', items: list.map(x => ({
          id: x.id, name: x.name, sub: workoutCount(x.id) + ' esercizi', note: x.id === w.id ? 'suggerito' : null })) });
        if (id) ctx.go('#/esegui/' + id);
      } } },
        el('span', { class: 'row-icon' }, icon('workouts')),
        el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: 'Scegli un altro allenamento' })),
        icon('chevron', 'ico chev')))));
  }

  const today = diaryByDay(todayIso());
  if (today.length) {
    ctx.view.appendChild(el('h2', { class: 'section-title', text: 'Già fatto oggi' }));
    ctx.view.appendChild(el('ul', { class: 'list' }, today.map(d => el('li', {},
      el('a', { class: 'row', href: '#/diario' },
        el('span', { class: 'dot ' + (isActivityEntry(d) ? 'act' : 'wk') }),
        el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: d.name })),
        d.stars ? el('span', { class: 'stars-text', text: starsText(d.stars) }) : null)))));
  }
}

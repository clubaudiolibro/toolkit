/** workouts.js — elenco degli allenamenti (ordine trascinabile) e dei gruppi di esercizi. */
import { el, icon, promptDialog, toast } from '../ui.js';
import { activeWorkouts, activeGroups, workoutItems, groupItems, groupUsage, createWorkout, createGroup,
  reorderWorkouts } from '../store.js';
import { makeSortable, dragHandle } from '../components.js';

/** Quanti esercizi contiene un allenamento (contando quelli dei gruppi). */
export function workoutCount(wId) {
  let n = 0;
  for (const it of workoutItems(wId)) n += it.kind === 'group' ? groupItems(it.group_id).length : 1;
  return n;
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

function switcher(active) {
  const mk = (href, label, key) => el('a', { class: 'chip', href, 'aria-pressed': String(active === key), text: label });
  return el('div', { class: 'segmented switch', role: 'tablist' },
    mk('#/allenamenti', 'Allenamenti', 'w'), mk('#/allenamenti/gruppi', 'Gruppi di esercizi', 'g'));
}

export async function render(ctx) {
  const showGroups = ctx.path === 'allenamenti/gruppi';
  ctx.setTitle(showGroups ? 'Gruppi di esercizi' : 'Allenamenti');
  ctx.setActions(el('button', { type: 'button', class: 'icon-btn', on: { click: async () => {
    const name = await promptDialog({ title: showGroups ? 'Nuovo gruppo' : 'Nuovo allenamento',
      placeholder: showGroups ? 'Es. Gambe' : 'Es. Allenamento A', ok: 'Crea' });
    if (!name) return;
    try {
      if (showGroups) { const g = await createGroup(name); ctx.go('#/allenamenti/gruppi/' + g.id); }
      else { const w = await createWorkout(name); ctx.go('#/allenamenti/' + w.id); }
    } catch (e) { /* avviso già mostrato */ }
  } } }, icon('plus'), el('span', { text: 'Nuovo' })));

  ctx.view.appendChild(switcher(showGroups ? 'g' : 'w'));
  if (showGroups) renderGroups(ctx); else await renderWorkouts(ctx);
}

async function renderWorkouts(ctx) {
  const list = activeWorkouts();
  if (!list.length) {
    ctx.view.appendChild(el('div', { class: 'placeholder' }, icon('workouts'),
      el('strong', { text: 'Nessun allenamento' }),
      el('p', { text: 'Un allenamento è fatto di gruppi e/o esercizi singoli. Premi «Nuovo» per crearne uno.' })));
    return;
  }
  ctx.view.appendChild(el('p', { class: 'hint', text: 'Trascina dalla maniglia per cambiare l\'ordine: dopo l\'ultimo completato ti verrà suggerito il successivo.' }));
  const ul = el('ul', { class: 'list' });
  for (const w of list) {
    const items = workoutItems(w.id);
    const nGroups = items.filter(i => i.kind === 'group').length;
    const sub = [nGroups ? plural(nGroups, 'gruppo', 'gruppi') : null, plural(workoutCount(w.id), 'esercizio', 'esercizi')].filter(Boolean).join(' · ');
    ul.appendChild(el('li', { class: 'sortable-row', dataset: { id: w.id } },
      dragHandle(w.name),
      el('a', { class: 'row', href: '#/allenamenti/' + w.id },
        el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: w.name }), el('div', { class: 'row-sub', text: sub })),
        icon('chevron', 'ico chev'))));
  }
  ctx.view.appendChild(ul);
  try {
    await makeSortable(ul, async ids => {
      try { await reorderWorkouts(ids); } catch (e) { ctx.rerender(); }
    });
  } catch (e) { toast(e.message, 'error'); }
}

function renderGroups(ctx) {
  const list = activeGroups();
  if (!list.length) {
    ctx.view.appendChild(el('div', { class: 'placeholder' }, icon('folder'),
      el('strong', { text: 'Nessun gruppo' }),
      el('p', { text: 'Un gruppo (es. «Gambe») raccoglie esercizi in un ordine preciso e si può usare in più allenamenti.' })));
    return;
  }
  const ul = el('ul', { class: 'list' });
  for (const g of list) {
    const used = groupUsage(g.id);
    const sub = [plural(groupItems(g.id).length, 'esercizio', 'esercizi'),
      used.length ? 'in ' + used.map(w => w.name).join(', ') : 'non usato'].join(' · ');
    ul.appendChild(el('li', {}, el('a', { class: 'row', href: '#/allenamenti/gruppi/' + g.id },
      el('span', { class: 'row-icon' }, icon('folder')),
      el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: g.name }), el('div', { class: 'row-sub', text: sub })),
      icon('chevron', 'ico chev'))));
  }
  ctx.view.appendChild(ul);
}

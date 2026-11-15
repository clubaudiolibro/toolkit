/** workout-edit.js — un allenamento: gruppi ed esercizi singoli in ordine trascinabile, con i loro valori. */
import { el, icon, toast, confirmDialog, promptDialog } from '../ui.js';
import { getWorkout, workoutItems, getGroup, groupItems, getExercise, activeGroups, addWorkoutItem, removeWorkoutItem,
  reorderWorkoutItems, renameWorkout, duplicateWorkout, trashWorkout, groupUsage } from '../store.js';
import { exerciseCard, makeSortable, pickFromList, actionMenu, dragHandle } from '../components.js';
import { pickExercise } from './group-edit.js';

export async function render(ctx) {
  const w = getWorkout(ctx.params[0]);
  ctx.setBack('#/allenamenti');
  if (!w || w.deleted_at) {
    ctx.setTitle('Allenamento');
    ctx.view.appendChild(el('div', { class: 'placeholder' }, el('strong', { text: 'Allenamento non trovato' }),
      el('p', { text: 'Forse è nel cestino.' }), el('a', { class: 'btn', href: '#/altro/cestino', text: 'Apri il cestino' })));
    return;
  }
  ctx.setTitle(w.name);
  ctx.setActions(el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Azioni dell\'allenamento', on: { click: () => actionMenu(w.name, [
    { label: 'Rinomina', icon: 'edit', run: async () => {
      const name = await promptDialog({ title: 'Rinomina allenamento', value: w.name });
      if (!name || name === w.name) return;
      try { await renameWorkout(w.id, name); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
    } },
    { label: 'Duplica', icon: 'copy', run: async () => {
      const name = await promptDialog({ title: 'Duplica allenamento', label: 'Nome della copia', value: w.name + ' (copia)', ok: 'Duplica' });
      if (!name) return;
      try { const c = await duplicateWorkout(w.id, name); toast('Allenamento duplicato', 'ok'); ctx.go('#/allenamenti/' + c.id); } catch (e) { /* avviso già mostrato */ }
    } },
    { label: 'Sposta nel cestino', icon: 'trash', danger: true, run: async () => {
      const ok = await confirmDialog({ title: 'Spostare nel cestino?', text: '«' + w.name + '» potrà essere ripristinato dal cestino. Il diario conserva comunque le voci passate.', ok: 'Sposta nel cestino', danger: true });
      if (!ok) return;
      try { await trashWorkout(w.id); toast('Allenamento spostato nel cestino', 'ok'); ctx.go('#/allenamenti'); } catch (e) { /* avviso già mostrato */ }
    } },
  ]) } }, icon('more')));

  const items = workoutItems(w.id);
  const ul = el('ul', { class: 'cards' });
  for (const it of items) {
    if (it.kind === 'group') ul.appendChild(groupBlock(ctx, it));
    else {
      const ex = getExercise(it.exercise_id);
      ul.appendChild(exerciseCard({ exercise: ex, kind: 'workout', item: it, sortable: true,
        removeLabel: 'Togli ' + ex.name + ' dall\'allenamento',
        onRemove: async () => {
          const ok = await confirmDialog({ title: 'Togliere «' + ex.name + '»?', text: 'L\'esercizio resta nel database; si perdono solo i valori in questo allenamento.', ok: 'Togli', danger: true });
          if (!ok) return;
          try { await removeWorkoutItem(it.id); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
        } }));
    }
  }
  if (!items.length) ctx.view.appendChild(el('p', { class: 'empty', text: 'Allenamento vuoto: aggiungi un gruppo o un esercizio singolo.' }));
  else ctx.view.appendChild(ul);

  const present = new Set(items.map(i => i.group_id || i.exercise_id));
  ctx.view.appendChild(el('div', { class: 'add-row two' },
    el('button', { type: 'button', class: 'btn', on: { click: async () => {
      const groups = activeGroups().filter(g => !present.has(g.id)).map(g => ({ id: g.id, name: g.name,
        sub: groupItems(g.id).map(i => getExercise(i.exercise_id).name).join(', ') || 'Gruppo vuoto' }));
      const id = await pickFromList({ title: 'Aggiungi un gruppo', items: groups,
        empty: 'Nessun gruppo disponibile: crealo in Allenamenti → Gruppi di esercizi.' });
      if (!id) return;
      try { await addWorkoutItem(w.id, 'group', id); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
    } } }, icon('folder'), 'Gruppo'),
    el('button', { type: 'button', class: 'btn', on: { click: async () => {
      const id = await pickExercise('Aggiungi un esercizio singolo', present);
      if (!id) return;
      try { await addWorkoutItem(w.id, 'exercise', id); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
    } } }, icon('dumbbell'), 'Esercizio')));

  if (items.length > 1) {
    try { await makeSortable(ul, async ids => { try { await reorderWorkoutItems(ids); } catch (e) { ctx.rerender(); } }); }
    catch (e) { toast(e.message, 'error'); }
  }
}

/** Blocco di un gruppo dentro l'allenamento: i valori sono quelli del gruppo (condivisi). */
function groupBlock(ctx, it) {
  const g = getGroup(it.group_id);
  const exItems = groupItems(g.id);
  const shared = groupUsage(g.id).length > 1;
  const inner = el('ul', { class: 'cards nested' });
  for (const gi of exItems) inner.appendChild(exerciseCard({ exercise: getExercise(gi.exercise_id), kind: 'group', item: gi }));
  return el('li', { class: 'group-block', dataset: { id: it.id } },
    el('div', { class: 'item-head group-head' },
      dragHandle(g.name),
      el('span', { class: 'group-label' }, icon('folder'), el('span', { text: g.name })),
      el('a', { class: 'icon-btn', href: '#/allenamenti/gruppi/' + g.id, 'aria-label': 'Modifica il gruppo ' + g.name }, icon('edit')),
      el('button', { type: 'button', class: 'icon-btn muted', 'aria-label': 'Togli il gruppo ' + g.name + ' dall\'allenamento', on: { click: async () => {
        const ok = await confirmDialog({ title: 'Togliere il gruppo «' + g.name + '»?', text: 'Il gruppo resta disponibile con i suoi valori; viene solo tolto da questo allenamento.', ok: 'Togli', danger: true });
        if (!ok) return;
        try { await removeWorkoutItem(it.id); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
      } } }, icon('close'))),
    shared ? el('p', { class: 'group-note', text: 'Valori condivisi con gli altri allenamenti che usano questo gruppo.' }) : null,
    exItems.length ? inner : el('p', { class: 'group-note', text: 'Gruppo vuoto: tocca la matita per aggiungere esercizi.' }));
}

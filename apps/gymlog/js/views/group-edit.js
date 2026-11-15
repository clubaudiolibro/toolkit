/** group-edit.js — un gruppo di esercizi: ordine trascinabile, valori, aggiunta e rimozione di esercizi. */
import { el, icon, toast, confirmDialog, promptDialog } from '../ui.js';
import { getGroup, groupItems, groupUsage, activeExercises, getExercise, addExerciseToGroup, removeGroupItem,
  reorderGroupItems, renameGroup, trashGroup, exerciseUsage } from '../store.js';
import { exerciseCard, makeSortable, pickFromList, actionMenu } from '../components.js';
import { exerciseSubtitle } from './exercises.js';

/** Foglio per scegliere un esercizio (esclude quelli in excludeIds). */
export async function pickExercise(title, excludeIds = new Set()) {
  const items = activeExercises().filter(ex => !excludeIds.has(ex.id)).map(ex => {
    const used = exerciseUsage(ex.id).groups;
    return { id: ex.id, name: ex.name, sub: exerciseSubtitle(ex), note: used.length ? 'in ' + used.map(g => g.name).join(', ') : null };
  });
  return pickFromList({ title, items, empty: 'Nessun esercizio disponibile: creane uno nella sezione Esercizi.' });
}

export async function render(ctx) {
  const g = getGroup(ctx.params[0]);
  ctx.setBack('#/allenamenti/gruppi');
  if (!g || g.deleted_at) {
    ctx.setTitle('Gruppo');
    ctx.view.appendChild(el('div', { class: 'placeholder' }, el('strong', { text: 'Gruppo non trovato' }),
      el('p', { text: 'Forse è nel cestino.' }), el('a', { class: 'btn', href: '#/altro/cestino', text: 'Apri il cestino' })));
    return;
  }
  ctx.setTitle(g.name);
  ctx.setActions(el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Azioni del gruppo', on: { click: () => actionMenu(g.name, [
    { label: 'Rinomina', icon: 'edit', run: async () => {
      const name = await promptDialog({ title: 'Rinomina gruppo', value: g.name });
      if (!name || name === g.name) return;
      try { await renameGroup(g.id, name); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
    } },
    { label: 'Sposta nel cestino', icon: 'trash', danger: true, run: async () => {
      const used = groupUsage(g.id);
      const ok = await confirmDialog({ title: 'Spostare nel cestino?',
        text: '«' + g.name + '» ' + (used.length ? 'sparirà anche da: ' + used.map(w => w.name).join(', ') + '. ' : '') + 'Potrai ripristinarlo dal cestino con tutti i valori.',
        ok: 'Sposta nel cestino', danger: true });
      if (!ok) return;
      try { await trashGroup(g.id); toast('Gruppo spostato nel cestino', 'ok'); ctx.go('#/allenamenti/gruppi'); } catch (e) { /* avviso già mostrato */ }
    } },
  ]) } }, icon('more')));

  const used = groupUsage(g.id);
  ctx.view.appendChild(el('p', { class: 'hint', text: used.length
    ? 'Usato in: ' + used.map(w => w.name).join(', ') + '. I valori sono condivisi: cambiandoli qui cambiano anche lì.'
    : 'Non ancora usato in un allenamento.' }));

  const items = groupItems(g.id);
  const ul = el('ul', { class: 'cards' });
  for (const it of items) {
    const ex = getExercise(it.exercise_id);
    ul.appendChild(exerciseCard({ exercise: ex, kind: 'group', item: it, sortable: true,
      removeLabel: 'Togli ' + ex.name + ' dal gruppo',
      onRemove: async () => {
        const ok = await confirmDialog({ title: 'Togliere «' + ex.name + '» dal gruppo?', text: 'L\'esercizio resta nel database; si perdono solo i valori di questo gruppo.', ok: 'Togli', danger: true });
        if (!ok) return;
        try { await removeGroupItem(it.id); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
      } }));
  }
  if (!items.length) ctx.view.appendChild(el('p', { class: 'empty', text: 'Il gruppo è vuoto: aggiungi il primo esercizio.' }));
  else ctx.view.appendChild(ul);

  ctx.view.appendChild(el('div', { class: 'add-row' },
    el('button', { type: 'button', class: 'btn btn-block', on: { click: async () => {
      const id = await pickExercise('Aggiungi al gruppo', new Set(items.map(i => i.exercise_id)));
      if (!id) return;
      try { await addExerciseToGroup(g.id, id); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
    } } }, icon('plus'), 'Aggiungi esercizio')));

  if (items.length > 1) {
    try { await makeSortable(ul, async ids => { try { await reorderGroupItems(ids); } catch (e) { ctx.rerender(); } }); }
    catch (e) { toast(e.message, 'error'); }
  }
}

/** trash.js — cestino: ripristino o eliminazione definitiva. Si svuota solo a mano. */
import { el, icon, fmtDate, toast, confirmDialog } from '../ui.js';
import { trashItems, restoreItem, purgeItem } from '../store.js';

const TYPE_LABEL = { exercise: 'Esercizio', group: 'Gruppo', workout: 'Allenamento', activity: 'Attività' };

export function render(ctx) {
  ctx.setTitle('Cestino');
  ctx.setBack('#/altro');
  draw();

  function draw() {
    ctx.view.textContent = '';
    const items = trashItems();
    if (!items.length) {
      ctx.view.appendChild(el('div', { class: 'placeholder' }, icon('trash'), el('strong', { text: 'Il cestino è vuoto' }),
        el('p', { text: 'Gli elementi eliminati restano qui finché non li elimini definitivamente.' })));
      return;
    }
    ctx.view.appendChild(el('p', { class: 'hint', text: 'Il cestino non si svuota mai da solo. Il diario conserva comunque i nomi degli allenamenti eliminati.' }));
    const ul = el('ul', { class: 'list' });
    for (const it of items) {
      ul.appendChild(el('li', {}, el('div', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: it.name }),
          el('div', { class: 'row-sub', text: TYPE_LABEL[it.type] + ' · eliminato il ' + fmtDate(it.deleted_at) })),
        el('div', { class: 'row-actions' },
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Ripristina ' + it.name, on: { click: async () => {
            try { await restoreItem(it); toast('«' + it.name + '» ripristinato', 'ok'); draw(); } catch (e) { /* avviso già mostrato */ }
          } } }, icon('restore')),
          el('button', { type: 'button', class: 'icon-btn btn-ghost-danger', 'aria-label': 'Elimina definitivamente ' + it.name, on: { click: async () => {
            const ok = await confirmDialog({ title: 'Eliminare definitivamente?', text: '«' + it.name + '» verrà eliminato per sempre, anche da gruppi e allenamenti. Non si può annullare.', ok: 'Elimina per sempre', danger: true });
            if (!ok) return;
            try { await purgeItem(it); toast('Eliminato definitivamente', 'ok'); draw(); } catch (e) { /* avviso già mostrato */ }
          } } }, icon('trash'))))));
    }
    ctx.view.appendChild(ul);
    ctx.view.appendChild(el('div', { class: 'danger-zone' },
      el('button', { type: 'button', class: 'btn btn-block btn-ghost-danger', on: { click: async () => {
        const ok = await confirmDialog({ title: 'Svuotare il cestino?', text: 'Tutti gli elementi (' + items.length + ') verranno eliminati per sempre. Non si può annullare.', ok: 'Svuota il cestino', danger: true });
        if (!ok) return;
        try { for (const it of trashItems()) await purgeItem(it); toast('Cestino svuotato', 'ok'); } catch (e) { /* avviso già mostrato */ }
        draw();
      } } }, icon('trash'), 'Svuota il cestino')));
  }
}

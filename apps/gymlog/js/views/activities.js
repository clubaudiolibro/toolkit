/** activities.js — tipi di attività che non sono allenamenti (es. Corsa). Eliminati → cestino. */
import { el, icon, toast, confirmDialog, promptDialog } from '../ui.js';
import { state, activeActivities, createActivity, renameActivity, trashActivity } from '../store.js';

export function render(ctx) {
  ctx.setTitle('Attività');
  ctx.setBack('#/altro');
  const exists = (name, exceptId) => activeActivities().some(a => a.id !== exceptId && a.name.toLowerCase() === name.toLowerCase());

  const input = el('input', { class: 'input', type: 'text', placeholder: 'Es. Corsa', autocomplete: 'off', 'aria-label': 'Nuova attività' });
  const form = el('form', { class: 'inline', style: 'margin-bottom:10px', on: { submit: async e => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (exists(name)) { toast('«' + name + '» è già nella lista.', 'error'); return; }
    try { await createActivity(name); input.value = ''; draw(); toast('Aggiunta', 'ok'); } catch (err) { /* avviso già mostrato */ }
  } } }, input, el('button', { type: 'submit', class: 'btn btn-primary' }, icon('plus'), 'Aggiungi'));

  const box = el('div');
  function draw() {
    box.textContent = '';
    const list = activeActivities();
    if (!list.length) { box.appendChild(el('p', { class: 'empty', text: 'Nessuna attività. Aggiungi ad esempio «Corsa» o «Nuoto».' })); return; }
    box.appendChild(el('ul', { class: 'list' }, list.map(a => {
      const n = state.diary.filter(d => d.activity_id === a.id).length;
      return el('li', {}, el('div', { class: 'row' },
        el('span', { class: 'dot act' }),
        el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: a.name }),
          el('div', { class: 'row-sub', text: n ? (n === 1 ? '1 volta nel diario' : n + ' volte nel diario') : 'Mai nel diario' })),
        el('div', { class: 'row-actions' },
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rinomina ' + a.name, on: { click: async () => {
            const name = await promptDialog({ title: 'Rinomina attività', value: a.name });
            if (!name || name === a.name) return;
            if (exists(name, a.id)) { toast('«' + name + '» è già nella lista.', 'error'); return; }
            try { await renameActivity(a.id, name); draw(); } catch (e) { /* avviso già mostrato */ }
          } } }, icon('edit')),
          el('button', { type: 'button', class: 'icon-btn btn-ghost-danger', 'aria-label': 'Sposta nel cestino ' + a.name, on: { click: async () => {
            const ok = await confirmDialog({ title: 'Spostare «' + a.name + '» nel cestino?', text: 'Le voci già nel diario restano. Potrai ripristinarla dal cestino.', ok: 'Sposta nel cestino', danger: true });
            if (!ok) return;
            try { await trashActivity(a.id); draw(); } catch (e) { /* avviso già mostrato */ }
          } } }, icon('trash')))));
    })));
  }
  ctx.view.append(el('p', { class: 'hint', text: 'Attività che non sono allenamenti: nel diario hanno un colore diverso e non contano per il suggerimento di oggi.' }), form, box);
  draw();
}

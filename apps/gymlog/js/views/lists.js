/** lists.js — liste personalizzabili: gruppi muscolari e attrezzi. */
import { el, icon, toast, confirmDialog, promptDialog } from '../ui.js';
import { state, addListItem, renameListItem, deleteListItem, listItemUsage } from '../store.js';

const KINDS = {
  muscoli: { kind: 'muscles', title: 'Gruppi muscolari', one: 'gruppo muscolare', placeholder: 'Es. Avambracci' },
  attrezzi: { kind: 'equipment', title: 'Attrezzi', one: 'attrezzo', placeholder: 'Es. Cavi' },
};

export function render(ctx) {
  const cfg = KINDS[ctx.params[0]];
  ctx.setTitle(cfg.title);
  ctx.setBack('#/altro');

  const exists = (name, exceptId) => state[cfg.kind].some(x => x.id !== exceptId && x.name.toLowerCase() === name.toLowerCase());

  const input = el('input', { class: 'input', type: 'text', placeholder: cfg.placeholder, autocomplete: 'off', 'aria-label': 'Nuovo ' + cfg.one });
  const addForm = el('form', { class: 'inline', style: 'margin-bottom:16px', on: { submit: async e => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (exists(name)) { toast('«' + name + '» è già nella lista.', 'error'); return; }
    try { await addListItem(cfg.kind, name); input.value = ''; draw(); toast('Aggiunto', 'ok'); } catch (err) { /* avviso già mostrato */ }
  } } }, input, el('button', { type: 'submit', class: 'btn btn-primary' }, icon('plus'), 'Aggiungi'));

  const listBox = el('div');
  function draw() {
    listBox.textContent = '';
    const ul = el('ul', { class: 'list' });
    for (const item of state[cfg.kind]) {
      const n = listItemUsage(cfg.kind, item.id);
      ul.appendChild(el('li', {}, el('div', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: item.name }),
          el('div', { class: 'row-sub', text: n ? (n === 1 ? 'Usato da 1 esercizio' : 'Usato da ' + n + ' esercizi') : 'Non usato' })),
        el('div', { class: 'row-actions' },
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rinomina ' + item.name, on: { click: async () => {
            const name = await promptDialog({ title: 'Rinomina', value: item.name });
            if (!name || name === item.name) return;
            if (exists(name, item.id)) { toast('«' + name + '» è già nella lista.', 'error'); return; }
            try { await renameListItem(cfg.kind, item.id, name); draw(); } catch (e) { /* avviso già mostrato */ }
          } } }, icon('edit')),
          el('button', { type: 'button', class: 'icon-btn btn-ghost-danger', 'aria-label': 'Elimina ' + item.name, on: { click: async () => {
            const ok = await confirmDialog({
              title: 'Eliminare «' + item.name + '»?',
              text: n ? 'È usato da ' + (n === 1 ? '1 esercizio' : n + ' esercizi') + ': verrà tolto da ' + (n === 1 ? 'quell\'esercizio' : 'quegli esercizi') + '. Gli esercizi restano.' : 'La voce verrà eliminata.',
              ok: 'Elimina', danger: true,
            });
            if (!ok) return;
            try { await deleteListItem(cfg.kind, item.id); draw(); } catch (e) { /* avviso già mostrato */ }
          } } }, icon('trash'))))));
    }
    listBox.appendChild(ul);
  }

  ctx.view.append(addForm, listBox);
  draw();
}

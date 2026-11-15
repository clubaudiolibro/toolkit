/**
 * components.js — pezzi di interfaccia riusati in più schermate:
 * modifica di serie/ripetizioni/peso (+ riscaldamento), scelta da un elenco, ordinamento a trascinamento.
 */
import { el, icon, norm, customSheet } from './ui.js';
import { updateItemValues, hasWarmup } from './store.js';

/* ---------------------------------------------------------------------
   Numeri
   --------------------------------------------------------------------- */

/** Peso in formato italiano (60,5). */
export const fmtKg = v => (v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','));

/** Riassunto compatto dei valori: "3 × 10 · 60 kg". */
export function valuesSummary(sets, reps, weight) {
  const a = [];
  if (sets != null || reps != null) a.push((sets ?? '–') + ' × ' + (reps ?? '–'));
  if (weight != null) a.push(fmtKg(weight) + ' kg');
  return a.join(' · ');
}

const PARSERS = {
  int: raw => {
    const s = raw.trim();
    if (!s) return { ok: true, value: null };
    return /^\d{1,3}$/.test(s) ? { ok: true, value: Number(s) } : { ok: false };
  },
  kg: raw => {
    const s = raw.trim().replace(',', '.');
    if (!s) return { ok: true, value: null };
    return /^\d{1,4}(\.\d{1,2})?$/.test(s) ? { ok: true, value: Number(s) } : { ok: false };
  },
};

/**
 * Casella numerica che salva da sola: dopo una breve pausa di digitazione e quando si esce dalla casella.
 * save(value) deve restituire una Promise; se fallisce la casella resta segnata come "non salvata".
 */
function numberField({ label, value, type, save, small }) {
  const input = el('input', {
    class: 'num', type: 'text', inputmode: type === 'kg' ? 'decimal' : 'numeric', autocomplete: 'off',
    value: type === 'kg' ? fmtKg(value) : (value ?? ''), 'aria-label': label, enterkeyhint: 'done',
  });
  let last = value ?? null;
  let timer = null;
  const commit = async () => {
    clearTimeout(timer);
    const p = PARSERS[type](input.value);
    if (!p.ok) { input.classList.add('invalid'); return; }
    input.classList.remove('invalid');
    if (p.value === last && !input.classList.contains('unsaved')) return;
    const before = last;
    last = p.value;
    try {
      await save(p.value);
      input.classList.remove('unsaved');
      input.classList.add('saved');
      setTimeout(() => input.classList.remove('saved'), 700);
    } catch (e) {
      last = before;
      input.classList.add('unsaved');
      // appena torna la rete riprova da solo
      window.addEventListener('online', () => { if (input.isConnected && input.classList.contains('unsaved')) commit(); }, { once: true });
    }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(commit, 900); });
  input.addEventListener('change', commit);
  input.addEventListener('blur', () => { if (input.classList.contains('unsaved')) commit(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  input.addEventListener('focus', () => input.select());
  return el('label', { class: 'val' + (small ? ' small' : '') }, el('span', { text: label }), input);
}

/**
 * Valori di un esercizio dentro un gruppo (kind 'group') o un allenamento (kind 'workout').
 * Ogni modifica si salva subito e diventa il valore di partenza della volta dopo.
 */
export function valuesEditor(kind, item) {
  const save = field => v => updateItemValues(kind, item.id, { [field]: v });
  const main = el('div', { class: 'vals' },
    numberField({ label: 'Serie', value: item.sets, type: 'int', save: save('sets') }),
    numberField({ label: 'Ripetizioni', value: item.reps, type: 'int', save: save('reps') }),
    numberField({ label: 'Peso kg', value: item.weight, type: 'kg', save: save('weight') }));

  const wuBox = el('div', { class: 'wu' });
  let open = hasWarmup(item);
  const draw = () => {
    wuBox.textContent = '';
    if (!open) {
      wuBox.appendChild(el('button', { type: 'button', class: 'link-btn', on: { click: () => { open = true; draw(); wuBox.querySelector('input').focus(); } } },
        icon('plus'), 'Riscaldamento'));
      return;
    }
    wuBox.append(
      el('div', { class: 'wu-head' },
        el('span', { class: 'wu-title', text: 'Riscaldamento' }),
        el('button', { type: 'button', class: 'link-btn muted', on: { click: async () => {
          try {
            if (hasWarmup(item)) await updateItemValues(kind, item.id, { wu_sets: null, wu_reps: null, wu_weight: null });
            open = false; draw();
          } catch (e) { /* avviso già mostrato */ }
        } } }, 'Togli')),
      el('div', { class: 'vals' },
        numberField({ label: 'Serie', value: item.wu_sets, type: 'int', save: save('wu_sets'), small: true }),
        numberField({ label: 'Ripetizioni', value: item.wu_reps, type: 'int', save: save('wu_reps'), small: true }),
        numberField({ label: 'Peso kg', value: item.wu_weight, type: 'kg', save: save('wu_weight'), small: true })));
  };
  draw();
  return el('div', { class: 'values' }, main, wuBox);
}

/* ---------------------------------------------------------------------
   Scelta da un elenco (foglio con ricerca)
   items: [{ id, name, sub, note }]  →  restituisce l'id scelto o null
   --------------------------------------------------------------------- */
export function pickFromList({ title, items, empty = 'Nessun elemento.', footer }) {
  return customSheet((sheet, close) => {
    const list = el('ul', { class: 'list pick-list' });
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Cerca', autocomplete: 'off', 'aria-label': 'Cerca',
      on: { input: () => draw() } });
    const draw = () => {
      const q = norm(search.value.trim());
      list.textContent = '';
      const shown = items.filter(it => !q || norm(it.name).includes(q));
      if (!shown.length) { list.appendChild(el('li', {}, el('p', { class: 'empty', text: items.length ? 'Nessun risultato.' : empty }))); return; }
      for (const it of shown) {
        list.appendChild(el('li', {}, el('button', { type: 'button', class: 'row', on: { click: () => close(it.id) } },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: it.name }),
            it.sub ? el('div', { class: 'row-sub', text: it.sub }) : null),
          it.note ? el('span', { class: 'tag', text: it.note }) : null)));
      }
    };
    sheet.classList.add('sheet-tall');
    sheet.append(
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title', text: title }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Chiudi', on: { click: () => close(null) } }, icon('close'))),
      items.length > 6 ? search : null,
      list,
      footer ? footer(close) : null);
    draw();
  }).then(v => v || null);
}

/** Menu di azioni (foglio): actions = [{ label, icon, danger, run }]. */
export function actionMenu(title, actions) {
  return customSheet((sheet, close) => {
    sheet.append(el('h2', { class: 'sheet-title', text: title }),
      el('ul', { class: 'list' }, actions.map(a => el('li', {},
        el('button', { type: 'button', class: 'row' + (a.danger ? ' danger' : ''), on: { click: () => close(a) } },
          el('span', { class: 'row-icon' + (a.danger ? ' danger' : '') }, icon(a.icon)),
          el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: a.label })))))),
      el('div', { class: 'sheet-actions' }, el('button', { type: 'button', class: 'btn', text: 'Annulla', on: { click: () => close(null) } })));
  }).then(a => { if (a) return a.run(); return undefined; });
}

/* ---------------------------------------------------------------------
   Ordinamento a trascinamento (SortableJS, copia locale in vendor/)
   La maniglia .drag-handle è l'unico punto da cui si trascina: lo scorrimento della pagina resta normale.
   --------------------------------------------------------------------- */
let sortablePromise = null;
function loadSortable() {
  if (window.Sortable) return Promise.resolve(window.Sortable);
  if (!sortablePromise) {
    sortablePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/Sortable.min.js', import.meta.url).href;
      s.onload = () => resolve(window.Sortable);
      s.onerror = () => { sortablePromise = null; reject(new Error('Impossibile caricare il trascinamento.')); };
      document.head.appendChild(s);
    });
  }
  return sortablePromise;
}

/** Rende trascinabili gli elementi (con data-id) di container. onSort(ids) salva il nuovo ordine. */
export async function makeSortable(container, onSort) {
  const Sortable = await loadSortable();
  return Sortable.create(container, {
    handle: '.drag-handle',
    animation: 160,
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    forceFallback: true,          // stesso comportamento su iPhone, Android e PC
    fallbackTolerance: 3,
    scroll: true,
    bubbleScroll: true,
    onEnd: async evt => {
      if (evt.oldIndex === evt.newIndex) return;
      const ids = [...container.children].map(n => n.dataset.id).filter(Boolean);
      await onSort(ids);
    },
  });
}

export function dragHandle(label) {
  return el('span', { class: 'drag-handle', role: 'img', 'aria-label': 'Trascina per spostare ' + (label || '') }, icon('grip'));
}

/* ---------------------------------------------------------------------
   Scheda di un esercizio con i suoi valori (in un gruppo o in un allenamento)
   --------------------------------------------------------------------- */
/**
 * opts: { exercise, kind ('group'|'workout'), item, sortable (mostra maniglia), onRemove (facoltativo) }
 */
export function exerciseCard({ exercise, kind, item, sortable, onRemove, removeLabel }) {
  return el('li', { class: 'item-card', dataset: { id: item.id } },
    el('div', { class: 'item-head' },
      sortable ? dragHandle(exercise.name) : null,
      el('span', { class: 'item-name', text: exercise.name }),
      onRemove ? el('button', { type: 'button', class: 'icon-btn muted', 'aria-label': removeLabel || ('Togli ' + exercise.name),
        on: { click: onRemove } }, icon('close')) : null),
    valuesEditor(kind, item));
}

/* ---------------------------------------------------------------------
   Stelline (1-5 intere)
   --------------------------------------------------------------------- */

/** Testo delle stelline: ★★★☆☆ (stringa vuota se nessuna). */
export const starsText = n => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');

/** Cinque stelle grandi da toccare. onChange(n) riceve 1-5. */
export function starsInput(value, onChange) {
  const box = el('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Valutazione' });
  const draw = v => {
    box.textContent = '';
    for (let i = 1; i <= 5; i++) {
      box.appendChild(el('button', {
        type: 'button', class: 'star' + (v && i <= v ? ' on' : ''), role: 'radio', 'aria-checked': String(v === i),
        'aria-label': i === 1 ? '1 stella' : i + ' stelle', text: '★',
        on: { click: () => { draw(i); onChange(i); } },
      }));
    }
  };
  draw(value || 0);
  return box;
}

/** Foglio per scegliere le stelline. Restituisce 1-5, 0 per "togli", oppure null se saltato/chiuso. */
export function askStars({ title, text, value = null, skipLabel = 'Salta', allowClear = false }) {
  return customSheet((sheet, close) => {
    sheet.append(
      el('h2', { class: 'sheet-title', text: title }),
      text ? el('p', { class: 'sheet-text', text }) : null,
      starsInput(value, n => setTimeout(() => close(n), 180)),
      el('div', { class: 'sheet-actions' },
        allowClear && value ? el('button', { type: 'button', class: 'btn', text: 'Togli stelle', on: { click: () => close(0) } }) : null,
        el('button', { type: 'button', class: 'btn', text: skipLabel, on: { click: () => close(null) } })));
  }).then(v => (typeof v === 'number' ? v : null));
}

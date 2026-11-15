/** exercises.js — elenco degli esercizi, con ricerca e filtro per gruppo muscolare. */
import { el, icon, norm } from '../ui.js';
import { state, activeExercises, exerciseMuscles, getEquipment } from '../store.js';
import { EFFICACY } from '../config.js';

// Filtri ricordati finché l'app resta aperta (tornando dalla scheda di un esercizio restano uguali)
const filters = { q: '', muscle: null };

export function effBadge(value) {
  const e = EFFICACY.find(x => x.value === value);
  return e ? el('span', { class: 'badge eff-' + e.value, title: 'Efficacia ' + e.label.toLowerCase(), text: e.label }) : null;
}

export function exerciseSubtitle(ex) {
  const parts = [];
  const m = exerciseMuscles(ex.id).map(x => x.name).join(', ');
  if (m) parts.push(m);
  const eq = getEquipment(ex.equipment_id);
  if (eq) parts.push(eq.name);
  return parts.join(' · ');
}

export function render(ctx) {
  ctx.setTitle('Esercizi');
  ctx.setActions(el('a', { class: 'icon-btn', href: '#/esercizi/nuovo', 'aria-label': 'Nuovo esercizio' },
    icon('plus'), el('span', { text: 'Nuovo' })));

  const all = activeExercises();
  if (!all.length) {
    ctx.view.appendChild(el('div', { class: 'placeholder' },
      icon('dumbbell'),
      el('strong', { text: 'Nessun esercizio' }),
      el('p', { text: 'Crea il primo esercizio del tuo database.' }),
      el('a', { class: 'btn btn-primary', href: '#/esercizi/nuovo' }, icon('plus'), 'Nuovo esercizio')));
    return;
  }

  if (filters.muscle && !state.muscles.some(m => m.id === filters.muscle)) filters.muscle = null;

  const listBox = el('div');
  const search = el('input', {
    type: 'search', placeholder: 'Cerca esercizio', value: filters.q, 'aria-label': 'Cerca esercizio',
    autocomplete: 'off', enterkeyhint: 'search',
    on: { input: () => { filters.q = search.value; draw(); } },
  });

  const usedMuscles = state.muscles.filter(m => all.some(ex => (state.exMuscles.get(ex.id) || new Set()).has(m.id)));
  const chips = el('div', { class: 'chips scroll', role: 'toolbar', 'aria-label': 'Filtra per gruppo muscolare' });
  const drawChips = () => {
    chips.textContent = '';
    const mk = (id, label) => el('button', {
      type: 'button', class: 'chip', text: label, 'aria-pressed': String(filters.muscle === id),
      on: { click: () => { filters.muscle = id; drawChips(); draw(); } },
    });
    chips.appendChild(mk(null, 'Tutti'));
    usedMuscles.forEach(m => chips.appendChild(mk(m.id, m.name)));
  };

  function draw() {
    const q = norm(filters.q.trim());
    const items = all.filter(ex => {
      if (filters.muscle && !(state.exMuscles.get(ex.id) || new Set()).has(filters.muscle)) return false;
      return !q || norm(ex.name).includes(q);
    });
    listBox.textContent = '';
    if (!items.length) { listBox.appendChild(el('p', { class: 'empty', text: 'Nessun esercizio trovato.' })); return; }
    const ul = el('ul', { class: 'list' });
    for (const ex of items) {
      const sub = exerciseSubtitle(ex);
      ul.appendChild(el('li', {},
        el('a', { class: 'row', href: '#/esercizi/' + ex.id },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: ex.name }),
            sub ? el('div', { class: 'row-sub', text: sub }) : null),
          effBadge(ex.efficacy),
          icon('chevron', 'ico chev'))));
    }
    listBox.appendChild(el('p', { class: 'hint', text: items.length === 1 ? '1 esercizio' : items.length + ' esercizi' }));
    listBox.appendChild(ul);
  }

  ctx.view.append(
    el('label', { class: 'search' }, icon('search'), search),
    usedMuscles.length ? chips : null,
    listBox);
  drawChips();
  draw();
}

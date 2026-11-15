/**
 * run.js — esecuzione di un allenamento: valori dell'ultima volta modificabili al volo, note,
 * spunte (salvate sul telefono) e «Allenamento completato».
 */
import { el, icon, toast, confirmDialog, todayIso, fmtDate } from '../ui.js';
import { getWorkout, workoutItems, getGroup, groupItems, getExercise, updateExerciseNotes, addDiaryEntry, setDiaryStars } from '../store.js';
import { valuesEditor, actionMenu, askStars } from '../components.js';
import { getChecked, setChecked, clearProgress } from '../progress.js';
import { hold, release } from '../wakelock.js';

/** Note dell'esercizio, modificabili da qui (si salvano subito e valgono ovunque). */
function notesEditor(ex) {
  const box = el('div', { class: 'notes' });
  let editing = false;
  const draw = () => {
    box.textContent = '';
    if (!editing) {
      box.appendChild(ex.notes
        ? el('button', { type: 'button', class: 'notes-view', on: { click: () => { editing = true; draw(); } } },
          el('span', { class: 'notes-label', text: 'Note' }), el('span', { class: 'notes-text', text: ex.notes }))
        : el('button', { type: 'button', class: 'link-btn', on: { click: () => { editing = true; draw(); } } }, icon('plus'), 'Nota'));
      return;
    }
    const ta = el('textarea', { class: 'input', value: ex.notes || '', placeholder: 'Es. sedile al 4, gomiti stretti', 'aria-label': 'Note di ' + ex.name });
    const save = async () => {
      const v = ta.value.trim();
      if (v === (ex.notes || '')) { editing = false; draw(); return; }
      try { await updateExerciseNotes(ex.id, v); editing = false; draw(); toast('Nota salvata', 'ok'); }
      catch (e) { ta.classList.add('invalid'); }
    };
    box.append(ta, el('div', { class: 'notes-actions' },
      el('button', { type: 'button', class: 'btn btn-sm', text: 'Annulla', on: { click: () => { editing = false; draw(); } } }),
      el('button', { type: 'button', class: 'btn btn-sm btn-primary', text: 'Salva nota', on: { click: save } })));
    setTimeout(() => ta.focus(), 30);
  };
  draw();
  return box;
}

export async function render(ctx) {
  const w = getWorkout(ctx.params[0]);
  ctx.setBack('#/oggi');
  if (!w || w.deleted_at) {
    ctx.setTitle('Allenamento');
    ctx.view.appendChild(el('div', { class: 'placeholder' }, el('strong', { text: 'Allenamento non trovato' }),
      el('a', { class: 'btn', href: '#/oggi', text: 'Torna a Oggi' })));
    return;
  }
  ctx.setTitle(w.name);
  hold('run');                                   // schermo sempre acceso durante l'allenamento
  ctx.onLeave(() => release('run'));
  ctx.setActions(el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Altre azioni', on: { click: () => actionMenu(w.name, [
    { label: 'Modifica l\'allenamento', icon: 'edit', run: () => ctx.go('#/allenamenti/' + w.id) },
    { label: 'Togli tutte le spunte', icon: 'restore', run: async () => {
      if (!(await confirmDialog({ title: 'Togliere tutte le spunte?', ok: 'Togli' }))) return;
      clearProgress(w.id); ctx.rerender();
    } },
  ]) } }, icon('more')));

  const checked = getChecked(w.id);
  const checkboxes = [];
  const counter = el('span');

  // Elenco piatto delle schede, per contare le spunte
  const card = (key, ex, kind, item) => {
    const box = el('button', { type: 'button', class: 'check', role: 'checkbox', 'aria-label': 'Fatto: ' + ex.name });
    const li = el('li', { class: 'item-card run-card' });
    const set = on => {
      box.setAttribute('aria-checked', String(on));
      li.classList.toggle('done', on);
    };
    set(checked.has(key));
    box.addEventListener('click', () => {
      const on = box.getAttribute('aria-checked') !== 'true';
      set(on);
      setChecked(w.id, key, on);
      if (on) checked.add(key); else checked.delete(key);
      updateCounter();
    });
    checkboxes.push({ key, set });
    li.append(
      el('div', { class: 'item-head' }, box, el('span', { class: 'item-name', text: ex.name })),
      valuesEditor(kind, item),
      notesEditor(ex));
    return li;
  };

  const list = el('ul', { class: 'cards' });
  for (const it of workoutItems(w.id)) {
    if (it.kind === 'group') {
      const g = getGroup(it.group_id);
      const inner = el('ul', { class: 'cards nested' });
      for (const gi of groupItems(g.id)) inner.appendChild(card('g:' + gi.id, getExercise(gi.exercise_id), 'group', gi));
      list.appendChild(el('li', { class: 'group-block' },
        el('div', { class: 'item-head group-head' }, el('span', { class: 'group-label' }, icon('folder'), el('span', { text: g.name }))),
        inner));
    } else {
      list.appendChild(card('w:' + it.id, getExercise(it.exercise_id), 'workout', it));
    }
  }

  const total = checkboxes.length;
  const updateCounter = () => {
    const n = checkboxes.filter(c => checked.has(c.key)).length;
    counter.textContent = total ? n + ' di ' + total + ' fatti' : '';
  };
  updateCounter();

  if (!total) {
    ctx.view.appendChild(el('div', { class: 'placeholder' }, el('strong', { text: 'Allenamento vuoto' }),
      el('p', { text: 'Aggiungi gruppi o esercizi prima di iniziare.' }),
      el('a', { class: 'btn btn-primary', href: '#/allenamenti/' + w.id, text: 'Modifica l\'allenamento' })));
    return;
  }

  const doneBtn = el('button', { type: 'button', class: 'btn btn-primary btn-big', on: { click: async () => {
    doneBtn.disabled = true;
    checkboxes.forEach(c => c.set(true));
    try {
      const entry = await addDiaryEntry({ day: todayIso(), workout_id: w.id });
      clearProgress(w.id);
      toast('«' + w.name + '» registrato nel diario', 'ok');
      const stars = await askStars({ title: 'Com\'è andata?', text: w.name + ' · ' + fmtDate(entry.day) + '. Puoi saltare e aggiungere le stelline dopo dal diario.' });
      if (stars) { try { await setDiaryStars(entry.id, stars); } catch (e) { /* avviso già mostrato */ } }
      ctx.go('#/oggi');
    } catch (e) {
      // salvataggio non riuscito: le spunte vere restano quelle di prima
      checkboxes.forEach(c => c.set(checked.has(c.key)));
      doneBtn.disabled = false;
    }
  } } }, icon('check'), 'Allenamento completato');

  ctx.view.append(
    el('p', { class: 'hint run-hint' }, counter, ' · i valori si salvano subito e saranno quelli di partenza della prossima volta'),
    list,
    el('div', { class: 'form-actions' }, doneBtn));
}

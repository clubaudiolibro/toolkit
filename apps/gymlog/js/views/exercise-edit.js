/** exercise-edit.js — scheda di un esercizio (nuovo o esistente). */
import { el, icon, toast, confirmDialog, promptDialog } from '../ui.js';
import { state, getExercise, createExercise, updateExercise, trashExercise, addListItem, exerciseUsage } from '../store.js';
import { EFFICACY } from '../config.js';

/** Restituisce l'URL se è un indirizzo web valido (aggiunge https:// se manca), altrimenti null. */
export function safeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null; }
  catch (e) { return null; }
}

export function render(ctx) {
  const id = ctx.params[0] || null;
  const ex = id ? getExercise(id) : null;
  if (id && (!ex || ex.deleted_at)) {
    ctx.setTitle('Esercizio');
    ctx.setBack('#/esercizi');
    ctx.view.appendChild(el('div', { class: 'placeholder' },
      el('strong', { text: 'Esercizio non trovato' }),
      el('p', { text: 'Forse è nel cestino.' }),
      el('a', { class: 'btn', href: '#/altro/cestino', text: 'Apri il cestino' })));
    return;
  }

  ctx.setTitle(ex ? 'Modifica esercizio' : 'Nuovo esercizio');
  ctx.setBack('#/esercizi');

  // Stato del modulo
  const f = {
    name: ex ? ex.name : '',
    muscle_ids: new Set(ex ? [...(state.exMuscles.get(ex.id) || [])] : []),
    equipment_id: ex ? ex.equipment_id : null,
    efficacy: ex ? ex.efficacy : null,
    description: ex ? ex.description || '' : '',
    video_url: ex ? ex.video_url || '' : '',
    notes: ex ? ex.notes || '' : '',
  };
  const initial = JSON.stringify({ ...f, muscle_ids: [...f.muscle_ids].sort() });
  const snapshot = () => JSON.stringify({ ...f, muscle_ids: [...f.muscle_ids].sort() });
  let saving = false;
  ctx.setLeaveGuard(() => !saving && snapshot() !== initial);

  /* --- Nome --- */
  const name = el('input', {
    class: 'input', type: 'text', value: f.name, placeholder: 'Es. Panca piana', autocomplete: 'off',
    autocapitalize: 'sentences', id: 'ex-name', on: { input: () => { f.name = name.value; } },
  });

  /* --- Gruppi muscolari (più di uno) --- */
  const musclesBox = el('div', { class: 'chips' });
  const drawMuscles = () => {
    musclesBox.textContent = '';
    for (const m of state.muscles) {
      musclesBox.appendChild(el('button', {
        type: 'button', class: 'chip', text: m.name, 'aria-pressed': String(f.muscle_ids.has(m.id)),
        on: { click: () => { f.muscle_ids.has(m.id) ? f.muscle_ids.delete(m.id) : f.muscle_ids.add(m.id); drawMuscles(); } },
      }));
    }
    musclesBox.appendChild(el('button', {
      type: 'button', class: 'chip add', on: { click: async () => {
        const n = await promptDialog({ title: 'Nuovo gruppo muscolare', placeholder: 'Es. Avambracci', ok: 'Aggiungi' });
        if (!n) return;
        const existing = state.muscles.find(m => m.name.toLowerCase() === n.toLowerCase());
        try {
          const m = existing || await addListItem('muscles', n);
          f.muscle_ids.add(m.id);
          drawMuscles();
        } catch (e) { /* avviso già mostrato */ }
      } },
    }, icon('plus'), 'Aggiungi'));
  };

  /* --- Attrezzo (uno solo) --- */
  const eqBox = el('div', { class: 'chips' });
  const drawEq = () => {
    eqBox.textContent = '';
    for (const q of state.equipment) {
      eqBox.appendChild(el('button', {
        type: 'button', class: 'chip', text: q.name, 'aria-pressed': String(f.equipment_id === q.id),
        on: { click: () => { f.equipment_id = f.equipment_id === q.id ? null : q.id; drawEq(); } },
      }));
    }
    eqBox.appendChild(el('button', {
      type: 'button', class: 'chip add', on: { click: async () => {
        const n = await promptDialog({ title: 'Nuovo attrezzo', placeholder: 'Es. Cavi', ok: 'Aggiungi' });
        if (!n) return;
        const existing = state.equipment.find(q => q.name.toLowerCase() === n.toLowerCase());
        try {
          const q = existing || await addListItem('equipment', n);
          f.equipment_id = q.id;
          drawEq();
        } catch (e) { /* avviso già mostrato */ }
      } },
    }, icon('plus'), 'Aggiungi'));
  };

  /* --- Efficacia --- */
  const effBox = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Efficacia' });
  const drawEff = () => {
    effBox.textContent = '';
    for (const e of EFFICACY) {
      effBox.appendChild(el('button', {
        type: 'button', class: 'chip', text: e.label, 'aria-pressed': String(f.efficacy === e.value),
        on: { click: () => { f.efficacy = f.efficacy === e.value ? null : e.value; drawEff(); } },
      }));
    }
  };

  /* --- Testi --- */
  const description = el('textarea', { class: 'input', value: f.description, placeholder: 'Come si esegue', on: { input: () => { f.description = description.value; } } });
  const notes = el('textarea', { class: 'input', value: f.notes, placeholder: 'Es. tenere i gomiti stretti', on: { input: () => { f.notes = notes.value; } } });

  /* --- Video --- */
  const openVideo = el('a', { class: 'btn', target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Apri il video' }, icon('video'), 'Apri');
  const video = el('input', {
    class: 'input', type: 'url', inputmode: 'url', value: f.video_url, placeholder: 'https://youtube.com/…',
    autocapitalize: 'off', spellcheck: 'false',
    on: { input: () => { f.video_url = video.value; updateVideo(); } },
  });
  const updateVideo = () => {
    const u = safeUrl(f.video_url);
    openVideo.hidden = !u;
    if (u) openVideo.href = u;
  };

  /* --- Salvataggio --- */
  const saveBtn = el('button', { type: 'submit', class: 'btn btn-primary', text: ex ? 'Salva modifiche' : 'Crea esercizio' });
  const form = el('form', { class: 'form', novalidate: true, on: { submit: async e => {
    e.preventDefault();
    if (!f.name.trim()) { toast('Scrivi il nome dell\'esercizio.', 'error'); name.focus(); return; }
    if (f.video_url.trim() && !safeUrl(f.video_url)) { toast('Il link del video non è valido.', 'error'); video.focus(); return; }
    const dup = state.exercises.find(x => !x.deleted_at && x.id !== id && x.name.trim().toLowerCase() === f.name.trim().toLowerCase());
    if (dup && !(await confirmDialog({ title: 'Nome già usato', text: 'Esiste già un esercizio chiamato «' + dup.name + '». Salvare comunque?', ok: 'Salva' }))) return;
    const data = { ...f, video_url: safeUrl(f.video_url) || '', muscle_ids: [...f.muscle_ids] };
    saving = true;
    saveBtn.disabled = true;
    try {
      if (ex) await updateExercise(ex.id, data); else await createExercise(data);
      toast(ex ? 'Modifiche salvate' : 'Esercizio creato', 'ok');
      ctx.go('#/esercizi');
    } catch (err) {
      saving = false;
      saveBtn.disabled = false;
    }
  } } },
    el('div', { class: 'field' }, el('label', { class: 'field-label', for: 'ex-name', text: 'Nome' }), name),
    el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Gruppi muscolari' }), musclesBox),
    el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Attrezzo' }), eqBox),
    el('div', { class: 'field' }, el('span', { class: 'field-label', html: 'Efficacia <span class="opt">(tocca di nuovo per togliere)</span>' }), effBox),
    el('div', { class: 'field' }, el('span', { class: 'field-label', html: 'Video <span class="opt">(facoltativo)</span>' }), el('div', { class: 'inline' }, video, openVideo)),
    el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Descrizione' }), description),
    el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Note' }), notes),
    el('div', { class: 'form-actions' }, saveBtn));

  if (ex) {
    const u = exerciseUsage(ex.id);
    const where = [...u.groups.map(g => 'gruppo ' + g.name), ...u.workouts.map(w => w.name)];
    ctx.view.appendChild(el('p', { class: 'hint', text: where.length ? 'Usato in: ' + where.join(', ') + '.' : 'Non ancora usato in gruppi o allenamenti.' }));
  }
  ctx.view.appendChild(form);

  if (ex) {
    ctx.view.appendChild(el('div', { class: 'danger-zone' },
      el('button', { type: 'button', class: 'btn btn-block btn-ghost-danger', on: { click: async () => {
        const ok = await confirmDialog({
          title: 'Spostare nel cestino?',
          text: '«' + ex.name + '» sparirà da elenchi, gruppi e allenamenti. Potrai ripristinarlo dal cestino con tutti i suoi valori.',
          ok: 'Sposta nel cestino', danger: true,
        });
        if (!ok) return;
        try {
          await trashExercise(ex.id);
          saving = true;
          toast('Esercizio spostato nel cestino', 'ok');
          ctx.go('#/esercizi');
        } catch (e) { /* avviso già mostrato */ }
      } } }, icon('trash'), 'Sposta nel cestino')));
  }

  drawMuscles();
  drawEq();
  drawEff();
  updateVideo();
  if (!ex) setTimeout(() => name.focus(), 50);
}

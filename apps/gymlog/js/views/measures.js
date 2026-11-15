/**
 * measures.js — Altro → Misure corporee: peso e circonferenze (lato destro), un grafico, storico.
 * Il peso si inserisce spesso, le circonferenze più di rado: tutti i campi sono facoltativi.
 */
import { el, icon, toast, confirmDialog, fmtDate, todayIso } from '../ui.js';
import { MEASURES, MEASURE_REMIND } from '../config.js';
import {
  state, measurementOn, measurementsSorted, saveMeasurement, deleteMeasurement, measureStatus,
} from '../store.js';
import { bodyFigure } from '../body-figure.js';
import { lineChart } from '../chart.js';

const fmt = v => (v == null ? '' : (Math.round(v * 10) / 10).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 1 }));
const toInput = v => (v == null ? '' : String(v).replace('.', ','));
const dayMs = day => new Date(day + 'T12:00:00').getTime();
const unitOf = key => MEASURES.find(m => m.key === key).unit;

/** Valore scritto a mano → numero con un decimale, null se vuoto, undefined se non valido. */
function parseValue(raw, m) {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return undefined;
  const n = Math.round(Number(s) * 10) / 10;
  return n >= m.min && n <= m.max ? n : undefined;
}

/* ---------------------------------------------------------------------
   Promemoria (usato anche in Oggi)
   --------------------------------------------------------------------- */

/** Riquadro «Misure da fare» se il peso manca da più di 15 giorni o le circonferenze da più di 30; altrimenti null. */
export function measureBanner({ link = true } = {}) {
  const s = measureStatus();
  if (!s.weight.due && !s.circ.due) return null;
  const lines = [];
  if (s.weight.due) {
    lines.push(s.weight.days == null ? 'Peso: nessuna misura inserita finora'
      : 'Peso: ultimo inserito ' + (s.weight.days === 1 ? 'ieri' : s.weight.days + ' giorni fa'));
  }
  if (s.circ.due) {
    lines.push(s.circ.days == null ? 'Circonferenze: nessuna misura inserita finora'
      : 'Circonferenze: ultime inserite ' + (s.circ.days === 1 ? 'ieri' : s.circ.days + ' giorni fa'));
  }
  const text = el('div', { class: 'row-main' },
    el('div', { class: 'backup-label', text: 'Misure da fare' }),
    lines.map(t => el('div', { class: 'row-title', text: t })),
    el('div', { class: 'row-sub', text: 'Promemoria dopo ' + MEASURE_REMIND.weight + ' giorni per il peso e ' + MEASURE_REMIND.circ + ' per le circonferenze.' }));
  const cls = 'backup-banner overdue';
  if (!link) return el('div', { class: cls }, el('span', { class: 'row-icon' }, icon('ruler')), text);
  return el('a', { class: cls, href: '#/altro/misure' },
    el('span', { class: 'row-icon' }, icon('ruler')), text,
    el('span', { class: 'btn btn-sm', text: 'Inserisci' }));
}

/** Testo per la riga «Misure» in Altro. */
export function measureSubtitle() {
  const s = measureStatus();
  if (!state.measurements.length) return 'Peso e circonferenze: nessuna misura';
  if (s.weight.due || s.circ.due) return 'Da aggiornare: ' + [s.weight.due ? 'peso' : null, s.circ.due ? 'circonferenze' : null].filter(Boolean).join(' e ');
  return 'Peso e circonferenze, con il grafico';
}

/* ---------------------------------------------------------------------
   Form
   --------------------------------------------------------------------- */

function buildForm(ctx) {
  const inputs = {};
  const fieldBoxes = {};

  const dateInput = el('input', { type: 'date', class: 'input', value: todayIso(), max: todayIso(), 'aria-label': 'Data della misura' });
  const note = el('p', { class: 'hint', style: 'margin:4px 0 0' });

  const makeField = m => {
    const input = el('input', {
      class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done',
      id: 'meas-' + m.key, placeholder: m.unit, 'aria-label': m.label + ' (' + m.unit + ')',
    });
    inputs[m.key] = input;
    const box = el('div', { class: 'field' },
      el('label', { class: 'field-label', for: 'meas-' + m.key, text: m.label + ' (' + m.unit + ')' }), input);
    fieldBoxes[m.key] = box;
    return box;
  };

  const weightField = makeField(MEASURES[0]);
  const circMeasures = MEASURES.filter(m => m.kind === 'circ');
  const circFields = circMeasures.map(makeField);

  const figure = bodyFigure({
    onPick: key => {
      const input = inputs[key];
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input.focus();
      fieldBoxes[key].classList.add('hl');
      setTimeout(() => fieldBoxes[key].classList.remove('hl'), 1600);
    },
  });
  for (const m of circMeasures) {
    inputs[m.key].addEventListener('focus', () => figure.setActive(m.key));
    inputs[m.key].addEventListener('blur', () => figure.setActive(null));
  }

  const details = el('details', { class: 'circ' },
    el('summary', {}, el('span', { text: 'Circonferenze (lato destro)' }), icon('chevron', 'ico chev')),
    el('p', { class: 'hint', style: 'margin:4px 0 8px', text: 'Tocca la «i» accanto a ogni punto per vedere come misurare. Tocca la fascia colorata per andare al campo.' }),
    figure.node,
    el('div', { class: 'fields-2' }, circFields),
    el('p', { class: 'hint', text: 'Sempre il lato destro (nella figura è a sinistra, perché la persona ti guarda). Al mattino, muscolo rilassato, non subito dopo l’allenamento. Metro aderente senza stringere: fai 2-3 misure e inserisci la media.' }));

  function fillFrom(day) {
    const rec = measurementOn(day);
    for (const m of MEASURES) inputs[m.key].value = rec ? toInput(rec[m.key]) : '';
    for (const m of MEASURES) inputs[m.key].classList.remove('invalid');
    note.textContent = rec ? 'Per questo giorno ci sono già delle misure: stai modificando quelle.' : '';
    if (rec && circMeasures.some(m => rec[m.key] != null)) details.open = true;
  }
  dateInput.addEventListener('change', () => { if (dateInput.value) fillFrom(dateInput.value); });

  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary btn-block', on: { click: onSave } }, icon('check'), el('span', { text: 'Salva misure' }));

  async function onSave() {
    const day = dateInput.value;
    if (!day) { toast('Scegli la data.', 'error'); dateInput.focus(); return; }
    if (day > todayIso()) { toast('La data non può essere nel futuro.', 'error'); dateInput.focus(); return; }
    const values = {};
    for (const m of MEASURES) {
      const v = parseValue(inputs[m.key].value, m);
      if (v === undefined) {
        inputs[m.key].classList.add('invalid');
        if (m.kind === 'circ') details.open = true;
        inputs[m.key].focus();
        toast(m.label + ': scrivi un numero tra ' + m.min + ' e ' + m.max + ' (' + m.unit + ').', 'error');
        return;
      }
      inputs[m.key].classList.remove('invalid');
      values[m.key] = v;
    }
    if (MEASURES.every(m => values[m.key] == null)) { toast('Inserisci almeno un valore.', 'error'); return; }
    saveBtn.disabled = true;
    try {
      await saveMeasurement(day, values);
      toast('Misure salvate.', 'ok');
      ctx.rerender();
    } catch (e) { /* avviso già mostrato */ }
    saveBtn.disabled = false;
  }

  const card = el('section', { class: 'card pad', id: 'meas-form' },
    el('h2', { class: 'card-title' }, icon('plus'), 'Nuova misura'),
    el('div', { class: 'field' }, el('label', { class: 'field-label', for: 'meas-date', text: 'Data' }), dateInput),
    note,
    el('div', { class: 'field', style: 'margin-top:12px' }, weightField.querySelector('label'), inputs.weight),
    el('p', { class: 'hint', style: 'margin:6px 0 0', text: 'Pesati sempre nelle stesse condizioni (per esempio al mattino, a digiuno, dopo il bagno): conta la tendenza, non il singolo valore.' }),
    details,
    el('div', { class: 'stack' }, saveBtn));
  dateInput.id = 'meas-date';

  const edit = rec => {
    dateInput.value = rec.day;
    fillFrom(rec.day);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Modifica le misure del ' + fmtDate(rec.day) + '.');
  };

  fillFrom(dateInput.value);
  // se le circonferenze sono da rifare, il gruppo è già aperto
  if (measureStatus().circ.due) details.open = true;
  return { card, edit, closeTip: figure.closeTip };
}

/* ---------------------------------------------------------------------
   Grafico
   --------------------------------------------------------------------- */

/** Lunedì della settimana di un giorno. */
function mondayOf(day) {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return todayIso(d);
}

/** Punti del grafico: il peso è la media di ogni settimana, le circonferenze sono le singole misure. */
function seriesFor(key) {
  const unit = unitOf(key);
  const rows = state.measurements.filter(m => m[key] != null).sort((a, b) => a.day.localeCompare(b.day));
  if (key !== 'weight') {
    return rows.map(m => ({ t: dayMs(m.day), v: m[key], day: m.day, title: fmtDate(m.day), detail: fmt(m[key]) + ' ' + unit }));
  }
  const weeks = new Map();
  for (const m of rows) {
    const wk = mondayOf(m.day);
    if (!weeks.has(wk)) weeks.set(wk, []);
    weeks.get(wk).push(m[key]);
  }
  return [...weeks].map(([wk, list]) => {
    const avg = list.reduce((s, v) => s + v, 0) / list.length;
    return {
      t: dayMs(wk), v: avg, day: wk, title: 'Settimana dal ' + fmtDate(wk),
      detail: fmt(avg) + ' ' + unit + ' · media di ' + list.length + (list.length === 1 ? ' pesata' : ' pesate'),
    };
  });
}

function buildChart() {
  let key = 'weight';
  let selected = null;
  const card = el('section', { class: 'card pad' });
  const chips = el('div', { class: 'chips scroll', role: 'group', 'aria-label': 'Misura da mostrare' });
  const body = el('div');
  card.append(el('h2', { class: 'card-title' }, icon('stats'), 'Andamento'), chips, body);

  const draw = () => {
    chips.textContent = '';
    for (const m of MEASURES) {
      chips.appendChild(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(m.key === key), text: m.label,
        on: { click: () => { key = m.key; selected = null; draw(); } },
      }));
    }
    body.textContent = '';
    const unit = unitOf(key);
    const pts = seriesFor(key);
    if (pts.length < 2) {
      body.appendChild(el('p', { class: 'hint', text: pts.length
        ? 'C’è una sola misura: ne servono almeno due per vedere l’andamento.'
        : 'Nessuna misura inserita per «' + MEASURES.find(m => m.key === key).label + '».' }));
      if (pts.length) body.appendChild(el('p', { class: 'chart-readout', text: pts[0].title + ' · ' + pts[0].detail }));
      return;
    }
    if (selected == null || selected >= pts.length) selected = pts.length - 1;
    body.append(
      lineChart({ points: pts, selected, label: 'Andamento: ' + MEASURES.find(m => m.key === key).label,
        onSelect: i => { selected = i; draw(); } }),
      el('p', { class: 'chart-readout', text: pts[selected].title + ' · ' + pts[selected].detail }));
    const a = pts[0], b = pts[pts.length - 1];
    const diff = Math.round((b.v - a.v) * 10) / 10;
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
    body.appendChild(el('p', { class: 'chart-sub',
      text: 'Da ' + fmt(a.v) + ' ' + unit + ' (' + fmtDate(a.day) + ') a ' + fmt(b.v) + ' ' + unit + ' (' + fmtDate(b.day) + '): '
        + sign + fmt(Math.abs(diff)) + ' ' + unit
        + (key === 'weight' ? '. Il grafico mostra la media di ogni settimana.' : '.') }));
  };
  draw();
  return card;
}

/* ---------------------------------------------------------------------
   Storico
   --------------------------------------------------------------------- */

function summaryOf(rec) {
  const parts = [];
  if (rec.weight != null) parts.push(fmt(rec.weight) + ' kg');
  for (const m of MEASURES) if (m.kind === 'circ' && rec[m.key] != null) parts.push(m.label.toLowerCase() + ' ' + fmt(rec[m.key]));
  return parts.join(' · ');
}

function buildHistory(ctx, onEdit) {
  const all = measurementsSorted();
  if (!all.length) return null;
  const LIMIT = 15;
  let showAll = false;
  const box = el('div');
  const draw = () => {
    box.textContent = '';
    const shown = showAll ? all : all.slice(0, LIMIT);
    box.appendChild(el('ul', { class: 'list' }, shown.map(rec => el('li', {},
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'row-main hist-main', 'aria-label': 'Modifica le misure del ' + fmtDate(rec.day), on: { click: () => onEdit(rec) } },
          el('div', { class: 'row-title', text: fmtDate(rec.day) }),
          el('div', { class: 'row-sub', text: summaryOf(rec) })),
        el('button', { type: 'button', class: 'icon-btn muted', 'aria-label': 'Elimina le misure del ' + fmtDate(rec.day), on: { click: async () => {
          const ok = await confirmDialog({ title: 'Eliminare queste misure?', text: fmtDate(rec.day) + ': ' + summaryOf(rec) + '.', ok: 'Elimina', danger: true });
          if (!ok) return;
          try { await deleteMeasurement(rec.id); toast('Misure eliminate.', 'ok'); ctx.rerender(); } catch (e) { /* avviso già mostrato */ }
        } } }, icon('trash')))))));
    if (all.length > LIMIT && !showAll) {
      box.appendChild(el('button', { type: 'button', class: 'btn btn-block', style: 'margin-top:10px', text: 'Mostra tutte (' + all.length + ')', on: { click: () => { showAll = true; draw(); } } }));
    }
  };
  draw();
  return box;
}

export function render(ctx) {
  ctx.setTitle('Misure corporee');
  ctx.setBack('#/altro');
  ctx.onLeave(() => form.closeTip());
  const banner = measureBanner({ link: false });
  const form = buildForm(ctx);
  const history = buildHistory(ctx, form.edit);
  ctx.view.append(...[
    banner,
    form.card,
    buildChart(),
    history ? el('h2', { class: 'section-title', text: 'Storico' }) : null,
    history,
  ].filter(Boolean));
}

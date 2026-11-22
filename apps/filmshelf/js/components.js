/**
 * components.js — pezzi di interfaccia riusati in più schermate:
 * locandina, controllo del voto, scelta dei tag, modulo «Visto».
 */
import { el, icon, customSheet, promptDialog, toast, todayIso, fmtVoto } from './ui.js';
import { posterUrl } from './tmdb.js';
import { TMDB } from './config.js';
import * as tags from './tags.js';
import * as store from './store.js';

/**
 * Locandina con caricamento pigro (lazy). Senza locandina, o senza rete, mostra un riquadro
 * con l'icona della pellicola al posto dell'immagine.
 */
export function poster(path, { size = TMDB.thumb, cls = 'poster', alt = '' } = {}) {
  const box = el('div', { class: cls });
  const fallback = () => { box.textContent = ''; box.classList.add('no-img'); box.appendChild(icon('film')); };
  const url = posterUrl(path, size);
  if (!url) { fallback(); return box; }
  box.appendChild(el('img', {
    src: url, alt, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
    on: { error: fallback },
  }));
  return box;
}

/** Riga di titolo per i fogli: piccola locandina, titolo, anno e titolo originale. */
export function filmHead(f) {
  const orig = f.titolo_originale && f.titolo_originale !== f.titolo_it ? f.titolo_originale : null;
  return el('div', { class: 'film-head' },
    poster(f.poster_path, { cls: 'poster poster-sm' }),
    el('div', { class: 'film-head-text' },
      el('div', { class: 'film-head-title', text: f.titolo_it }),
      el('div', { class: 'row-sub', text: [f.anno, orig].filter(Boolean).join(' · ') })));
}

/**
 * Controllo del voto (1–10 a passi di 0,5, oppure nessun voto).
 * Restituisce { node, get() } dove get() dà il numero o null.
 */
export function votoInput(initial = null) {
  let value = initial == null || initial === '' ? null : Number(initial);
  const out = el('output', { class: 'voto-value' });
  const range = el('input', {
    type: 'range', min: '1', max: '10', step: '0.5', class: 'voto-range', 'aria-label': 'Voto da 1 a 10',
    on: { input: () => { value = Number(range.value); update(); } },
  });
  const step = d => { value = value == null ? (d > 0 ? 6 : 5) : Math.min(10, Math.max(1, value + d)); update(); };
  const clear = el('button', { type: 'button', class: 'link-btn muted', text: 'Togli il voto', on: { click: () => { value = null; update(); } } });
  function update() {
    out.textContent = value == null ? '—' : fmtVoto(value);
    out.classList.toggle('empty', value == null);
    range.value = value == null ? '6' : String(value);
    range.classList.toggle('unset', value == null);
    clear.hidden = value == null;
  }
  const node = el('div', { class: 'voto' },
    el('div', { class: 'voto-row' },
      el('button', { type: 'button', class: 'btn voto-step', 'aria-label': 'Mezzo punto in meno', text: '−', on: { click: () => step(-0.5) } }),
      el('div', { class: 'voto-display' }, out, el('span', { class: 'voto-max', text: '/ 10' })),
      el('button', { type: 'button', class: 'btn voto-step', 'aria-label': 'Mezzo punto in più', text: '+', on: { click: () => step(0.5) } })),
    range, clear);
  update();
  return { node, get: () => value };
}

/**
 * Scelta multipla dei tag, con il pulsante «+» per crearne di nuovi.
 * Restituisce { node, addBtn, get() }: node sono le pillole, addBtn il «+» da mettere accanto all'etichetta,
 * get() l'array dei tag scelti (nell'ordine dell'elenco).
 */
export function tagInput(initial = []) {
  const chosen = new Set(initial || []);
  const node = el('div', { class: 'chips' });

  function draw() {
    node.textContent = '';
    for (const t of tags.all()) {
      node.appendChild(el('button', {
        type: 'button', class: 'chip', text: t, 'aria-pressed': String(chosen.has(t)),
        on: { click: e => { chosen.has(t) ? chosen.delete(t) : chosen.add(t); e.currentTarget.setAttribute('aria-pressed', String(chosen.has(t))); } },
      }));
    }
  }

  async function create() {
    if (store.isOffline()) { toast('Senza connessione non si possono creare tag.', 'error'); return; }
    const name = await promptDialog({ title: 'Nuovo tag', label: 'Nome del tag', placeholder: 'Es. Cinema all’aperto', ok: 'Crea il tag' });
    if (!name) return;
    try {
      const { tag, created } = await tags.add(name);
      chosen.add(tag);
      draw();
      toast(created ? 'Tag «' + tag + '» creato.' : 'Il tag «' + tag + '» esisteva già: l’ho selezionato.', 'ok');
    } catch (e) {
      if (e.validation) toast(e.message, 'error');   // gli errori del database sono già stati mostrati da db.js
    }
  }

  const addBtn = el('button', {
    type: 'button', class: 'tag-add', title: 'Crea un nuovo tag', 'aria-label': 'Crea un nuovo tag', on: { click: create },
  }, icon('plus'));
  draw();
  return { node, addBtn, get: () => tags.all().filter(t => chosen.has(t)) };
}

/**
 * Modulo «Visto» in un foglio: data di visione, voto, note, tag.
 * film: dati del film (per il titolo in alto); values: valori iniziali.
 * Restituisce { data_visione, voto, note, luoghi } (luoghi = i tag) oppure null se annullato.
 */
export function vistoSheet(film, values = {}, { title = 'Segna come visto', ok = 'Salva' } = {}) {
  return customSheet((sheet, close) => {
    const date = el('input', { type: 'date', class: 'input', value: values.data_visione === undefined ? todayIso() : (values.data_visione || ''), max: '2100-12-31' });
    const voto = votoInput(values.voto);
    const tagSel = tagInput(values.luoghi);
    const note = el('textarea', { class: 'input', rows: 3, placeholder: 'Impressioni, con chi l’hai visto…', value: values.note || '' });
    const form = el('form', {
      class: 'form',
      on: { submit: e => {
        e.preventDefault();
        close({ data_visione: date.value || null, voto: voto.get(), note: note.value.trim() || null, luoghi: tagSel.get() });
      } },
    },
      el('div', { class: 'sheet-head' },
        el('h2', { class: 'sheet-title', text: title }),
        el('button', { type: 'button', class: 'icon-btn muted', 'aria-label': 'Chiudi', autofocus: true, on: { click: () => close(null) } }, icon('close'))),
      filmHead(film),
      el('div', { class: 'field' },
        el('label', { class: 'field-label', text: 'Data di visione ' }, el('span', { class: 'opt', text: '(facoltativa)' })),
        el('div', { class: 'inline' }, date,
          el('button', { type: 'button', class: 'btn btn-sm', text: 'Oggi', on: { click: () => { date.value = todayIso(); } } }),
          el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Togli la data', text: '✕', on: { click: () => { date.value = ''; } } }))),
      el('div', { class: 'field' },
        el('span', { class: 'field-label', text: 'Voto ' }, el('span', { class: 'opt', text: '(facoltativo)' })),
        voto.node),
      el('div', { class: 'field' },
        el('div', { class: 'field-head' },
          el('span', { class: 'field-label' }, 'Tag ', el('span', { class: 'opt', text: '(anche più di uno)' })),
          tagSel.addBtn),
        tagSel.node),
      el('div', { class: 'field' },
        el('label', { class: 'field-label', text: 'Note ' }, el('span', { class: 'opt', text: '(facoltative)' })),
        note),
      el('div', { class: 'sheet-actions' },
        el('button', { type: 'button', class: 'btn', text: 'Annulla', on: { click: () => close(null) } }),
        el('button', { type: 'submit', class: 'btn btn-primary', text: ok })));
    sheet.classList.add('sheet-form');
    sheet.appendChild(form);
  }).then(v => v || null);
}

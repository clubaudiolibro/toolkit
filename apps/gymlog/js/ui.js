/**
 * ui.js — piccoli strumenti di interfaccia: creazione elementi, avvisi, finestre di conferma.
 */

/**
 * Crea un elemento. attrs: class, text, html, on (oggetto eventi), dataset, style, e attributi normali.
 * I figli possono essere nodi, stringhe o array (null/false vengono ignorati).
 */
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'value') value = v;
    else if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style') n.style.cssText = v;
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  append(n, children);
  if (value !== undefined) n.value = value;   // dopo i figli: vale anche per <select> e <textarea>
  return n;
}

function append(n, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(n, c);
    else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

/* ---------- Icone (SVG a tratto, 24x24) ---------- */
const P = {
  back: '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 5v14l12-7z"/>',
  today: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2"/>',
  diary: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
  workouts: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  backup: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5"/><circle cx="12" cy="20" r="1"/>',
};
export function icon(name, cls = 'ico') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.9');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', cls);
  s.innerHTML = P[name] || '';
  return s;
}

/* ---------- Avvisi (toast) ---------- */
let toastTimer = null;
export function toast(message, type = 'info') {
  const box = document.getElementById('toast');
  if (!box) { alert(message); return; }
  box.textContent = '';
  box.className = 'toast show ' + type;
  box.setAttribute('role', type === 'error' ? 'alert' : 'status');
  box.appendChild(el('span', { class: 'toast-text', text: message }));
  box.appendChild(el('button', {
    class: 'toast-close', type: 'button', 'aria-label': 'Chiudi avviso',
    on: { click: () => { box.className = 'toast'; } },
  }, icon('close')));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = 'toast'; }, type === 'error' ? 8000 : 2600);
}

/* ---------- Finestre (dialog a foglio dal basso) ---------- */
function openSheet(build) {
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const backdrop = el('div', { class: 'sheet-backdrop' });
    const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    backdrop.appendChild(sheet);
    let done = false;
    const close = value => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey);
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 180);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(value);
    };
    const onKey = e => { if (e.key === 'Escape') close(undefined); };
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(undefined); });
    document.addEventListener('keydown', onKey);
    build(sheet, close);
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
    const f = sheet.querySelector('[autofocus], input, textarea, .btn-primary');
    if (f) setTimeout(() => f.focus(), 60);
  });
}

/** Chiede conferma. Restituisce true/false. */
export function confirmDialog({ title, text, ok = 'Conferma', cancel = 'Annulla', danger = false }) {
  return openSheet((sheet, close) => {
    sheet.append(
      el('h2', { class: 'sheet-title', text: title }),
      text ? el('p', { class: 'sheet-text', text }) : null,
      el('div', { class: 'sheet-actions' },
        el('button', { type: 'button', class: 'btn', text: cancel, on: { click: () => close(false) } }),
        el('button', { type: 'button', class: danger ? 'btn btn-danger' : 'btn btn-primary', text: ok, on: { click: () => close(true) } }),
      ),
    );
  }).then(v => v === true);
}

/** Chiede un testo. Restituisce la stringa (già senza spazi ai lati) oppure null se annullato. */
export function promptDialog({ title, label, value = '', placeholder = '', ok = 'Salva', type = 'text' }) {
  return openSheet((sheet, close) => {
    const input = el('input', { type, class: 'input', value, placeholder, autocomplete: 'off', 'aria-label': label || title });
    const form = el('form', {
      on: { submit: e => { e.preventDefault(); const v = input.value.trim(); if (v) close(v); else input.focus(); } },
    },
      el('h2', { class: 'sheet-title', text: title }),
      label ? el('label', { class: 'field-label', text: label }) : null,
      input,
      el('div', { class: 'sheet-actions' },
        el('button', { type: 'button', class: 'btn', text: 'Annulla', on: { click: () => close(null) } }),
        el('button', { type: 'submit', class: 'btn btn-primary', text: ok }),
      ),
    );
    sheet.appendChild(form);
  }).then(v => (typeof v === 'string' ? v : null));
}

/** Foglio libero: build(sheet, close) costruisce il contenuto. */
export function customSheet(build) { return openSheet(build); }

/* ---------- Date ---------- */
const pad = n => String(n).padStart(2, '0');
/** Data in formato gg.mm.aa (accetta Date, ISO o "AAAA-MM-GG"). */
export function fmtDate(v) {
  if (!v) return '';
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
  if (isNaN(d)) return '';
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(-2);
}
/** Data di oggi come "AAAA-MM-GG" (ora locale). */
export function todayIso(d = new Date()) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** Confronto alfabetico italiano, senza distinguere maiuscole/accenti. */
export const byName = (a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' });

/** Normalizza un testo per la ricerca. */
export const norm = s => String(s || '').toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');

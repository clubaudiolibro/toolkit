/**
 * body-figure.js — sagoma stilizzata (vista frontale) con evidenziati i punti di misura.
 *
 * Ogni punto ha una fascia colorata sul corpo e una «i» a lato: la «i» apre un riquadro con le
 * istruzioni per misurare, la fascia porta al campo corrispondente. Le misure sono sul lato destro:
 * nella figura è quello a sinistra, perché la persona guarda chi la osserva.
 */
import { el } from './ui.js';
import { MEASURES } from './config.js';

const W = 360, H = 470, OFF = 20;      // misure della figura; OFF = spostamento del corpo verso destra per fare spazio alle etichette

/**
 * Punti di misura. band = fascia sul corpo (coordinate del corpo, prima dello spostamento OFF);
 * anchor = punto della fascia a cui si aggancia la linea guida; side = lato dell'etichetta.
 */
const POINTS = [
  { key: 'shoulders', band: 'M94 108 Q160 118 226 108', anchor: [226, 108], side: 'R' },
  { key: 'chest', band: 'M108 146 Q160 156 212 146', anchor: [212, 146], side: 'R' },
  { key: 'waist', band: 'M121 214 Q160 222 199 214', anchor: [199, 214], side: 'R' },
  { key: 'biceps', band: 'M85 134 Q98 142 111 142', anchor: [85, 134], side: 'L' },
  { key: 'thigh', band: 'M117 302 Q137 310 157 302', anchor: [117, 302], side: 'L' },
  { key: 'calf', band: 'M120 383 Q134 390 148 383', anchor: [120, 383], side: 'L' },
];
const DOT_X = { L: 90, R: W - 90 };    // posizione orizzontale delle «i» (coordinate assolute)
const LABEL_X = { L: 74, R: W - 74 };

// un arto (quello a sinistra nella figura); l'altro è lo specchio
const LIMBS = `
  <path class="fig-limb" d="M107 106 L89 172" stroke-width="22"/>
  <circle class="fig-fill" cx="107" cy="106" r="11"/>
  <circle class="fig-fill" cx="89" cy="172" r="11"/>
  <path class="fig-limb" d="M89 172 L80 240" stroke-width="17" stroke-linecap="round"/>
  <circle class="fig-fill" cx="80" cy="248" r="9.5"/>
  <path class="fig-fill" d="M117 254 C115 290 118 322 122 352 C120 380 120 410 122 442 L146 442 C148 410 148 380 148 354 C154 322 157 290 157 254 Z"/>
  <ellipse class="fig-fill" cx="130" cy="448" rx="17" ry="6"/>`;

function figureMarkup() {
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Figura con i punti in cui misurare">`);
  parts.push(`<g transform="translate(${OFF} 0)">`);
  parts.push(`<circle class="fig-fill" cx="160" cy="40" r="23"/>`);
  parts.push(`<rect class="fig-fill" x="150" y="60" width="20" height="32" rx="6"/>`);
  parts.push(`<path class="fig-fill" d="M108 100 Q160 78 212 100 L206 160 Q198 190 199 222 L203 258 L117 258 L121 222 Q122 190 114 160 Z"/>`);
  parts.push(LIMBS);
  parts.push(`<g transform="translate(320 0) scale(-1 1)">${LIMBS}</g>`);
  parts.push(`</g>`);

  for (const p of POINTS) {
    const m = MEASURES.find(x => x.key === p.key);
    const ay = p.anchor[1];
    const ax = p.anchor[0] + OFF;
    const dx = DOT_X[p.side];
    const lx1 = p.side === 'L' ? dx + 11 : dx - 11;
    parts.push(`<g class="fig-pt" data-k="${p.key}">
      <line class="fig-leader" x1="${lx1}" y1="${ay}" x2="${ax}" y2="${ay}"/>
      <g transform="translate(${OFF} 0)">
        <path class="fig-band" d="${p.band}"/>
        <path class="fig-hit" d="${p.band}"/>
      </g>
      <text class="fig-label" x="${LABEL_X[p.side]}" y="${ay + 5}" text-anchor="${p.side === 'L' ? 'end' : 'start'}">${m.label}</text>
      <g class="fig-info" tabindex="0" role="button" aria-label="Come misurare: ${m.label}" data-k="${p.key}">
        <circle class="fig-info-hit" cx="${dx}" cy="${ay}" r="22"/>
        <circle class="fig-dot" cx="${dx}" cy="${ay}" r="11"/>
        <text class="fig-i" x="${dx}" y="${ay + 5}">i</text>
      </g>
    </g>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

/**
 * Crea la figura. onPick(key) viene chiamata quando si tocca una fascia sul corpo.
 * Restituisce { node, setActive(key|null), closeTip() }.
 */
export function bodyFigure({ onPick }) {
  const wrap = el('div', { class: 'figure-wrap' });
  wrap.innerHTML = figureMarkup();
  const svg = wrap.querySelector('svg');
  let tip = null;
  let tipKey = null;

  const point = key => wrap.querySelector('.fig-pt[data-k="' + key + '"]');

  function setActive(key) {
    wrap.querySelectorAll('.fig-pt.on').forEach(n => n.classList.remove('on'));
    if (key) { const n = point(key); if (n) n.classList.add('on'); }
  }

  function onDocClick(e) {
    if (tip && !tip.contains(e.target) && !e.target.closest('.fig-info')) closeTip();
  }
  function onKey(e) { if (e.key === 'Escape') closeTip(); }

  function closeTip() {
    if (tip) { tip.remove(); tip = null; }
    tipKey = null;
    wrap.querySelectorAll('.fig-pt.open').forEach(n => n.classList.remove('open'));
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey);
  }

  function openTip(key) {
    if (tipKey === key) { closeTip(); return; }
    closeTip();
    const m = MEASURES.find(x => x.key === key);
    const p = POINTS.find(x => x.key === key);
    tipKey = key;
    point(key).classList.add('open');
    tip = el('div', { class: 'fig-tip', role: 'dialog', 'aria-label': 'Come misurare: ' + m.label },
      el('strong', { text: m.label + ' (lato destro)' }),
      el('span', { text: m.tip }));
    wrap.appendChild(tip);

    // posizione: sotto la «i» (o sopra se non c'è spazio), dentro i bordi della figura
    const scale = svg.getBoundingClientRect().width / W;
    const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
    const tipW = Math.min(260, wrapW - 16);
    tip.style.width = tipW + 'px';
    const cx = DOT_X[p.side] * scale, cy = p.anchor[1] * scale;
    const left = Math.max(8, Math.min(cx - tipW / 2, wrapW - tipW - 8));
    let top = cy + 20;
    if (top + tip.offsetHeight > wrapH - 4) top = Math.max(4, cy - tip.offsetHeight - 20);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';

    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey);
  }

  svg.addEventListener('click', e => {
    const info = e.target.closest('.fig-info');
    if (info) { openTip(info.dataset.k); return; }
    const band = e.target.closest('.fig-hit');
    if (band) { closeTip(); onPick(band.closest('.fig-pt').dataset.k); }
  });
  svg.addEventListener('keydown', e => {
    const info = e.target.closest && e.target.closest('.fig-info');
    if (info && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTip(info.dataset.k); }
  });

  return { node: wrap, setActive, closeTip };
}

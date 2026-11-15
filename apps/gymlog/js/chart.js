/**
 * chart.js — grafico a linea minimo in SVG (nessuna libreria).
 * Asse orizzontale in scala di tempo; si tocca un punto per leggerne il valore.
 */
import { fmtDate } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function svg(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/**
 * points: [{ t (millisecondi), v (valore), day ("AAAA-MM-GG", per l'etichetta dell'asse) }] in ordine di tempo.
 * selected: indice del punto evidenziato; onSelect(i) viene chiamata al tocco.
 */
export function lineChart({ points, selected, onSelect, label }) {
  const W = 340, H = 210;
  const m = { l: 44, r: 16, t: 14, b: 30 };
  const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': label || 'Grafico' });

  const vals = points.map(p => p.v);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  // tre linee di riferimento a valori tondi (lo, metà, hi) che contengono tutti i punti
  const pad = Math.max((vmax - vmin) * 0.1, 0.25);
  let lo = 0, hi = 0;
  for (const st of [0.5, 1, 2, 2.5, 5, 10, 20, 50, 100]) {
    lo = Math.floor((vmin - pad * 0.5) / st) * st;
    hi = lo + 2 * st;
    if (hi >= vmax + pad * 0.5) break;
  }
  const tmin = points[0].t, tmax = points[points.length - 1].t;
  const x = t => (tmax === tmin ? (m.l + W - m.r) / 2 : m.l + ((t - tmin) / (tmax - tmin)) * (W - m.l - m.r));
  const y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

  // linee orizzontali di riferimento con i valori
  for (let i = 0; i < 3; i++) {
    const v = lo + ((hi - lo) * i) / 2;
    root.appendChild(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'chart-grid' }));
    const t = svg('text', { x: m.l - 6, y: y(v) + 4, class: 'chart-axis', 'text-anchor': 'end' });
    t.textContent = fmt1(v);
    root.appendChild(t);
  }

  // date agli estremi
  const first = svg('text', { x: points.length === 1 ? x(tmin) : m.l, y: H - 8, class: 'chart-axis', 'text-anchor': points.length === 1 ? 'middle' : 'start' });
  first.textContent = fmtDate(points[0].day);
  root.appendChild(first);
  if (points.length > 1) {
    const last = svg('text', { x: W - m.r, y: H - 8, class: 'chart-axis', 'text-anchor': 'end' });
    last.textContent = fmtDate(points[points.length - 1].day);
    root.appendChild(last);
  }

  if (points.length > 1) {
    root.appendChild(svg('path', {
      class: 'chart-line',
      d: points.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' '),
    }));
  }

  points.forEach((p, i) => {
    const sel = i === selected;
    root.appendChild(svg('circle', { cx: x(p.t), cy: y(p.v), r: sel ? 6 : 4, class: 'chart-pt' + (sel ? ' sel' : '') }));
    const hit = svg('circle', { cx: x(p.t), cy: y(p.v), r: 16, class: 'chart-hit', tabindex: '0', role: 'button', 'aria-label': p.title + ': ' + p.detail });
    hit.addEventListener('click', () => onSelect(i));
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } });
    root.appendChild(hit);
  });
  return root;
}

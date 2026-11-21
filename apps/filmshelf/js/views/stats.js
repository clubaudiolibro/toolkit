/**
 * views/stats.js — «Statistiche»: numeri e grafici semplici, pensati per lo schermo del telefono.
 *
 * I grafici sono fatti con normali elementi HTML (niente librerie): barre di un solo colore
 * con il valore scritto accanto, così si leggono senza dover toccare nulla.
 *   - film visti per anno e per mese (si sceglie l'anno)
 *   - generi più visti
 *   - voto medio e distribuzione dei voti
 *   - ore totali e ripartizione per luogo
 *   - watchlist: numero di film, durata media e totale
 */
import { el, icon, fmtVoto } from '../ui.js';
import { LUOGHI } from '../config.js';
import * as store from '../store.js';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/* ---------- Calcoli (funzioni pure, facili da verificare) ---------- */

const fmtNum = (n, dec = 0) => n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
/** Ore con una cifra decimale: 125 min → "2,1". */
const ore = min => fmtNum(min / 60, min / 60 >= 100 ? 0 : 1);

export function computeStats(films) {
  const visti = films.filter(f => f.stato === 'visto');
  const wl = films.filter(f => f.stato === 'watchlist');

  // per anno e per mese (solo film con data di visione)
  const perAnno = new Map();       // anno → numero
  const perMese = new Map();       // anno → [12 numeri]
  let senzaData = 0;
  for (const f of visti) {
    if (!f.data_visione) { senzaData++; continue; }
    const y = Number(f.data_visione.slice(0, 4)), m = Number(f.data_visione.slice(5, 7)) - 1;
    perAnno.set(y, (perAnno.get(y) || 0) + 1);
    if (!perMese.has(y)) perMese.set(y, Array(12).fill(0));
    perMese.get(y)[m]++;
  }

  // generi
  const generi = new Map();
  for (const f of visti) for (const g of f.generi || []) generi.set(g, (generi.get(g) || 0) + 1);

  // voti (19 gradini da 1 a 10)
  const conVoto = visti.filter(f => f.voto != null);
  const distrib = Array.from({ length: 19 }, (_, i) => ({ voto: 1 + i / 2, n: 0 }));
  for (const f of conVoto) distrib[Math.round((Number(f.voto) - 1) * 2)].n++;
  const media = conVoto.length ? conVoto.reduce((s, f) => s + Number(f.voto), 0) / conVoto.length : null;

  // ore e luoghi (un film visto in più luoghi conta per ciascuno)
  const minTot = visti.reduce((s, f) => s + (f.durata_min || 0), 0);
  const luoghi = LUOGHI.map(l => {
    const fs = visti.filter(f => (f.luoghi || []).includes(l));
    return { luogo: l, n: fs.length, min: fs.reduce((s, f) => s + (f.durata_min || 0), 0) };
  });
  const senzaLuogo = visti.filter(f => !(f.luoghi || []).length);
  luoghi.push({ luogo: 'Non indicato', n: senzaLuogo.length, min: senzaLuogo.reduce((s, f) => s + (f.durata_min || 0), 0), muted: true });

  // watchlist
  const wlDur = wl.filter(f => f.durata_min);
  const wlMin = wlDur.reduce((s, f) => s + f.durata_min, 0);

  return {
    visti: visti.length, senzaData, perAnno, perMese,
    generi: [...generi].map(([g, n]) => ({ g, n })).sort((a, b) => b.n - a.n || a.g.localeCompare(b.g, 'it')),
    conVoto: conVoto.length, media, distrib,
    minTot, senzaDurata: visti.filter(f => !f.durata_min).length, luoghi,
    wl: { n: wl.length, min: wlMin, media: wlDur.length ? wlMin / wlDur.length : null },
  };
}

/* ---------- Pezzi grafici ---------- */

function tile(value, label, sub) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-value', text: value }),
    el('div', { class: 'stat-label', text: label }),
    sub ? el('div', { class: 'stat-sub', text: sub }) : null);
}

/** Barre orizzontali: righe { label, value, text?, muted? }. */
function hbars(rows, { aria } = {}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return el('ul', { class: 'hbars', 'aria-label': aria },
    rows.map(r => el('li', { class: 'hbar' + (r.muted ? ' muted' : '') },
      el('span', { class: 'hbar-label', text: r.label }),
      el('span', { class: 'hbar-track' },
        el('span', { class: 'hbar-fill', style: 'width:' + (r.value / max * 100).toFixed(1) + '%' })),
      el('span', { class: 'hbar-value', text: r.text != null ? r.text : fmtNum(r.value) }))));
}

/** Colonne verticali: colonne { label, value, title, showLabel }. */
function columns(cols, { aria, small = false } = {}) {
  const max = Math.max(1, ...cols.map(c => c.value));
  return el('div', { class: 'cols' + (small ? ' small' : ''), role: 'img', 'aria-label': aria },
    cols.map(c => el('div', { class: 'col', title: c.title },
      el('span', { class: 'col-value', text: c.value ? fmtNum(c.value) : '' }),
      el('span', { class: 'col-bar-wrap' },
        el('span', { class: 'col-bar' + (c.value ? '' : ' zero'), style: 'height:' + (c.value / max * 100).toFixed(1) + '%' })),
      el('span', { class: 'col-label', text: c.showLabel === false ? '' : c.label }))));
}

function section(title, ic, ...body) {
  return el('section', { class: 'card pad chart-card' },
    el('h2', { class: 'card-title' }, icon(ic), title), ...body);
}

const note = text => el('p', { class: 'chart-note', text });

/* ---------- Schermata ---------- */

export async function render(ctx) {
  ctx.setTitle('Statistiche');
  const s = computeStats(store.all());
  const view = ctx.view;

  if (!s.visti && !s.wl.n) {
    view.appendChild(el('div', { class: 'empty' }, icon('stats'),
      el('p', { text: 'Le statistiche compariranno quando avrai aggiunto qualche film.' })));
    return;
  }

  // Numeri principali
  view.appendChild(el('div', { class: 'stats' },
    tile(fmtNum(s.visti), s.visti === 1 ? 'film visto' : 'film visti'),
    tile(ore(s.minTot), 'ore di film', s.senzaDurata ? s.senzaDurata + ' senza durata' : null),
    tile(s.media == null ? '—' : fmtVoto(Math.round(s.media * 10) / 10), 'voto medio',
      s.conVoto ? 'su ' + s.conVoto + (s.conVoto === 1 ? ' film votato' : ' film votati') : 'nessun voto')));

  // Per anno
  const anni = [...s.perAnno.keys()].sort((a, b) => b - a);
  if (anni.length) {
    view.appendChild(section('Film visti per anno', 'today',
      hbars(anni.map(y => ({ label: String(y), value: s.perAnno.get(y) })), { aria: 'Film visti per anno' }),
      s.senzaData ? note(s.senzaData + (s.senzaData === 1 ? ' film senza data di visione non è contato.' : ' film senza data di visione non sono contati.')) : null));

    // Per mese, con scelta dell'anno
    let year = anni[0];
    const chips = el('div', { class: 'chips scroll year-chips', role: 'group', 'aria-label': 'Anno' });
    const chart = el('div');
    const drawMonths = () => {
      chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.y) === year)));
      const m = s.perMese.get(year);
      chart.textContent = '';
      chart.appendChild(columns(m.map((n, i) => ({ label: MESI[i], value: n, title: MESI_LUNGHI[i] + ' ' + year + ': ' + n + ' film' })),
        { aria: 'Film visti per mese nel ' + year }));
    };
    anni.forEach(y => chips.appendChild(el('button', {
      type: 'button', class: 'chip', text: String(y), dataset: { y: String(y) },
      on: { click: () => { year = y; drawMonths(); } },
    })));
    drawMonths();
    view.appendChild(section('Film visti per mese', 'diary', chips, chart));
  }

  // Generi
  if (s.generi.length) {
    const TOP = 8;
    const box = el('div');
    let allShown = false;
    const more = el('button', { type: 'button', class: 'link-btn', on: { click: () => { allShown = !allShown; draw(); } } });
    const draw = () => {
      box.textContent = '';
      box.appendChild(hbars((allShown ? s.generi : s.generi.slice(0, TOP)).map(x => ({ label: x.g, value: x.n })), { aria: 'Generi più visti' }));
      more.textContent = allShown ? 'Mostra meno' : 'Mostra tutti i ' + s.generi.length + ' generi';
      more.hidden = s.generi.length <= TOP;
    };
    draw();
    view.appendChild(section('Generi più visti', 'film', box, more,
      note('Un film con più generi conta per ciascuno.')));
  }

  // Voti
  if (s.conVoto) {
    view.appendChild(section('Distribuzione dei voti', 'star',
      el('p', { class: 'chart-lead' }, 'Voto medio ', el('strong', { text: fmtVoto(Math.round(s.media * 10) / 10) }), ' su ' + s.conVoto + ' film'),
      columns(s.distrib.map(d => ({ label: fmtVoto(d.voto), value: d.n, showLabel: Number.isInteger(d.voto), title: 'Voto ' + fmtVoto(d.voto) + ': ' + d.n + ' film' })),
        { aria: 'Numero di film per voto', small: true })));
  }

  // Ore e luoghi
  if (s.visti) {
    view.appendChild(section('Ore viste per luogo', 'timer',
      el('p', { class: 'chart-lead' }, 'In totale ', el('strong', { text: ore(s.minTot) + ' ore' }), ' (' + fmtNum(Math.round(s.minTot)) + ' minuti)'),
      hbars(s.luoghi.filter(l => l.n || !l.muted).map(l => ({
        label: l.luogo, value: l.min, muted: l.muted,
        text: ore(l.min) + ' h · ' + l.n + ' film',
      })), { aria: 'Ore viste per luogo' }),
      note('Un film visto in più luoghi conta per ciascuno.')));
  }

  // Watchlist
  view.appendChild(section('Watchlist', 'bookmark',
    el('div', { class: 'stats stats-inline' },
      tile(fmtNum(s.wl.n), s.wl.n === 1 ? 'film da vedere' : 'film da vedere'),
      tile(s.wl.media == null ? '—' : fmtNum(Math.round(s.wl.media)) + ' min', 'durata media'),
      tile(s.wl.min ? ore(s.wl.min) + ' h' : '—', 'durata totale'))));
}

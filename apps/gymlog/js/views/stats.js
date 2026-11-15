/** stats.js — statistiche minime: tre numeri, solo allenamenti (le attività non contano). */
import { el, todayIso } from '../ui.js';
import { diarySorted, isActivityEntry } from '../store.js';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** Data "AAAA-MM-GG" di n giorni fa (ora locale). */
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return todayIso(d); }

export function computeStats() {
  const today = todayIso();
  const workouts = diarySorted().filter(d => !isActivityEntry(d) && d.day <= today);
  const month = today.slice(0, 7);
  const inMonth = workouts.filter(d => d.day.startsWith(month)).length;
  const from28 = daysAgo(27);
  const last4w = workouts.filter(d => d.day >= from28).length;
  const from30 = daysAgo(29);
  const rated = workouts.filter(d => d.day >= from30 && d.stars);
  const avgStars = rated.length ? rated.reduce((s, d) => s + d.stars, 0) / rated.length : null;
  return { inMonth, perWeek: last4w / 4, last4w, avgStars, rated: rated.length };
}

export function render(ctx) {
  ctx.setTitle('Statistiche');
  ctx.setBack('#/altro');
  const s = computeStats();
  const now = new Date();
  const tile = (value, label, sub) => el('div', { class: 'stat' },
    el('div', { class: 'stat-value', text: value }),
    el('div', { class: 'stat-label', text: label }),
    sub ? el('div', { class: 'stat-sub', text: sub }) : null);
  ctx.view.append(
    el('div', { class: 'stats' },
      tile(String(s.inMonth), 'Allenamenti a ' + MONTHS[now.getMonth()], 'completati nel mese'),
      tile(fmt1(s.perWeek), 'Media a settimana', 'ultime 4 settimane (' + s.last4w + ' allenamenti)'),
      tile(s.avgStars == null ? '–' : fmt1(s.avgStars) + ' ★', 'Media stelline', s.rated ? 'ultimi 30 giorni (' + s.rated + ' con stelline)' : 'nessuna stellina negli ultimi 30 giorni')),
    el('p', { class: 'hint', text: 'Contano solo gli allenamenti del diario, non le attività come la Corsa.' }));
}

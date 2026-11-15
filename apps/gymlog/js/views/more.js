/** more.js — sezione "Altro": statistiche, backup, cestino, liste personali, impostazioni. */
import { el, icon } from '../ui.js';
import { state, trashItems, activeActivities } from '../store.js';
import { APP_VERSION } from '../config.js';
import { backupBanner } from './backup.js';
import { backupOverdue, backupStatusText } from '../backup.js';

function row({ href, ico, title, sub, disabled }) {
  const inner = [
    el('span', { class: 'row-icon' }, icon(ico)),
    el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: title }), sub ? el('div', { class: 'row-sub', text: sub }) : null),
    disabled ? null : icon('chevron', 'ico chev'),
  ];
  return el('li', {}, disabled
    ? el('div', { class: 'row disabled' }, inner)
    : el('a', { class: 'row', href }, inner));
}

export function render(ctx) {
  ctx.setTitle('Altro');
  const nTrash = trashItems().length;
  if (backupOverdue()) ctx.view.appendChild(backupBanner());
  ctx.view.append(
    el('h2', { class: 'section-title', text: 'Liste personali' }),
    el('ul', { class: 'list' },
      row({ href: '#/altro/muscoli', ico: 'list', title: 'Gruppi muscolari', sub: state.muscles.length + ' voci' }),
      row({ href: '#/altro/attrezzi', ico: 'dumbbell', title: 'Attrezzi', sub: state.equipment.length + ' voci' }),
      row({ href: '#/altro/attivita', ico: 'today', title: 'Attività (es. Corsa)', sub: activeActivities().length + ' voci' })),
    el('h2', { class: 'section-title', text: 'Dati' }),
    el('ul', { class: 'list' },
      row({ href: '#/altro/cestino', ico: 'trash', title: 'Cestino', sub: nTrash ? (nTrash === 1 ? '1 elemento' : nTrash + ' elementi') : 'Vuoto' }),
      row({ href: '#/altro/backup', ico: 'backup', title: 'Backup', sub: backupStatusText() }),
      row({ href: '#/altro/statistiche', ico: 'stats', title: 'Statistiche', sub: 'Mese, media settimanale, stelline' }),
      row({ href: '#/altro/impostazioni', ico: 'settings', title: 'Impostazioni', sub: 'Installa sulla Home, timer' })),
    el('p', { class: 'about', text: 'GymLog v' + APP_VERSION }));
}

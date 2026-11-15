/** backup.js — Altro → Backup: esporta (JSON + CSV per Excel) e ripristina dal file JSON. */
import { el, icon, toast, confirmDialog, fmtDate } from '../ui.js';
import {
  exportBackup, exportCsv, buildBackup, saveBackupFile, readBackupFile, restoreBackup,
  backupOverdue, backupStatusText, BACKUP_MAX_DAYS,
} from '../backup.js';

let busy = false;

function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

/** Riepilogo leggibile del contenuto di un backup. */
function summary(c) {
  return [
    plural(c.exercises, 'esercizio', 'esercizi'),
    plural(c.groups, 'gruppo', 'gruppi'),
    plural(c.workouts, 'allenamento', 'allenamenti'),
    plural(c.diary, 'voce di diario', 'voci di diario'),
    plural(c.activity_types, 'attività', 'attività'),
  ].join(', ');
}

/** Riquadro con la data dell'ultimo backup (usato anche in Oggi e in Altro). */
export function backupBanner({ link = true } = {}) {
  const overdue = backupOverdue();
  const text = el('div', { class: 'row-main' },
    el('div', { class: 'backup-label', text: overdue ? 'Backup da fare' : 'Backup' }),
    el('div', { class: 'row-title', text: backupStatusText() }),
    overdue ? el('div', { class: 'row-sub', text: 'Ti consiglio di farne uno almeno ogni ' + BACKUP_MAX_DAYS + ' giorni.' }) : null);
  const cls = 'backup-banner' + (overdue ? ' overdue' : '');
  if (!link) return el('div', { class: cls }, el('span', { class: 'row-icon' }, icon('backup')), text);
  return el('a', { class: cls, href: '#/altro/backup' },
    el('span', { class: 'row-icon' }, icon('backup')), text,
    el('span', { class: 'btn btn-sm', text: 'Fai il backup' }));
}

export function render(ctx) {
  ctx.setTitle('Backup');
  ctx.setBack('#/altro');

  const buttons = [];
  const setBusy = on => { busy = on; buttons.forEach(b => { b.disabled = on; }); };
  const btn = (attrs, ...children) => { const b = el('button', { type: 'button', ...attrs }, ...children); buttons.push(b); return b; };

  /* ---- Esporta ---- */
  const exportBtn = btn({ class: 'btn btn-primary btn-block', on: { click: async () => {
    if (busy) return;
    setBusy(true);
    exportBtn.lastChild.textContent = 'Preparo il file…';
    try {
      const b = await exportBackup();
      if (b) { toast('Backup salvato: ' + summary(b.counts), 'ok'); setBusy(false); ctx.rerender(); return; }
    } catch (e) { console.error(e); }
    exportBtn.lastChild.textContent = 'Esporta backup';
    setBusy(false);
  } } }, icon('backup'), el('span', { text: 'Esporta backup' }));

  const csvBtn = btn({ class: 'btn btn-block', on: { click: async () => {
    if (busy) return;
    try { await exportCsv(); } catch (e) { console.error(e); toast('Non sono riuscito a creare il file per Excel.', 'error'); }
  } } }, icon('list'), el('span', { text: 'Scarica tabella per Excel (CSV)' }));

  /* ---- Ripristina ---- */
  const fileInput = el('input', { type: 'file', hidden: true, on: { change: async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file || busy) return;
    await restoreFlow(file);
  } } });

  const restoreBtn = btn({ class: 'btn btn-block', on: { click: () => { if (!busy) fileInput.click(); } } },
    icon('restore'), el('span', { text: 'Ripristina da un file…' }));

  async function restoreFlow(file) {
    let backup;
    try { backup = await readBackupFile(file); }
    catch (e) { toast(e.message, 'error'); return; }

    setBusy(true);
    restoreBtn.lastChild.textContent = 'Controllo i dati attuali…';
    let current;
    try { current = await buildBackup(); }       // copia di sicurezza dei dati attuali (preparata prima della conferma)
    catch (e) { console.error(e); restoreBtn.lastChild.textContent = 'Ripristina da un file…'; setBusy(false); return; }
    restoreBtn.lastChild.textContent = 'Ripristina da un file…';
    setBusy(false);

    const hasCurrent = current.counts.exercises || current.counts.workouts || current.counts.diary;
    const ok = await confirmDialog({
      title: 'Sostituire tutti i dati?',
      text: 'Backup del ' + fmtDate(backup.created_at) + ': ' + summary(backup.counts) + '.\n\n'
        + 'Tutti i dati attuali (' + summary(current.counts) + ') verranno sostituiti da quelli del file. '
        + (hasCurrent ? 'Prima scarico una copia di sicurezza dei dati attuali.' : ''),
      ok: 'Sostituisci tutto', danger: true,
    });
    if (!ok) return;

    setBusy(true);
    restoreBtn.lastChild.textContent = 'Ripristino in corso…';
    try {
      if (hasCurrent) {
        const saved = await saveBackupFile(current, 'gymlog-prima-del-ripristino');
        if (!saved) { toast('Ripristino annullato: la copia di sicurezza non è stata salvata.', 'error'); throw new Error('annullato'); }
      }
      await restoreBackup(backup);
      toast('Dati ripristinati: ' + summary(backup.counts), 'ok');
      setBusy(false);
      ctx.go('#/oggi');
      return;
    } catch (e) {
      console.error(e);
      // il database non è cambiato: il ripristino avviene in un'unica operazione
      if (e.message !== 'annullato') {
        toast('Ripristino non riuscito: i tuoi dati non sono cambiati. ' + (navigator.onLine ? 'Il file potrebbe essere rovinato.' : 'Controlla la connessione e riprova.'), 'error');
      }
    }
    restoreBtn.lastChild.textContent = 'Ripristina da un file…';
    setBusy(false);
  }

  ctx.view.append(
    backupBanner({ link: false }),
    el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('backup'), 'Esporta'),
      el('p', { text: 'Scarica sul telefono un file con tutti i tuoi dati (esercizi, gruppi, allenamenti, diario, attività, liste, impostazioni, cestino compreso). Conservalo in un posto sicuro, per esempio Google Drive o iCloud.' }),
      el('div', { class: 'stack' }, exportBtn),
      el('p', { class: 'small', text: 'Vuoi solo consultare i dati? La tabella per Excel contiene diario, esercizi, gruppi e allenamenti con i pesi. Non serve per il ripristino.' }),
      el('div', { class: 'stack' }, csvBtn)),
    el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('restore'), 'Ripristina'),
      el('p', { text: 'Scegli un file di backup (.json) creato da GymLog: tutti i dati attuali verranno sostituiti da quelli del file. Prima di procedere ti chiedo conferma e scarico una copia di sicurezza dei dati attuali.' }),
      el('p', { class: 'small', text: 'Se il ripristino si interrompe (per esempio cade la rete) non cambia niente: i dati restano quelli di prima.' }),
      el('div', { class: 'stack' }, restoreBtn),
      fileInput));
}

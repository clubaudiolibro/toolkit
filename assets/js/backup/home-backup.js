/**
 * home-backup.js — sezione «Backup e ripristino» della home e relativa finestra.
 *
 * Esporta: sceglie gli strumenti, crea un unico zip (core.createBackup).
 * Ripristina: legge lo zip, mostra cosa contiene con i controlli preliminari di ogni strumento,
 *             chiede conferma, scarica una copia di sicurezza di ciò che verrebbe sostituito, poi ripristina.
 * Stile: solo variabili --tk-* e componenti .tk-* (docs/IDENTITA-VISIVA.md); classi proprie in assets/css/backup.css.
 */
import { ADAPTERS } from './adapters/index.js';
import { makeContext, createBackup, openArchive, restoreItems, markBackupDone, lastBackupAt } from './core.js';
import { describeError, Interrupted } from './util.js';

const $ = id => document.getElementById(id);

function h(tag, attrs, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}

const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/></svg>',
};
const icon = (svg, cls) => { const s = h('span', { class: cls || 'bk-ico', 'aria-hidden': 'true' }); s.innerHTML = svg; return s; };

const fmtDate = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const daysSince = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const MAX_DAYS = 30;

/* ------------------------------------------------------------------ stato e finestra */

let dlg, titleEl, bodyEl, footEl, closeBtn;
let busy = false;
let ctx = null;
let wakeLock = null;

function ensureDialog() {
  if (dlg) return;
  titleEl = h('h2', { id: 'bk-title' });
  closeBtn = h('button', { type: 'button', class: 'tk-btn tk-btn--icon bk-close', 'aria-label': 'Chiudi', onclick: () => close() });
  closeBtn.innerHTML = ICON.close;
  bodyEl = h('div', { class: 'bk-body' });
  footEl = h('div', { class: 'bk-foot' });
  dlg = h('dialog', { class: 'bk-dialog', 'aria-labelledby': 'bk-title' },
    h('div', { class: 'bk-head' }, titleEl, closeBtn), bodyEl, footEl);
  dlg.addEventListener('cancel', e => { if (busy) e.preventDefault(); });          // Esc non chiude durante il lavoro
  dlg.addEventListener('close', () => { setBusy(false); ctx = null; refreshHome(); });
  document.body.appendChild(dlg);
}

function open(title) {
  ensureDialog();
  titleEl.textContent = title;
  if (!dlg.open) dlg.showModal();
}
function close() { if (!busy && dlg && dlg.open) dlg.close(); }

function setBusy(on) {
  busy = on;
  if (closeBtn) closeBtn.hidden = on;
  window.onbeforeunload = on ? e => { e.preventDefault(); e.returnValue = ''; } : null;
  if (on) {
    if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; }).catch(() => {});
  } else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

function render(title, body, foot) {
  if (title) titleEl.textContent = title;
  bodyEl.replaceChildren(...[].concat(body).filter(Boolean));
  footEl.replaceChildren(...[].concat(foot).filter(Boolean));
  bodyEl.scrollTop = 0;
}

const btn = (label, cls, onclick, attrs) => h('button', { type: 'button', class: 'tk-btn ' + (cls || ''), onclick, ...attrs }, label);
const closeFoot = () => btn('Chiudi', 'tk-btn--primary', () => close());

function progressView(title, onStop) {
  const bar = h('span', { class: 'bk-bar-fill' });
  const text = h('p', { class: 'bk-status', role: 'status' }, 'Preparazione…');
  const pct = h('span', { class: 'bk-pct' }, '0%');
  render(title,
    [h('p', { class: 'bk-hint' }, 'Non chiudere questa pagina e tieni lo schermo acceso finché non finisce.'),
      h('div', { class: 'bk-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar), h('div', { class: 'bk-barline' }, text, pct)],
    [btn('Interrompi', '', () => { if (ctx) ctx.abort(); text.textContent = 'Interruzione in corso…'; })]);
  return (f, t) => {
    const p = Math.round(Math.min(1, Math.max(0, f)) * 100);
    bar.style.width = p + '%';
    bar.parentNode.setAttribute('aria-valuenow', String(p));
    pct.textContent = p + '%';
    if (t) text.textContent = t;
  };
}

/* ------------------------------------------------------------------ elenco con caselle */

/**
 * Righe con casella per scegliere gli strumenti. rows = [{ adapter, ok, summary, reason, note, checked }].
 * Restituisce { node, selected() } e chiama onChange quando cambia la scelta.
 */
function pickList(rows, onChange) {
  const boxes = [];
  const list = h('div', { class: 'bk-list', role: 'group' });
  rows.forEach(r => {
    const box = h('input', { type: 'checkbox', class: 'bk-check', disabled: !r.ok, checked: r.ok && r.checked, id: 'bk-pick-' + r.adapter.id });
    box.addEventListener('change', onChange);
    boxes.push([r, box]);
    list.appendChild(h('label', { class: 'bk-row' + (r.ok ? '' : ' is-off'), for: box.id },
      box,
      h('span', { class: 'bk-row-main' },
        h('span', { class: 'bk-row-title' }, r.adapter.title),
        h('span', { class: 'bk-row-sub' }, r.ok ? r.summary : r.reason),
        r.note ? h('span', { class: 'bk-row-note' + (r.warn ? ' is-warn' : '') }, r.note) : null)));
  });
  return { node: list, selected: () => boxes.filter(([r, b]) => r.ok && b.checked).map(([r]) => r.adapter) };
}

function resultList(items) {
  return h('ul', { class: 'bk-results' }, items.map(i =>
    h('li', { class: 'bk-result ' + (i.ok ? 'is-ok' : 'is-bad') },
      icon(i.ok ? ICON.ok : ICON.warn, 'bk-ico'),
      h('span', { class: 'bk-row-main' },
        h('span', { class: 'bk-row-title' }, i.title),
        h('span', { class: 'bk-row-sub' }, i.ok ? (i.message || i.summary || 'Fatto.')
          : i.interrupted ? (i.message && i.message !== 'Interrotto.' ? i.message : 'Interrotto.')
            : 'Non riuscito: ' + (i.message || i.error)),
        i.warning ? h('span', { class: 'bk-row-note is-warn' }, i.warning) : null))));
}

/* ------------------------------------------------------------------ esportazione */

async function openExport() {
  if (busy) return;
  open('Esporta tutto');
  render(null, h('p', { class: 'bk-status' }, 'Controllo i dati degli strumenti…'), [btn('Annulla', '', () => close())]);
  try { ctx = await makeContext(); }
  catch (e) { return render(null, h('p', { class: 'bk-error' }, describeError(e)), [closeFoot()]); }

  const checks = await Promise.all(ADAPTERS.map(a => a.check(ctx).catch(e => ({ ok: false, reason: describeError(e) }))));
  const canStream = !!window.showSaveFilePicker;
  const rows = ADAPTERS.map((a, i) => {
    const c = checks[i];
    const row = { adapter: a, ok: c.ok, summary: c.summary, reason: c.reason, checked: true };
    if (a.heavy && c.ok && !canStream) {
      row.checked = false;
      row.note = 'Pesante: da telefono può non riuscire. Meglio crearlo dal PC (Chrome o Edge).';
      row.warn = true;
    } else if (a.heavy && c.ok) {
      row.note = 'Include tutti i file delle tablature: serve più tempo.';
    }
    return row;
  });
  const startBtn = btn('Crea backup', 'tk-btn--primary', () => start());
  const list = pickList(rows, () => { startBtn.disabled = !list.selected().length; });
  startBtn.disabled = !list.selected().length;

  render('Esporta tutto', [
    h('p', { class: 'bk-lead' }, 'Scegli cosa salvare. Avrai un solo file .zip da conservare in un posto sicuro (per esempio Google Drive o iCloud).'),
    list.node,
    h('p', { class: 'bk-hint' }, 'Diario, Citazioni e Postcard salvano nel browser: il backup contiene i dati di questo dispositivo. Il cestino di TabShelf e la chiave TMDB non sono inclusi.'),
  ], [btn('Annulla', '', () => close()), startBtn]);

  async function start() {
    const chosen = list.selected();
    if (!chosen.length) return;
    setBusy(true);
    const onProgress = progressView('Creo il backup…');
    let res;
    try {
      res = await createBackup({ adapters: chosen, ctx, onProgress });
    } catch (e) {
      setBusy(false);
      const stopped = e instanceof Interrupted;
      return render(stopped ? 'Backup interrotto' : 'Backup non riuscito',
        h('p', { class: stopped ? 'bk-status' : 'bk-error' }, stopped ? 'Hai interrotto il backup: nessun file è stato creato.' : describeError(e)),
        [btn('Riprova', '', () => openExport()), closeFoot()]);
    }
    setBusy(false);
    if (!res) return render('Esporta tutto', h('p', { class: 'bk-status' }, 'Salvataggio annullato.'), [btn('Indietro', '', () => openExport()), closeFoot()]);
    if (res.complete) { markBackupDone(); refreshHome(); }
    render(res.complete ? 'Backup completato' : 'Backup completato in parte', [
      h('p', { class: 'bk-lead' }, 'File «' + res.fileName + '» ' + (res.savedAs === 'disco' ? 'salvato dove hai scelto.' : 'scaricato.') +
        (res.complete ? '' : ' Qualche strumento non è stato incluso: controlla l’elenco.')),
      resultList(res.items),
      h('p', { class: 'bk-hint' }, 'Conserva il file in un posto sicuro e non condividerlo: contiene i tuoi dati personali.'),
    ], [closeFoot()]);
  }
}

/* ------------------------------------------------------------------ ripristino */

async function openRestore(file) {
  if (busy) return;
  open('Ripristina da un backup');
  render(null, h('p', { class: 'bk-status' }, 'Leggo il file…'), [btn('Annulla', '', () => close())]);

  let archive;
  try {
    ctx = await makeContext();
    archive = await openArchive(file);
  } catch (e) {
    return render('Ripristina da un backup', h('p', { class: 'bk-error' }, describeError(e)), [closeFoot()]);
  }

  // per ogni strumento nel file: controlli preliminari dell'adattatore
  render(null, h('p', { class: 'bk-status' }, 'Controllo il contenuto e i dati attuali…'), [btn('Annulla', '', () => close())]);
  const rows = [];
  for (const it of archive.manifest.items) {
    const a = ADAPTERS.find(x => x.id === it.id);
    if (!a) { rows.push({ adapter: { id: it.id, title: it.title || it.id }, ok: false, reason: 'Non supportato da questa versione della Toolbox.' }); continue; }
    try {
      const needsCloud = a.kind !== 'overwrite';
      if (needsCloud && !ctx.client) throw new Error('Non sei collegato a Supabase.');
      const p = await a.prepare(ctx, archive.zip.folder(a.id), it);
      rows.push({ adapter: a, ok: !p.blocked, summary: p.summary, reason: p.reason, note: p.warning, warn: !!p.warning, checked: true });
    } catch (e) {
      rows.push({ adapter: a, ok: false, reason: describeError(e) });
    }
  }

  const goBtn = btn('Continua', 'tk-btn--primary', () => confirmStep());
  const list = pickList(rows, () => { goBtn.disabled = !list.selected().length; });
  goBtn.disabled = !list.selected().length;
  const when = archive.manifest.created_at ? ' del ' + fmtDate(archive.manifest.created_at) : '';
  render('Ripristina da un backup', [
    h('p', { class: 'bk-lead' }, 'Backup' + when + '. Scegli cosa ripristinare.'),
    list.node,
  ], [btn('Annulla', '', () => close()), goBtn]);

  function confirmStep() {
    const chosen = list.selected();
    const replacing = chosen.filter(a => a.kind !== 'merge');
    render('Confermi il ripristino?', [
      h('ul', { class: 'bk-steps' }, chosen.map(a => h('li', null, h('strong', null, a.title + ': '), a.restoreNote))),
      replacing.length
        ? h('p', { class: 'bk-callout is-warn' }, 'Prima di cominciare scarico una copia di sicurezza di ciò che verrà sostituito (' + replacing.map(a => a.title).join(', ') + '). Se non la salvi, il ripristino non parte.')
        : h('p', { class: 'bk-hint' }, 'Non viene cancellato né modificato niente di ciò che c’è già.'),
    ], [btn('Indietro', '', () => openRestoreList()), btn('Sì, ripristina', 'tk-btn--primary', () => run(chosen, replacing))]);
  }
  function openRestoreList() {
    render('Ripristina da un backup', [
      h('p', { class: 'bk-lead' }, 'Backup' + when + '. Scegli cosa ripristinare.'), list.node,
    ], [btn('Annulla', '', () => close()), goBtn]);
  }

  async function run(chosen, replacing) {
    setBusy(true);
    try {
      if (replacing.length) {
        const safety = progressView('Copia di sicurezza…');
        const copy = await createBackup({ adapters: replacing, ctx, onProgress: safety, prefix: 'toolbox-prima-del-ripristino' });
        if (!copy) {
          setBusy(false);
          return render('Ripristino annullato', h('p', { class: 'bk-status' }, 'La copia di sicurezza non è stata salvata, quindi non ho cambiato niente.'),
            [btn('Indietro', '', () => openRestoreList()), closeFoot()]);
        }
      }
      const onProgress = progressView('Ripristino in corso…');
      const results = await restoreItems({ archive, adapters: chosen, ctx, onProgress });
      setBusy(false);
      const allOk = results.every(r => r.ok);
      render(allOk ? 'Ripristino completato' : 'Ripristino terminato con problemi', [
        resultList(results),
        results.some(r => r.interrupted || (!r.ok && /Ripeti|ripeti/.test(r.message)))
          ? h('p', { class: 'bk-hint' }, 'Puoi ripetere lo stesso ripristino: quello che è già stato fatto viene saltato.') : null,
        h('p', { class: 'bk-hint' }, 'Riapri gli strumenti per vedere i dati aggiornati.'),
      ], [closeFoot()]);
    } catch (e) {
      setBusy(false);
      const stopped = e instanceof Interrupted;
      render(stopped ? 'Ripristino interrotto' : 'Ripristino non riuscito',
        h('p', { class: stopped ? 'bk-status' : 'bk-error' }, stopped ? 'Hai interrotto l’operazione prima di cominciare a ripristinare.' : describeError(e)),
        [btn('Indietro', '', () => openRestoreList()), closeFoot()]);
    }
  }
}

/* ------------------------------------------------------------------ sezione nella home */

function refreshHome() {
  const el = $('backup-last');
  if (!el) return;
  const t = lastBackupAt();
  if (!t) { el.textContent = 'Nessun backup completo ancora fatto.'; el.classList.add('is-warn'); return; }
  const d = daysSince(t);
  el.textContent = 'Ultimo backup completo: ' + fmtDate(t) + ' (' + (d <= 0 ? 'oggi' : d === 1 ? 'ieri' : d + ' giorni fa') + ')';
  el.classList.toggle('is-warn', d > MAX_DAYS);
}

function init() {
  const ex = $('btn-backup-export'), re = $('btn-backup-restore'), fi = $('backup-file');
  if (!ex || !re || !fi) return;
  ex.addEventListener('click', openExport);
  re.addEventListener('click', () => { if (!busy) fi.click(); });
  fi.addEventListener('change', () => {
    const f = fi.files && fi.files[0];
    fi.value = '';
    if (f) openRestore(f);
  });
  refreshHome();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

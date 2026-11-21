/**
 * import-letterboxd/import.js — «Importa da Letterboxd» (operazione da fare una volta sola, meglio dal PC).
 *
 * SEZIONE ISOLATA: per toglierla basta cancellare la cartella import-letterboxd/ e le righe segnate
 * «import Letterboxd» in app.js e in js/views/altro.js (e i file dall'elenco CORE del service worker).
 *
 * Passi:
 *   1. si caricano i CSV (o direttamente lo zip) dell'export di Letterboxd; tutto viene letto nel browser;
 *   2. per ogni film si cerca su TMDB titolo + anno; se il risultato è univoco ed esatto il film viene
 *      salvato subito (voto ×2, data dal diario, luoghi vuoti), altrimenti va «da rivedere»;
 *   3. nella revisione si sceglie il film giusto tra i candidati (o si cerca un altro titolo) oppure si salta.
 *
 * L'avanzamento è salvato nel browser dopo ogni film (localStorage, chiave filmshelf.import.letterboxd):
 * se l'import si interrompe riparte da dove era arrivato. I film già presenti nell'archivio non vengono
 * mai duplicati (controllo su tmdb_id); se erano in watchlist passano tra i visti con data e voto.
 */
import { el, icon, toast, confirmDialog, fmtDate, fmtVoto } from '../js/ui.js';
import { poster } from '../js/components.js';
import { searchMovies, movieDetails, hasKey, loadKey } from '../js/tmdb.js';
import * as store from '../js/store.js';
import { keySetupCard } from '../js/views/key.js';
import { readFiles, mergeLetterboxd, classify } from './letterboxd.js';

const STATE_KEY = 'filmshelf.import.letterboxd';
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js';

/* Stati di ogni film:
   todo      da cercare            imported  importato
   exists    era già tra i visti   moved     era in watchlist, ora tra i visti
   review    da rivedere           skipped   saltato a mano */
const LABEL = {
  imported: 'Importati', moved: 'Spostati dalla watchlist', exists: 'Già presenti', review: 'Da rivedere', skipped: 'Saltati', todo: 'Da cercare',
};

/* ---------- Stato salvato nel browser ---------- */

function loadState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { return null; }
}
function saveState(st) { localStorage.setItem(STATE_KEY, JSON.stringify(st)); }
function clearState() { localStorage.removeItem(STATE_KEY); }
const counts = st => st.items.reduce((c, it) => { c[it.status] = (c[it.status] || 0) + 1; return c; }, {});

/* ---------- Lettura dei file ---------- */

function loadJsZip() {
  if (window.JSZip) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP; s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Non riesco a caricare il lettore di file zip: estrai lo zip e carica i CSV.'));
    document.head.appendChild(s);
  });
}

/** File scelti → [{ name, text }] (gli zip vengono aperti). */
async function readChosen(fileList) {
  const out = [];
  for (const f of fileList) {
    if (/\.zip$/i.test(f.name)) {
      await loadJsZip();
      const zip = await window.JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) {
        if (!entry.dir && /\.csv$/i.test(entry.name)) out.push({ name: entry.name, text: await entry.async('string') });
      }
    } else out.push({ name: f.name, text: await f.text() });
  }
  return out;
}

/* ---------- Salvataggio di un film ---------- */

/** Salva il film TMDB scelto per una voce di Letterboxd. Restituisce il nuovo stato della voce. */
async function saveItem(it, tmdbId) {
  const have = store.findByTmdb(tmdbId);
  if (have && have.stato === 'visto') return 'exists';
  const extra = { stato: 'visto', data_visione: it.data || null, voto: it.voto != null ? it.voto : null };
  if (have) {                                   // era in watchlist: passa tra i visti
    await store.updateFilm(have.id, extra);
    return 'moved';
  }
  const details = await movieDetails(tmdbId);
  try {
    await store.addFilm({ ...details, ...extra, note: null, luoghi: [] });
  } catch (e) {
    if (e.code === '23505') return 'exists';   // aggiunto nel frattempo (es. da un altro dispositivo)
    throw e;
  }
  return 'imported';
}

/* ---------- Schermata ---------- */

export async function render(ctx) {
  ctx.setTitle('Importa da Letterboxd');
  ctx.setBack('#/altro');
  const view = ctx.view;
  ensureCss();

  if (store.isOffline()) {
    view.appendChild(el('div', { class: 'placeholder' },
      el('strong', { text: 'Serve la connessione' }),
      el('p', { text: 'Per importare i film attiva la rete e ricarica la pagina.' })));
    return;
  }
  try { await loadKey(); } catch (e) { /* senza chiave si mostra la guida */ }
  if (!hasKey()) { view.appendChild(keySetupCard(() => ctx.rerender())); return; }

  const st = loadState();
  if (!st) renderUpload(ctx);
  else renderProgress(ctx, st);
}

/** Passo 1: caricamento dei file. */
function renderUpload(ctx) {
  const input = el('input', { type: 'file', accept: '.csv,.zip,text/csv,application/zip', multiple: true, class: 'lb-file', id: 'lb-file' });
  const msg = el('div', { class: 'lb-msg', 'aria-live': 'polite' });
  const start = el('button', { type: 'button', class: 'btn btn-primary btn-block btn-big', text: 'Prepara l’import', hidden: true });
  let merged = null;

  input.addEventListener('change', async () => {
    msg.textContent = 'Leggo i file…';
    start.hidden = true;
    try {
      const files = await readChosen(input.files);
      const r = readFiles(files);
      msg.textContent = '';
      if (!r.watched.length && !r.ratings.length && !r.diary.length) {
        msg.appendChild(el('p', { class: 'form-error', text: 'Non trovo i file di Letterboxd: servono watched.csv (e se vuoi ratings.csv e diary.csv), oppure lo zip dell’export.' }));
        return;
      }
      merged = mergeLetterboxd(r);
      msg.append(...[
        el('ul', { class: 'lb-found' }, r.found.map(f => el('li', {}, icon('check'), f.name + ' — ' + f.rows + ' righe'))),
        !r.watched.length ? el('p', { class: 'hint', text: 'Attenzione: manca watched.csv, verranno importati solo i film presenti negli altri file.' }) : null,
        el('p', {}, el('strong', { text: merged.length + ' film' }), ' da importare: ' +
          merged.filter(m => m.voto != null).length + ' con voto, ' + merged.filter(m => m.data).length + ' con data di visione.'),
      ].filter(Boolean));
      start.hidden = false;
    } catch (e) {
      msg.textContent = '';
      msg.appendChild(el('p', { class: 'form-error', text: e.message || 'Non riesco a leggere i file.' }));
    }
  });

  start.addEventListener('click', () => {
    if (!merged || !merged.length) return;
    const st = { created_at: new Date().toISOString(), items: merged.map(m => ({ ...m, status: 'todo' })) };
    saveState(st);
    ctx.rerender();
  });

  ctx.view.appendChild(el('div', { class: 'card pad setup' },
    el('h2', { class: 'card-title' }, icon('upload'), 'Importa i film visti su Letterboxd'),
    el('p', { text: 'Operazione da fare una volta sola, meglio dal PC:' }),
    el('ol', {},
      el('li', { html: 'Su <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">letterboxd.com → Settings → Data</a> premi <strong>Export your data</strong> e scarica lo zip.' }),
      el('li', { html: 'Qui sotto scegli lo <strong>zip</strong> così com’è, oppure i file <strong>watched.csv</strong>, <strong>ratings.csv</strong> e <strong>diary.csv</strong> (insieme).' }),
      el('li', { text: 'Controlla il riepilogo e avvia: i film trovati con certezza vengono salvati da soli, gli altri li scegli tu.' })),
    el('p', { class: 'small', text: 'I voti Letterboxd (da ½ a 5 stelle) vengono moltiplicati per 2. La data di visione viene dal diario (la visione più recente); i luoghi restano vuoti. I file vengono letti solo nel browser.' }),
    el('label', { class: 'btn btn-block lb-pick', for: 'lb-file' }, icon('upload'), 'Scegli i file'),
    input, msg, start));
}

/** Passi 2 e 3: ricerca automatica con avanzamento, poi revisione. */
function renderProgress(ctx, st) {
  const view = ctx.view;
  const total = st.items.length;
  let running = false;
  let stop = false;

  const bar = el('span', { class: 'lb-bar-fill' });
  const barText = el('p', { class: 'lb-bar-text', 'aria-live': 'polite' });
  const current = el('p', { class: 'hint lb-current' });
  const summary = el('div', { class: 'lb-summary' });
  const actions = el('div', { class: 'stack' });
  const review = el('div', { class: 'lb-review-list' });

  function updateTop() {
    const c = counts(st);
    const done = total - (c.todo || 0);
    bar.style.width = (done / total * 100).toFixed(1) + '%';
    barText.textContent = done + ' di ' + total + ' film cercati';
    summary.textContent = '';
    for (const k of ['imported', 'moved', 'exists', 'review', 'skipped', 'todo']) {
      if (c[k]) summary.appendChild(el('span', { class: 'lb-count lb-' + k }, el('strong', { text: String(c[k]) }), ' ' + LABEL[k]));
    }
    actions.textContent = '';
    if (running) {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-block', text: 'Metti in pausa', on: { click: () => { stop = true; } } }));
    } else if (c.todo) {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary btn-block btn-big', on: { click: runLoop } },
        icon('play'), done ? 'Riprendi la ricerca' : 'Avvia la ricerca'));
      if (!done) actions.appendChild(el('p', { class: 'small', text: 'Ci vuole circa 1 secondo per film (TMDB accetta un numero limitato di richieste). Puoi mettere in pausa e riprendere anche più tardi.' }));
    }
    if (!running) {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost-danger btn-sm', text: c.todo || c.review ? 'Annulla e ricomincia da capo' : 'Chiudi l’import e ricomincia da capo', on: { click: async () => {
        const ok = await confirmDialog({
          title: 'Ricominciare da capo?',
          text: 'I film già importati restano nell’archivio; si perde solo l’elenco di questo import (anche quelli da rivedere).',
          ok: 'Ricomincia', danger: true,
        });
        if (ok) { clearState(); ctx.rerender(); }
      } } }));
    }
  }

  async function runLoop() {
    running = true; stop = false;
    updateTop();
    try {
      for (const it of st.items) {
        if (stop) break;
        if (it.status !== 'todo') continue;
        current.textContent = 'Cerco «' + it.name + '»' + (it.year ? ' (' + it.year + ')' : '') + '…';
        let results = await searchMovies(it.name, { year: it.year });
        if (!results.length && it.year) results = await searchMovies(it.name);
        const { match, candidates } = classify(it, results);
        if (match) {
          it.tmdb_id = match.tmdb_id;
          it.status = await saveItem(it, match.tmdb_id);
        } else {
          it.status = 'review';
          it.candidates = candidates.map(c => ({ tmdb_id: c.tmdb_id, titolo_it: c.titolo_it, titolo_originale: c.titolo_originale, anno: c.anno, poster_path: c.poster_path }));
        }
        saveState(st);
        updateTop();
      }
      current.textContent = stop ? 'In pausa.' : '';
    } catch (e) {
      current.textContent = '';
      toast((e.message || 'Errore') + ' — l’import è in pausa: premi «Riprendi» quando la connessione è tornata.', 'error');
    }
    running = false;
    updateTop();
    drawReview();
  }

  function drawReview() {
    review.textContent = '';
    const items = st.items.filter(it => it.status === 'review');
    const c = counts(st);
    if (!items.length) {
      if (!c.todo) {
        review.appendChild(el('div', { class: 'card pad lb-done' },
          el('h2', { class: 'card-title' }, icon('check'), 'Import completato'),
          el('p', { text: 'Tutti i film sono stati abbinati o saltati.' }),
          el('a', { class: 'btn btn-primary', href: '#/visti', text: 'Vai ai film visti' })));
      }
      return;
    }
    review.appendChild(el('h2', { class: 'section-title', text: 'Da rivedere (' + items.length + ')' }));
    review.appendChild(el('p', { class: 'hint', text: 'Per questi film TMDB non ha dato un risultato certo: tocca quello giusto, cerca con un altro titolo oppure salta.' }));
    for (const it of items) review.appendChild(reviewCard(it));
  }

  function reviewCard(it) {
    const card = el('div', { class: 'card lb-item' });
    const list = el('ul', { class: 'list lb-cands' });
    const input = el('input', { type: 'search', class: 'input', value: it.name, 'aria-label': 'Cerca un altro titolo', enterkeyhint: 'search' });
    const status = el('p', { class: 'hint' });

    const drawCands = cands => {
      list.textContent = '';
      if (!cands.length) { status.textContent = 'Nessun risultato: prova a cercare con un altro titolo (anche in italiano).'; list.hidden = true; return; }
      status.textContent = '';
      list.hidden = false;
      for (const r of cands) {
        const have = store.findByTmdb(r.tmdb_id);
        const orig = r.titolo_originale && r.titolo_originale !== r.titolo_it ? r.titolo_originale : null;
        list.appendChild(el('li', {}, el('button', {
          type: 'button', class: 'row',
          on: { click: async e => {
            const btn = e.currentTarget;
            if (running) { toast('Aspetta la fine della ricerca automatica (o mettila in pausa).'); return; }
            btn.disabled = true;
            try {
              it.tmdb_id = r.tmdb_id;
              it.status = await saveItem(it, r.tmdb_id);
              delete it.candidates;
              saveState(st);
              toast(it.status === 'exists' ? 'Era già tra i visti.' : '«' + (have ? have.titolo_it : r.titolo_it) + '» importato.', 'ok');
              card.remove();
              updateTop();
              if (!st.items.some(x => x.status === 'review')) drawReview();
            } catch (err) {
              btn.disabled = false;
              if (!err.code) toast(err.message || 'Salvataggio non riuscito.', 'error');
            }
          } },
        },
          poster(r.poster_path, { cls: 'poster poster-xs' }),
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: r.titolo_it }),
            el('div', { class: 'row-sub', text: [r.anno || 'anno sconosciuto', orig].filter(Boolean).join(' · ') })),
          have ? el('span', { class: 'tag ' + (have.stato === 'visto' ? 'tag-seen' : 'tag-wl'), text: have.stato === 'visto' ? 'Già visto' : 'In watchlist' }) : null)));
      }
    };

    const search = async () => {
      const q = input.value.trim();
      if (!q) return;
      status.textContent = 'Cerco…';
      try { drawCands((await searchMovies(q)).slice(0, 8)); }
      catch (e) { status.textContent = e.message || 'Ricerca non riuscita.'; }
    };

    card.append(
      el('div', { class: 'lb-item-head' },
        el('div', {},
          el('div', { class: 'lb-name', text: it.name }),
          el('div', { class: 'row-sub', text: [
            it.year || 'anno non indicato',
            it.voto != null ? 'voto ' + fmtVoto(it.voto) : null,
            it.data ? 'visto il ' + fmtDate(it.data) : null,
          ].filter(Boolean).join(' · ') })),
        el('button', { type: 'button', class: 'btn btn-sm', text: 'Salta', on: { click: () => {
          it.status = 'skipped'; delete it.candidates; saveState(st);
          card.remove(); updateTop();
          if (!st.items.some(x => x.status === 'review')) drawReview();
        } } })),
      list, status,
      el('form', { class: 'inline lb-search', on: { submit: e => { e.preventDefault(); search(); } } },
        input, el('button', { type: 'submit', class: 'btn', 'aria-label': 'Cerca' }, icon('search'))));
    drawCands(it.candidates || []);
    return card;
  }

  view.append(
    el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('upload'), 'Import da Letterboxd'),
      el('div', { class: 'lb-bar', role: 'progressbar' }, bar),
      barText, current, summary, actions),
    review);

  updateTop();
  drawReview();
  // uscendo dalla schermata la ricerca si mette in pausa (l'avanzamento è già salvato)
  ctx.onLeave(() => { stop = true; });
}

/** Il foglio di stile di questa sezione sta nella sua cartella e si carica solo qui. */
function ensureCss() {
  if (document.getElementById('lb-css')) return;
  document.head.appendChild(el('link', { id: 'lb-css', rel: 'stylesheet', href: new URL('./import.css', import.meta.url).href }));
}

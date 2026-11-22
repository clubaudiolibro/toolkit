/**
 * views/altro.js — «Altro»: esporta CSV, import da Letterboxd, chiave TMDB, crediti e informazioni.
 */
import { el, icon, toast, confirmDialog } from '../ui.js';
import { loadKey, hasKey, removeKey } from '../tmdb.js';
import { APP_VERSION } from '../config.js';
import * as store from '../store.js';
import { keySetupCard } from './key.js';
import { exportCsv } from '../export.js';
import { parseFilmCsv } from '../import-csv.js';

/** Logo TMDB approvato (versione «blue short» dalla pagina ufficiale dei loghi TMDB). */
const TMDB_LOGO = 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg';

export function creditsCard() {
  return el('div', { class: 'card pad credits', id: 'crediti' },
    el('h2', { class: 'card-title' }, icon('info'), 'Crediti e informazioni'),
    el('a', { class: 'tmdb-logo', href: 'https://www.themoviedb.org/', target: '_blank', rel: 'noopener' },
      el('img', { src: TMDB_LOGO, alt: 'The Movie Database (TMDB)', width: '180', height: '24', referrerpolicy: 'no-referrer' })),
    el('p', { text: 'This product uses the TMDB API but is not endorsed or certified by TMDB.' }),
    el('p', { class: 'small', text: 'Titoli, trame, generi, durate e locandine provengono da The Movie Database (TMDB). Le locandine non vengono salvate: si caricano da TMDB ogni volta che servono.' }),
    el('p', { class: 'small', text: 'FilmShelf ' + APP_VERSION + ' · parte della Toolbox.' }));
}

/** Legge il file scelto, mostra il riepilogo, chiede conferma e importa. */
async function importFromFile(input, ctx) {
  const file = input.files && input.files[0];
  input.value = '';                       // permette di scegliere di nuovo lo stesso file
  if (!file) return;
  let text;
  try { text = await file.text(); } catch (e) { toast('Non riesco a leggere il file.', 'error'); return; }

  const have = new Set(store.all().map(f => f.tmdb_id));
  const res = parseFilmCsv(text, have);
  if (res.error) { toast(res.error, 'error'); return; }

  const n = res.rows.length;
  const visti = res.rows.filter(f => f.stato === 'visto').length;
  const lines = [];
  lines.push('Nel file ci sono ' + res.total + ' film.');
  if (n) lines.push('Da importare: ' + n + ' (' + visti + ' visti, ' + (n - visti) + ' in watchlist).');
  else lines.push('Non c’è niente da importare.');
  if (res.already) lines.push('Già nell’archivio, lasciati come sono: ' + res.already + '.');
  if (res.skipped.length) {
    lines.push('Non importabili: ' + res.skipped.length + '.');
    const shown = res.skipped.slice(0, 8).map(s => '• ' + s.titolo + ' (' + s.motivo + ')');
    if (res.skipped.length > shown.length) shown.push('… e altri ' + (res.skipped.length - shown.length) + '.');
    lines.push(shown.join('\n'));
  }
  const ok = await confirmDialog({
    title: n ? 'Importare ' + n + ' film?' : 'Importazione da CSV',
    text: lines.join('\n\n'),
    ok: n ? 'Importa' : 'Chiudi', cancel: n ? 'Annulla' : 'Fine',
  });
  if (!ok || !n) return;

  try {
    const k = await store.addMany(res.rows, (d, t) => toast('Importazione in corso: ' + d + ' di ' + t + '…'));
    toast(k + (k === 1 ? ' film importato.' : ' film importati.'), 'ok');
  } catch (e) {
    // l'avviso l'ha già mostrato db.js; ripetere l'import è sicuro (i film già salvati si saltano)
    toast('Importazione interrotta. Puoi ripetere: i film già salvati vengono saltati.', 'error');
  }
  ctx.rerender();
}

export async function render(ctx) {
  ctx.setTitle('Altro');
  const view = ctx.view;
  const n = store.all().length;

  // Esporta CSV (copia di sicurezza)
  view.appendChild(el('div', { class: 'card pad' },
    el('h2', { class: 'card-title' }, icon('backup'), 'Esporta CSV'),
    el('p', { text: 'Scarica tutti i film (visti e watchlist) con tutti i tuoi dati in un file che si apre con Excel. Tienilo come copia di sicurezza.' }),
    el('button', {
      type: 'button', class: 'btn btn-primary btn-block', disabled: !n,
      on: { click: () => { const k = exportCsv(); toast(k + (k === 1 ? ' film esportato.' : ' film esportati.'), 'ok'); } },
    }, icon('backup'), n ? 'Esporta CSV (' + n + ' film)' : 'Nessun film da esportare')));

  // Importa da CSV di FilmShelf (ripristino da copia di sicurezza)
  if (!store.isOffline()) {
    const input = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true, on: { change: () => importFromFile(input, ctx) } });
    view.appendChild(el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('upload'), 'Importa da CSV'),
      el('p', { text: 'Carica un file nel formato di «Esporta CSV» per ripristinare i film. Quelli già presenti nell’archivio non vengono toccati né duplicati.' }),
      el('button', { type: 'button', class: 'btn btn-block', on: { click: () => input.click() } }, icon('upload'), 'Scegli il file CSV'),
      input));
  }

  // import Letterboxd (sezione rimovibile)
  if (!store.isOffline()) {
    view.appendChild(el('a', { class: 'card pad row-link', href: '#/altro/importa-letterboxd' },
      el('span', { class: 'row-icon' }, icon('upload')),
      el('span', { class: 'row-main' },
        el('span', { class: 'row-title', text: 'Importa da Letterboxd' }),
        el('span', { class: 'row-sub', text: 'Una volta sola: porta qui i film visti, i voti e le date (meglio dal PC).' })),
      icon('chevron', 'ico chev')));
  }

  // Chiave TMDB
  if (!store.isOffline()) {
    try { await loadKey(); } catch (e) { /* senza rete: si mostra comunque il resto */ }
    if (hasKey()) {
      const box = el('div');
      const card = el('div', { class: 'card pad' },
        el('h2', { class: 'card-title' }, icon('key'), 'Chiave TMDB'),
        el('p', { text: 'Collegata. La chiave è salvata nel tuo database Supabase e la vedi solo tu.' }),
        el('div', { class: 'stack' },
          el('button', { type: 'button', class: 'btn', text: 'Cambia la chiave', on: { click: () => {
            box.textContent = '';
            box.appendChild(keySetupCard(() => ctx.rerender(), { change: true }));
          } } }),
          el('button', { type: 'button', class: 'btn btn-ghost-danger', text: 'Rimuovi la chiave', on: { click: async () => {
            const ok = await confirmDialog({ title: 'Rimuovere la chiave TMDB?', text: 'I film salvati restano. Per aggiungerne altri dovrai inserire di nuovo una chiave.', ok: 'Rimuovi', danger: true });
            if (!ok) return;
            await removeKey();
            toast('Chiave rimossa.', 'ok');
            ctx.rerender();
          } } })),
        box);
      view.appendChild(card);
    } else {
      view.appendChild(keySetupCard(() => ctx.rerender()));
    }
  }

  // Elimina tutti i film (operazione irreversibile)
  if (!store.isOffline()) {
    view.appendChild(el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('trash'), 'Elimina tutti i film'),
      el('p', { text: 'Svuota l’archivio: vengono cancellati tutti i film, visti e in watchlist, con voti, date e note. Poi puoi importare un nuovo CSV da zero.' }),
      el('button', {
        type: 'button', class: 'btn btn-ghost-danger btn-block', disabled: !n,
        on: { click: async () => {
          const tot = store.all().length;
          const ok = await confirmDialog({
            title: 'Sei sicuro di voler eliminare tutto?',
            text: 'Stai per eliminare definitivamente ' + tot + (tot === 1 ? ' film' : ' film') + ' (visti e watchlist), con voti, date, luoghi e note.\n\n'
              + 'L’operazione è IRREVERSIBILE: non si può annullare e i dati non si possono recuperare. '
              + 'Se non hai ancora una copia di sicurezza, annulla e usa prima «Esporta CSV».',
            ok: 'Sì, elimina tutto', cancel: 'Annulla', danger: true,
          });
          if (!ok) return;
          try {
            const k = await store.deleteAll();
            try { localStorage.removeItem('filmshelf.import.letterboxd'); } catch (e) { /* l'avanzamento di un vecchio import resta solo su questo dispositivo */ }
            toast(k + (k === 1 ? ' film eliminato.' : ' film eliminati.'), 'ok');
            ctx.rerender();
          } catch (e) { /* l'avviso di errore l'ha già mostrato db.js: i film sono rimasti dove erano */ }
        } },
      }, icon('trash'), n ? 'Elimina tutti i film (' + n + ')' : 'Nessun film da eliminare')));
  }

  view.appendChild(creditsCard());
}

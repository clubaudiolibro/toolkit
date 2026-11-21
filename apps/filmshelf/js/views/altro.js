/**
 * views/altro.js — «Altro»: chiave TMDB, crediti e informazioni.
 */
import { el, icon, toast, confirmDialog } from '../ui.js';
import { loadKey, hasKey, removeKey } from '../tmdb.js';
import { APP_VERSION } from '../config.js';
import * as store from '../store.js';
import { keySetupCard } from './key.js';

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

export async function render(ctx) {
  ctx.setTitle('Altro');
  const view = ctx.view;

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

  view.appendChild(creditsCard());
}

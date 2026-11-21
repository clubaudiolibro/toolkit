/**
 * views/key.js — riquadro per inserire (o cambiare) la chiave TMDB.
 * La chiave viene provata su TMDB e poi salvata nella tabella protetta filmshelf_impostazioni.
 */
import { el, icon, toast } from '../ui.js';
import { saveKey } from '../tmdb.js';

/** onDone: chiamata dopo il salvataggio riuscito. change = true se si sta sostituendo una chiave esistente. */
export function keySetupCard(onDone, { change = false } = {}) {
  const input = el('input', {
    type: 'text', class: 'input', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    placeholder: 'Incolla qui la chiave TMDB', 'aria-label': 'Chiave TMDB',
  });
  const error = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const btn = el('button', { type: 'submit', class: 'btn btn-primary btn-block', text: 'Prova e salva la chiave' });

  const form = el('form', {
    class: 'form',
    on: { submit: async e => {
      e.preventDefault();
      error.hidden = true;
      btn.disabled = true; btn.textContent = 'Controllo la chiave…';
      try {
        await saveKey(input.value);
        toast('Chiave TMDB salvata.', 'ok');
        onDone();
      } catch (err) {
        error.textContent = err.message || 'Salvataggio non riuscito.';
        error.hidden = false;
      } finally {
        btn.disabled = false; btn.textContent = 'Prova e salva la chiave';
      }
    } },
  }, input, error, btn);

  return el('div', { class: 'card pad setup' },
    el('h2', { class: 'card-title' }, icon('key'), change ? 'Cambia la chiave TMDB' : 'Collega TMDB (una volta sola)'),
    change ? null : el('p', { text: 'Per cercare i film FilmShelf usa il catalogo gratuito di TMDB, che richiede una chiave personale. Conviene farlo dal PC:' }),
    change ? null : el('ol', {},
      el('li', { html: 'Vai su <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org</a> e crea un account gratuito (poi conferma l’email che ti arriva).' }),
      el('li', { html: 'Una volta entrato apri <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Impostazioni → API</a>.' }),
      el('li', { html: 'Premi <strong>Crea</strong> (o «Request an API key»), scegli <strong>Developer</strong> e accetta le condizioni.' }),
      el('li', { html: 'Compila il modulo: tipo di utilizzo <em>Personale</em>, nome dell’app <em>FilmShelf</em>, come sito l’indirizzo della tua Toolbox, una breve descrizione (es. «archivio personale dei film visti»).' }),
      el('li', { html: 'Nella stessa pagina copia il <strong>Token di accesso in lettura all’API</strong> (il testo lungo) oppure la <strong>Chiave API</strong> (quella corta): vanno bene entrambi.' }),
      el('li', { text: 'Incollalo qui sotto e premi il pulsante.' })),
    el('p', { class: 'small', text: 'La chiave viene salvata nel tuo database Supabase, visibile solo a te dopo il login. Non compare mai nel codice pubblico.' }),
    form);
}

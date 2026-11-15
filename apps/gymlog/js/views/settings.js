/** settings.js — impostazioni: installazione sulla Home, schermo acceso, versione. */
import { el, icon, toast } from '../ui.js';
import { isStandalone, isIOS, canPrompt, promptInstall } from '../install.js';
import { supported as wakeSupported } from '../wakelock.js';
import { timerPresets } from '../store.js';
import { presetLabel } from '../timer.js';
import { APP_VERSION } from '../config.js';

export function render(ctx) {
  ctx.setTitle('Impostazioni');
  ctx.setBack('#/altro');

  const install = el('div', { class: 'card pad' });
  install.appendChild(el('h2', { class: 'card-title' }, icon('install'), 'Installa sulla Home'));
  if (isStandalone()) {
    install.appendChild(el('p', { text: 'GymLog è già installata: la stai usando come app.' }));
  } else if (canPrompt()) {
    install.append(el('p', { text: 'Aggiungi GymLog alla schermata Home: si aprirà a tutto schermo, come un\'app.' }),
      el('button', { type: 'button', class: 'btn btn-primary btn-block', on: { click: async () => {
        if (await promptInstall()) toast('GymLog installata', 'ok');
        ctx.rerender();
      } } }, icon('install'), 'Installa GymLog'));
  } else if (isIOS()) {
    install.append(el('p', { text: 'Su iPhone, da Safari:' }), el('ol', { class: 'steps' },
      el('li', { html: 'tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia verso l\'alto);' }),
      el('li', { html: 'scorri e scegli <strong>Aggiungi alla schermata Home</strong>;' }),
      el('li', { html: 'conferma con <strong>Aggiungi</strong>.' })));
  } else {
    install.append(el('p', { text: 'Su Android, da Chrome:' }), el('ol', { class: 'steps' },
      el('li', { html: 'apri il menu <strong>⋮</strong> in alto a destra;' }),
      el('li', { html: 'scegli <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).' })));
  }

  ctx.view.append(
    install,
    el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('timer'), 'Timer di riposo'),
      el('p', { text: 'Preset: ' + timerPresets().map(presetLabel).join(', ') + '. Per aggiungerne o toglierne apri il timer (pulsante rotondo in basso) e tocca «Modifica preset».' })),
    el('div', { class: 'card pad' },
      el('h2', { class: 'card-title' }, icon('today'), 'Schermo sempre acceso'),
      el('p', { text: wakeSupported()
        ? 'Attivo in automatico mentre un allenamento o il timer sono aperti.'
        : 'Questo browser non permette di tenere lo schermo acceso: aggiorna il telefono o usa Chrome/Safari recenti.' })),
    el('p', { class: 'about', text: 'GymLog v' + APP_VERSION }));
}

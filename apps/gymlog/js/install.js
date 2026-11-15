/** install.js — installazione di GymLog sulla schermata Home (PWA). */
let deferred = null;

export function initInstall() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { deferred = null; });
}

/** Già aperta come app installata? */
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Il browser permette di installare con un pulsante (Chrome/Edge su Android e PC)? */
export const canPrompt = () => !!deferred;

/** Mostra la richiesta di installazione del browser. Restituisce true se accettata. */
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  let ok = false;
  try { ok = (await deferred.userChoice).outcome === 'accepted'; } catch (e) { /* niente */ }
  deferred = null;
  return ok;
}

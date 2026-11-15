/**
 * wakelock.js — schermo sempre acceso mentre un allenamento o il timer sono aperti.
 * Usa la Screen Wake Lock API (Android/Chrome, iPhone con iOS 16.4+ e, da app installata, iOS 18.4+).
 * Il telefono rilascia il blocco quando la pagina va in secondo piano: lo si richiede al ritorno.
 */
const reasons = new Set();
let lock = null;
let pending = false;

async function sync() {
  if (!('wakeLock' in navigator)) return;
  const want = reasons.size > 0 && document.visibilityState === 'visible';
  if (want && !lock && !pending) {
    pending = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (e) { lock = null; /* non consentito (es. risparmio energetico): nessun avviso */ }
    pending = false;
    if (!(reasons.size > 0) && lock) { lock.release().catch(() => {}); lock = null; }
  } else if (!want && lock) {
    const l = lock; lock = null;
    l.release().catch(() => {});
  }
}

document.addEventListener('visibilitychange', sync);

/** Tiene lo schermo acceso per un motivo ('run', 'timer', ...). */
export function hold(reason) { reasons.add(reason); sync(); }
/** Toglie un motivo; lo schermo torna normale quando non ne resta nessuno. */
export function release(reason) { reasons.delete(reason); sync(); }
export const supported = () => 'wakeLock' in navigator;

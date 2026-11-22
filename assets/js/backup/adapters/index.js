/**
 * Elenco degli adattatori del backup globale, nell'ordine in cui compaiono nella home.
 * Per includere un NUOVO strumento: crea un adattatore (vedi gymlog.js come modello) con lo stesso `id`
 * dello strumento in assets/js/apps.js e aggiungilo qui.
 *
 * Ogni adattatore ha:
 *   id, title            id dello strumento e nome mostrato
 *   kind                 'replace' (sostituisce i dati), 'merge' (aggiunge, non cancella) o 'overwrite' (sostituisce impostazioni del browser)
 *   weight               peso sull'avanzamento (più lavoro = più alto)
 *   restoreNote          frase mostrata prima del ripristino
 *   check(ctx)           → { ok, summary, reason, bytes }   prima dell'esportazione
 *   export(ctx, folder, progress) → { summary, counts, warning }   scrive i file nella cartella dello zip
 *   prepare(ctx, folder) → { summary, blocked, reason, warning }   controlli prima del ripristino
 *   restore(ctx, folder, item, progress) → testo del risultato
 */
import { audiolibri, citazioni, postcard } from './local-apps.js';
import tabshelf from './tabshelf.js';
import gymlog from './gymlog.js';
import filmshelf from './filmshelf.js';

export const ADAPTERS = [audiolibri, citazioni, postcard, tabshelf, gymlog, filmshelf];

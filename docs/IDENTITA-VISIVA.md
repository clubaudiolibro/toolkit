# Identità visiva della Toolbox — stile «Ciottolo»

Questa guida vale per la home e per **ogni** strumento della Toolbox, compresi quelli futuri.
Chi crea un nuovo applicativo (persona o assistente) deve seguirla: struttura, componenti e regole
sono gli stessi ovunque, **cambia solo il colore della categoria**.

L'idea in una frase: *superfici morbide, tanto respiro e colore come velatura: un'interfaccia fatta per il pollice.*
Mood: calmo, tattile, accogliente.

I file che la realizzano:

| File | Cosa contiene |
|---|---|
| `assets/css/toolkit.css` | Tutte le variabili `--tk-*` (colori, font, angoli, spaziature, ombre), il pulsante tema e i componenti pronti `.tk-*` |
| `assets/css/app-nav.css` | Il link «Toolbox» per tornare alla home (`.home-link`) |
| `assets/js/toolkit-theme.js` | Tema chiaro/scuro: lo applica subito e gestisce ogni `<button data-tk-theme>` |
| `assets/js/apps.js` | Categorie e colori (`CATEGORIES`), elenco delle app, registro delle versioni |

---

## 1. Le regole in breve

1. **Un solo font:** Atkinson Hyperlegible Next (Google Fonts), pesi 400, 700 e 800. Niente monospazio, niente maiuscolo per le etichette: si scrive in frase normale.
2. **Tema chiaro di base.** Lo scuro si attiva solo dal pulsante luna/sole, che deve esserci in ogni app. La scelta vale per tutta la Toolbox.
3. **Superfici bianche senza bordo né ombra** su un fondo grigio azzurro. I livelli si distinguono per il fondo, non per i bordi.
4. **L'ombra spetta solo a ciò che galleggia:** barra di navigazione in basso, timer, menu a tendina, finestre, avvisi.
5. **Angoli ampi:** 24 px card, 16 px pulsanti, 14 px campi, tondo pieno per chip, badge, barre e pulsanti a icona.
6. **Colore della categoria:** pieno solo per l'azione principale, le spunte, le barre dei grafici e i dischi delle icone sulla home. Per tutto il resto (filtro scelto, voce attiva, badge, dischi delle icone nelle app) si usa la **velatura**: il colore al 12% (22% nello scuro) con il testo nel tono scuro.
7. **Aree da toccare di almeno 44 px** (48–56 px per le azioni principali su telefono).
8. **Contrasto WCAG AA:** 4,5:1 per ogni testo, anche piccolo e colorato; 3:1 per bordi dei campi, icone e grafici.
9. **Vietati:** gradienti decorativi, effetto vetro (blur), emoji nell'interfaccia, bordo sinistro colorato sulle card, colori scritti a mano invece delle variabili.

---

## 2. Colori

### Neutri

| Variabile | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--tk-bg` | `#EEF1F4` | `#15191E` | Fondo della pagina |
| `--tk-surface` | `#FFFFFF` | `#1E242B` | Card, pannelli, barra in basso, chip |
| `--tk-surface-2` | `#F5F7F9` | `#262D35` | Blocchi interni, pulsanti secondari, campi numerici |
| `--tk-line` | `#DCE1E7` | `#323A44` | Separatori tra righe (decorativi) |
| `--tk-line-strong` | `#7D8794` | `#7A838F` | Bordo dei campi e dei controlli (≥ 3:1) |
| `--tk-text` | `#1C2430` | `#EDF0F3` | Testo |
| `--tk-muted` | `#566170` | `#A3ACB7` | Testo secondario, etichette (≥ 5,5:1) |
| `--tk-ok` / `--tk-warn` / `--tk-danger` | `#2B7448` / `#835A00` / `#B3261E` | `#74C795` / `#E6B85A` / `#F39389` | Stati (con le rispettive `-soft` come fondo) |

### Colore della categoria

Ogni app dichiara la sua categoria su `<html data-cat="…">`; `toolkit.css` imposta da sola le variabili giuste.

| Categoria | Tono di riferimento `--tk-cat` | Pulsante pieno `--tk-accent-fill` | Testo piccolo `--tk-accent-text` | Tema scuro (testo e pulsanti) |
|---|---|---|---|---|
| Audiolibri | `#2F6F62` | `#2F6F62` (bianco 5,9:1) | `#2F6F62` | `#66A697` |
| Chitarra | `#C2632B` | `#B35620` (bianco 4,9:1) | `#AC4F10` | `#E98751` |
| Benessere | `#B0506E` | `#B0506E` (bianco 5,0:1) | `#A94A68` | `#E37E9B` |
| Film | `#8A3FB8` | `#8A3FB8` (bianco 6,0:1) | `#8A3FB8` | `#C47AF6` |
| Utility | `#3B6FD1` | `#3B6FD1` (bianco 4,8:1) | `#3266C7` | `#659DFF` |

- La **Chitarra** è l'unico caso in cui il tono di riferimento non regge il testo bianco (4,1:1): per pulsanti e testi si usano i due toni più scuri della tabella.
- Nel **tema scuro** pulsanti pieni e testi colorati usano il tono chiaro dell'ultima colonna, con il testo del pulsante scuro (`--tk-on-accent`).
- Tutti i testi colorati sono verificati ≥ 4,5:1 su fondo, superficie e velatura, in chiaro e in scuro.
- Una **nuova categoria** va aggiunta in tre punti con gli stessi valori: `CATEGORIES` in `assets/js/apps.js`, le due regole `:root[data-cat="…"]` (chiaro e scuro) in `toolkit.css`, questa tabella. Prima di sceglierla, verificare i contrasti (es. con un controllo WCAG online).

Variabili da usare nel CSS dell'app:

| Variabile | Quando |
|---|---|
| `--tk-accent-fill` + `--tk-on-accent` | Fondo e testo del pulsante primario, spunte, timer in corso |
| `--tk-accent-text` | Testo piccolo colorato, link, voce attiva, icone colorate |
| `--tk-accent-soft` | Velatura: filtro scelto, voce attiva della navigazione, badge, disco delle icone |
| `--tk-accent-softer` | Velatura leggera per raggruppare (es. gruppi di esercizi) |
| `--tk-accent` / `--tk-cat` | Elementi grandi e grafici (barre, linee, anelli) |

La **home** non ha categoria: lì l'accento è l'inchiostro (`--tk-text`) e ogni piastrella prende il colore della propria app.

---

## 3. Carattere

Atkinson Hyperlegible Next, già caricato da `toolkit.css` (`--tk-font`). È disegnato per la leggibilità: cifre e
lettere simili (1, l, I, 0, O) restano distinguibili anche di sfuggita, utile in palestra o sul tablet.
Per i numeri incolonnati: `font-variant-numeric: tabular-nums`. `--tk-mono` esiste solo per compatibilità e punta allo stesso font.

| Ruolo | Misura | Peso |
|---|---|---|
| Numeri grandi (timer, KPI) | 42–60 px | 800 |
| Titolo dell'app o della pagina | 32–42 px | 800 |
| Titolo di card o sezione | 20–24 px | 800 |
| Pulsanti, chip, etichette dei campi | 15–17 px | 700 |
| Testo corrente | 16–17 px, interlinea 1,5 | 400 |
| Testo secondario | 14–15 px | 400 |
| Etichette piccole, badge | 13 px | 700 |

Le etichette sono **in frase normale** («Esercizio 4 di 9», non «ESERCIZIO 4 DI 9»).

---

## 4. Misure

- **Angoli:** `--tk-radius-lg` 24 (card), `--tk-radius` 16 (pulsanti, blocchi), `--tk-radius-field` 14 (campi), `--tk-radius-sm` 10, `--tk-radius-pill` 999 (chip, badge, barre, pulsanti tondi).
- **Spaziature:** passo di 8 → `--tk-s2` 8, `--tk-s4` 16, `--tk-s5` 24, `--tk-s6` 32, `--tk-s7` 48 (più `--tk-s1` 4 e `--tk-s3` 12 per i ritocchi). Densità bassa: meglio un po' di aria in più.
- **Aree da toccare:** `--tk-touch` 44 px minimo.
- **Ombre:** `--tk-shadow-float` per ciò che galleggia, `--tk-shadow-lg` per finestre e avvisi. Le card non hanno ombra.
- **Icone:** a tratto da 2 px con terminali arrotondati (stile SVG già usato in `apps.js`), 20–24 px, spesso dentro un disco velato (`.tk-icon-disc`).

---

## 5. Struttura di ogni app

- **Header senza fascia:** sul fondo della pagina, a sinistra il link «Toolbox» (pillola bianca con freccia), al centro o a sinistra il titolo (800), a destra i pulsanti tondi: azioni, poi il **pulsante tema** per ultimo.
- **Contenuto:** card bianche da 24 px su fondo grigio azzurro, separate da 10–16 px; dentro le liste, righe da almeno 64 px divise da un filetto `--tk-line`.
- **Telefono:** navigazione in una **barra sospesa in basso** a forma di pillola, con ombra, staccata 12 px dai bordi; la voce attiva è velata. Ricordarsi di lasciare spazio sotto il contenuto (`padding-bottom` ≈ altezza della barra + 16 px).
- **Computer:** la stessa navigazione diventa una fila di pillole in alto, su una superficie bianca.
- **Finestre e fogli:** angoli da 28 px, ombra grande, niente bordo.

---

## 6. Componenti pronti

Sono definiti in `toolkit.css`; usarli nei nuovi applicativi evita di riscrivere lo stile.

```html
<!-- Link alla home e pulsante tema -->
<a class="home-link" href="../../index.html" title="Torna alla Toolbox">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
  <span class="home-label">Toolbox</span>
</a>
<button class="tk-theme-btn" data-tk-theme></button>

<!-- Pulsanti -->
<button class="tk-btn tk-btn--primary">Salva</button>     <!-- azione principale: una per schermata -->
<button class="tk-btn">Annulla</button>                    <!-- secondario -->
<button class="tk-btn tk-btn--tint">Aggiungi alla lista</button>  <!-- azione colorata ma non principale -->
<button class="tk-btn tk-btn--icon" aria-label="Cerca">…svg…</button>

<!-- Campo di testo -->
<div class="tk-field">
  <label for="q">Cerca un film</label>
  <input id="q" class="tk-input" placeholder="Titolo, regista o anno">
</div>

<!-- Filtri a chip e controllo segmentato -->
<button class="tk-chip" aria-pressed="true">Dramma</button>
<button class="tk-chip" aria-pressed="false">Commedia</button>
<div class="tk-seg" role="group" aria-label="Elenco">
  <button aria-pressed="true">Visti</button><button aria-pressed="false">Watchlist</button>
</div>

<!-- Card, riga di elenco, badge, disco icona -->
<section class="tk-card">…</section>
<a class="tk-row" href="#">…</a>
<span class="tk-badge">In watchlist</span>        <!-- velato -->
<span class="tk-badge tk-badge--fill">Nuovo</span>
<span class="tk-badge tk-badge--neutral">v1.0</span>
<span class="tk-icon-disc">…svg…</span>

<!-- Barra di navigazione in basso (telefono) -->
<nav class="tk-nav" aria-label="Sezioni">
  <a href="#/oggi" aria-current="page">…svg…<span>Oggi</span></a>
  <a href="#/diario">…svg…<span>Diario</span></a>
</nav>
```

---

## 7. Checklist per un nuovo applicativo

1. `<html lang="it" data-cat="<categoria>">` (una delle chiavi di `CATEGORIES`).
2. Nell'`<head>`, in quest'ordine e con percorsi `../../`: `assets/js/toolbox-guard.js` (se serve il login), `assets/js/toolkit-theme.js` (senza `defer`), `assets/css/toolkit.css`, `assets/css/app-nav.css`, poi il CSS dell'app. `<meta name="theme-color" content="#eef1f4">`.
3. Header con `.home-link` e `<button class="tk-theme-btn" data-tk-theme>`.
4. Nel CSS dell'app solo variabili `--tk-*` (nessun colore scritto a mano, salvo immagini o anteprime che riproducono un contenuto); componenti `.tk-*` dove possibile.
5. Provare l'app in **chiaro e in scuro**, su telefono (390 px) e su PC.
6. Controllare: niente maiuscolo nelle etichette, niente bordi sulle card, ombre solo su ciò che galleggia, aree da toccare ≥ 44 px, testi ≥ 4,5:1.
7. Aggiungere l'app in `assets/js/apps.js` (versione `"1.0"`) con una riga in cima a `CHANGELOG`.

Le proposte visive da cui nasce lo stile (con schermate, componenti e i cinque colori) sono nella tavola di progetto «Toolbox — 3 direzioni estetiche», proposta B «Ciottolo».

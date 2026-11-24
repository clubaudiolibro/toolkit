/* =====================================================================
   TOOLBOX ALESSANDRO — registro di categorie e applicativi
   Per aggiungere un nuovo strumento:
     1. crea la cartella /apps/<id>/ con il suo index.html
     2. aggiungi una voce in APPS con gli stessi campi
   Campi: id, title, description, url (relativo alla root),
          category (chiave di CATEGORIES),
          version (es. "1.0", mostrata sulla card),
          icon (SVG 24x24 a tratto), tags (facoltativo).
   VERSIONI: ogni aggiornamento di un applicativo DEVE incrementare il suo
   campo version (1.0 → 1.1 per modifiche piccole, → 2.0 per cambiamenti grandi)
   e aggiungere in cima a CHANGELOG una riga brevissima (vedi sotto).
   Una categoria compare nei filtri solo se ha almeno un applicativo.
   ===================================================================== */

/* Colori per categoria: color = tono pieno (tema chiaro), text = tono per le scritte piccole
   sul chiaro, dark = tono per il tema scuro. Devono coincidere con assets/css/toolkit.css. */
const CATEGORIES = {
  audiolibri: { label: "Audiolibri", color: "#2f6f62", text: "#2f6f62", dark: "#66a697" },
  chitarra:   { label: "Chitarra",   color: "#c2632b", text: "#ac4f10", dark: "#e98751" },
  benessere:  { label: "Benessere",  color: "#b0506e", text: "#a94a68", dark: "#e37e9b" },
  film:       { label: "Film",       color: "#8a3fb8", text: "#8a3fb8", dark: "#c47af6" },
  utility:    { label: "Utility",    color: "#3b6fd1", text: "#3266c7", dark: "#659dff" }
};

const APPS = [
  {
    id: "audiolibri",
    title: "Diario degli Audiolibri",
    description: "Analizza il tuo archivio di audiolibri con statistiche, grafici, filtri e indicatori.",
    url: "./apps/audiolibri/index.html",
    category: "audiolibri",
    version: "1.3",
    tags: ["Notion · cloud", "Grafici", "Filtri"],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>'
  },
  {
    id: "citazioni",
    title: "Citazioni in Immagine",
    description: "Trasforma le citazioni dei tuoi libri in immagini personalizzate pronte da condividere.",
    url: "./apps/citazioni/index.html",
    category: "audiolibri",
    version: "1.3",
    tags: ["CSV / Excel", "PNG / JPG", "ZIP"],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 4.5"/><path d="M19 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4-4 4.5"/></svg>'
  },
  {
    id: "postcard-audiolibri",
    title: "Postcard audiolibri",
    description: "Crea cartoline dei tuoi ascolti con copertina, autore, narratore e durata.",
    url: "./apps/postcard-audiolibri/index.html",
    category: "audiolibri",
    version: "1.3",
    tags: ["CSV / Excel", "1:1 · 9:16 · 3:4", "PNG / JPG / ZIP"],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16M17 9h1M17 13h1"/><rect x="6" y="8" width="5" height="5" rx="1"/></svg>'
  },
  {
    id: "tabshelf",
    title: "TabShelf",
    description: "Libreria di tablature con tag e filtri: carichi dal PC, studi dal tablet.",
    url: "./apps/tabshelf/index.html",
    category: "chitarra",
    version: "1.3",
    tags: ["Tag", "Immagini / PDF", "PC + tablet"],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="3" height="13" rx="1"/><rect x="8.5" y="7" width="3" height="11" rx="1"/><path d="M3 21h18"/><path d="M17 16V6l3 1"/><circle cx="15.5" cy="16" r="1.6"/></svg>'
  },
  {
    id: "gymlog",
    title: "GymLog",
    description: "Registro degli allenamenti in palestra: esercizi, gruppi, allenamenti e pesi sempre aggiornati.",
    url: "./apps/gymlog/index.html",
    category: "benessere",
    version: "1.8",
    tags: ["Palestra", "Telefono", "Cloud"],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>'
  },
  {
    id: "filmshelf",
    title: "FilmShelf",
    description: "I film che ho visto e la watchlist: ricerca su TMDB, voti, luoghi e statistiche.",
    url: "./apps/filmshelf/index.html",
    category: "film",
    version: "1.8",
    tags: ["TMDB", "Telefono", "Cloud"],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9l16.5-4M7 8l2-3.6M12 6.8l2-3.6M16.6 5.7l1.5-3.2"/></svg>'
  }
];

/* =====================================================================
   REGISTRO DELLE VERSIONI (mostrato in fondo alla homepage)
   Una riga per ogni nuova versione, la più recente IN CIMA.
   Campi: date (AAAA-MM-GG), app (id in APPS, oppure "toolbox"),
          version, text (descrizione brevissima).
   ===================================================================== */
const CHANGELOG = [
  { date: "2026-11-24", app: "filmshelf", version: "1.8", text: "Filtro «Tag» in Visti: premendo «Applica» senza scegliere alcun tag si vedono i film senza tag («Azzera» toglie il filtro)." },
  { date: "2026-11-22", app: "toolbox", version: "3.1", text: "Nuova sezione «Backup e ripristino» in home: «Esporta tutto» crea un unico file .zip con i dati di GymLog, FilmShelf, TabShelf (file delle tablature compresi) e le impostazioni di Diario, Citazioni e Postcard; «Ripristina…» lo rilegge scegliendo cosa recuperare, con controlli preliminari (spazio incluso) e copia di sicurezza di ciò che verrebbe sostituito. FilmShelf e TabShelf vengono solo integrati: niente viene cancellato." },
  { date: "2026-11-22", app: "filmshelf", version: "1.7", text: "«Dove» diventa «Tag»: nel modulo Visto il «+» crea nuovi tag; nuova sezione Statistiche «Film visti per tag»; in Visti il pulsante «Tag» filtra per uno o più tag. Richiede di rieseguire supabase/filmshelf.sql (schema 2)." },
  { date: "2026-11-22", app: "filmshelf", version: "1.6", text: "Altro → «Importa» unico: si sceglie tra «Importa da Letterboxd» (procedura invariata) e «Importa da CSV»." },
  { date: "2026-11-22", app: "filmshelf", version: "1.5", text: "Altro → «Importa da CSV»: ripristina i film da un file nel formato di «Esporta CSV», con riepilogo prima di importare; i film già presenti non vengono toccati e quelli senza id TMDB vengono segnalati." },
  { date: "2026-11-22", app: "filmshelf", version: "1.4", text: "Altro → «Elimina tutti i film»: svuota l'archivio (visti e watchlist) dopo un avviso che l'operazione è irreversibile, per poter reimportare un CSV da zero." },
  { date: "2026-11-22", app: "filmshelf", version: "1.3", text: "Voto sulle locandine della griglia più grande e ben visibile: box viola con numero bianco in basso a destra." },
  { date: "2026-11-22", app: "toolbox", version: "3.0", text: "Nuova identità visiva «Ciottolo» per home e strumenti: font Atkinson Hyperlegible Next, superfici morbide senza bordi, colore della categoria come velatura, barra in basso sospesa. Regole per i nuovi strumenti in docs/IDENTITA-VISIVA.md." },
  { date: "2026-11-22", app: "audiolibri", version: "1.3", text: "Veste grafica «Ciottolo»." },
  { date: "2026-11-22", app: "citazioni", version: "1.3", text: "Veste grafica «Ciottolo»." },
  { date: "2026-11-22", app: "postcard-audiolibri", version: "1.3", text: "Veste grafica «Ciottolo»." },
  { date: "2026-11-22", app: "tabshelf", version: "1.3", text: "Veste grafica «Ciottolo»." },
  { date: "2026-11-22", app: "gymlog", version: "1.8", text: "Veste grafica «Ciottolo»: barra in basso sospesa, spunte nel colore della categoria." },
  { date: "2026-11-22", app: "filmshelf", version: "1.2", text: "Veste grafica «Ciottolo»: barra in basso sospesa." },
  { date: "2026-11-21", app: "toolbox", version: "2.0", text: "Nuova veste grafica comune a tutti gli strumenti (stile «Strumento»: Inter Tight e JetBrains Mono, filetti sottili, colore della categoria come segnale). Tema chiaro di base e tema scuro dal pulsante, valido per tutte le app." },
  { date: "2026-11-21", app: "audiolibri", version: "1.2", text: "Nuova veste grafica della Toolbox; il tema chiaro/scuro è quello comune (pulsante in alto e Impostazioni)." },
  { date: "2026-11-21", app: "citazioni", version: "1.2", text: "Nuova veste grafica della Toolbox; pulsante del tema comune." },
  { date: "2026-11-21", app: "postcard-audiolibri", version: "1.2", text: "Nuova veste grafica della Toolbox; pulsante del tema comune." },
  { date: "2026-11-21", app: "tabshelf", version: "1.2", text: "Nuova veste grafica della Toolbox e tema scuro (pulsante nella barra in alto)." },
  { date: "2026-11-21", app: "gymlog", version: "1.7", text: "Nuova veste grafica della Toolbox e tema scuro (pulsante in alto a destra)." },
  { date: "2026-11-21", app: "filmshelf", version: "1.1", text: "Nuova veste grafica della Toolbox e tema scuro (pulsante in alto a destra)." },
  { date: "2026-11-21", app: "filmshelf", version: "1.0", text: "Prima versione: ricerca dei film su TMDB e aggiunta tra i visti (data, voto, luoghi, note) o in watchlist; griglia, lista e schede con ricerca e ordinamento; scheda del film con modifica ed eliminazione; statistiche; esporta CSV; import una tantum da Letterboxd. Richiede supabase/filmshelf.sql e una chiave TMDB." },
  { date: "2026-11-21", app: "tabshelf", version: "1.1", text: "Tasto «Azzera filtri» sempre a portata; link facoltativo (URL + nome) per ogni immagine; in Visualizza il tasto «i» apre note (modificabili) e link. Richiede di rilanciare apps/tabshelf/supabase/setup.sql (schema 3)." },
  { date: "2026-11-21", app: "toolbox", version: "1.5", text: "Rimossa la sezione «In evidenza» dalla home." },
  { date: "2026-11-21", app: "toolbox", version: "1.4", text: "Registro delle versioni: di default mostra solo le ultime 3 voci, con il pulsante «Mostra tutto» per vedere lo storico." },
  { date: "2026-11-21", app: "gymlog", version: "1.6", text: "Schede degli allenamenti più compatte, nodo espandibile «Istruzioni» (come si esegue, errori da evitare, video) anche durante l'allenamento; campi rinominati; tolte le scritte «null» dai fogli di scelta." },
  { date: "2026-11-15", app: "gymlog", version: "1.5", text: "Misure corporee (Altro → Misure corporee): peso e circonferenze del lato destro con sagoma e istruzioni, un grafico, storico e promemoria dopo 15 giorni (peso) e 30 (circonferenze). Richiede di rilanciare supabase/gymlog.sql (schema 4)." },
  { date: "2026-11-15", app: "gymlog", version: "1.4", text: "Fase 5: backup (esporta in JSON e CSV per Excel, ripristino sicuro) con avviso se manca da più di 30 giorni." },
  { date: "2026-11-15", app: "gymlog", version: "1.3", text: "Fase 4: timer di riposo sempre visibile con preset, schermo sempre acceso, installazione sulla Home, statistiche." },
  { date: "2026-11-15", app: "gymlog", version: "1.2", text: "Fase 3: esecuzione dell'allenamento, «Allenamento completato» con stelline, diario a calendario/elenco, attività (es. Corsa), cosa allenare oggi." },
  { date: "2026-11-15", app: "gymlog", version: "1.1", text: "Fase 2: gruppi di esercizi e allenamenti con serie, ripetizioni, peso e riscaldamento; duplica; ordine trascinabile." },
  { date: "2026-11-15", app: "gymlog", version: "1.0", text: "Prima versione (fase 1): database degli esercizi, gruppi muscolari e attrezzi personalizzabili, cestino." },
  { date: "2026-11-15", app: "toolbox", version: "1.3", text: "Nuova sezione Benessere con GymLog." },
  { date: "2026-11-14", app: "toolbox", version: "1.2", text: "Accesso unico con email e password dalla home: vale per tutte le app." },
  { date: "2026-11-14", app: "audiolibri", version: "1.1", text: "Carica i dati dal cloud (sincronizzati ogni notte da Notion). Il CSV manuale resta disponibile." },
  { date: "2026-11-14", app: "citazioni", version: "1.1", text: "Si apre dopo l'accesso dalla home." },
  { date: "2026-11-14", app: "postcard-audiolibri", version: "1.1", text: "Si apre dopo l'accesso dalla home." },
  { date: "2026-11-14", app: "toolbox", version: "1.1", text: "Nuova icona del sito (valigetta della Toolbox)." },
  { date: "2026-11-14", app: "toolbox", version: "1.0", text: "Versione degli strumenti sulle card e registro delle versioni." },
  { date: "2026-11-14", app: "tabshelf", version: "1.0", text: "Prima versione: tag in categorie, caricamento dal PC, visualizzazione per tablet, raccolte preferite, backup. Sostituisce Guitar Tab Library." },
  { date: "2026-11-14", app: "audiolibri", version: "1.0", text: "Versione di partenza registrata." },
  { date: "2026-11-14", app: "citazioni", version: "1.0", text: "Versione di partenza registrata." },
  { date: "2026-11-14", app: "postcard-audiolibri", version: "1.0", text: "Versione di partenza registrata." }
];

# Toolbox Alessandro

Web app statica (PWA installabile) che raccoglie:

- **Diario degli Audiolibri** — `apps/audiolibri/`
- **Citazioni in Immagine** — `apps/citazioni/` (accetta CSV e Excel .xlsx; template in `apps/citazioni/template-citazioni.xlsx`)
- **Postcard audiolibri** — `apps/postcard-audiolibri/`
- **TabShelf** — `apps/tabshelf/` (libreria di tablature con tag e filtri: si carica dal PC, si studia dal tablet; dati e file su Supabase. Guida completa più sotto)
- **GymLog** — `apps/gymlog/` (registro degli allenamenti in palestra, pensato per il telefono; dati su Supabase. Vedi «GymLog» più sotto)
- **FilmShelf** — `apps/filmshelf/` (film visti e watchlist con ricerca su TMDB, pensato per il telefono; dati su Supabase. Vedi «FilmShelf» più sotto)
- `apps/tablature/` — contiene solo il reindirizzamento a TabShelf della vecchia *Guitar Tab Library* (vedi «Vecchia Guitar Tab Library»)

Nessun build step e nessun framework: HTML, CSS e JavaScript (moduli ES) con percorsi relativi.
Gli strumenti elaborano i file nel browser. I dati online (TabShelf e archivio audiolibri sincronizzato da Notion) stanno nel progetto Supabase personale e si vedono solo dopo il login.

## Accesso (login unico)
- Il login con email e password si fa **una sola volta nella home**; poi tutte le app si aprono senza altre richieste. Se si apre un'app direttamente senza sessione, si viene rimandati alla home e poi riportati all'app.
- Gli utenti sono quelli del progetto Supabase (gli stessi di TabShelf): non si creano account in più. Le nuove registrazioni vanno tenute disattivate.
- `assets/js/toolbox-auth.js` gestisce client e sessione (stessi nomi di memoria di TabShelf, `tabshelf.config` e `tabshelf.auth`); `assets/js/toolbox-guard.js` è il controllo d'ingresso delle singole app.
- URL del progetto e chiave **pubblica** (mai la secret/service_role) si possono scrivere in `assets/js/toolbox-config.js`; se restano vuoti li chiede la schermata di accesso, una volta per dispositivo.
- Il login protegge la navigazione; la protezione vera dei dati è RLS su Supabase (nessun dato sta in questa repo pubblica).

## Archivio audiolibri nel cloud
Ogni notte alle 03:00 la repo privata `dashboard-audiolibri-automation` copia il database Notion nella tabella Supabase `audiolibri`. Il Diario degli Audiolibri la legge all'apertura (`apps/audiolibri/cloud.js`) e usa la stessa importazione del CSV. Se il cloud non risponde restano i dati ricordati nel browser, e il caricamento manuale del CSV funziona sempre.
Preparazione del database: `supabase/audiolibri.sql` (una volta sola, nel SQL Editor di Supabase).

## Pubblicazione su GitHub Pages
1. Carica il contenuto di questa cartella nella root del repository (es. `toolkit`).
2. Settings → Pages → Source: *Deploy from a branch* → branch `main`, cartella `/ (root)`.
3. Apri `https://<utente>.github.io/toolkit/`.

Tutti i percorsi sono relativi: il sito funziona sia nella root del dominio sia in una sottocartella.

## Memoria dei dati
- Diario: l'ultimo CSV caricato viene ricordato in questo browser (opzione «Memorizza il CSV in questo browser», attiva di default, disattivabile dalle Impostazioni del Diario). Un nuovo CSV sostituisce il precedente.
- Citazioni: ricorda impostazioni, template e copertine; le citazioni si caricano a ogni sessione.

## Versioni e registro delle versioni
- Ogni strumento ha una versione (campo `version` in `assets/js/apps.js`), mostrata sulla sua card nella homepage.
- **Regola: ogni aggiornamento di uno strumento deve incrementare la sua versione** (`1.0` → `1.1` per
  modifiche piccole, → `2.0` per cambiamenti grandi) **e aggiungere una riga in cima a `CHANGELOG`**, sempre in
  `assets/js/apps.js` (data, id dello strumento, versione, descrizione brevissima). Le modifiche alla homepage
  stessa usano l'id `toolbox`.
- In fondo alla homepage, «Registro delle versioni» mostra questo storico.
- TabShelf ha la sua versione anche in `apps/tabshelf/js/config.js` (`APP_VERSION`, visibile nelle Impostazioni
  e nei backup): va tenuta uguale a quella di `apps.js`.

## Aggiungere un nuovo strumento
1. Crea `apps/<id>/index.html`.
2. Aggiungi una voce in `assets/js/apps.js` (id, title, description, url, icon, tags, version `"1.0"`) e una riga in `CHANGELOG`.
3. Per richiedere l'accesso dalla home, nell'`<head>` aggiungi `<script src="../../assets/js/toolbox-guard.js"></script>`. Se lo strumento ha dati online: crea la tabella in `supabase/<nome>.sql` con RLS attiva, nessun permesso ad `anon` e una policy per `authenticated`; nel frontend usa `await Toolbox.getClient()` (`assets/js/toolbox-auth.js`).
4. (Consigliato) nell'`<head>` del nuovo strumento includi manifest, icone e `assets/css/app-nav.css` con percorsi `../../`, e nell'header il link `.home-link` verso `../../index.html`.

## TabShelf

Libreria di tablature (JPG, PNG, PDF) con tag organizzati in categorie.

- **Gestione** (pensata per il PC): caricamento multiplo con trascinamento, anteprima, rotazione e ritaglio,
  compressione delle immagini nel browser (lato lungo max 2200 px, WebP qualità ~0,85; se il risultato è più
  grande dell'originale resta l'originale), miniature WebP da 400 px (anche per i PDF, prima pagina),
  coda con avanzamento e «Riprova»; «Da classificare»; libreria con ricerca, filtri e azioni in blocco;
  scheda documento; categorie e tag (ordine manuale, colori, unione); cestino.
- **Visualizzazione** (pensata per il tablet): filtri a chip (1 tocco includi, 2 escludi, 3 neutro;
  OR nella stessa categoria, AND tra categorie), stato, voto minimo, ricerca, ordinamenti (anche casuale
  con «Mischia»), raccolte preferite, schermo intero con swipe, zoom, PDF a pagine verticali e schermo
  sempre acceso.

### Sicurezza

- Il repository è **pubblico**: non contiene e non deve contenere URL, chiavi, password o email di Supabase
  (negli esempi si usano solo segnaposto come `https://<id-progetto>.supabase.co`).
- L'app usa solo la chiave **pubblica** (publishable `sb_publishable_…` o, nei progetti vecchi, `anon`).
  La chiave segreta (`sb_secret_…` o `service_role`) non va **mai** usata: l'app la rifiuta.
- I dati sono protetti dalle regole RLS del database (ognuno vede solo le proprie righe) e dalle regole
  del bucket privato `tabshelf` (ognuno accede solo alla cartella `<user_id>/`). Il ruolo `anon`
  (chi non ha fatto login) non ha accesso a nessuna tabella; può solo chiamare `tabshelf_ping()`,
  che non legge né scrive dati (serve al workflow keepalive).
- Login con email e password (Supabase Auth); un solo utente, registrazione disattivata.
- I file si leggono solo tramite URL firmati temporanei (1 ora, rinnovati automaticamente).
- La pagina ha `noindex, nofollow` e non invia il referrer ad altri siti.

### Preparazione di Supabase (una volta sola)

1. Su [supabase.com](https://supabase.com) creare un account gratuito e un nuovo progetto (regione UE).
   Annotare la password del database. Nella sezione *Security*: lasciare attivo *Enable Data API*;
   *Automatically expose new tables* può restare disattivato (i permessi li dà `setup.sql`).
2. **Authentication → Sign In / Providers**: disattivare *Allow new users to sign up* e salvare.
   **Authentication → Users → Add user → Create new user**: email e password, con *Auto Confirm User* attivo.
3. **SQL Editor**: incollare tutto `apps/tabshelf/supabase/setup.sql` ed eseguirlo (*Run*). È rilanciabile
   senza errori e senza perdere dati. Alla fine deve comparire la riga `tabshelf | false | 52428800`
   (bucket privato).
4. Copiare il **Project URL** (Project Settings → Data API; se mostra `…/rest/v1/` l'app lo toglie da sola)
   e la **chiave pubblica** (Project Settings → API Keys → *Publishable key*). I nomi nel pannello di
   Supabase possono cambiare nel tempo.

**Aggiornamenti dello schema:** quando `setup.sql` cambia (la versione è in `tabshelf_schema_version()` e in
`SCHEMA_VERSION` di `apps/tabshelf/js/config.js`), l'app mostra «Database da preparare»: basta rieseguire
il file nel SQL Editor.

### Collegare un dispositivo

- **Primo dispositivo:** aprire `apps/tabshelf/index.html`; nella schermata «Collega TabShelf» incollare
  Project URL e chiave pubblica, poi accedere con email e password. I dati di collegamento restano solo
  in quel browser (localStorage).
- **Altri dispositivi:** in TabShelf → Impostazioni → «Collega un altro dispositivo» c'è un link (con
  pulsante Copia) e un QR code. Il link ha la forma
  `…/apps/tabshelf/index.html#cfg=<base64url di {"url": "...", "key": "..."}>`: la parte dopo `#` non viene
  mai inviata al server; l'app la legge, la salva e la cancella subito dall'indirizzo. Contiene i dati di
  connessione ma **non la password**: condividerlo solo con i propri dispositivi.
- Impostazioni → «Scollega questo dispositivo» cancella dal browser collegamento, sessione e miniature salvate.

### File e cache

- `apps/tabshelf/js/config.js`: tutte le impostazioni (soglie di spazio, dimensioni delle immagini,
  versioni delle librerie). Le librerie arrivano da jsDelivr con versione bloccata: supabase-js 2.119.0,
  PDF.js 6.5.438, jszip 3.10.2, qrcode-generator 2.0.4 (supabase-js anche in `index.html`).
- `apps/tabshelf/js/storage.js`: unico punto di accesso ai file (URL firmati, cache delle miniature).
- **Service worker** (`apps/tabshelf/service-worker.js`): gestisce solo i file dell'app e le librerie
  jsDelivr, mai i dati o i file di Supabase. I file dell'app vengono presi prima dalla rete (gli
  aggiornamenti si vedono subito), la cache serve solo senza connessione. Le cache hanno prefisso
  `tabshelf-app-`. **`CACHE_VERSION`**: incrementarla (es. `tabshelf-app-v5` → `tabshelf-app-v6`) quando si
  aggiungono, rinominano o tolgono file dell'app, aggiornando anche l'elenco `CORE`; all'attivazione le
  vecchie cache `tabshelf-app-*` vengono cancellate.
- Le miniature sono salvate nel browser (Cache API, cache `tabshelf-thumbs-v1`, chiave = percorso del file).

### Spazio e avvisi

Lo spazio occupato (somma di `file_size` e `thumb_size`) è sempre visibile nel Cestino e nelle Impostazioni.
Un banner avvisa quando i documenti nel cestino superano **100 MB** o il totale supera l'**80% di 1 GB**
(soglie in `SPACE` di `js/config.js`). Il cestino non si svuota mai da solo.

### Formato del backup

Impostazioni → «Crea backup» (consigliato dal PC) crea `tabshelf-backup-AAAA-MM-GG.zip`, escluso il cestino:

```
documenti/<titolo, o nome originale senza estensione> - <primi 8 caratteri dell'id>.<estensione>
tabshelf-dati.json
documenti.csv
FILE-MANCANTI.txt     (solo se qualche file non è stato scaricato)
```

`tabshelf-dati.json`:

```json
{
  "app": "TabShelf",
  "app_version": "1.0",
  "schema_version": 2,
  "exported_at": "2026-01-31T10:00:00.000Z",
  "categories":    [{ "id": "…", "name": "Genere", "sort_order": 10, "created_at": "…" }],
  "tags":          [{ "id": "…", "category_id": "…", "name": "Blues", "color": "#2c7fb8", "sort_order": 10, "created_at": "…" }],
  "documents":     [{ "id": "…", "title": "…", "artist": "…", "notes": "…", "original_name": "foto.jpg",
                      "file_type": "image", "file_size": 123456, "status": "da_fare", "mastery": 4,
                      "created_at": "…", "file": "documenti/… - 1a2b3c4d.webp" }],
  "document_tags": [{ "document_id": "…", "tag_id": "…" }],
  "collections":   [{ "id": "…", "name": "…", "created_at": "…",
                      "filter": { "include": ["<tag_id>"], "exclude": [], "status": ["in_corso"], "minMastery": 0, "sort": "title" } }]
}
```

- `status`: `da_fare` | `in_corso` | `completo`; `mastery`: 1–5 oppure `null`; `file_type`: `image` | `pdf`.
- `file` è il percorso del documento dentro lo zip; gli id sono quelli del database.
- `sort` delle raccolte: `title` | `newest` | `oldest` | `random`.
- `documenti.csv`: separatore `;`, UTF-8 con BOM (si apre direttamente in Excel in italiano); colonne
  Titolo, Artista, Tag (`Categoria: tag` separati da ` | `), Stato, Voto, Note, Nome file originale, Tipo,
  Dimensione (KB), Data di caricamento, File nel backup, ID.

Il **ripristino da backup non è ancora disponibile**: il formato qui sopra è pensato per permetterlo in futuro.

### Limiti del piano gratuito di Supabase

- 500 MB di database, **1 GB di file**, 5 GB di traffico al mese, file singolo max 50 MB.
- Il progetto va **in pausa dopo 7 giorni senza attività** (si riattiva dal pannello di Supabase).
  Per evitarlo c'è il workflow `.github/workflows/supabase-keepalive.yml`: ogni 3 giorni (e a mano dalla
  scheda *Actions*) chiama `tabshelf_ping`. Richiede i secrets del repository `SUPABASE_URL` e
  `SUPABASE_ANON_KEY` (chiave **pubblica**); se mancano termina senza errore.
- **Attenzione:** GitHub disattiva i workflow programmati dopo **60 giorni senza attività** nel repository
  (nessun commit): in quel caso riattivarlo dalla scheda *Actions*.

### Vecchia Guitar Tab Library

`apps/tablature/` contiene solo `index.html`, che reindirizza a `../tabshelf/index.html` (vecchi segnalibri),
e un `service-worker.js` che sostituisce il vecchio service worker cache-first: si attiva subito, cancella
le cache con prefisso `gtl-`, si deregistra e ricarica le schede aperte. I vecchi dati rimasti in IndexedDB
non vengono toccati né importati.

## GymLog

Registro degli allenamenti in palestra (sezione Benessere), pensato prima per il telefono.
Solo tema chiaro, accento `#b0506e` (colore della categoria Benessere).

- **Database:** `supabase/gymlog.sql` (una volta sola nel SQL Editor; rilanciabile senza perdere dati).
  Tutte le tabelle hanno il prefisso `gym_`, RLS attiva (ognuno vede solo le proprie righe) e nessun
  accesso per `anon`. La versione dello schema è in `gym_schema_version()` e in `SCHEMA_VERSION` di
  `apps/gymlog/js/config.js`: se il database è più vecchio l'app mostra «Database da aggiornare» (versione attuale: 4).
- **Voci predefinite** (gruppi muscolari e attrezzi): le inserisce l'app al primo avvio.
- **Accesso:** usa il login unico (`Toolbox.getClient()`), nessun dato di collegamento duplicato.
- **Salvataggio:** ogni modifica va subito su Supabase; se manca la rete compare un avviso e la modifica
  non viene salvata (non c'è una coda offline).
- **Valori:** serie, ripetizioni e peso valgono per l'esercizio dentro un gruppo (`gym_group_items`, condivisi da
  tutti gli allenamenti che usano il gruppo) o come esercizio singolo dentro un allenamento (`gym_workout_items`).
  Ogni casella si salva da sola; se manca la rete resta bordata di rosso e riprova appena la rete torna.
- **Esecuzione:** le spunte dell'allenamento in corso stanno solo nel telefono (`localStorage`, chiave
  `gymlog.progress`); «Allenamento completato» registra la voce nel diario con la data di oggi e le azzera.
- **Diario:** `gym_diary` conserva il nome al momento e il tipo (`kind`: `workout` | `activity`, schema v2),
  così le voci restano leggibili e del colore giusto anche dopo un'eliminazione definitiva.
- **Cosa allenare oggi:** l'allenamento che segue, nell'ordine della lista, l'ultimo completato (ciclico);
  le attività non contano.
- **Timer di riposo:** pulsante sempre visibile; il tempo si calcola dall'orario di fine salvato sul telefono
  (`localStorage`, chiave `gymlog.timer`), quindi resta esatto anche se la pagina va in pausa. Preset in
  `gym_settings.timer_presets` (secondi). Nessun suono né vibrazione.
- **Schermo sempre acceso:** Screen Wake Lock API (`js/wakelock.js`) mentre un allenamento o il timer sono aperti.
- **Misure corporee** (Altro → Misure corporee, tabella `gym_measurements`, una riga per giorno): peso in kg e
  circonferenze in cm del lato destro (vita, spalle, petto, bicipite, coscia, polpaccio), tutti i campi facoltativi.
  Il form ha una sagoma SVG con i punti di misura e una «i» per ciascuno con le istruzioni; un solo grafico a linea
  (il peso è la media settimanale), storico modificabile. Promemoria in Oggi e in Altro se il peso manca da più di
  15 giorni o le circonferenze da più di 30 (`MEASURE_REMIND` in `config.js`). Incluse in backup JSON e CSV; il ripristino
  di un backup senza misure (fatto prima della v1.5) non le tocca.
- **Installazione (PWA):** `apps/gymlog/manifest.json` + `service-worker.js` (cache `gymlog-app-*`, prima la rete;
  non tocca mai i dati di Supabase). **`CACHE_VERSION`** va incrementata quando si aggiungono, rinominano o
  tolgono file dell'app, aggiornando l'elenco `CORE`.
- **Statistiche:** allenamenti del mese, media a settimana delle ultime 4 settimane, media stelline degli
  ultimi 30 giorni (le attività non contano).
- **Trascinamento:** SortableJS 1.15.7 (MIT) copiato in `apps/gymlog/vendor/`, si trascina solo dalla maniglia.
- **Cestino:** esercizi, gruppi, allenamenti, attività eliminati restano con `deleted_at` e si possono
  ripristinare; si svuota solo a mano.
- **Backup** (Altro → Backup, `js/backup.js` + `js/views/backup.js`):
  - *Esporta* scarica `gymlog-backup-gg-mm-aa.json` con tutte le tabelle (cestino compreso, id originali, senza
    `user_id`) in `{ app: 'gymlog', format: 1, created_at, app_version, schema_version, counts, data }` e salva
    `gym_settings.last_backup_at`. A parte si può scaricare un CSV per Excel (`;`, UTF-8 con BOM, pesi con la
    virgola): diario, esercizi, gruppi, allenamenti. Il CSV non serve per il ripristino.
  - *Ripristina* accetta solo il JSON, mostra un riepilogo e chiede conferma; prima scarica una copia di sicurezza
    dei dati attuali (`gymlog-prima-del-ripristino-…json`), poi chiama `gym_restore(payload)` (schema v3): cancella
    e reinserisce tutto in un'unica transazione (se fallisce non cambia niente), con `security invoker` (vale RLS)
    e `user_id` sempre dell'utente collegato. Delle impostazioni ripristina solo i preset del timer.
  - Su iPhone con l'app installata sulla Home i file si salvano dal foglio «Condividi» (Salva su File).
  - Avviso in Oggi e in Altro se l'ultimo backup ha più di 30 giorni o non è mai stato fatto (e ci sono dati).
- `APP_VERSION` in `apps/gymlog/js/config.js` va tenuta uguale alla versione di `gymlog` in `assets/js/apps.js`.

## FilmShelf

Database personale dei film visti e della watchlist (sezione Film), pensato prima per il telefono.
Solo tema chiaro, accento `#8a3fb8` (colore della categoria Film). Stessa struttura di GymLog.

- **Database:** `supabase/filmshelf.sql` (una volta sola nel SQL Editor; rilanciabile senza perdere dati).
  Tabelle con prefisso `filmshelf_`, RLS attiva (ognuno vede solo le proprie righe), nessun accesso per `anon`.
  - `filmshelf_film`: una riga per film (una sola visione: se lo si rivede si aggiornano data e voto).
    `tmdb_id` unico per utente; `stato` `visto` | `watchlist`; `voto` 1–10 a passi di 0,5; `luoghi` solo
    `Cinema`, `The Space Pass`, `Casa`; `aggiornato_il` si aggiorna da solo.
  - `filmshelf_impostazioni`: la chiave TMDB (una riga per utente).
  - Versione dello schema in `filmshelf_schema_version()` e in `SCHEMA_VERSION` di `apps/filmshelf/js/config.js` (attuale: 1).
- **Chiave TMDB:** non è mai nel codice. La prima volta l'app la chiede (Aggiungi o Altro), la prova su TMDB e la
  salva in `filmshelf_impostazioni`; dopo il login la legge e chiama TMDB direttamente dal browser.
  Vanno bene sia la «Chiave API» (32 caratteri, inviata come `api_key`) sia il «Token di accesso in lettura»
  (`eyJ…`, inviato come `Authorization: Bearer`).
- **TMDB** (`js/tmdb.js`): lingua `it-IT`; ricerca `search/movie` mentre si scrive (attesa 300 ms); dettagli
  `movie/{id}` con `append_to_response=translations` (trama inglese se manca quella italiana). Tutte le chiamate
  passano da una coda con almeno 260 ms tra l'una e l'altra (limite TMDB ≈ 40 ogni 10 s); su 429 aspetta e riprova.
- **Locandine:** si salva solo `poster_path`; l'immagine si carica da `image.tmdb.org` (`w185` elenchi, `w500` scheda)
  con lazy loading. Senza rete compare un riquadro con l'icona della pellicola.
- **Elenchi** (`js/views/films.js`, uguali per visti e watchlist): tre modalità — griglia di copertine, lista compatta,
  schede — scelte con il selettore in alto a destra (ultima scelta in `localStorage`, chiave `filmshelf.view`).
  Ricerca su titolo italiano e originale (senza badare ad accenti e maiuscole) e ordinamento sempre in cima:
  visti per data di visione, voto, titolo, anno; watchlist per data di aggiunta, titolo, anno, durata; un tasto
  inverte il verso; i valori mancanti vanno sempre in fondo (scelta ricordata in `filmshelf.sort.<stato>`).
- **Scheda del film** (`#/film/<id>`, `js/views/film.js`): tutti i dati, «Modifica» (data, voto, luoghi, note),
  «Elimina» con conferma, «Sposta in watchlist»; per la watchlist «Segna come visto».
- **Statistiche** (`js/views/stats.js`, grafici in HTML/CSS senza librerie, un solo colore con i valori scritti):
  numeri principali (film visti, ore, voto medio), film per anno e per mese (scelta dell'anno; i film senza data non
  contano), generi più visti, distribuzione dei voti (19 gradini), ore per luogo (un film in più luoghi conta per
  ciascuno, più «Non indicato»), watchlist (numero, durata media e totale).
- **Senza rete:** una copia dei film è salvata nel browser (`localStorage`, chiave `filmshelf.cache`) e viene mostrata
  in sola lettura.
- **Crediti:** Altro → «Crediti e informazioni», con logo TMDB e la dicitura richiesta.
- **Installazione (PWA):** `manifest.json` + `service-worker.js` (cache `filmshelf-app-*`, prima la rete; non tocca
  mai Supabase né TMDB). **`CACHE_VERSION`** va incrementata quando si aggiungono, rinominano o tolgono file,
  aggiornando l'elenco `CORE`.
- `APP_VERSION` in `apps/filmshelf/js/config.js` va tenuta uguale alla versione di `filmshelf` in `assets/js/apps.js`.

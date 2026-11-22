# Istruzioni per chi lavora su questa repo (anche assistenti AI)

- **Identità visiva:** ogni modifica grafica e ogni nuovo strumento seguono `docs/IDENTITA-VISIVA.md` (stile «Ciottolo»). Usare solo le variabili `--tk-*` e i componenti `.tk-*` di `assets/css/toolkit.css`; provare sempre tema chiaro e scuro, telefono e PC.
- **Versioni:** ogni aggiornamento di uno strumento incrementa il suo `version` in `assets/js/apps.js` e aggiunge una riga in cima a `CHANGELOG` (vedi README, «Versioni e registro delle versioni»). TabShelf ha anche `APP_VERSION` in `apps/tabshelf/js/config.js`.
- **Funzioni:** le funzioni degli strumenti funzionano e non vanno cambiate senza una richiesta esplicita; prima di toccare la logica spiegare cosa si vuole fare.
- **Sicurezza:** la repo è pubblica: mai URL, chiavi, password o email di Supabase nei file.

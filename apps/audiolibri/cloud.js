/* Diario degli Audiolibri — caricamento automatico dei dati dal cloud.
   Dopo il login della home, legge la tabella `audiolibri` (aggiornata ogni notte da Notion),
   ricostruisce il CSV e lo passa alla STESSA funzione di importazione usata per il file manuale.
   Se il cloud non è raggiungibile restano i dati ricordati nel browser e il caricamento manuale del CSV. */
"use strict";
(function () {
  const HEADERS = ["Titolo", "Anno Ascolto", "Autore", "Consigliato da", "Durata", "Fine Ascolto", "Fisico", "Genere",
    "Hype", "Inizio Ascolto", "Narratore", "N°", "OneDrive", "Serie", "Stato", "Volume", "Voto", "epub"];
  const FIELDS = ["titolo", "anno_ascolto", "autore", "consigliato_da", "durata", "fine_ascolto", "fisico", "genere",
    "hype", "inizio_ascolto", "narratore", "numero", "onedrive", "serie", "stato", "volume", "voto", "epub"];

  const cell = v => { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

  async function fetchAll(client) {
    const out = [], size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await client.from("audiolibri").select("*").order("pos", { ascending: true }).range(from, from + size - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < size) break;
    }
    return out;
  }

  /* Avviso VISIBILE (non un toast che sparisce in 2 secondi) quando il caricamento dal cloud non riesce. */
  function problem(title, detail, withLogin) {
    console.warn("[cloud] " + title, detail || "");
    const html = '<div class="notice warn" role="alert" data-cloud-problem>' + (window.IC ? IC.warn : "") +
      '<span class="grow"><strong>' + title + "</strong> " + (detail || "") + "</span>" +
      '<button class="btn sm" type="button" data-cloud-retry>Riprova</button>' +
      (withLogin ? '<button class="btn sm" type="button" data-cloud-login>Accedi di nuovo</button>' : "") + "</div>";
    const host = document.querySelector(window.S && S.data ? "#import-notices" : "#empty-msg");
    if (!host) return;
    host.querySelectorAll("[data-cloud-problem]").forEach(n => n.remove());
    host.insertAdjacentHTML("afterbegin", html);
    const retry = host.querySelector("[data-cloud-retry]"), login = host.querySelector("[data-cloud-login]");
    if (retry) retry.onclick = () => load();
    if (login) login.onclick = relogin;
  }
  function clearProblem() { document.querySelectorAll("[data-cloud-problem]").forEach(n => n.remove()); }

  /* Sessione non più valida: la si elimina in questo browser e si va alla home per rifare il login,
     poi si torna qui. (Senza eliminarla la home rimanderebbe subito indietro: giro infinito.) */
  async function relogin() {
    try { await Toolbox.signOut(); } catch (e) {}
    try { sessionStorage.setItem("adb.relogin", String(Date.now())); } catch (e) {}
    location.replace(Toolbox.homeUrl() + "?next=" + encodeURIComponent("apps/audiolibri/"));
  }
  function justRelogged() {
    try { return Date.now() - Number(sessionStorage.getItem("adb.relogin") || 0) < 60000; } catch (e) { return false; }
  }
  const isAuthError = e => !!e && (e.status === 401 || e.status === 403 || /jwt|token|not authenticated|permission denied/i.test(e.message || ""));

  async function load() {
    if (!window.Toolbox || location.protocol === "file:") return;
    clearProblem();
    try {
      const client = await Toolbox.getClient();
      if (!client) { problem("Collegamento al cloud non configurato.", "Apri la home e accedi: serviranno URL e chiave pubblica di Supabase.", true); return; }

      const { data: sd, error: se } = await client.auth.getSession();
      if (!sd || !sd.session) {
        if (se || !navigator.onLine) { problem("Impossibile verificare l’accesso.", "Sei offline o il servizio non risponde. Controlla la connessione e riprova.", false); return; }
        if (!justRelogged()) { await relogin(); return; }   // sessione scaduta: login automatico dalla home
        problem("Accesso non riuscito.", "La sessione non risulta valida anche dopo il login.", true); return;
      }

      let rows;
      try { rows = await fetchAll(client); }
      catch (e) {
        if (isAuthError(e) && !justRelogged()) { await relogin(); return; }
        throw e;
      }
      if (!rows.length) { problem("Nessun dato nel cloud.", "La tabella è vuota: controlla la sincronizzazione notturna oppure usa il CSV.", false); return; }

      const csv = [HEADERS.map(cell).join(",")]
        .concat(rows.map(r => FIELDS.map(f => cell(r[f])).join(","))).join("\n");
      const when = new Date(rows.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), ""));
      const ok = importText(csv, "Notion · sincronizzazione automatica", isNaN(when) ? new Date() : when,
        [{ level: "info", msg: "Dati caricati dal cloud (aggiornati ogni notte alle 03:00)." }]);
      if (ok) { try { sessionStorage.removeItem("adb.relogin"); } catch (e) {} }
    } catch (e) {
      const msg = (e && (e.message || e.details)) ? String(e.message || e.details) : "errore sconosciuto";
      const esc2 = t => t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      problem("Dati cloud non disponibili.", "Dettaglio: " + esc2(msg) + ". Puoi riprovare o usare il CSV.", isAuthError(e));
    }
  }
  document.addEventListener("DOMContentLoaded", load);
})();

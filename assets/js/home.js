/* TOOLBOX ALESSANDRO — homepage: card, filtri, installazione (il tema è in toolkit-theme.js) */
"use strict";
(function () {
  const FILTER_KEY = "toolbox.filter";
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
  const CATS = (typeof CATEGORIES !== "undefined") ? CATEGORIES : {};
  const LIST = (typeof APPS !== "undefined" && Array.isArray(APPS)) ? APPS : [];

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Card ---------- */
  function catVars(node, cat) {
    node.style.setProperty("--cat-l", cat.color);
    node.style.setProperty("--cat-t", cat.text || cat.color);
    node.style.setProperty("--cat-d", cat.dark || cat.color);
  }

  function card(app) {
    const cat = CATS[app.category] || { label: "", color: "#5d6470" };
    const a = el("a", "app-card");
    a.href = app.url;
    a.dataset.app = app.id;
    catVars(a, cat);
    a.setAttribute("aria-label", app.title + " — " + app.description);

    const icon = el("span", "app-icon");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = app.icon || "";

    const body = el("span", "app-body");
    if (cat.label) body.appendChild(el("span", "app-cat", cat.label));
    body.appendChild(el("span", "app-title", app.title));
    body.appendChild(el("span", "app-desc", app.description));
    if (Array.isArray(app.tags) && app.tags.length) {
      const tags = el("span", "app-tags");
      app.tags.forEach(t => tags.appendChild(el("span", "app-tag", t)));
      body.appendChild(tags);
    }

    const ver = el("span", "app-ver", app.version ? "v" + app.version : "");
    if (app.version) ver.title = "Versione " + app.version;

    a.append(icon, body, ver);
    a.insertAdjacentHTML("beforeend", ARROW.replace("<svg ", '<svg class="app-arrow" '));
    return a;
  }

  /* ---------- Registro delle versioni ---------- */
  function renderChangelog() {
    const list = document.getElementById("changelog-list");
    const log = (typeof CHANGELOG !== "undefined" && Array.isArray(CHANGELOG)) ? CHANGELOG : [];
    if (!list) return;
    if (!log.length) { list.closest("details").hidden = true; return; }
    const names = {};
    LIST.forEach(a => { names[a.id] = a.title; });
    names.toolbox = "Toolbox";
    list.textContent = "";
    const VISIBLE = 3;
    let expanded = false;
    let more = document.getElementById("changelog-more");
    if (!more) {
      more = el("button", "log-more");
      more.id = "changelog-more";
      more.type = "button";
      list.insertAdjacentElement("afterend", more);
      more.addEventListener("click", () => { expanded = !expanded; apply(); });
    }
    function apply() {
      Array.from(list.children).forEach((li, i) => { li.hidden = !expanded && i >= VISIBLE; });
      more.hidden = log.length <= VISIBLE;
      more.textContent = expanded ? "Mostra meno" : "Mostra tutto (" + log.length + ")";
      more.setAttribute("aria-expanded", String(expanded));
    }
    log.forEach(e => {
      const li = el("li");
      const d = new Date(e.date + "T12:00:00");
      li.appendChild(el("time", "log-date", isNaN(d) ? e.date : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })));
      li.appendChild(el("strong", null, (names[e.app] || e.app) + " v" + e.version));
      li.appendChild(el("span", null, e.text));
      list.appendChild(li);
    });
    apply();
  }

  /* ---------- Filtri + griglia ---------- */
  function usedCategories() {
    return Object.keys(CATS).filter(k => LIST.some(a => a.category === k));
  }

  function renderGrid(filter) {
    const grid = document.getElementById("app-grid");
    const items = filter === "all" ? LIST : LIST.filter(a => a.category === filter);
    grid.textContent = "";
    items.forEach(app => grid.appendChild(card(app)));
    const c = document.getElementById("app-count");
    if (c) {
      c.textContent = items.length === 1 ? "1 strumento" : items.length + " strumenti";
    }
  }

  function renderFilters() {
    const box = document.getElementById("filters");
    const cats = usedCategories();
    let active = read(FILTER_KEY) || "all";
    if (active !== "all" && !cats.includes(active)) active = "all";

    box.textContent = "";
    box.hidden = cats.length < 2;            // con una sola categoria i filtri non servono

    const make = (key, label, color) => {
      const b = el("button", "pill", label);
      b.type = "button";
      b.dataset.filter = key;
      if (color) catVars(b, color);
      b.setAttribute("aria-pressed", String(key === active));
      b.addEventListener("click", () => {
        box.querySelectorAll(".pill").forEach(p => p.setAttribute("aria-pressed", String(p === b)));
        store(FILTER_KEY, key);
        renderGrid(key);
      });
      return b;
    };
    box.appendChild(make("all", "Tutti"));
    cats.forEach(k => box.appendChild(make(k, CATS[k].label, CATS[k])));
    renderGrid(active);
  }

  /* Diario degli Audiolibri: "Memorizza il CSV in questo browser" attiva di default (prefsRev 2) */
  try {
    const KEY = "adb.prefs.v1";
    const prefs = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    if (prefs.prefsRev !== 2) { prefs.saveData = true; prefs.prefsRev = 2; localStorage.setItem(KEY, JSON.stringify(prefs)); }
  } catch (e) {}

  /* ---------- Installazione PWA ---------- */
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferred = e;
    const b = document.getElementById("btn-install"); if (b) b.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    deferred = null; const b = document.getElementById("btn-install"); if (b) b.hidden = true;
  });

  document.addEventListener("DOMContentLoaded", () => {
    renderFilters();
    renderChangelog();

    const b = document.getElementById("btn-install");
    if (b) b.addEventListener("click", async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) {}
      deferred = null; b.hidden = true;
    });
  });
})();

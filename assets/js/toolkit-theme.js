/* TOOLBOX — tema chiaro/scuro condiviso da home e applicativi.
   Va caricato nel <head> PRIMA dei fogli di stile (senza defer), così il tema
   è applicato subito e non c'è il "lampo" di colore.
   - Tema di base: chiaro. Lo scuro si attiva solo dal pulsante e resta memorizzato
     in questo browser (chiave "toolbox.theme"), valido per tutte le app.
   - Ogni <button data-tk-theme> diventa un pulsante tema; per pulsanti creati dopo
     il caricamento basta chiamare ToolkitTheme.mount(elemento).
   - Le app possono ascoltare l'evento "toolkit:theme" su window (detail = "light"|"dark"). */
(function () {
  "use strict";
  var KEY = "toolbox.theme";
  var COLORS = { light: "#eef1f4", dark: "#15191e" };
  var ICONS = {
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  };
  var LABELS = { light: "Passa al tema scuro", dark: "Passa al tema chiaro" };

  function read() { try { return localStorage.getItem(KEY) === "dark" ? "dark" : "light"; } catch (e) { return "light"; } }
  function save(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }

  function meta(name, content) {
    var m = document.querySelector('meta[name="' + name + '"]');
    if (!m) { m = document.createElement("meta"); m.name = name; (document.head || document.documentElement).appendChild(m); }
    m.setAttribute("content", content);
  }

  function paintButtons(t) {
    var list = document.querySelectorAll("[data-tk-theme]");
    for (var i = 0; i < list.length; i++) paint(list[i], t);
  }
  function paint(b, t) {
    b.innerHTML = ICONS[t];
    b.title = LABELS[t];
    b.setAttribute("aria-label", LABELS[t]);
  }

  function apply(t, silent) {
    var root = document.documentElement;
    root.dataset.theme = t;
    meta("theme-color", COLORS[t]);
    meta("color-scheme", t);
    paintButtons(t);
    if (!silent) { try { window.dispatchEvent(new CustomEvent("toolkit:theme", { detail: t })); } catch (e) {} }
  }

  function set(t) { t = t === "dark" ? "dark" : "light"; save(t); apply(t); }
  function toggle() { set(read() === "dark" ? "light" : "dark"); }

  function mount(b) {
    if (!b || b.__tkTheme) return b;
    b.__tkTheme = true;
    if (b.tagName === "BUTTON" && !b.getAttribute("type")) b.type = "button";
    if (!b.className) b.className = "tk-theme-btn";
    paint(b, read());
    b.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
    return b;
  }

  window.ToolkitTheme = { get: read, set: set, toggle: toggle, mount: mount };

  apply(read(), true);
  document.addEventListener("DOMContentLoaded", function () {
    apply(read(), true);
    var list = document.querySelectorAll("[data-tk-theme]");
    for (var i = 0; i < list.length; i++) mount(list[i]);
  });
  /* Un'altra scheda ha cambiato tema: allinea anche questa */
  window.addEventListener("storage", function (e) { if (e.key === KEY) apply(read()); });
})();

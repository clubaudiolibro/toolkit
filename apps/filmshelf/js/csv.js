/**
 * csv.js — lettura e scrittura di file CSV (nel browser, senza librerie).
 */

/**
 * Legge un testo CSV (separatore virgola o punto e virgola, campi tra virgolette anche su più righe).
 * Restituisce un array di oggetti { intestazione: valore }.
 */
export function parseCsv(text, sep = null) {
  text = String(text || '').replace(/^﻿/, '');
  if (!sep) {
    const first = text.slice(0, text.indexOf('\n') >>> 0);
    sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  }
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

/** Un valore per il CSV in stile Excel italiano (separatore ";"): virgolette se serve. */
function cell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Costruisce un CSV (UTF-8 con BOM, separatore ";") da intestazioni e righe (array di array). */
export function buildCsv(headers, rows) {
  return '﻿' + [headers, ...rows].map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Fa scaricare un testo come file. */
export function download(text, filename, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

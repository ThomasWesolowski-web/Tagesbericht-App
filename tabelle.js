// Excel- und CSV-Dateien lesen, um sie in der App als Tabelle anzuzeigen (ohne Bibliothek).
// Eine .xlsx-Datei ist ein ZIP-Archiv mit XML-Dateien; entpackt wird mit DecompressionStream.
// Alte .xls-Dateien (Binärformat) lassen sich so nicht lesen.

export const MAX_ZEILEN = 2000;
export const MAX_SPALTEN = 100;

const endung = (f) => (/\.([a-z0-9]+)$/i.exec(f?.name || '')?.[1] || '').toLowerCase();
export const istExcel = (f) => ['xlsx', 'xlsm'].includes(endung(f)) || /spreadsheetml/.test(f?.type || '');
export const istAltesExcel = (f) => endung(f) === 'xls' || f?.type === 'application/vnd.ms-excel';
export const istCsv = (f) => endung(f) === 'csv' || f?.type === 'text/csv';
export const istTabelle = (f) => istExcel(f) || istCsv(f);

// Liefert [{ name, zeilen: [[Text, …], …], gekuerzt }]
export async function tabelleLesen(file) {
  if (istCsv(file)) return [{ name: file.name.replace(/\.[^.]+$/, ''), ...csvLesen(await textLesen(file.blob)) }];
  return xlsxLesen(file.blob);
}

async function textLesen(blob) {
  const buf = await blob.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // Excel speichert CSV oft in Windows-1252 (Umlaute)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8.replace(/^﻿/, '');
}

function csvLesen(text) {
  const ersteZeile = text.split(/\r?\n/, 1)[0];
  const trenner = [';', ',', '\t'].reduce((a, b) => (ersteZeile.split(b).length > ersteZeile.split(a).length ? b : a));
  const zeilen = [];
  let zeile = [];
  let feld = '';
  let inAnf = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inAnf) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inAnf = false;
      else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === trenner) { zeile.push(feld); feld = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld);
      zeilen.push(zeile);
      zeile = [];
      feld = '';
    } else feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return kuerzen(zeilen);
}

function kuerzen(zeilen) {
  const gekuerzt = zeilen.length > MAX_ZEILEN || zeilen.some((z) => z.length > MAX_SPALTEN);
  return { zeilen: zeilen.slice(0, MAX_ZEILEN).map((z) => z.slice(0, MAX_SPALTEN)), gekuerzt };
}

// ZIP: Inhaltsverzeichnis am Ende lesen, einzelne Dateien bei Bedarf entpacken
function zipOeffnen(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('keine Excel-Datei');
  const anzahl = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dateien = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < anzahl; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const methode = dv.getUint16(p + 10, true);
    const groesse = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const kommLen = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    dateien.set(name, { methode, groesse, lokal });
    p += 46 + nameLen + extraLen + kommLen;
  }
  const lesen = async (name) => {
    const e = dateien.get(name);
    if (!e) return null;
    const start = e.lokal + 30 + dv.getUint16(e.lokal + 26, true) + dv.getUint16(e.lokal + 28, true);
    const daten = new Uint8Array(buf, start, e.groesse);
    if (e.methode === 0) return dec.decode(daten);
    if (e.methode !== 8) throw new Error('unbekannte Packart');
    const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(strom).text();
  };
  return { lesen, namen: [...dateien.keys()] };
}

const xml = (text) => new DOMParser().parseFromString(text, 'application/xml');
const kinder = (el, name) => [...el.getElementsByTagNameNS('*', name)];

// Spaltenbuchstaben → Nummer (A = 0, AA = 26)
function spalte(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// Excel-Datumszahl (Tage seit 30.12.1899) → TT.MM.JJJJ
function datumText(zahl, mitZeit) {
  const ms = Math.round((zahl - 25569) * 86400000);
  const d = new Date(ms);
  const zwei = (x) => String(x).padStart(2, '0');
  const tag = `${zwei(d.getUTCDate())}.${zwei(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  if (zahl < 1) return `${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}`;
  return mitZeit ? `${tag} ${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}` : tag;
}

const zahlText = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: 6 }) : v;
};

async function xlsxLesen(blob) {
  const zip = zipOeffnen(await blob.arrayBuffer());
  const wb = await zip.lesen('xl/workbook.xml');
  if (!wb) throw new Error('keine Excel-Datei');
  const rels = xml((await zip.lesen('xl/_rels/workbook.xml.rels')) || '<r/>');
  const ziel = new Map(kinder(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const ss = await zip.lesen('xl/sharedStrings.xml');
  const texte = ss ? kinder(xml(ss), 'si').map((si) => kinder(si, 't').filter((t) => t.parentNode.localName !== 'rPh').map((t) => t.textContent).join('')) : [];
  // Formate, die ein Datum anzeigen
  const datumStil = [];
  const st = await zip.lesen('xl/styles.xml');
  if (st) {
    const doc = xml(st);
    const eigene = new Map(kinder(doc, 'numFmt').map((n) => [Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') || '']));
    const xfs = kinder(doc, 'cellXfs')[0];
    (xfs ? kinder(xfs, 'xf') : []).forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId') || 0);
      const code = eigene.get(id);
      const istDatum = (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (code != null && /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, '')));
      if (istDatum) datumStil[i] = { zeit: id === 22 || /h/i.test(code || '') };
    });
  }
  const blaetter = [];
  for (const s of kinder(xml(wb), 'sheet')) {
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id');
    let pfad = ziel.get(rid) || '';
    pfad = pfad.startsWith('/') ? pfad.slice(1) : `xl/${pfad}`;
    const inhalt = await zip.lesen(pfad);
    if (!inhalt) continue;
    const zeilen = [];
    let gekuerzt = false;
    for (const row of kinder(xml(inhalt), 'row')) {
      const r = Number(row.getAttribute('r') || zeilen.length + 1) - 1;
      if (r >= MAX_ZEILEN) { gekuerzt = true; break; }
      const zeile = [];
      let naechste = 0;
      for (const c of kinder(row, 'c')) {
        let i = spalte(c.getAttribute('r'));
        if (i < 0) i = naechste;
        naechste = i + 1;
        if (i >= MAX_SPALTEN) { gekuerzt = true; continue; }
        const typ = c.getAttribute('t');
        const v = kinder(c, 'v')[0]?.textContent ?? '';
        let wert;
        if (typ === 's') wert = texte[Number(v)] ?? '';
        else if (typ === 'inlineStr') wert = kinder(c, 't').map((t) => t.textContent).join('');
        else if (typ === 'b') wert = v === '1' ? 'WAHR' : 'FALSCH';
        else if (typ === 'str' || typ === 'e') wert = v;
        else if (v !== '' && datumStil[Number(c.getAttribute('s') || 0)]) wert = datumText(Number(v), datumStil[Number(c.getAttribute('s'))].zeit);
        else wert = v === '' ? '' : zahlText(v);
        zeile[i] = wert;
      }
      zeilen[r] = Array.from(zeile, (x) => x ?? '');
    }
    const voll = Array.from(zeilen, (z) => z || []);
    // leere Zeilen am Ende (nur formatiert) weglassen
    while (voll.length && voll[voll.length - 1].every((x) => x === '')) voll.pop();
    blaetter.push({ name: s.getAttribute('name') || `Blatt ${blaetter.length + 1}`, zeilen: voll, gekuerzt });
  }
  if (!blaetter.length) throw new Error('keine Tabellenblätter gefunden');
  return blaetter;
}

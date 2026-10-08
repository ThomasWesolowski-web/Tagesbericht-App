// Raumaufmaß als eigene Test-App (vorübergehend getrennt von der Tagesberichte-App).
// Ein Aufmaß hat einen Namen (z. B. Baustelle) und Räume. Alles bleibt auf dem Gerät (IndexedDB),
// ausgegeben wird ein PDF mit den Grundrissen und Flächen. Der Editor ist raumaufmass.js.

import { openRaumAufmass } from './raumaufmass.js';
import { zeige3d } from './ansicht3d.js';
import { materialPlaner, systemListe, systemEditor, systemSpeicherSetzen, alleSysteme } from './material-ui.js';
import { bedarf, KNAUF_STAND } from './material.js';
import {
  neuerRaum, berechne, raumKurz, alsSvg, massstabFuer, grenzen, planElemente, gruppeElemente, geschlossen,
  naechsterName, fmt2, verschiebeRaum, grundrissAbgleichen,
} from './raumgeometrie.js';

const RA_VERSION = '1.9.1';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const heute = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ICON = {
  zurueck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM12 5v6M12 14v5M12 11h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  stift: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  weg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  teilen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wuerfel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  schichten: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16M9 4v16M13 4v16M20 4v16M9 8h4M9 16h4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

let toastTimer = 0;
function toast(text, ms = 2600) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Speicher (IndexedDB) ----------
const dbOffen = new Promise((resolve, reject) => {
  // Version 2: Store „systeme“ für eigene oder geänderte Material-Systeme
  const req = indexedDB.open('raumaufmass', 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('projekte')) db.createObjectStore('projekte', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('systeme')) db.createObjectStore('systeme', { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function tx(modus, fn) {
  const db = await dbOffen;
  return new Promise((resolve, reject) => {
    const t = db.transaction('projekte', modus);
    const erg = fn(t.objectStore('projekte'));
    t.oncomplete = () => resolve(erg?.result);
    t.onabort = () => reject(t.error);
    t.onerror = () => reject(t.error);
  });
}
systemSpeicherSetzen(() => dbOffen);
const alleProjekte = () => tx('readonly', (s) => s.getAll());
const projektLaden = (id) => tx('readonly', (s) => s.get(id));
const projektSpeichern = (p) => tx('readwrite', (s) => s.put({ ...p, geaendert: Date.now() }));
const projektLoeschen = (id) => tx('readwrite', (s) => s.delete(id));

// ---------- Hilfen ----------
const fertig = (r) => geschlossen(r) && r.massstabGesetzt;
const svgBild = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
// Räume mit gleicher gruppe bilden einen gemeinsamen Grundriss
function gruppen(raeume) {
  const out = new Map();
  for (const r of raeume) if (r.gruppe && fertig(r)) out.set(r.gruppe, [...(out.get(r.gruppe) || []), r]);
  return [...out.values()].filter((l) => l.length > 1);
}
// Für die 3-D-Ansicht: Grundrisse (Gruppen) und einzelne Räume nebeneinander statt übereinander
function nebeneinander(raeume) {
  const teile = [];
  const gesehen = new Set();
  for (const r of raeume) {
    if (gesehen.has(r.id)) continue;
    const t = r.gruppe ? raeume.filter((x) => x.gruppe === r.gruppe) : [r];
    t.forEach((x) => gesehen.add(x.id));
    teile.push(t);
  }
  const out = [];
  let x = 0;
  for (const t of teile) {
    const g = t.map(grenzen);
    const x0 = Math.min(...g.map((b) => b.x0));
    const y0 = Math.min(...g.map((b) => b.y0));
    const x1 = Math.max(...g.map((b) => b.x1));
    out.push(...t.map((r) => verschiebeRaum(r, [x - x0, -y0]).raum));
    x += x1 - x0 + 1;
  }
  return out;
}
const bodenSumme = (raeume) => raeume.filter(fertig).reduce((s, r) => s + berechne(r).bodenflaeche, 0);

// ---------- Ansichten ----------
const appbar = $('#appbar');
const view = $('#view');

async function liste() {
  appbar.innerHTML = `<h1>Raumaufmaß<span class="sub">Testversion ${RA_VERSION}, getrennt von der Berichte-App</span></h1>`;
  const projekte = (await alleProjekte()).sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0));
  view.innerHTML = `
    <section class="section">
      <h2>Aufmaße</h2>
      <div class="knoepfe">
        ${projekte.length ? projekte.map((p) => `<button type="button" class="proj" data-id="${p.id}"><span><b>${esc(p.name)}</b><small>${esc(p.datum)} · ${p.raeume.length} ${p.raeume.length === 1 ? 'Raum' : 'Räume'} · ${fmt2(bodenSumme(p.raeume))} m² Boden netto</small></span>${ICON.zurueck.replace('M15 5l-7 7 7 7', 'M9 5l7 7-7 7')}</button>`).join('') : '<p class="leer">Noch kein Aufmaß. Unten ein neues anlegen.</p>'}
      </div>
      <div class="knoepfe"><button type="button" class="btn primary block" id="neu">${ICON.plus} Neues Aufmaß</button>
        <button type="button" class="btn ghost block" id="systeme">${ICON.schichten} Systeme für Material (Knauf, eigene)</button></div>
      <p class="hint">Räume skizzieren, eine Wand messen, Türen, Fenster, Dachschrägen und Körper (Kamin, Säule) setzen, Räume Wand an Wand anbauen. Alles bleibt auf diesem Gerät gespeichert; als PDF ansehen, teilen oder speichern.</p>
    </section>`;
  $$('.proj', view).forEach((b) => { b.onclick = () => { location.hash = `#/p/${b.dataset.id}`; }; });
  $('#systeme').onclick = () => { location.hash = '#/systeme'; };
  $('#neu').onclick = async () => {
    const p = { id: neueId(), name: `Aufmaß ${heute()}`, datum: heute(), raeume: [], erstellt: Date.now() };
    await projektSpeichern(p);
    location.hash = `#/p/${p.id}`;
  };
}

async function projekt(id) {
  let p = await projektLaden(id);
  if (!p) { location.hash = '#/'; return; }
  const speichern = async () => { await projektSpeichern(p); p = await projektLaden(id); };
  // Türen in gemeinsamen Wänden und übernommene Dachflächen nachziehen (auch in älteren Aufmaßen)
  const abgeglichen = grundrissAbgleichen(p.raeume);
  if (abgeglichen.some((r, k) => r !== p.raeume[k])) { p.raeume = abgeglichen; await speichern(); }
  appbar.innerHTML = `<button type="button" class="icon-btn" id="back" aria-label="Zurück">${ICON.zurueck}</button><h1 class="small">${esc(p.name)}<span class="sub">${esc(p.datum)}</span></h1>`;
  $('#back').onclick = () => { location.hash = '#/'; };

  const oeffnen = async (vorlage) => {
    const nachbarn = vorlage.gruppe ? p.raeume.filter((x) => x.gruppe === vorlage.gruppe && x.id !== vorlage.id) : [];
    let erg;
    try {
      erg = await openRaumAufmass(vorlage, { nachbarn, namen: p.raeume.filter((x) => x.id !== vorlage.id).map((x) => x.name) });
    } catch (err) {
      toast(`Der Raum konnte nicht geöffnet werden (${err.message}).`, 5000);
      return;
    }
    if (!erg) return;
    for (const { daten } of erg.raeume || [{ daten: erg.daten }]) {
      const i = p.raeume.findIndex((x) => x.id === daten.id);
      if (i >= 0) p.raeume[i] = daten; else p.raeume.push(daten);
    }
    await speichern();
    zeichnen();
    toast((erg.raeume?.length || 1) > 1 ? `${erg.raeume.length} Räume gespeichert.` : 'Raum gespeichert.');
  };

  const zeichnen = () => {
    const gr = gruppen(p.raeume);
    view.innerHTML = `
      <section class="section">
        <label class="field"><span>Name des Aufmaßes (z. B. Baustelle)</span><input type="text" id="name" value="${esc(p.name)}"></label>
      </section>
      <section class="section">
        <h2>Räume <span class="h-right">${fmt2(bodenSumme(p.raeume))} m² Boden netto</span></h2>
        <div class="fa-karten" id="karten">
          ${gr.map((l, k) => `<div class="fa-karte" data-gruppe="${k}">
            <button type="button" class="fa-karte-bild ra-bild" aria-label="Grundriss ansehen"><img src="${svgBild(alsSvg(l, massstabFuer(l)))}" alt=""></button>
            <div class="fa-karte-text"><b>Grundriss gesamt</b><small>${l.length} Räume · ${fmt2(bodenSumme(l))} m² Boden netto</small></div>
            <button type="button" class="btn soft ra-bearbeiten" aria-label="Grundriss bearbeiten">${ICON.stift}</button>
          </div>`).join('')}
          ${p.raeume.map((r) => `<div class="fa-karte" data-id="${r.id}">
            <button type="button" class="fa-karte-bild ra-bild" aria-label="Grundriss ansehen">${fertig(r) ? `<img src="${svgBild(alsSvg(r, massstabFuer(r)))}" alt="">` : ICON.plan}</button>
            <button type="button" class="fa-karte-text ra-name" aria-label="Raum umbenennen"><b>${esc(r.name)} ${ICON.stift}</b><small>${esc(raumKurz(r))}</small></button>
            <button type="button" class="btn soft ra-bearbeiten" aria-label="Raum bearbeiten">${ICON.stift}</button>
            <button type="button" class="icon-btn fa-weg ra-weg" aria-label="Raum entfernen">${ICON.weg}</button>
          </div>`).join('')}
        </div>
        ${p.raeume.length ? '' : '<p class="leer">Noch keine Räume.</p>'}
        <div class="knoepfe">
          <button type="button" class="btn primary block" id="raum-neu">${ICON.plan} Raum zeichnen</button>
          <button type="button" class="btn ghost block" id="drei-d" ${p.raeume.some(fertig) ? '' : 'disabled'}>${ICON.wuerfel} 3-D ansehen</button>
          <button type="button" class="btn ghost block" id="material" ${p.raeume.some(fertig) ? '' : 'disabled'}>${ICON.schichten} Material planen</button>
          <button type="button" class="btn ghost block" id="pdf" ${p.raeume.some(fertig) ? '' : 'disabled'}>${ICON.pdf} PDF ansehen</button>
        </div>
      </section>
      <section class="section">
        <button type="button" class="btn danger block" id="loeschen">${ICON.weg} Aufmaß löschen</button>
      </section>`;
    $('#name').onchange = async (e) => {
      p.name = e.target.value.trim() || p.name;
      await speichern();
      $('h1', appbar).firstChild.textContent = p.name;
    };
    $$('.fa-karte[data-gruppe]', view).forEach((el) => {
      const l = gr[Number(el.dataset.gruppe)];
      $('.ra-bild', el).onclick = () => bildZeigen(alsSvg(l, massstabFuer(l)));
      $('.ra-bearbeiten', el).onclick = () => oeffnen(l[0]);
    });
    $$('.fa-karte[data-id]', view).forEach((el) => {
      const r = p.raeume.find((x) => x.id === el.dataset.id);
      $('.ra-bild', el).onclick = () => (fertig(r) ? bildZeigen(alsSvg(r, massstabFuer(r))) : oeffnen(r));
      $('.ra-bearbeiten', el).onclick = () => oeffnen(r);
      $('.ra-name', el).onclick = async () => {
        const neu = prompt('Neuer Name für den Raum:', r.name)?.trim();
        if (!neu || neu === r.name) return;
        r.name = neu;
        p.raeume = grundrissAbgleichen(p.raeume);
        await speichern();
        zeichnen();
        toast('Raum umbenannt.');
      };
      $('.ra-weg', el).onclick = async () => {
        if (!confirm(`„${r.name}“ entfernen?`)) return;
        p.raeume = grundrissAbgleichen(p.raeume.filter((x) => x.id !== r.id));
        await speichern();
        zeichnen();
      };
    });
    $('#raum-neu').onclick = () => oeffnen({ ...neuerRaum(1), name: naechsterName(p.raeume.map((x) => x.name)) });
    $('#drei-d').onclick = () => zeige3d(nebeneinander(p.raeume.filter(fertig)), p.name);
    $('#material').onclick = () => { location.hash = `#/p/${p.id}/material`; };
    $('#pdf').onclick = async () => {
      try {
        const blob = await pdfBauen(p, await alleSysteme());
        await pdfZeigen(blob, `${(p.name || 'raumaufmass').replace(/[^\wäöüÄÖÜß-]+/g, '_')}.pdf`, p.name);
      } catch (err) {
        toast(`PDF ging nicht (${err.message}).`, 5000);
      }
    };
    $('#loeschen').onclick = async () => {
      if (!confirm(`„${p.name}“ mit allen Räumen löschen?`)) return;
      await projektLoeschen(p.id);
      location.hash = '#/';
    };
  };
  zeichnen();
}

// Grundriss groß ansehen (SVG im Vollbild, schließen durch Antippen)
function bildZeigen(svg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;background:#fff;display:grid;place-items:center;padding:calc(env(safe-area-inset-top) + 12px) 12px 12px;';
  el.innerHTML = `<img src="${svgBild(svg)}" alt="Grundriss" style="max-width:100%;max-height:100%;object-fit:contain"><button type="button" class="btn primary" style="position:absolute;top:calc(env(safe-area-inset-top) + 12px);right:12px">Schließen</button>`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
}

// PDF erst in der App ansehen (wie in der Berichte-App), Teilen/Speichern über den Knopf unten
let pdfjs = null;
async function pdfJsLaden() {
  if (!pdfjs) {
    pdfjs = await import('../vendor/pdf.min.js');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.js', location.href).href;
  }
  return pdfjs;
}

async function pdfZeigen(blob, name, titel) {
  const ansicht = document.createElement('div');
  ansicht.className = 'pdf-view';
  ansicht.innerHTML = `
    <header><button type="button" class="icon-btn" id="pdfv-close" aria-label="Zurück">${ICON.zurueck}</button>
      <div><b>${esc(titel || name)}</b><small id="pdfv-info">PDF</small></div>
      <div class="pdfv-zoom"><button type="button" data-z="-1" aria-label="Verkleinern">−</button><button type="button" data-z="1" aria-label="Vergrößern">+</button></div></header>
    <div class="pdf-pages" id="pdfv-pages"><p class="hint" style="text-align:center;margin-top:40px">PDF wird geladen …</p></div>
    <footer><button type="button" class="btn primary block" id="pdfv-share">${ICON.teilen} Teilen oder speichern</button></footer>`;
  document.body.appendChild(ansicht);
  document.body.classList.add('no-scroll');
  let zu = false;
  let dok = null;
  const schliessen = () => { zu = true; ansicht.remove(); document.body.classList.remove('no-scroll'); dok?.destroy(); };
  $('#pdfv-close', ansicht).onclick = schliessen;
  $('#pdfv-share', ansicht).onclick = () => teilen(blob, name);

  const seiten = $('#pdfv-pages', ansicht);
  // + und − zeichnen das PDF größer (die App selbst ist nicht zoombar)
  const STUFEN = [1, 1.5, 2, 3];
  let stufe = 0;
  let nrZeichnen = 0;
  const zeichnen = async () => {
    const nr = ++nrZeichnen;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const breite = Math.min(seiten.clientWidth - 16, 900) * STUFEN[stufe];
    const neu = [];
    for (let i = 1; i <= dok.numPages; i++) {
      const seite = await dok.getPage(i);
      const basis = seite.getViewport({ scale: 1 });
      const hoehe = (breite / basis.width) * basis.height;
      const k = Math.min(dpr, Math.sqrt(4e6 / (breite * hoehe)));
      const vp = seite.getViewport({ scale: (breite / basis.width) * k });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${breite}px`;
      await seite.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      seite.cleanup();
      if (zu || nr !== nrZeichnen) { canvas.width = 0; return; }
      neu.push(canvas);
    }
    seiten.querySelectorAll('canvas').forEach((c) => { c.width = 0; c.height = 0; });
    seiten.replaceChildren(...neu);
    seiten.classList.toggle('gezoomt', stufe > 0);
  };
  $$('.pdfv-zoom button', ansicht).forEach((b) => {
    b.onclick = () => {
      const s = Math.min(STUFEN.length - 1, Math.max(0, stufe + Number(b.dataset.z)));
      if (s === stufe || !dok) return;
      stufe = s;
      zeichnen().catch(() => {});
    };
  });
  try {
    const lib = await pdfJsLaden();
    dok = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    if (zu) { dok.destroy(); return; }
    seiten.innerHTML = '';
    $('#pdfv-info', ansicht).textContent = `${dok.numPages} ${dok.numPages === 1 ? 'Seite' : 'Seiten'}`;
    await zeichnen();
  } catch (err) {
    if (zu) return;
    seiten.innerHTML = `<p class="hint" style="text-align:center;margin-top:40px">Vorschau nicht möglich (${esc(err.message)}).<br>Tippe unten auf „Teilen oder speichern“.</p>`;
  }
}

async function teilen(blob, name) {
  const datei = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [datei] })) { await navigator.share({ files: [datei], title: name }); return; }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- PDF ----------
function jsPdfLaden() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '../vendor/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf);
    s.onerror = () => reject(new Error('jsPDF fehlt'));
    document.head.appendChild(s);
  });
}

// jsPDF kann nur Windows-1252; andere Zeichen ersetzen (wie in der Berichte-App)
const pdfText = (t) => String(t ?? '').normalize('NFC').replace(/[^\u0000-ÿ€–—‘’‚“”„•…]/g, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\u0000-ÿ]/g, '?'));

export async function pdfBauen(p, systeme = null) {
  const { jsPDF } = await jsPdfLaden();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 18;
  const CW = 210 - 2 * M;
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  let y = M;
  let erste = true;
  const neueSeite = () => { if (!erste) doc.addPage(); erste = false; y = M; };
  const titel = (t) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 35, 42);
    doc.text(pdfText(t), M, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 98, 108);
    doc.text(pdfText(`${p.name} · ${p.datum}`), M, y + 11);
    y += 18;
  };
  const tabelle = (zeilen, fettLetzte) => {
    doc.setFontSize(10);
    zeilen.forEach(([a, b, c], i) => {
      if (y > 297 - M) { doc.addPage(); y = M + 4; }
      const fett = fettLetzte && i === zeilen.length - 1;
      doc.setFont('helvetica', fett ? 'bold' : 'normal'); doc.setTextColor(30, 35, 42);
      doc.text(pdfText(a), M, y);
      doc.text(pdfText(b), M + CW - 16, y, { align: 'right' });
      doc.text(pdfText(c || ''), M + CW - 13, y);
      doc.setDrawColor(225, 228, 232); doc.setLineWidth(0.2);
      doc.line(M, y + 2, M + CW, y + 2);
      y += 7;
    });
  };
  const plan = (was) => {
    const liste = Array.isArray(was) ? was : [was];
    const gr = grenzen(liste);
    const gesamt = Array.isArray(was);
    const rand = gesamt ? 6 : 14;
    const mst = massstabFuer(liste, CW - 2 * rand, 150);
    const s = 1000 / mst;
    const bw = (gr.x1 - gr.x0) * s;
    const bh = (gr.y1 - gr.y0) * s;
    const x0 = M + (CW - bw) / 2;
    const y0 = y + rand;
    const abb = ([x, yy]) => [x0 + (x - gr.x0) * s, y0 + (yy - gr.y0) * s];
    const opt = { wand: 0.6, duenn: 0.2, schrift: 2.6, massAbstand: 7, flaeche: '#f3f5f8', schraege: '#e2e8f0' };
    // Grundriss gesamt in kleinem Maßstab: kleinere Schrift, nur Raumnamen, Flächen und Wandmaße
    // (Türen, Fenster, Körper usw. stehen beschriftet auf den Seiten der einzelnen Räume)
    if (gesamt && mst >= 200) Object.assign(opt, { wand: 0.45, duenn: 0.15, schrift: mst >= 400 ? 1.5 : 1.8, details: false });
    for (const e of gesamt ? gruppeElemente(liste, abb, opt) : planElemente(was, abb, opt)) {
      if (e.art === 'flaeche') {
        doc.setFillColor(...rgb(e.farbe));
        const rel = e.punkte.slice(1).map((q, k) => [q[0] - e.punkte[k][0], q[1] - e.punkte[k][1]]);
        doc.lines(rel, e.punkte[0][0], e.punkte[0][1], [1, 1], 'F', true);
      } else if (e.art === 'linie' || e.art === 'bogen') {
        doc.setDrawColor(...rgb(e.farbe));
        doc.setLineWidth(e.breite);
        doc.setLineDashPattern(e.gestrichelt ? [0.8, 0.6] : [], 0);
        if (e.art === 'linie') doc.line(e.a[0], e.a[1], e.b[0], e.b[1]);
        else {
          let d = e.bis - e.von;
          while (d <= -Math.PI) d += 2 * Math.PI;
          while (d > Math.PI) d -= 2 * Math.PI;
          for (let k = 0; k < 24; k++) {
            const w1 = e.von + (d * k) / 24;
            const w2 = e.von + (d * (k + 1)) / 24;
            doc.line(e.m[0] + e.r * Math.cos(w1), e.m[1] + e.r * Math.sin(w1), e.m[0] + e.r * Math.cos(w2), e.m[1] + e.r * Math.sin(w2));
          }
        }
      } else if (e.art === 'text') {
        doc.setFont('helvetica', e.fett ? 'bold' : 'normal');
        doc.setFontSize(e.groesse * 2.835);
        doc.setTextColor(...rgb(e.farbe));
        const t = pdfText(e.text);
        const w = doc.getTextWidth(t);
        const a = ((e.winkel || 0) * Math.PI) / 180;
        const hoch = e.groesse * 0.35;
        doc.text(t, e.p[0] - Math.cos(a) * (w / 2) - Math.sin(a) * hoch, e.p[1] - Math.sin(a) * (w / 2) + Math.cos(a) * hoch, { angle: -(e.winkel || 0) });
      }
    }
    doc.setLineDashPattern([], 0);
    y = y0 + bh + rand + 2;
    doc.setDrawColor(30, 35, 42); doc.setLineWidth(0.4);
    doc.line(M, y, M + s, y); doc.line(M, y - 1.2, M, y + 1.2); doc.line(M + s, y - 1.2, M + s, y + 1.2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 98, 108);
    doc.text(pdfText(`1 m · Maßstab 1:${mst} (A4 ohne Anpassen drucken) · Maße in m, blau = gemessen`), M + s + 3, y + 1);
    y += 9;
  };
  const raeume = p.raeume.filter(fertig);
  for (const l of gruppen(raeume)) {
    neueSeite();
    titel('Grundriss gesamt');
    plan(l);
    tabelle([...l.map((r) => { const b = berechne(r); return [r.name, fmt2(b.bodenflaeche), 'm²']; }), ['Bodenfläche gesamt (netto)', fmt2(bodenSumme(l)), 'm²']], true);
    y += 4;
    tabelle([...l.map((r) => [`${r.name}, Raumvolumen`, fmt2(berechne(r).volumen), 'm³']), ['Raumvolumen gesamt', fmt2(l.reduce((s, r) => s + berechne(r).volumen, 0)), 'm³']], true);
  }
  for (const r of raeume) {
    neueSeite();
    titel(`Grundriss ${r.name || 'Raum'}`);
    plan(r);
    const b = berechne(r);
    tabelle([
      [b.mitSchraege ? 'Raumhöhe (flache Decke)' : 'Raumhöhe', fmt2(b.hoehe), 'm'],
      ...(b.koerper.length ? [
        ['Bodenfläche brutto', fmt2(b.bodenBrutto), 'm²'],
        ...b.koerper.map((k) => [`${k.name} (${fmt2(k.breite)} × ${fmt2(k.tiefe)} m)${k.bisDecke !== false ? ', auch Decke' : ''}, abgezogen`, fmt2(k.flaeche), 'm²']),
        ['Bodenfläche netto', fmt2(b.bodenflaeche), 'm²'],
      ] : [['Bodenfläche', fmt2(b.bodenflaeche), 'm²']]),
      [`${b.mitSchraege ? 'Deckenfläche waagerecht' : 'Deckenfläche'}${b.koerperDecke ? ' netto' : ''}`, fmt2(b.deckenflaeche), 'm²'],
      [`Raumvolumen${b.mitSchraege ? ' (mit Dachschrägen)' : ''}${b.koerperVolumen ? ', Körper bis zur Decke abgezogen' : ''}`, fmt2(b.volumen), 'm³'],
      ...b.schraegen.map((e) => [`Dachschräge an Wand ${e.wandName} (Kniestock ${fmt2(e.kniestock)} m, ${fmt2(e.winkel)}°)`, fmt2(e.flaeche), 'm²']),
      ...b.dachfenster.map((o) => [`${o.name} (${fmt2(o.breite)} × ${fmt2(o.laenge)} m), abgezogen`, fmt2(o.flaeche), 'm²']),
      ...(b.mitSchraege ? [['Dachschrägen netto', fmt2(b.dachNetto), 'm²']] : []),
      ['Wandumfang', fmt2(b.umfang), 'lfm'],
      [b.mitSchraege ? 'Wandfläche brutto (Kniestock- und Giebelwände)' : 'Wandfläche brutto (Umfang × Höhe)', fmt2(b.wandBrutto), 'm²'],
      ['Türflächen', fmt2(b.tuerFlaeche), 'm²'],
      ['Fensterflächen', fmt2(b.fensterFlaeche), 'm²'],
      [`Wandfläche netto${r.einstellungen?.abzug === 'vob' ? ' (Öffnungen bis 2,5 m² übermessen)' : ''}`, fmt2(b.wandNetto), 'm²'],
    ], true);
  }
  if (systeme && p.material) materialSeiten(doc, p, raeume, systeme, { M, CW, titel: (t) => { neueSeite(); titel(t); }, tabelle, y: () => y, setY: (v) => { y = v; } });
  return doc.output('blob');
}

// PDF-Seiten Material: Bedarf gesamt, Zuordnung Fläche → System, Aufbauten als Schnitt
function materialSeiten(doc, p, raeume, systeme, { M, CW, titel, tabelle, y, setY }) {
  const erg = bedarf(p.material, raeume.map((raum) => ({ raum, b: berechne(raum) })), systeme);
  if (!erg.zuordnung.length) return;
  const zahl = (n, d) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('de-DE', { maximumFractionDigits: d });
  const hinweis = (t) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 98, 108);
    const zeilen = doc.splitTextToSize(pdfText(t), CW);
    doc.text(zeilen, M, y()); setY(y() + zeilen.length * 4 + 3);
  };
  titel('Materialbedarf');
  hinweis(`Richtwerte nach Knauf-Unterlagen (Stand ${KNAUF_STAND}) bzw. eigenen Werten, mit Verschnitt, ohne Gewähr. Verbrauch hängt vom Untergrund ab; vor der Bestellung am Bau prüfen.`);
  setY(y() + 3);
  tabelle(erg.material.map((x) => [`${x.name}${x.anzahl ? ` (${x.anzahl} × ${x.gebinde.name || 'Gebinde'} ${zahl(x.gebinde.inhalt, 2)} ${x.gebinde.einheit || x.einheit})` : ''}`, zahl(x.menge, x.einheit === 'Stk' ? 0 : 1), x.einheit]));
  setY(y() + 4);
  tabelle([...erg.jeSystem.map((j) => [j.name, fmt2(j.m2), 'm²']), ['Fläche mit System gesamt', fmt2(erg.jeSystem.reduce((s, j) => s + j.m2, 0)), 'm²']], true);
  titel('Material: Zuordnung der Flächen');
  tabelle(erg.zuordnung.map((z) => [`${z.raumName} · ${z.flaeche.name} · ${z.systemName}`, fmt2(z.m2), 'm²']));
  titel('Aufbauten');
  const FARBE = { massiv: '#d9d2c5', putz: '#f1e6c8', spachtel: '#fbf6e6', platte: '#e8edf3', profil: '#ffffff', daemmung: '#f7e3a3', luft: '#ffffff', holz: '#e6c9a0', grund: '#dbe9f6' };
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  for (const j of erg.jeSystem) {
    const s = systeme.find((x) => x.id === j.system);
    const aufbau = s?.aufbau || [];
    const hoch = 22 + Math.max(aufbau.length * 4.5, 22);
    if (y() + hoch > 297 - M) { doc.addPage(); setY(M); }
    let yy = y();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 35, 42);
    doc.text(pdfText(`${s.name} · ${fmt2(j.m2)} m²`), M, yy + 4);
    yy += 8;
    // Schnitt: Schichtbreite nach Dicke, dünne Schichten mindestens 2 mm, dicke gekappt
    const roh = aufbau.map((a) => Math.min(30, Math.max(2.5, (Number(a.dicke) || 0) * 0.2)));
    let x = M;
    aufbau.forEach((a, i) => {
      doc.setFillColor(...rgb(FARBE[a.art] || FARBE.massiv)); doc.setDrawColor(110, 120, 130); doc.setLineWidth(0.2);
      doc.rect(x, yy, roh[i], 20, 'FD');
      doc.setFontSize(6.5); doc.setTextColor(30, 35, 42);
      doc.text(String(i + 1), x + roh[i] / 2, yy + 11, { align: 'center' });
      x += roh[i];
    });
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    aufbau.forEach((a, i) => {
      doc.text(pdfText(`${i + 1}  ${a.name}${Number(a.dicke) ? ` · ${zahl(Number(a.dicke), 1)} mm` : ''}`), M + 70, yy + 3 + i * 4.5);
    });
    if (s.quelle) { doc.setFontSize(7.5); doc.setTextColor(90, 98, 108); doc.text(doc.splitTextToSize(pdfText(`Quelle: ${s.quelle}`), 60), M, yy + 24); }
    setY(yy + hoch);
  }
}

// ---------- Start ----------
async function materialSeite(id) {
  const p = await projektLaden(id);
  if (!p) { location.hash = '#/'; return; }
  await materialPlaner({
    p, appbar, view, toast,
    speichern: () => projektSpeichern(p),
    pdf: async (pp, systeme) => {
      try {
        const blob = await pdfBauen(pp, systeme);
        await pdfZeigen(blob, `${(pp.name || 'raumaufmass').replace(/[^\wäöüÄÖÜß-]+/g, '_')}.pdf`, pp.name);
      } catch (err) {
        toast(`PDF ging nicht (${err.message}).`, 5000);
      }
    },
  });
}

function route() {
  const [pfad, such = ''] = location.hash.split('?');
  const zurueck = new URLSearchParams(such).get('zurueck') || '';
  let m;
  if ((m = /^#\/p\/(.+)\/material$/.exec(pfad))) materialSeite(decodeURIComponent(m[1]));
  else if ((m = /^#\/p\/(.+)$/.exec(pfad))) projekt(decodeURIComponent(m[1]));
  else if ((m = /^#\/systeme\/(.+)$/.exec(pfad))) systemEditor({ id: decodeURIComponent(m[1]), appbar, view, toast, zurueck });
  else if (pfad === '#/systeme') systemListe({ appbar, view, zurueck });
  else liste();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
// Daten auf dem Gerät vor automatischem Aufräumen des Browsers schützen
if (navigator.storage?.persist) navigator.storage.persisted().then((ja) => ja || navigator.storage.persist()).catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// für Tests: PDF eines gespeicherten Aufmaßes bauen
window.raumaufmassPdf = async (id) => pdfBauen(await projektLaden(id), await alleSysteme());
window.raumaufmassProjekte = alleProjekte;

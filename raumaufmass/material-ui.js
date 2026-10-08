// Oberfläche für Material-Planer (System je Fläche wählen, Bedarf ansehen) und System-Editor
// (Knauf-Systeme ansehen und anpassen, eigene Systeme anlegen). Die Rechnung steht in material.js.

import { berechne, fmt2, geschlossen } from './raumgeometrie.js';
import {
  BEREICHE, SCHICHT_ARTEN, KNAUF_STAND, systemeMischen, flaechenVon, systemFuer, bedarf, neuesSystem, aufbauSvg, parameterVon,
} from './material.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const zahlText = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('de-DE', { maximumFractionDigits: d });
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const fertig = (r) => geschlossen(r) && r.massstabGesetzt;

// ---------- Speicher für eigene Systeme (IndexedDB-Store „systeme“ der Raumaufmaß-App) ----------
let dbHolen = null;
export function systemSpeicherSetzen(fn) { dbHolen = fn; }
async function txSys(modus, fn) {
  const db = await dbHolen();
  return new Promise((resolve, reject) => {
    const t = db.transaction('systeme', modus);
    const erg = fn(t.objectStore('systeme'));
    t.oncomplete = () => resolve(erg?.result);
    t.onabort = () => reject(t.error);
    t.onerror = () => reject(t.error);
  });
}
export const eigeneSysteme = () => txSys('readonly', (s) => s.getAll());
const eigenesSpeichern = (s) => txSys('readwrite', (st) => st.put({ ...s, geaendertAm: Date.now() }));
const eigenesLoeschen = (id) => txSys('readwrite', (st) => st.delete(id));
export async function alleSysteme() { return systemeMischen(await eigeneSysteme()); }

const ICON = {
  zurueck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  weg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  schichten: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16M9 4v16M13 4v16M20 4v16M9 8h4M9 16h4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

const systemOptionen = (systeme, bereich, wert, leerText) => `<option value=""${!wert ? ' selected' : ''}>${esc(leerText)}</option>`
  + systeme.filter((s) => (s.bereiche || []).includes(bereich)).map((s) => `<option value="${esc(s.id)}"${wert === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('');

// Aufbau eines Systems in einem Blatt zeigen
export function aufbauZeigen(s) {
  const el = document.createElement('div');
  el.className = 'sheet-backdrop open';
  el.innerHTML = `<div class="sheet mat-blatt" role="dialog" aria-label="Aufbau ${esc(s.name)}"><div class="sheet-grip"></div>
    <h2>${esc(s.name)}</h2>
    ${s.beschreibung ? `<p class="hint mat-text">${esc(s.beschreibung)}</p>` : ''}
    <div class="mat-svg">${aufbauSvg(s)}</div>
    <h3 class="mat-h3">Materialbedarf je m²</h3>
    <table class="mat-tab">${(s.positionen || []).map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${zahlText(p.menge, 3)} ${esc(p.einheit)}${p.jeParameter ? ` je ${esc(String(p.bezug ?? 1))} ${esc((s.parameter || []).find((q) => q.key === p.jeParameter)?.einheit || '')}` : ''}</td></tr>`).join('')}</table>
    ${s.quelle ? `<p class="hint">Quelle: ${esc(s.quelle)}</p>` : ''}
    <button type="button" class="btn primary block" id="mat-zu">Schließen</button></div>`;
  const zu = () => el.remove();
  el.onclick = (e) => { if (e.target === el) zu(); };
  $('#mat-zu', el).onclick = zu;
  document.body.appendChild(el);
}

// ---------- Planer ----------
export async function materialPlaner({ p, speichern, appbar, view, toast, pdf }) {
  let systeme = await alleSysteme();
  p.material ||= { standard: {}, raeume: {}, parameter: {}, verschnitt: {} };
  const m = p.material;
  appbar.innerHTML = `<button type="button" class="icon-btn" id="back" aria-label="Zurück">${ICON.zurueck}</button><h1 class="small">Material planen<span class="sub">${esc(p.name)}</span></h1>`;
  $('#back').onclick = () => { location.hash = `#/p/${p.id}`; };
  const raeume = p.raeume.filter(fertig).map((raum) => ({ raum, b: berechne(raum) }));
  const offen = new Set();

  const zeichnen = () => {
    const erg = bedarf(m, raeume, systeme);
    const benutzt = [...new Set(erg.zuordnung.map((z) => z.system))].map((id) => systeme.find((s) => s.id === id)).filter(Boolean);
    const mitSchraege = raeume.some(({ b }) => b.mitSchraege && b.dachNetto > 0);
    view.innerHTML = `
      <section class="section">
        <h2>Für alle Räume</h2>
        ${Object.entries(BEREICHE).filter(([k]) => k !== 'schraege' || mitSchraege).map(([k, t]) => `<label class="field"><span>${t}</span><select data-standard="${k}">${systemOptionen(systeme, k, m.standard?.[k], 'kein System')}</select></label>`).join('')}
        <p class="hint">Gilt für jeden Raum, solange dort nichts anderes gewählt ist.</p>
      </section>
      ${raeume.length ? '' : '<section class="section"><p class="leer">Noch kein fertiger Raum. Zuerst Räume zeichnen und eine Wand messen.</p></section>'}
      ${raeume.map(({ raum, b }) => {
        const r = m.raeume?.[raum.id] || {};
        const fl = flaechenVon(raum, b);
        const waende = fl.filter((f) => f.bereich === 'wand');
        const auf = offen.has(raum.id);
        const zeile = (f) => {
          const id = systemFuer(m, raum.id, f);
          const s = systeme.find((x) => x.id === id);
          return `<span class="mat-wert">${fmt2(f.flaeche)} m²${s ? ` · ${esc(s.name)}` : ''}</span>`;
        };
        return `<section class="section mat-raum" data-raum="${raum.id}">
          <h2>${esc(raum.name || 'Raum')}<span class="h-right">${fmt2(b.bodenflaeche)} m² Boden</span></h2>
          <label class="field"><span>Wände (${fmt2(waende.reduce((s, f) => s + f.flaeche, 0))} m² netto)</span><select data-raum-bereich="wand">${systemOptionen(systeme, 'wand', 'wand' in r ? (r.wand || '-') : '', 'wie für alle Räume')}<option value="-"${'wand' in r && !r.wand ? ' selected' : ''}>kein System</option></select></label>
          <button type="button" class="btn ghost mat-einzeln">${auf ? 'Wände einzeln ausblenden' : 'Wände einzeln wählen'}</button>
          ${auf ? `<div class="mat-waende">${waende.map((f) => `<label class="field"><span>${esc(f.name)} · ${fmt2(f.laenge)} m lang · ${zeile(f)}</span><select data-wand="${f.wand}">${systemOptionen(systeme, 'wand', r.waende && f.wand in r.waende ? (r.waende[f.wand] || '-') : '', 'wie die Wände im Raum')}<option value="-"${r.waende && f.wand in r.waende && !r.waende[f.wand] ? ' selected' : ''}>kein System</option></select></label>`).join('')}</div>` : ''}
          ${fl.filter((f) => f.bereich !== 'wand').map((f) => `<label class="field"><span>${esc(f.name)} · ${zeile(f)}</span><select data-raum-bereich="${f.bereich}">${systemOptionen(systeme, f.bereich, f.bereich in r ? (r[f.bereich] || '-') : '', 'wie für alle Räume')}<option value="-"${f.bereich in r && !r[f.bereich] ? ' selected' : ''}>kein System</option></select></label>`).join('')}
        </section>`;
      }).join('')}
      ${benutzt.some((s) => (s.parameter || []).length) ? `<section class="section"><h2>Angaben</h2>
        ${benutzt.flatMap((s) => (s.parameter || []).map((q) => `<label class="field"><span>${esc(s.name)}: ${esc(q.name)} (${esc(q.einheit)})</span><input type="number" inputmode="decimal" step="any" data-par="${esc(s.id)}|${esc(q.key)}" value="${parameterVon(s, m.parameter?.[s.id])[q.key]}"></label>`)).join('')}
      </section>` : ''}
      <section class="section">
        <h2>Materialbedarf<span class="h-right">mit Verschnitt</span></h2>
        ${erg.material.length ? `<table class="mat-tab">
          ${erg.material.map((x) => `<tr><td>${esc(x.name)}<small>${esc(x.systeme.join(', '))}</small></td><td class="n"><b>${zahlText(x.menge, x.einheit === 'Stk' ? 0 : 1)} ${esc(x.einheit)}</b>${x.anzahl ? `<small>${x.anzahl} × ${esc(x.gebinde.name || '')} ${zahlText(x.gebinde.inhalt)} ${esc(x.gebinde.einheit || x.einheit)}</small>` : ''}</td></tr>`).join('')}
        </table>` : '<p class="leer">Oben ein System wählen, dann steht hier, was gebraucht wird.</p>'}
        ${erg.jeSystem.length ? `<h3 class="mat-h3">Flächen je System</h3><div class="mat-systeme">${erg.jeSystem.map((j) => `<button type="button" class="mat-sys" data-sys="${esc(j.system)}">${ICON.schichten}<span><b>${esc(j.name)}</b><small>${fmt2(j.m2)} m² · Aufbau ansehen</small></span></button>`).join('')}</div>` : ''}
        <p class="hint">Richtwerte nach Knauf-Unterlagen (Stand ${esc(KNAUF_STAND)}), ohne Gewähr. Verbrauch hängt vom Untergrund ab; vor der Bestellung prüfen.</p>
      </section>
      <section class="section">
        <div class="knoepfe">
          <button type="button" class="btn ghost block" id="mat-pdf" ${erg.zuordnung.length ? '' : 'disabled'}>${ICON.pdf} PDF mit Material ansehen</button>
          <button type="button" class="btn ghost block" id="mat-systeme">${ICON.schichten} Systeme bearbeiten</button>
        </div>
      </section>`;

    $$('[data-standard]', view).forEach((sel) => {
      sel.onchange = async () => { m.standard ||= {}; m.standard[sel.dataset.standard] = sel.value || null; await speichern(); zeichnen(); };
    });
    $$('.mat-raum', view).forEach((sec) => {
      const rid = sec.dataset.raum;
      const r = () => { m.raeume ||= {}; m.raeume[rid] ||= {}; return m.raeume[rid]; };
      $$('[data-raum-bereich]', sec).forEach((sel) => {
        sel.onchange = async () => {
          const k = sel.dataset.raumBereich;
          if (sel.value === '') delete r()[k]; else r()[k] = sel.value === '-' ? null : sel.value;
          await speichern(); zeichnen();
        };
      });
      $$('[data-wand]', sec).forEach((sel) => {
        sel.onchange = async () => {
          const w = r().waende ||= {};
          if (sel.value === '') delete w[sel.dataset.wand]; else w[sel.dataset.wand] = sel.value === '-' ? null : sel.value;
          await speichern(); zeichnen();
        };
      });
      $('.mat-einzeln', sec).onclick = () => { if (offen.has(rid)) offen.delete(rid); else offen.add(rid); zeichnen(); };
    });
    $$('[data-par]', view).forEach((inp) => {
      inp.onchange = async () => {
        const [sid, key] = inp.dataset.par.split('|');
        m.parameter ||= {}; m.parameter[sid] ||= {};
        m.parameter[sid][key] = Number(String(inp.value).replace(',', '.'));
        await speichern(); zeichnen();
      };
    });
    $$('.mat-sys', view).forEach((b) => { b.onclick = () => aufbauZeigen(systeme.find((s) => s.id === b.dataset.sys)); });
    $('#mat-systeme').onclick = () => { location.hash = `#/systeme?zurueck=${encodeURIComponent(`#/p/${p.id}/material`)}`; };
    $('#mat-pdf').onclick = () => pdf(p, systeme);
  };
  zeichnen();
}

// ---------- Editor: Liste ----------
export async function systemListe({ appbar, view, zurueck }) {
  const systeme = await alleSysteme();
  appbar.innerHTML = `<button type="button" class="icon-btn" id="back" aria-label="Zurück">${ICON.zurueck}</button><h1 class="small">Systeme<span class="sub">Aufbau und Materialbedarf</span></h1>`;
  $('#back').onclick = () => { location.hash = zurueck || '#/'; };
  const marke = (s) => (s.knauf ? '<em class="mat-marke">Knauf</em>' : s.geaendert ? '<em class="mat-marke anders">geändert</em>' : '<em class="mat-marke eigen">eigenes</em>');
  view.innerHTML = Object.entries(BEREICHE).map(([k, t]) => `<section class="section"><h2>${t}</h2><div class="knoepfe">
      ${systeme.filter((s) => (s.bereiche || []).includes(k)).map((s) => `<button type="button" class="proj" data-sys="${esc(s.id)}"><span><b>${esc(s.name)} ${marke(s)}</b><small>${esc((s.aufbau || []).map((a) => a.name).join(' · '))}</small></span></button>`).join('') || '<p class="leer">Keine Systeme.</p>'}
    </div></section>`).join('')
    + `<section class="section"><button type="button" class="btn primary block" id="sys-neu">${ICON.plus} Neues System</button>
      <p class="hint">Knauf-Systeme kannst du anpassen (z. B. eigene Verbrauchswerte); die Änderung gilt nur auf diesem Gerät und lässt sich zurücksetzen.</p></section>`;
  $$('[data-sys]', view).forEach((b) => { b.onclick = () => { location.hash = `#/systeme/${encodeURIComponent(b.dataset.sys)}${zurueck ? `?zurueck=${encodeURIComponent(zurueck)}` : ''}`; }; });
  $('#sys-neu').onclick = async () => {
    const s = neuesSystem(`eigen-${neueId()}`);
    await eigenesSpeichern(s);
    location.hash = `#/systeme/${encodeURIComponent(s.id)}${zurueck ? `?zurueck=${encodeURIComponent(zurueck)}` : ''}`;
  };
}

// ---------- Editor: ein System ----------
export async function systemEditor({ id, appbar, view, toast, zurueck }) {
  const systeme = await alleSysteme();
  const vorher = systeme.find((s) => s.id === id);
  const liste = `#/systeme${zurueck ? `?zurueck=${encodeURIComponent(zurueck)}` : ''}`;
  if (!vorher) { location.hash = liste; return; }
  const s = JSON.parse(JSON.stringify(vorher));
  delete s.knauf; delete s.geaendert;
  appbar.innerHTML = `<button type="button" class="icon-btn" id="back" aria-label="Zurück">${ICON.zurueck}</button><h1 class="small">System bearbeiten<span class="sub">${vorher.knauf ? 'Knauf' : vorher.geaendert ? 'Knauf, geändert' : 'eigenes System'}</span></h1>`;
  $('#back').onclick = () => { location.hash = liste; };
  const zahl = (v) => Number(String(v).replace(',', '.')) || 0;

  const zeichnen = () => {
    view.innerHTML = `
      <section class="section">
        <label class="field"><span>Name</span><input type="text" id="s-name" value="${esc(s.name)}"></label>
        <span class="mat-label">Für</span>
        <div class="chips" id="s-ber">${Object.entries(BEREICHE).map(([k, t]) => `<button type="button" class="chip" data-ber="${k}" aria-pressed="${(s.bereiche || []).includes(k)}">${t}</button>`).join('')}</div>
        <label class="field" style="margin-top:12px"><span>Beschreibung</span><textarea id="s-text">${esc(s.beschreibung || '')}</textarea></label>
        <div class="row">
          <label class="field"><span>Verschnitt %</span><input type="number" inputmode="decimal" step="any" id="s-v" value="${s.verschnitt ?? 0}"></label>
          <label class="field"><span>Hersteller</span><input type="text" id="s-h" value="${esc(s.hersteller || '')}"></label>
        </div>
        ${s.quelle ? `<p class="hint">Quelle: ${esc(s.quelle)}</p>` : ''}
      </section>
      <section class="section">
        <h2>Aufbau<span class="h-right">vom Untergrund zum Raum</span></h2>
        <div class="mat-svg">${aufbauSvg(s)}</div>
        ${(s.aufbau || []).map((a, i) => `<div class="mat-zeile" data-a="${i}">
          <input type="text" class="mat-in" data-f="name" value="${esc(a.name)}" aria-label="Schicht">
          <input type="number" inputmode="decimal" step="any" class="mat-in mat-kurz" data-f="dicke" value="${a.dicke ?? ''}" aria-label="Dicke in mm" placeholder="mm">
          <select class="mat-in mat-kurz" data-f="art" aria-label="Art">${Object.entries(SCHICHT_ARTEN).map(([k, t]) => `<option value="${k}"${a.art === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
          <button type="button" class="icon-btn mat-weg" aria-label="Schicht entfernen">${ICON.weg}</button></div>`).join('')}
        <button type="button" class="btn ghost" id="a-neu">${ICON.plus} Schicht</button>
      </section>
      <section class="section">
        <h2>Material je m²</h2>
        ${(s.parameter || []).map((q, i) => `<div class="mat-zeile" data-q="${i}"><span class="mat-label">Angabe</span>
          <input type="text" class="mat-in" data-f="name" value="${esc(q.name)}" aria-label="Name der Angabe">
          <input type="number" inputmode="decimal" step="any" class="mat-in mat-kurz" data-f="wert" value="${q.wert}" aria-label="Wert">
          <input type="text" class="mat-in mat-kurz" data-f="einheit" value="${esc(q.einheit)}" aria-label="Einheit"></div>`).join('')}
        ${(s.positionen || []).map((p, i) => `<div class="mat-pos" data-p="${i}">
          <div class="mat-zeile"><input type="text" class="mat-in" data-f="name" value="${esc(p.name)}" aria-label="Material">
            <button type="button" class="icon-btn mat-weg" aria-label="Material entfernen">${ICON.weg}</button></div>
          <div class="mat-zeile">
            <input type="number" inputmode="decimal" step="any" class="mat-in mat-kurz" data-f="menge" value="${p.menge}" aria-label="Menge je m²">
            <input type="text" class="mat-in mat-kurz" data-f="einheit" value="${esc(p.einheit)}" aria-label="Einheit">
            ${(s.parameter || []).length ? `<select class="mat-in" data-f="jeParameter" aria-label="Menge bezieht sich auf"><option value="">je m²</option>${s.parameter.map((q) => `<option value="${esc(q.key)}"${p.jeParameter === q.key ? ' selected' : ''}>je m² und ${esc(String(p.bezug ?? 1))} ${esc(q.einheit)} ${esc(q.name)}</option>`).join('')}</select>` : '<span class="mat-label">je m²</span>'}
          </div>
          <div class="mat-zeile"><span class="mat-label">Gebinde</span>
            <input type="text" class="mat-in mat-kurz" data-f="gname" value="${esc(p.gebinde?.name || '')}" placeholder="Sack" aria-label="Gebinde">
            <input type="number" inputmode="decimal" step="any" class="mat-in mat-kurz" data-f="ginhalt" value="${p.gebinde?.inhalt ?? ''}" placeholder="Inhalt" aria-label="Inhalt">
            <span class="mat-label">${esc(p.einheit)}</span></div>
        </div>`).join('')}
        <div class="knoepfe">
          <button type="button" class="btn ghost" id="p-neu">${ICON.plus} Material</button>
          ${(s.parameter || []).length ? '' : '<button type="button" class="btn ghost" id="q-neu">' + ICON.plus + ' Angabe (z. B. Putzdicke)</button>'}
        </div>
      </section>
      <section class="section"><div class="knoepfe">
        <button type="button" class="btn primary block" id="s-speichern">Speichern</button>
        <button type="button" class="btn ghost block" id="s-kopie">Als neues System kopieren</button>
        ${vorher.geaendert ? '<button type="button" class="btn ghost block" id="s-reset">Knauf-Werte wiederherstellen</button>' : ''}
        ${!vorher.knauf && !vorher.geaendert ? `<button type="button" class="btn danger block" id="s-loeschen">${ICON.weg} System löschen</button>` : ''}
      </div></section>`;

    const lesen = () => {
      s.name = $('#s-name').value.trim() || s.name;
      s.beschreibung = $('#s-text').value.trim();
      s.verschnitt = zahl($('#s-v').value);
      s.hersteller = $('#s-h').value.trim();
      $$('[data-a]', view).forEach((z) => {
        const a = s.aufbau[Number(z.dataset.a)];
        a.name = $('[data-f=name]', z).value.trim();
        a.dicke = zahl($('[data-f=dicke]', z).value);
        a.art = $('[data-f=art]', z).value;
      });
      $$('[data-q]', view).forEach((z) => {
        const q = s.parameter[Number(z.dataset.q)];
        q.name = $('[data-f=name]', z).value.trim();
        q.wert = zahl($('[data-f=wert]', z).value);
        q.einheit = $('[data-f=einheit]', z).value.trim();
      });
      $$('[data-p]', view).forEach((z) => {
        const p = s.positionen[Number(z.dataset.p)];
        p.name = $('[data-f=name]', z).value.trim();
        p.menge = zahl($('[data-f=menge]', z).value);
        p.einheit = $('[data-f=einheit]', z).value.trim();
        const je = $('[data-f=jeParameter]', z);
        if (je) { if (je.value) { p.jeParameter = je.value; p.bezug ??= 1; } else delete p.jeParameter; }
        const inhalt = zahl($('[data-f=ginhalt]', z).value);
        const gname = $('[data-f=gname]', z).value.trim();
        p.gebinde = inhalt > 0 ? { name: gname, inhalt, einheit: p.einheit } : null;
      });
    };
    $$('[data-ber]', view).forEach((b) => {
      b.onclick = () => {
        lesen();
        const k = b.dataset.ber;
        s.bereiche = (s.bereiche || []).includes(k) ? s.bereiche.filter((x) => x !== k) : [...(s.bereiche || []), k];
        zeichnen();
      };
    });
    $$('[data-a] .mat-weg', view).forEach((b) => { b.onclick = () => { lesen(); s.aufbau.splice(Number(b.closest('[data-a]').dataset.a), 1); zeichnen(); }; });
    $$('[data-p] .mat-weg', view).forEach((b) => { b.onclick = () => { lesen(); s.positionen.splice(Number(b.closest('[data-p]').dataset.p), 1); zeichnen(); }; });
    $$('[data-a] input, [data-a] select', view).forEach((i) => { i.onchange = () => { lesen(); $('.mat-svg', view).innerHTML = aufbauSvg(s); }; });
    $('#a-neu').onclick = () => { lesen(); (s.aufbau ||= []).push({ name: 'Schicht', dicke: 10, art: 'putz' }); zeichnen(); };
    $('#p-neu').onclick = () => { lesen(); (s.positionen ||= []).push({ name: 'Material', menge: 1, einheit: 'kg' }); zeichnen(); };
    $('#q-neu')?.addEventListener('click', () => { lesen(); s.parameter = [{ key: 'dicke', name: 'Putzdicke', einheit: 'mm', wert: 10 }]; zeichnen(); });
    $('#s-speichern').onclick = async () => {
      lesen();
      if (!s.bereiche?.length) { toast('Bitte wählen, wofür das System ist (Wände, Decke oder Dachschrägen).'); return; }
      await eigenesSpeichern(s);
      toast('System gespeichert.');
      location.hash = liste;
    };
    $('#s-kopie').onclick = async () => {
      lesen();
      const k = { ...JSON.parse(JSON.stringify(s)), id: `eigen-${neueId()}`, name: `${s.name} (Kopie)` };
      delete k.quelle;
      await eigenesSpeichern(k);
      toast('Kopie angelegt.');
      location.hash = `#/systeme/${encodeURIComponent(k.id)}${zurueck ? `?zurueck=${encodeURIComponent(zurueck)}` : ''}`;
    };
    $('#s-reset')?.addEventListener('click', async () => {
      if (!confirm('Deine Änderungen an diesem System verwerfen und die Knauf-Werte wiederherstellen?')) return;
      await eigenesLoeschen(id);
      toast('Knauf-Werte wiederhergestellt.');
      location.hash = liste;
    });
    $('#s-loeschen')?.addEventListener('click', async () => {
      if (!confirm(`„${s.name}“ löschen?`)) return;
      await eigenesLoeschen(id);
      toast('System gelöscht.');
      location.hash = liste;
    });
  };
  zeichnen();
}

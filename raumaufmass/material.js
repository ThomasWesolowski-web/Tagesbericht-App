// Material-Planer fürs Raumaufmaß: Systeme (Aufbau + Materialbedarf je m²) den Flächen eines Raums
// zuordnen und den Bedarf für das ganze Aufmaß zusammenrechnen. Reine Rechnung ohne Oberfläche,
// mit Node testbar. Die mitgelieferten Systeme folgen den Knauf-Unterlagen (Quelle steht am System);
// eigene oder geänderte Systeme speichert die App auf dem Gerät.

import { KNAUF_SYSTEME, KNAUF_STAND } from './knauf.js';

export { KNAUF_STAND };
export const STANDARD_SYSTEME = KNAUF_SYSTEME;

export const BEREICHE = { wand: 'Wände', decke: 'Decke', schraege: 'Dachschrägen' };
export const SCHICHT_ARTEN = {
  massiv: 'Mauerwerk / Beton', putz: 'Putz', spachtel: 'Spachtel', platte: 'Gipsplatte',
  profil: 'Profil / Unterkonstruktion', daemmung: 'Dämmung', luft: 'Hohlraum', holz: 'Holz / Sparren', grund: 'Grundierung',
};

const zahl = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Alle Systeme: mitgelieferte, darüber eigene Änderungen (gleiche id) und eigene neue Systeme
export function systemeMischen(eigene = []) {
  const map = new Map(STANDARD_SYSTEME.map((s) => [s.id, { ...s, knauf: true }]));
  for (const s of eigene) {
    if (s.geloescht) { map.delete(s.id); continue; }
    const alt = map.get(s.id);
    map.set(s.id, { ...s, knauf: false, geaendert: !!alt });
  }
  return [...map.values()];
}

// Parameter eines Systems (z. B. Putzdicke) mit Werten aus dem Aufmaß überschreiben
export function parameterVon(system, werte = {}) {
  const out = {};
  for (const p of system.parameter || []) out[p.key] = zahl(werte[p.key], zahl(p.wert));
  return out;
}

// Flächen eines Raums für die Zuordnung: jede Wand einzeln (netto), Decke, Dachschrägen.
// b ist das Ergebnis von berechne(raum).
export function flaechenVon(raum, b) {
  const out = [];
  for (const w of b.waende) {
    const ab = b.oeffnungen.filter((o) => o.wand === w.id && o.abgezogen).reduce((s, o) => s + o.flaeche, 0);
    out.push({ key: `wand:${w.id}`, bereich: 'wand', wand: w.id, name: `Wand ${w.name}`, laenge: w.laenge, brutto: w.flaeche, flaeche: Math.max(0, w.flaeche - ab) });
  }
  if (b.deckenflaeche > 1e-9) out.push({ key: 'decke', bereich: 'decke', name: b.mitSchraege ? 'Decke (waagerecht)' : 'Decke', flaeche: b.deckenflaeche });
  if (b.mitSchraege && b.dachNetto > 1e-9) out.push({ key: 'schraege', bereich: 'schraege', name: 'Dachschrägen', flaeche: b.dachNetto });
  return out;
}

// Welches System gilt für eine Fläche? Reihenfolge: einzelne Wand > Raum > ganzes Aufmaß
export function systemFuer(material, raumId, f) {
  const r = material?.raeume?.[raumId] || {};
  if (f.bereich === 'wand' && r.waende && f.wand in r.waende) return r.waende[f.wand] || null;
  if (f.bereich in r) return r[f.bereich] || null;
  return material?.standard?.[f.bereich] || null;
}

// Bedarf für das ganze Aufmaß. raeume: [{raum, b}] (b = berechne(raum)).
export function bedarf(material, raeume, systeme) {
  const sys = new Map(systeme.map((s) => [s.id, s]));
  const zuordnung = [];
  const summen = new Map();
  for (const { raum, b } of raeume) {
    for (const f of flaechenVon(raum, b)) {
      const id = systemFuer(material, raum.id, f);
      const s = id && sys.get(id);
      if (!s || f.flaeche <= 1e-9) continue;
      zuordnung.push({ raum: raum.id, raumName: raum.name || 'Raum', flaeche: f, system: s.id, systemName: s.name, m2: f.flaeche });
      const par = parameterVon(s, material?.parameter?.[s.id]);
      const verschnitt = zahl(material?.verschnitt?.[s.id], zahl(s.verschnitt)) / 100;
      for (const pos of s.positionen || []) {
        let je = zahl(pos.menge);
        if (pos.jeParameter) je *= zahl(par[pos.jeParameter], 1) / zahl(pos.bezug, 1);
        const menge = je * f.flaeche * (1 + (pos.ohneVerschnitt ? 0 : verschnitt));
        const key = `${pos.name}|${pos.einheit}`;
        const alt = summen.get(key) || { name: pos.name, einheit: pos.einheit, menge: 0, gebinde: pos.gebinde || null, systeme: new Set() };
        alt.menge += menge;
        alt.systeme.add(s.name);
        summen.set(key, alt);
      }
    }
  }
  const material_ = [...summen.values()].map((m) => ({
    ...m,
    systeme: [...m.systeme],
    anzahl: m.gebinde?.inhalt > 0 ? Math.ceil(m.menge / m.gebinde.inhalt - 1e-9) : null,
  }));
  // Flächen je System zusammengefasst
  const jeSystem = new Map();
  for (const z of zuordnung) {
    const alt = jeSystem.get(z.system) || { system: z.system, name: z.systemName, m2: 0 };
    alt.m2 += z.m2;
    jeSystem.set(z.system, alt);
  }
  return { zuordnung, material: material_, jeSystem: [...jeSystem.values()] };
}

// Leeres eigenes System als Vorlage für den Editor
export function neuesSystem(id) {
  return {
    id, name: 'Eigenes System', bereiche: ['wand'], hersteller: '', beschreibung: '', verschnitt: 5, parameter: [],
    aufbau: [{ name: 'Untergrund', dicke: 175, art: 'massiv' }, { name: 'Putz', dicke: 10, art: 'putz' }],
    positionen: [{ name: 'Material', menge: 1, einheit: 'kg' }],
  };
}

// Aufbau als SVG-Schnitt (waagerechter Schnitt, Untergrund links, Raumseite rechts)
const FARBEN = {
  massiv: ['#d9d2c5', '#9b9184'], putz: ['#f1e6c8', '#b7a678'], spachtel: ['#fbf6e6', '#c9bb8e'], platte: ['#e8edf3', '#8395aa'],
  profil: ['#ffffff', '#5c6b7a'], daemmung: ['#f7e3a3', '#c8a43a'], luft: ['#ffffff', '#b9c1ca'], holz: ['#e6c9a0', '#9c7646'], grund: ['#dbe9f6', '#6c94bd'],
};
const escx = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Breite der Schichten: echte Dicke, aber dünne Schichten mindestens sichtbar, dicke gekappt
export function schichtBreiten(aufbau, gesamt = 220) {
  const roh = aufbau.map((s) => Math.min(120, Math.max(10, zahl(s.dicke) * 0.9)));
  const summe = roh.reduce((a, b) => a + b, 0) || 1;
  return roh.map((w) => (w / summe) * gesamt);
}
export function aufbauSvg(system, o = {}) {
  const aufbau = system.aufbau || [];
  const W = 340; const H = 120 + aufbau.length * 16;
  const x0 = 14; const breiten = schichtBreiten(aufbau, o.breite || 200); const top = 12; const hoch = 86;
  let x = x0;
  const teile = [];
  const labels = [];
  aufbau.forEach((s, i) => {
    const [fill, stroke] = FARBEN[s.art] || FARBEN.massiv;
    const w = breiten[i];
    teile.push(`<rect x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(1)}" height="${hoch}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
    if (s.art === 'massiv') teile.push(`<path d="${Array.from({ length: Math.ceil(hoch / 8) }, (_, k) => `M${x.toFixed(1)} ${top + k * 8 + 8}l${Math.min(8, w).toFixed(1)} -8`).join('')}" stroke="${stroke}" stroke-width=".6" fill="none" clip-path="none"/>`);
    if (s.art === 'daemmung') teile.push(`<path d="${Array.from({ length: Math.ceil(hoch / 10) }, (_, k) => `M${x.toFixed(1)} ${top + k * 10 + 5}q${(w / 2).toFixed(1)} -6 ${w.toFixed(1)} 0`).join('')}" stroke="${stroke}" stroke-width=".8" fill="none"/>`);
    if (s.art === 'profil') teile.push(`<path d="M${(x + 2).toFixed(1)} ${top + 10}h${(w - 4).toFixed(1)}v${hoch - 20}h${(-(w - 4)).toFixed(1)}" stroke="${stroke}" stroke-width="1.6" fill="none"/>`);
    const mx = x + w / 2;
    const ly = top + hoch + 14 + i * 16;
    teile.push(`<path d="M${mx.toFixed(1)} ${top + hoch}V${ly - 4}H${(x0 + 236).toFixed(1)}" stroke="#8a939d" stroke-width=".7" fill="none"/>`);
    labels.push(`<text x="${x0 + 240}" y="${ly}" font-size="11" fill="currentColor">${i + 1} ${escx(s.name)}${zahl(s.dicke) ? ` · ${String(zahl(s.dicke)).replace('.', ',')} mm` : ''}</text>`);
    teile.push(`<text x="${mx.toFixed(1)}" y="${top + hoch / 2 + 4}" font-size="10" text-anchor="middle" fill="#1d232a">${i + 1}</text>`);
    x += w;
  });
  teile.push(`<text x="${x0}" y="${top - 2}" font-size="9" fill="#8a939d">Untergrund</text><text x="${(x).toFixed(1)}" y="${top - 2}" font-size="9" text-anchor="end" fill="#8a939d">Raum</text>`);
  const breite = Math.max(W, x0 + 240 + Math.max(0, ...aufbau.map((s) => (s.name.length + 12) * 6.2)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite.toFixed(0)} ${H}" width="100%" style="max-width:${breite.toFixed(0)}px">${teile.join('')}${labels.join('')}</svg>`;
}

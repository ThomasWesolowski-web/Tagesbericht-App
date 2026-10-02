// Foto-Aufmaß: im Foto zwei bekannte Maße (Länge waagerecht, Höhe senkrecht) markieren, daraus den
// Maßstab berechnen und Flächen, Öffnungen und Strecken ausmessen. Öffnungen werden nach VOB/C
// übermessen oder abgezogen, Laibungen gesondert gerechnet. Alles läuft im Browser, ohne Server.
// openFotoAufmass(blob, daten) liefert { daten, plan } (plan = Foto mit Maßen als JPEG) oder null.

import { zahl, newZeile } from './report.js';

// Abzugsgrenzen nach VOB/C (Ausgabe 2019): Öffnungen bis zu dieser Einzelgröße werden übermessen.
export const REGELN = [
  { id: '18363', label: 'Malerarbeiten (DIN 18363)', schwelle: 2.5 },
  { id: '18350', label: 'Putz und Stuck (DIN 18350)', schwelle: 2.5 },
  { id: '18345', label: 'WDVS (DIN 18345)', schwelle: 2.5 },
  { id: '18340', label: 'Trockenbau (DIN 18340)', schwelle: 2.5 },
  { id: '18352', label: 'Fliesen (DIN 18352)', schwelle: 0.1 },
  { id: 'alle', label: 'Alle Öffnungen abziehen', schwelle: 0 },
];
const regelVon = (d) => REGELN.find((r) => r.id === d.regel) || REGELN[0];

const TYPEN = {
  flaeche: { label: 'Fläche', name: 'Wand' },
  oeffnung: { label: 'Öffnung', name: 'Fenster' },
  linie: { label: 'Strecke', name: 'Strecke' },
};
const FARBE = {
  ref: '#fdd835', flaeche: '#43a047', abzug: '#e53935', uebermessen: '#fb8c00', linie: '#1e88e5',
};

const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function neuesFotoAufmass(nr) {
  let regel = '18363';
  try { regel = localStorage.getItem('fa-regel') || regel; } catch { /* ohne Speicher */ }
  return { id: neueId(), titel: `Foto-Aufmaß ${nr}`, ref: {}, teile: [], regel, laibungAls: 'm2' };
}

// Zahl wie auf dem Papier: Komma, höchstens zwei Nachkommastellen
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false });
const fmt2 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- Geometrie ----------

// Die beiden Referenzlinien spannen ein (schiefwinkliges) Achsenkreuz auf. So gleicht der Maßstab
// leicht schräg aufgenommene Fotos aus; echte Perspektive (stark von der Seite) bleibt ungenau.
export function massstab(d) {
  const L = d.ref?.laenge;
  const H = d.ref?.hoehe;
  const vec = (r) => [r.b[0] - r.a[0], r.b[1] - r.a[1]];
  const gueltig = (r) => r && zahl(r.m) > 0 && Math.hypot(...vec(r)) > 2;
  let u = null;
  let v = null;
  let lm = 0;
  let hm = 0;
  if (gueltig(L)) { u = vec(L); if (u[0] < 0) u = [-u[0], -u[1]]; lm = zahl(L.m); }
  if (gueltig(H)) { v = vec(H); if (v[1] > 0) v = [-v[0], -v[1]]; hm = zahl(H.m); }
  if (!u && !v) return null;
  const beide = Boolean(u && v);
  if (!v) { v = [u[1], -u[0]]; hm = lm; }
  if (!u) { u = [-v[1], v[0]]; lm = hm; }
  const sin = Math.abs(u[0] * v[1] - v[0] * u[1]) / (Math.hypot(...u) * Math.hypot(...v));
  if (sin < 0.26) return { fehler: 'Länge und Höhe zeigen fast in dieselbe Richtung. Bitte eine waagerechte und eine senkrechte Referenz ziehen.' };
  const [ux, uy, vx, vy] = [u[0] / lm, u[1] / lm, v[0] / hm, v[1] / hm];
  const det = ux * vy - vx * uy;
  const o = gueltig(L) ? L.a : H.a;
  return {
    beide,
    pxProM: Math.min(Math.hypot(ux, uy), Math.hypot(vx, vy)),
    inPx: ([X, Y]) => [o[0] + X * ux + Y * vx, o[1] + X * uy + Y * vy],
    inM: ([x, y]) => {
      const dx = x - o[0];
      const dy = y - o[1];
      return [(vy * dx - vx * dy) / det, (-uy * dx + ux * dy) / det];
    },
  };
}

const flaecheVon = (p) => Math.abs(p.reduce((s, [x, y], i) => {
  const [x2, y2] = p[(i + 1) % p.length];
  return s + x * y2 - x2 * y;
}, 0)) / 2;
const laengeVon = (p) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
const mitte = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
function innen([x, y], poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

// Werte aller markierten Teile in Metern
export function auswerten(d) {
  const ms = massstab(d);
  if (!ms || ms.fehler) return { ms, teile: [] };
  const grenze = regelVon(d).schwelle;
  const teile = d.teile.map((t) => {
    const m = t.punkte.map(ms.inM);
    if (t.typ === 'linie') return { t, laenge: laengeVon(m) };
    const xs = m.map((q) => q[0]);
    const ys = m.map((q) => q[1]);
    const breite = Math.max(...xs) - Math.min(...xs);
    const hoehe = Math.max(...ys) - Math.min(...ys);
    const flaeche = flaecheVon(m);
    // Vier Ecken und fast so groß wie das umschließende Rechteck: als Länge × Höhe angeben
    const rechteck = t.punkte.length === 4 && flaeche >= 0.97 * breite * hoehe;
    return { t, flaeche, breite, hoehe, rechteck };
  });
  const flaechen = teile.filter((x) => x.t.typ === 'flaeche');
  for (const x of teile) {
    if (x.t.typ !== 'oeffnung') continue;
    const c = mitte(x.t.punkte);
    x.in = flaechen.find((f) => innen(c, f.t.punkte)) || null;
    x.abzug = x.flaeche > grenze;
    const tiefe = zahl(x.t.laibung?.tiefe) / 100;
    if (tiefe > 0) {
      x.laibungTiefe = tiefe;
      x.laibungLaenge = 2 * x.hoehe + x.breite * (x.t.laibung?.unten ? 2 : 1);
    }
  }
  for (const f of flaechen) {
    const ab = teile.filter((x) => x.in === f && x.abzug).reduce((s, x) => s + x.flaeche, 0);
    f.netto = f.flaeche - ab;
  }
  return { ms, teile };
}

// Ergebnis als Aufmaßpositionen (wie auf dem Papier: Messzeilen, Abzüge, Laibungen gesondert)
export function alsPositionen(d) {
  const { teile } = auswerten(d);
  const out = [];
  const flZeile = (x, abzug = false) => (x.rechteck
    ? { ...newZeile(), laenge: fmt(x.breite), hoehe: fmt(x.hoehe), abzug }
    : { ...newZeile(), wert: fmt(x.flaeche), abzug });
  for (const f of teile.filter((x) => x.t.typ === 'flaeche')) {
    const oe = teile.filter((x) => x.in === f);
    const ueber = oe.filter((x) => !x.abzug).map((x) => x.t.name);
    out.push({
      bezeichnung: f.t.name + (ueber.length ? ` (übermessen: ${ueber.join(', ')})` : ''),
      einheit: 'm2',
      zeilen: [flZeile(f), ...oe.filter((x) => x.abzug).map((x) => flZeile(x, true))],
    });
  }
  const frei = teile.filter((x) => x.t.typ === 'oeffnung' && !x.in);
  if (frei.length) out.push({ bezeichnung: frei.map((x) => x.t.name).join(', '), einheit: 'm2', zeilen: frei.map((x) => flZeile(x)) });
  // Laibungen je Tiefe eine Position
  const tiefen = new Map();
  for (const x of teile.filter((y) => y.laibungTiefe)) {
    const k = fmt(x.laibungTiefe * 100);
    tiefen.set(k, [...(tiefen.get(k) || []), x]);
  }
  const alsM2 = d.laibungAls !== 'm';
  for (const [cm, list] of tiefen) {
    out.push({
      bezeichnung: `Laibungen Tiefe ${cm} cm (${list.map((x) => x.t.name).join(', ')})`,
      einheit: alsM2 ? 'm2' : 'm',
      zeilen: list.map((x) => ({ ...newZeile(), laenge: fmt(x.laibungLaenge), breite: alsM2 ? fmt(x.laibungTiefe) : '' })),
    });
  }
  for (const l of teile.filter((x) => x.t.typ === 'linie')) {
    out.push({ bezeichnung: l.t.name, einheit: 'm', zeilen: [{ ...newZeile(), laenge: fmt(l.laenge) }] });
  }
  return out.map((p) => ({ ...p, fotoAufmass: d.id }));
}

export function kurzfassung(d) {
  const { ms, teile } = auswerten(d);
  if (!ms || ms.fehler) return 'Noch keine Referenz';
  const fl = teile.filter((x) => x.t.typ === 'flaeche').reduce((s, x) => s + x.netto, 0);
  const li = teile.filter((x) => x.t.typ === 'linie').reduce((s, x) => s + x.laenge, 0);
  return [`${teile.length} ${teile.length === 1 ? 'Teil' : 'Teile'}`, fl ? `${fmt2(fl)} m²` : '', li ? `${fmt2(li)} m` : ''].filter(Boolean).join(' · ');
}

function wertText(x) {
  if (!x) return '';
  if (x.t.typ === 'linie') return `${fmt2(x.laenge)} m`;
  if (x.t.typ === 'flaeche') return x.netto < x.flaeche - 0.005 ? `${fmt2(x.flaeche)} − Abzug = ${fmt2(x.netto)} m²` : `${fmt2(x.flaeche)} m²`;
  const masse = `${fmt2(x.breite)} × ${fmt2(x.hoehe)} m = ${fmt2(x.flaeche)} m²`;
  return `${masse}, ${x.abzug ? 'abgezogen' : 'übermessen'}${x.laibungTiefe ? `, Laibung ${fmt2(x.laibungLaenge)} m` : ''}`;
}

// ---------- Raster ----------

// Mit Maßstab ein Meter-Raster entlang der Referenzachsen (ganze Meter kräftiger), sonst ein Bildraster.
// abstand = kleinster Linienabstand in Bildpunkten, damit das Raster auf dem Handy lesbar bleibt.
function rasterVon(d, W, H, abstand) {
  const ms = massstab(d);
  if (ms && !ms.fehler) {
    const schritt = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10].find((x) => x * ms.pxProM >= abstand) || 10;
    const ecken = [[0, 0], [W, 0], [0, H], [W, H]].map(ms.inM);
    const xs = ecken.map((q) => q[0]);
    const ys = ecken.map((q) => q[1]);
    return {
      ms, schritt,
      x: [Math.floor(Math.min(...xs) / schritt), Math.ceil(Math.max(...xs) / schritt)],
      y: [Math.floor(Math.min(...ys) / schritt), Math.ceil(Math.max(...ys) / schritt)],
    };
  }
  return { schritt: abstand };
}
function rasterFang(r, p) {
  if (!r.ms) return [Math.round(p[0] / r.schritt) * r.schritt, Math.round(p[1] / r.schritt) * r.schritt];
  const m = r.ms.inM(p);
  return r.ms.inPx([Math.round(m[0] / r.schritt) * r.schritt, Math.round(m[1] / r.schritt) * r.schritt]);
}
function zeichneRaster(ctx, r, W, H, basis) {
  ctx.save();
  const linie = (a, b, stark) => {
    ctx.strokeStyle = stark ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.3)';
    ctx.lineWidth = basis * (stark ? 0.32 : 0.18);
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  };
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = basis * 0.4;
  if (r.ms) {
    const s = r.schritt;
    const ganz = (v) => Math.abs(v - Math.round(v)) < 1e-6;
    for (let i = r.x[0]; i <= r.x[1]; i++) linie(r.ms.inPx([i * s, r.y[0] * s]), r.ms.inPx([i * s, r.y[1] * s]), ganz(i * s));
    for (let j = r.y[0]; j <= r.y[1]; j++) linie(r.ms.inPx([r.x[0] * s, j * s]), r.ms.inPx([r.x[1] * s, j * s]), ganz(j * s));
  } else {
    for (let x = 0, i = 0; x <= W; x += r.schritt, i++) linie([x, 0], [x, H], i % 5 === 0);
    for (let y = 0, j = 0; y <= H; y += r.schritt, j++) linie([0, y], [W, y], j % 5 === 0);
  }
  ctx.restore();
}

// ---------- Zeichnen ----------

async function ladeBild(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function etikett(ctx, text, [x0, y0], groesse, farbe) {
  ctx.save();
  ctx.font = `700 ${groesse}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const zeilen = String(text).split('\n');
  const w = Math.max(...zeilen.map((z) => ctx.measureText(z).width)) + groesse * 0.8;
  const h = zeilen.length * groesse * 1.2 + groesse * 0.4;
  // Immer ganz im Bild lassen
  const x = Math.min(Math.max(x0, w / 2), ctx.canvas.width - w / 2);
  const y = Math.min(Math.max(y0, h / 2), ctx.canvas.height - h / 2);
  ctx.fillStyle = 'rgba(17,17,17,.78)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, groesse * 0.3); else ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fill();
  ctx.fillStyle = farbe;
  zeilen.forEach((z, i) => ctx.fillText(z, x, y - h / 2 + groesse * 0.2 + groesse * 1.2 * (i + 0.5)));
  ctx.restore();
}

function zeichneAlles(ctx, img, d, { basis, entwurf = null, griffe = false, auswahl = null, vorschau = null, raster = null, aktiv = null }) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  ctx.drawImage(img, 0, 0, W, H);
  if (raster) zeichneRaster(ctx, raster, W, H, basis);
  const { teile } = auswerten(d);
  const werte = new Map(teile.map((x) => [x.t, x]));
  const schrift = basis * 4.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const pfad = (p, zu) => {
    ctx.beginPath();
    p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (zu) ctx.closePath();
  };
  for (const t of d.teile) {
    const x = werte.get(t);
    const farbe = t.typ === 'linie' ? FARBE.linie : t.typ === 'flaeche' ? FARBE.flaeche : (x && !x.abzug ? FARBE.uebermessen : FARBE.abzug);
    ctx.save();
    pfad(t.punkte, t.typ !== 'linie');
    if (t.typ !== 'linie') { ctx.fillStyle = hexA(farbe, t.typ === 'flaeche' ? 0.18 : 0.3); ctx.fill(); }
    ctx.strokeStyle = farbe;
    ctx.lineWidth = basis * (t === auswahl ? 1.9 : 1.1);
    if (t.typ === 'oeffnung' && x && !x.abzug) ctx.setLineDash([basis * 3, basis * 2]);
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = basis;
    ctx.stroke();
    ctx.restore();
  }
  // Referenzen: gelbe Maßlinien mit Endstrichen
  for (const key of ['laenge', 'hoehe']) {
    const r = d.ref[key];
    if (!r) continue;
    ctx.save();
    ctx.strokeStyle = FARBE.ref;
    ctx.lineWidth = basis * 1.2;
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = basis;
    const [ax, ay] = r.a;
    const [bx, by] = r.b;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / len) * basis * 3;
    const ny = ((bx - ax) / len) * basis * 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.moveTo(ax - nx, ay - ny); ctx.lineTo(ax + nx, ay + ny);
    ctx.moveTo(bx - nx, by - ny); ctx.lineTo(bx + nx, by + ny);
    ctx.stroke();
    ctx.restore();
    const m = zahl(r.m);
    etikett(ctx, `${key === 'laenge' ? 'Länge' : 'Höhe'} ${m ? `${fmt2(m)} m` : '?'}`, [(ax + bx) / 2 + nx * 2.2, (ay + by) / 2 + ny * 2.2], schrift * 0.9, FARBE.ref);
  }
  // Beschriftung der Teile
  for (const t of d.teile) {
    const x = werte.get(t);
    let pos = mitte(t.punkte);
    // Flächen oben beschriften, damit Öffnungen in der Mitte frei bleiben
    if (t.typ === 'flaeche') pos = [pos[0], Math.min(...t.punkte.map((q) => q[1])) + schrift * 1.8];
    if (t.typ === 'linie') {
      const i = Math.floor((t.punkte.length - 1) / 2);
      pos = [(t.punkte[i][0] + t.punkte[i + 1][0]) / 2, (t.punkte[i][1] + t.punkte[i + 1][1]) / 2 - schrift * 1.4];
    }
    let wert = '';
    if (x) {
      if (t.typ === 'linie') wert = `${fmt2(x.laenge)} m`;
      else if (t.typ === 'flaeche') wert = `${fmt2(x.netto)} m²`;
      else wert = `${fmt2(x.breite)} × ${fmt2(x.hoehe)}\n${fmt2(x.flaeche)} m² ${x.abzug ? 'Abzug' : 'übermessen'}`;
    }
    const farbe = t.typ === 'linie' ? '#90caf9' : t.typ === 'flaeche' ? '#a5d6a7' : (x && !x.abzug ? '#ffcc80' : '#ef9a9a');
    etikett(ctx, wert ? `${t.name}\n${wert}` : t.name, pos, t.typ === 'flaeche' ? schrift : schrift * 0.85, farbe);
  }
  // Entwurf (gerade gezeichnetes Teil)
  if (entwurf) {
    const p = vorschau ? [...entwurf.punkte, vorschau] : entwurf.punkte;
    const farbe = entwurf.typ === 'linie' ? FARBE.linie : entwurf.typ === 'flaeche' ? FARBE.flaeche : FARBE.abzug;
    ctx.save();
    ctx.strokeStyle = farbe;
    ctx.lineWidth = basis * 1.1;
    ctx.setLineDash([basis * 2.5, basis * 1.5]);
    if (p.length > 1) { pfad(p, false); ctx.stroke(); }
    ctx.restore();
  }
  if (griffe) {
    const punkt = ([x, y], farbe, gross) => {
      ctx.save();
      ctx.fillStyle = farbe;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = basis * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, basis * (gross ? 2.6 : 1.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    for (const key of ['laenge', 'hoehe']) if (d.ref[key]) { punkt(d.ref[key].a, FARBE.ref); punkt(d.ref[key].b, FARBE.ref); }
    for (const t of d.teile) t.punkte.forEach((q) => punkt(q, '#fff'));
    if (entwurf) entwurf.punkte.forEach((q, i) => punkt(q, i === 0 && entwurf.punkte.length > 2 && entwurf.typ !== 'linie' ? '#fdd835' : '#fff', i === 0));
    if (vorschau) punkt(vorschau, '#fff');
    if (aktiv) {
      // Gerade bearbeiteter Punkt: roter Ring
      ctx.save();
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = basis * 0.8;
      ctx.beginPath();
      ctx.arc(aktiv[0], aktiv[1], basis * 3.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Fertiges Bild für Bericht und PDF: Foto mit allen Maßen und einem Hinweis unten
async function planBild(img, d, basis) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const fuss = Math.round(basis * 9);
  const bild = document.createElement('canvas');
  bild.width = W;
  bild.height = H;
  zeichneAlles(bild.getContext('2d'), img, d, { basis });
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H + fuss;
  const ctx = c.getContext('2d');
  ctx.drawImage(bild, 0, 0);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, H, W, fuss);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${basis * 3.4}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  const ref = ['laenge', 'hoehe'].filter((k) => d.ref[k] && zahl(d.ref[k].m)).map((k) => `${k === 'laenge' ? 'Länge' : 'Höhe'} ${fmt2(zahl(d.ref[k].m))} m`).join(', ');
  const text = `${d.titel} · Referenz ${ref} · ${regelVon(d).label} · Maße aus Foto ermittelt, nur ungefähr`;
  ctx.fillText(text, basis * 3, H + fuss / 2, W - basis * 6);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.86));
}

// ---------- Oberfläche ----------

const WERKZEUGE = [
  { id: 'laenge', label: 'Ref. Länge', svg: '<path d="M3 12h18M3 8v8M21 8v8" fill="none" stroke="#fdd835" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'hoehe', label: 'Ref. Höhe', svg: '<path d="M12 3v18M8 3h8M8 21h8" fill="none" stroke="#fdd835" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'flaeche', label: 'Fläche', svg: '<path d="M4 6l15-2 1 15-16 1z" fill="rgba(67,160,71,.35)" stroke="#43a047" stroke-width="2" stroke-linejoin="round"/>' },
  { id: 'oeffnung', label: 'Öffnung', svg: '<rect x="6" y="4" width="12" height="16" fill="rgba(229,57,53,.3)" stroke="#e53935" stroke-width="2"/><path d="M12 4v16M6 11h12" stroke="#e53935" stroke-width="1.5"/>' },
  { id: 'linie', label: 'Strecke', svg: '<path d="M4 18l6-9 5 5 5-9" fill="none" stroke="#1e88e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
];
const RUECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L4 9l5 5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RASTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const RASTER_MODI = { aus: 'Raster aus', an: 'Raster', fang: 'Raster + Fangen' };
const PFEILE = { l: [-1, 0, '◀'], o: [0, -1, '▲'], u: [0, 1, '▼'], r: [1, 0, '▶'] };
const LISTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.5M4 12h.5M4 18h.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function openFotoAufmass(blob, vorlage) {
  const img = await ladeBild(blob);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const basis = Math.max(2, Math.max(W, H) / 130);
  const d = JSON.parse(JSON.stringify(vorlage));
  d.ref = d.ref || {};
  d.teile = d.teile || [];
  let werkzeug = d.ref.laenge ? (d.ref.hoehe ? 'flaeche' : 'hoehe') : 'laenge';
  let entwurf = null; // { typ, punkte }
  let ziehen = null; // aktuelle Fingerbewegung
  let auswahl = null;
  let geaendert = false;
  let aktiv = null; // Punkt im Fadenkreuz-Fenster: { art: 'ref'|'teil'|'entwurf', … }
  let fkZoom = 6;
  let rasterModus = 'an';
  try { rasterModus = localStorage.getItem('fa-raster') || 'an'; } catch { /* ohne Speicher */ }

  const view = document.createElement('div');
  view.className = 'mk-view fa-view';
  view.innerHTML = `
    <div class="mk-top">
      <button type="button" class="btn ghost fa-abbrechen">Abbrechen</button>
      <b>Foto-Aufmaß</b>
      <button type="button" class="btn primary fa-fertig">Übernehmen</button>
    </div>
    <div class="fa-hinweis"><span class="fa-text"></span><span class="fa-knoepfe"></span></div>
    <div class="mk-flaeche fa-flaeche"><canvas class="fa-bild"></canvas><div class="fa-fk" hidden>
      <canvas width="360" height="360"></canvas>
      <div class="fa-fk-leiste">${Object.entries(PFEILE).map(([k, v]) => `<button type="button" data-pfeil="${k}" aria-label="Punkt verschieben">${v[2]}</button>`).join('')}
        <button type="button" class="fa-fk-zoom">6×</button><button type="button" class="fa-fk-ok" aria-label="Fertig">✓</button></div>
    </div></div>
    <div class="fa-panel" hidden></div>
    <div class="mk-leiste">
      <div class="mk-werkzeuge">${WERKZEUGE.map((w) => `<button type="button" class="mk-wz" data-wz="${w.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${w.svg}</svg><span>${w.label}</span></button>`).join('')}</div>
      <div class="mk-farben">
        <button type="button" class="mk-rueck fa-liste">${LISTE}<span>Liste</span></button>
        <button type="button" class="mk-rueck fa-raster">${RASTER}<span></span></button>
        <span class="fa-regel"></span>
        <button type="button" class="mk-rueck fa-rueck" aria-label="Rückgängig">${RUECK}<span>Rückgängig</span></button>
      </div>
    </div>`;
  document.body.appendChild(view);
  document.documentElement.classList.add('mk-offen');
  const $ = (s) => view.querySelector(s);

  const canvas = $('.fa-bild');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const flaeche = $('.fa-flaeche');
  const fk = $('.fa-fk');
  const fkCanvas = fk.querySelector('canvas');
  const fctx = fkCanvas.getContext('2d');
  const panel = $('.fa-panel');

  const einpassen = () => {
    const r = flaeche.getBoundingClientRect();
    const s = Math.min((r.width - 8) / W, (r.height - 8) / H);
    canvas.style.width = `${Math.floor(W * s)}px`;
    canvas.style.height = `${Math.floor(H * s)}px`;
  };
  const vorschauPunkt = () => (ziehen?.art === 'neupunkt' ? ziehen.p : null);
  const proPx = () => W / canvas.getBoundingClientRect().width; // Bildpunkte je Bildschirmpunkt
  const raster = () => (rasterModus === 'aus' ? null : rasterVon(d, W, H, 26 * proPx()));
  const fangen = (p) => (rasterModus === 'fang' ? rasterFang(raster(), p) : p);
  const lage = (a) => {
    if (!a) return null;
    if (a.art === 'ref') return d.ref[a.key]?.[a.ende] || null;
    if (a.art === 'teil') return d.teile.includes(a.t) ? a.t.punkte[a.i] || null : null;
    return entwurf?.punkte[a.i] || null;
  };
  const setze = (a, p) => {
    if (a.art === 'ref') d.ref[a.key][a.ende] = p;
    else if (a.art === 'teil') a.t.punkte[a.i] = p;
    else entwurf.punkte[a.i] = p;
    geaendert = true;
  };
  const neuZeichnen = () => {
    const tmp = ziehen?.art === 'refneu' ? { ...d, ref: { ...d.ref, [ziehen.key]: { a: ziehen.a, b: ziehen.b, m: d.ref[ziehen.key]?.m || '' } } } : d;
    if (aktiv && !lage(aktiv)) { aktiv = null; if (!ziehen) fk.hidden = true; }
    zeichneAlles(ctx, img, tmp, { basis, entwurf, griffe: true, auswahl, vorschau: vorschauPunkt(), raster: raster(), aktiv: lage(aktiv) });
    hinweis();
  };

  // Fadenkreuz-Fenster: stark vergrößerter Ausschnitt mit Fadenkreuz in der Mitte. Beim Antippen folgt
  // es dem Finger; danach bleibt es für den zuletzt gesetzten Punkt offen. Bild im Fenster ziehen oder
  // Pfeile tippen schiebt den Punkt genau aufs Fadenkreuz.
  let FK = 180; // Fenstergröße in Bildschirmpunkten, passt sich dem freien Platz an
  const fkQuelle = () => (FK / fkZoom) * proPx(); // gezeigter Ausschnitt in Bildpunkten
  const zeigeFenster = (p) => {
    if (!p) { fk.hidden = true; return; }
    fk.classList.toggle('nur-lupe', !aktiv || Boolean(ziehen));
    const r = canvas.getBoundingClientRect();
    const fr = flaeche.getBoundingClientRect();
    // Fenster möglichst neben das Foto (Platz darüber oder darunter), sonst in die Ecke weit weg vom Punkt
    const leiste = 38; // Pfeilleiste immer einplanen, damit das Fenster nicht springt
    const frei = Math.max(r.top - fr.top, fr.bottom - r.bottom) - leiste - 12;
    FK = frei >= 120 ? Math.min(180, frei) : 150;
    fkCanvas.style.width = `${FK}px`;
    fkCanvas.style.height = `${FK}px`;
    fk.style.width = `${FK}px`;
    const hoch = FK + leiste + 4;
    const px = r.left + p[0] / proPx() - fr.left;
    const py = r.top + p[1] / proPx() - fr.top;
    const oben = r.top - fr.top;
    const unten = fr.bottom - r.bottom;
    let x;
    let y;
    if (oben >= hoch + 8 || unten >= hoch + 8) {
      y = oben >= hoch + 8 && (unten < hoch + 8 || py > fr.height / 2) ? oben - hoch - 4 : r.bottom - fr.top + 4;
      x = Math.min(Math.max(8, px - FK / 2), fr.width - FK - 8);
    } else {
      x = px > fr.width / 2 ? 8 : fr.width - FK - 8;
      y = py > fr.height / 2 ? 8 : fr.height - hoch - 8;
    }
    fk.style.left = `${x}px`;
    fk.style.top = `${y}px`;
    fk.style.right = 'auto';
    fk.hidden = false;
    const q = fkQuelle();
    const sk = fkCanvas.width / q;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.fillStyle = '#000';
    fctx.fillRect(0, 0, fkCanvas.width, fkCanvas.height);
    fctx.setTransform(sk, 0, 0, sk, -(p[0] - q / 2) * sk, -(p[1] - q / 2) * sk);
    fctx.imageSmoothingEnabled = fkZoom < 10;
    fctx.drawImage(img, 0, 0, W, H);
    // dünne Linien der Markierungen, damit Kanten sichtbar bleiben
    fctx.lineWidth = 1.6 / sk;
    const strich = (pts, farbe, zu) => {
      if (!pts || pts.length < 2) return;
      fctx.strokeStyle = farbe;
      fctx.beginPath();
      pts.forEach((q2, i) => (i ? fctx.lineTo(...q2) : fctx.moveTo(...q2)));
      if (zu) fctx.closePath();
      fctx.stroke();
    };
    for (const key of ['laenge', 'hoehe']) if (d.ref[key]) strich([d.ref[key].a, d.ref[key].b], FARBE.ref);
    if (ziehen?.art === 'refneu') strich([ziehen.a, ziehen.b], FARBE.ref);
    for (const t of d.teile) strich(t.punkte, t.typ === 'linie' ? FARBE.linie : t.typ === 'flaeche' ? FARBE.flaeche : FARBE.abzug, t.typ !== 'linie');
    if (entwurf) strich(entwurf.punkte, '#fff');
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    const c = fkCanvas.width / 2;
    const kreuz = (farbe, breite) => {
      fctx.strokeStyle = farbe;
      fctx.lineWidth = breite;
      fctx.beginPath();
      fctx.moveTo(c, 0); fctx.lineTo(c, c - 10); fctx.moveTo(c, c + 10); fctx.lineTo(c, c * 2);
      fctx.moveTo(0, c); fctx.lineTo(c - 10, c); fctx.moveTo(c + 10, c); fctx.lineTo(c * 2, c);
      fctx.stroke();
    };
    kreuz('rgba(0,0,0,.7)', 4);
    kreuz('#ff1744', 1.6);
    fctx.fillStyle = '#ff1744';
    fctx.fillRect(c - 1.5, c - 1.5, 3, 3);
  };
  const fensterZu = () => { aktiv = null; fk.hidden = true; neuZeichnen(); };
  const fensterAuf = () => { zeigeFenster(lage(aktiv)); };

  // Im Fenster ziehen: das Bild wandert unter dem Fadenkreuz, der Punkt bewegt sich fein mit
  let fkZug = null;
  fkCanvas.addEventListener('pointerdown', (e) => {
    if (!aktiv) return;
    e.preventDefault();
    fkCanvas.setPointerCapture(e.pointerId);
    fkZug = { x: e.clientX, y: e.clientY, p: [...lage(aktiv)] };
  });
  fkCanvas.addEventListener('pointermove', (e) => {
    if (!fkZug || !aktiv) return;
    const f = fkQuelle() / FK;
    const p = [
      Math.min(W, Math.max(0, fkZug.p[0] - (e.clientX - fkZug.x) * f)),
      Math.min(H, Math.max(0, fkZug.p[1] - (e.clientY - fkZug.y) * f)),
    ];
    setze(aktiv, p);
    neuZeichnen();
    fensterAuf();
  });
  const fkLos = () => { fkZug = null; };
  fkCanvas.addEventListener('pointerup', fkLos);
  fkCanvas.addEventListener('pointercancel', fkLos);
  fk.querySelectorAll('[data-pfeil]').forEach((b) => {
    b.onclick = () => {
      const p = lage(aktiv);
      if (!p) return;
      const [dx, dy] = PFEILE[b.dataset.pfeil];
      const schritt = Math.max(0.25, fkQuelle() / 90); // etwa 2 Fensterpunkte
      setze(aktiv, [Math.min(W, Math.max(0, p[0] + dx * schritt)), Math.min(H, Math.max(0, p[1] + dy * schritt))]);
      neuZeichnen();
      fensterAuf();
    };
  });
  fk.querySelector('.fa-fk-zoom').onclick = (e) => {
    fkZoom = fkZoom === 3 ? 6 : fkZoom === 6 ? 12 : 3;
    e.currentTarget.textContent = `${fkZoom}×`;
    fensterAuf();
  };
  fk.querySelector('.fa-fk-ok').onclick = fensterZu;

  function hinweis() {
    const txt = $('.fa-text');
    const kn = $('.fa-knoepfe');
    const ms = massstab(d);
    let t;
    let k = '';
    if (entwurf) {
      const n = entwurf.punkte.length;
      t = entwurf.typ === 'linie'
        ? `Tippe die Punkte der Strecke an (${n} gesetzt).`
        : `Tippe die Ecken an (${n} gesetzt). Zum Schließen den gelben ersten Punkt antippen.`;
      k = `<button type="button" class="chip fa-punkt-zurueck">Punkt zurück</button>${n >= (entwurf.typ === 'linie' ? 2 : 3) ? '<button type="button" class="chip fa-schliessen" aria-pressed="true">Fertig</button>' : ''}`;
    } else if (werkzeug === 'laenge' || werkzeug === 'hoehe') {
      t = werkzeug === 'laenge'
        ? 'Ziehe eine Linie über eine bekannte waagerechte Länge (z. B. Fensterbreite, Zollstock).'
        : 'Ziehe eine Linie über eine bekannte senkrechte Höhe (z. B. Türhöhe, Geschosshöhe).';
    } else if (!ms) {
      t = 'Zuerst eine Referenz setzen: „Ref. Länge“ und „Ref. Höhe“.';
    } else if (ms.fehler) {
      t = ms.fehler;
    } else {
      t = werkzeug === 'linie' ? 'Strecke: Punkte antippen, dann „Fertig“.'
        : `${werkzeug === 'flaeche' ? 'Fläche' : 'Öffnung'}: Ecken nacheinander antippen. Punkte lassen sich danach verschieben.`;
      if (!ms.beide) t += ' Nur eine Referenz gesetzt: Maßstab gilt dann für beide Richtungen.';
    }
    if (aktiv && !ziehen) t = `Roter Punkt: im Fadenkreuz-Fenster das Bild ziehen oder die Pfeile tippen, bis er genau sitzt. ${t}`;
    txt.textContent = t;
    kn.innerHTML = k;
    const pz = $('.fa-punkt-zurueck');
    if (pz) pz.onclick = () => { entwurf.punkte.pop(); if (!entwurf.punkte.length) entwurf = null; neuZeichnen(); };
    const sc = $('.fa-schliessen');
    if (sc) sc.onclick = () => abschliessen();
    view.querySelectorAll('.mk-wz').forEach((b) => b.setAttribute('aria-pressed', b.dataset.wz === werkzeug));
    $('.fa-regel').textContent = `${regelVon(d).label.replace(/ \(.*/, '')}: ${regelVon(d).schwelle ? `bis ${fmt(regelVon(d).schwelle)} m² übermessen` : 'alles abziehen'}`;
    $('.fa-rueck').disabled = !entwurf && !d.teile.length && !d.ref.laenge && !d.ref.hoehe;
    const rb = $('.fa-raster');
    rb.querySelector('span').textContent = RASTER_MODI[rasterModus];
    rb.setAttribute('aria-pressed', rasterModus !== 'aus');
  }

  // Kleines Eingabefeld unten statt eines Dialogs
  const frage = (html, onOk, onAbbruch) => {
    panel.innerHTML = `${html}<div class="fa-panel-knoepfe"><button type="button" class="btn ghost fa-p-ab">Abbrechen</button><button type="button" class="btn primary fa-p-ok">OK</button></div>`;
    panel.hidden = false;
    const zu = () => { panel.hidden = true; panel.innerHTML = ''; neuZeichnen(); };
    panel.querySelector('.fa-p-ok').onclick = () => { if (onOk(panel) !== false) zu(); };
    panel.querySelector('.fa-p-ab').onclick = () => { onAbbruch?.(); zu(); };
    panel.querySelectorAll('input').forEach((inp) => {
      inp.onkeydown = (e) => { if (e.key === 'Enter') panel.querySelector('.fa-p-ok').click(); };
    });
    const erstes = panel.querySelector('input');
    if (erstes) setTimeout(() => { erstes.focus(); erstes.select?.(); }, 50);
  };

  const fragMass = (key, neu) => {
    frage(`<label class="fa-feld"><span>${key === 'laenge' ? 'Bekannte Länge (waagerecht)' : 'Bekannte Höhe (senkrecht)'} in Metern</span>
      <input type="text" inputmode="decimal" class="fa-m" value="${escH(d.ref[key]?.m || '')}" placeholder="z. B. 1,01"></label>`, (p) => {
      const v = p.querySelector('.fa-m').value.trim();
      if (!(zahl(v) > 0)) { p.querySelector('.fa-m').focus(); return false; }
      d.ref[key].m = v;
      geaendert = true;
      if (key === 'laenge' && !d.ref.hoehe) werkzeug = 'hoehe';
      else if (werkzeug === 'laenge' || werkzeug === 'hoehe') werkzeug = 'flaeche';
      return true;
    }, () => { if (neu) delete d.ref[key]; });
  };

  const naechsterName = (typ) => {
    const basisName = TYPEN[typ].name;
    let n = 1;
    while (d.teile.some((t) => t.name === `${basisName} ${n}`)) n++;
    return `${basisName} ${n}`;
  };

  const teilFragen = (t, neu) => {
    const oe = t.typ === 'oeffnung';
    frage(`<label class="fa-feld"><span>Bezeichnung (${TYPEN[t.typ].label})</span><input type="text" class="fa-name" value="${escH(t.name)}"></label>
      ${t.typ === 'flaeche' ? '<div class="fa-vorschlaege">' + ['Wand', 'Decke', 'Fassade', 'Giebel', 'Sockel'].map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('') + '</div>' : ''}
      ${oe ? `<div class="fa-vorschlaege">${['Fenster', 'Tür', 'Tor', 'Nische'].map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="fa-zeile"><label class="fa-feld"><span>Laibungstiefe (cm)</span><input type="text" inputmode="decimal" class="fa-tiefe" value="${escH(t.laibung?.tiefe || '')}" placeholder="leer = keine"></label>
      <label class="fa-check"><input type="checkbox" class="fa-unten" ${t.laibung?.unten ? 'checked' : ''}> Laibung unten (Brüstung) mitrechnen</label></div>` : ''}`, (p) => {
      t.name = p.querySelector('.fa-name').value.trim() || t.name;
      if (oe) t.laibung = { tiefe: p.querySelector('.fa-tiefe').value.trim(), unten: p.querySelector('.fa-unten').checked };
      geaendert = true;
      return true;
    }, () => { if (neu) { d.teile.splice(d.teile.indexOf(t), 1); } });
    panel.querySelectorAll('.fa-vorschlaege .chip').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.v;
        let n = 1;
        while (d.teile.some((x) => x !== t && x.name === `${v} ${n}`)) n++;
        const inp = panel.querySelector('.fa-name');
        inp.value = `${v} ${n}`;
        inp.focus();
      };
    });
  };

  const abschliessen = () => {
    if (!entwurf) return;
    const genug = entwurf.punkte.length >= (entwurf.typ === 'linie' ? 2 : 3);
    if (!genug) return;
    const t = { id: neueId(), typ: entwurf.typ, name: naechsterName(entwurf.typ), punkte: entwurf.punkte };
    d.teile.push(t);
    if (aktiv?.art === 'entwurf') aktiv = { art: 'teil', t, i: aktiv.i };
    entwurf = null;
    geaendert = true;
    neuZeichnen();
    teilFragen(t, true);
  };

  einpassen();
  neuZeichnen();
  window.addEventListener('resize', einpassen);

  const punkt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W)),
      Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H)),
    ];
  };
  const fangRadius = () => (24 * W) / canvas.getBoundingClientRect().width;
  const treffer = (p) => {
    const rad = fangRadius();
    let best = null;
    let bestD = rad;
    const pruefe = (q, ziel) => {
      const dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (dd < bestD) { bestD = dd; best = ziel; }
    };
    if (entwurf) entwurf.punkte.forEach((q, i) => pruefe(q, { art: 'entwurf', i }));
    for (const key of ['laenge', 'hoehe']) {
      if (d.ref[key]) { pruefe(d.ref[key].a, { art: 'ref', key, ende: 'a' }); pruefe(d.ref[key].b, { art: 'ref', key, ende: 'b' }); }
    }
    for (const t of d.teile) t.punkte.forEach((q, i) => pruefe(q, { art: 'teil', t, i }));
    return best;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!panel.hidden) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const roh = punkt(e);
    const p = fangen(roh);
    const t = treffer(roh);
    if (t) {
      // Antippen fängt den vorhandenen Punkt (gemeinsame Ecken), Ziehen verschiebt ihn
      ziehen = { ...t, start: roh, p, tippen: true };
    } else if (werkzeug === 'laenge' || werkzeug === 'hoehe') {
      ziehen = { art: 'refneu', key: werkzeug, a: p, b: p };
    } else {
      if (!entwurf || entwurf.typ !== werkzeug) entwurf = { typ: werkzeug, punkte: [] };
      ziehen = { art: 'neupunkt', p };
    }
    neuZeichnen();
    zeigeFenster(p);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ziehen) return;
    const roh = punkt(e);
    const p = fangen(roh);
    ziehen.p = p;
    if (ziehen.tippen && Math.hypot(roh[0] - ziehen.start[0], roh[1] - ziehen.start[1]) > fangRadius() / 3) {
      ziehen.tippen = false;
      if (ziehen.art === 'teil') auswahl = ziehen.t;
      aktiv = ziehen.art === 'ref' ? { art: 'ref', key: ziehen.key, ende: ziehen.ende }
        : ziehen.art === 'teil' ? { art: 'teil', t: ziehen.t, i: ziehen.i } : { art: 'entwurf', i: ziehen.i };
    }
    if (ziehen.tippen) { zeigeFenster(roh); return; }
    if (ziehen.art === 'refneu') ziehen.b = p;
    else if (ziehen.art !== 'neupunkt') setze(aktiv, p);
    neuZeichnen();
    zeigeFenster(p);
  });
  const loslassen = () => {
    if (!ziehen) return;
    const z = ziehen;
    ziehen = null;
    if (z.art === 'refneu') {
      if (Math.hypot(z.b[0] - z.a[0], z.b[1] - z.a[1]) > fangRadius()) {
        const neu = !d.ref[z.key];
        d.ref[z.key] = { a: z.a, b: z.b, m: d.ref[z.key]?.m || '' };
        aktiv = { art: 'ref', key: z.key, ende: 'b' };
        geaendert = true;
        neuZeichnen();
        fensterAuf();
        fragMass(z.key, neu);
        return;
      }
    } else if (z.art === 'neupunkt') {
      entwurf.punkte.push(z.p);
      aktiv = { art: 'entwurf', i: entwurf.punkte.length - 1 };
    } else if (z.tippen) {
      const hier = z.art === 'ref' ? { art: 'ref', key: z.key, ende: z.ende } : z.art === 'teil' ? { art: 'teil', t: z.t, i: z.i } : { art: 'entwurf', i: z.i };
      if (z.art === 'entwurf' && z.i === 0 && entwurf.typ !== 'linie' && entwurf.punkte.length >= 3) {
        abschliessen();
        fensterAuf();
        return;
      }
      if (werkzeug === 'laenge' || werkzeug === 'hoehe' || z.art === 'entwurf') {
        aktiv = hier; // vorhandenen Punkt zum Feinjustieren auswählen
      } else {
        if (!entwurf || entwurf.typ !== werkzeug) entwurf = { typ: werkzeug, punkte: [] };
        const q = lage(hier);
        entwurf.punkte.push(Math.hypot(q[0] - z.start[0], q[1] - z.start[1]) < fangRadius() / 2 ? [...q] : z.p);
        aktiv = { art: 'entwurf', i: entwurf.punkte.length - 1 };
      }
    }
    neuZeichnen();
    fensterAuf();
  };
  canvas.addEventListener('pointerup', loslassen);
  canvas.addEventListener('pointercancel', loslassen);

  view.querySelectorAll('.mk-wz').forEach((b) => {
    b.onclick = () => {
      if (entwurf && entwurf.typ !== b.dataset.wz) {
        if (entwurf.punkte.length >= (entwurf.typ === 'linie' ? 2 : 3)) abschliessen();
        else entwurf = null;
      }
      werkzeug = b.dataset.wz;
      auswahl = null;
      neuZeichnen();
    };
  });
  $('.fa-raster').onclick = () => {
    rasterModus = rasterModus === 'aus' ? 'an' : rasterModus === 'an' ? 'fang' : 'aus';
    try { localStorage.setItem('fa-raster', rasterModus); } catch { /* egal */ }
    neuZeichnen();
  };
  $('.fa-rueck').onclick = () => {
    aktiv = null;
    fk.hidden = true;
    if (entwurf) { entwurf.punkte.pop(); if (!entwurf.punkte.length) entwurf = null; } else if (d.teile.length) d.teile.pop();
    else if (d.ref.hoehe) delete d.ref.hoehe;
    else delete d.ref.laenge;
    geaendert = true;
    neuZeichnen();
  };

  // Liste aller Teile mit Werten, Abzugsregel und Laibungen
  $('.fa-liste').onclick = () => {
    const zeichneListe = () => {
      const { ms, teile } = auswerten(d);
      const werte = new Map(teile.map((x) => [x.t, x]));
      const refZeile = (key) => {
        const r = d.ref[key];
        return `<div class="fa-li"><span class="fa-dot" style="--c:${FARBE.ref}"></span><div><b>Referenz ${key === 'laenge' ? 'Länge' : 'Höhe'}</b><small>${r ? (zahl(r.m) ? `${fmt2(zahl(r.m))} m` : 'Maß fehlt') : 'nicht gesetzt'}</small></div>
          ${r ? `<button type="button" class="chip" data-ref="${key}">Maß ändern</button>` : ''}</div>`;
      };
      panel.innerHTML = `
        <div class="fa-panel-kopf"><b>${escH(d.titel)}</b><button type="button" class="btn primary fa-p-ok">Fertig</button></div>
        <label class="fa-feld"><span>Abzug von Öffnungen (VOB/C)</span><select class="fa-regel-wahl">${REGELN.map((r) => `<option value="${r.id}" ${r.id === regelVon(d).id ? 'selected' : ''}>${r.label}${r.schwelle ? ` – bis ${fmt(r.schwelle)} m² übermessen` : ''}</option>`).join('')}</select></label>
        <div class="fa-feld"><span>Laibungen abrechnen nach</span><div class="seg fa-laibung" role="radiogroup">
          <button type="button" role="radio" data-l="m2" aria-checked="${d.laibungAls !== 'm'}">Fläche (m²)</button>
          <button type="button" role="radio" data-l="m" aria-checked="${d.laibungAls === 'm'}">Länge (lfm)</button></div></div>
        <p class="fa-klein">Grenzen nach VOB/C 2019. Was im Vertrag vereinbart ist, geht vor. Maße aus dem Foto sind nur ungefähr; wichtige Maße am Bau nachmessen.</p>
        ${refZeile('laenge')}${refZeile('hoehe')}
        ${ms?.fehler ? `<p class="fa-klein fa-warn">${escH(ms.fehler)}</p>` : ''}
        ${d.teile.map((t, i) => {
          const x = werte.get(t);
          const c = t.typ === 'linie' ? FARBE.linie : t.typ === 'flaeche' ? FARBE.flaeche : (x && !x.abzug ? FARBE.uebermessen : FARBE.abzug);
          return `<div class="fa-li"><span class="fa-dot" style="--c:${c}"></span><div><b>${escH(t.name)}</b><small>${TYPEN[t.typ].label}${x ? ` · ${escH(wertText(x))}` : ''}${x?.t.typ === 'oeffnung' && x.in ? ` · in ${escH(x.in.t.name)}` : ''}</small></div>
            <button type="button" class="chip" data-edit="${i}">Ändern</button><button type="button" class="chip" data-del="${i}" aria-label="Löschen">✕</button></div>`;
        }).join('') || '<p class="fa-klein">Noch nichts markiert.</p>'}`;
      panel.querySelector('.fa-p-ok').onclick = () => { panel.hidden = true; panel.innerHTML = ''; neuZeichnen(); };
      panel.querySelector('.fa-regel-wahl').onchange = (e) => {
        d.regel = e.target.value;
        try { localStorage.setItem('fa-regel', d.regel); } catch { /* egal */ }
        geaendert = true;
        neuZeichnen();
        zeichneListe();
      };
      panel.querySelectorAll('.fa-laibung button').forEach((b) => {
        b.onclick = () => { d.laibungAls = b.dataset.l; geaendert = true; zeichneListe(); };
      });
      panel.querySelectorAll('[data-ref]').forEach((b) => { b.onclick = () => fragMass(b.dataset.ref, false); });
      panel.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => teilFragen(d.teile[Number(b.dataset.edit)], false); });
      panel.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => {
          const t = d.teile[Number(b.dataset.del)];
          if (!confirm(`„${t.name}“ löschen?`)) return;
          d.teile.splice(Number(b.dataset.del), 1);
          geaendert = true;
          neuZeichnen();
          zeichneListe();
        };
      });
    };
    if (entwurf) abschliessen();
    if (!panel.hidden) return;
    panel.hidden = false;
    zeichneListe();
  };

  return new Promise((resolve) => {
    const schliessen = (ergebnis) => {
      window.removeEventListener('resize', einpassen);
      document.documentElement.classList.remove('mk-offen');
      view.remove();
      resolve(ergebnis);
    };
    $('.fa-abbrechen').onclick = () => {
      if (geaendert && !confirm('Foto-Aufmaß verwerfen?')) return;
      schliessen(null);
    };
    $('.fa-fertig').onclick = async () => {
      if (entwurf) abschliessen();
      if (!panel.hidden) return;
      const ms = massstab(d);
      if (!ms) { alert('Bitte zuerst eine Referenz (Länge oder Höhe) mit Maß setzen.'); return; }
      if (ms.fehler) { alert(ms.fehler); return; }
      if (!d.teile.length) { alert('Bitte mindestens eine Fläche, Öffnung oder Strecke markieren.'); return; }
      const plan = await planBild(img, d, basis);
      schliessen({ daten: d, plan });
    };
  });
}

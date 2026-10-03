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

// Perspektiv-Rahmen (wie bei Fotoaufmaß-Programmen): vier Ecken eines Rechtecks bekannter Breite und
// Höhe auf der Wand. Daraus eine Homografie, die das Foto entzerrt; Fotos von schräg werden damit richtig.
function loese(A, b) {
  const n = b.length;
  const M = A.map((z, i) => [...z, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((z, i) => z[n] / z[i]);
}
function homografie(von, nach) {
  const A = [];
  const b = [];
  von.forEach(([x, y], i) => {
    const [u, v] = nach[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  });
  const h = loese(A, b);
  return h ? [...h, 1] : null;
}
const wende = (h, [x, y]) => {
  const w = h[6] * x + h[7] * y + h[8];
  return w > 1e-12 ? [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w] : null;
};
// Ecken im Uhrzeigersinn ab links oben: links oben, rechts oben, rechts unten, links unten
export function ordneEcken(p) {
  const c = mitte(p);
  const s = [...p].sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
  const k = s.reduce((best, q, i) => (q[0] + q[1] < s[best][0] + s[best][1] ? i : best), 0);
  return [0, 1, 2, 3].map((j) => s[(k + j) % 4]);
}
function konvex(q) {
  const z = q.map((a, i) => {
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  });
  return z.every((v) => v > 0) || z.every((v) => v < 0);
}
export const rahmenFertig = (r) => Boolean(r && r.punkte?.length === 4 && zahl(r.b) > 0 && zahl(r.h) > 0);
function rahmenMassstab(r) {
  const q = ordneEcken(r.punkte);
  if (!konvex(q)) return { fehler: 'Die vier Rahmen-Ecken bilden kein Viereck. Bitte die Ecken verschieben.' };
  const b = zahl(r.b);
  const h = zahl(r.h);
  const hin = homografie(q, [[0, h], [b, h], [b, 0], [0, 0]]);
  const zurueck = hin && homografie([[0, h], [b, h], [b, 0], [0, 0]], q);
  if (!hin || !zurueck) return { fehler: 'Der Rahmen ist zu schmal. Bitte ein größeres Rechteck wählen.' };
  return {
    beide: true,
    rahmen: true,
    groesse: [b, h],
    pxProM: Math.min(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / b, Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) / h),
    inM: (p) => wende(hin, p) || [NaN, NaN],
    inPx: (P) => wende(zurueck, P),
  };
}

// Ohne Rahmen: die beiden Referenzlinien spannen ein (schiefwinkliges) Achsenkreuz auf. Das gleicht
// leicht schräge Fotos aus; echte Perspektive (stark von der Seite) braucht den Rahmen.
export function massstab(d) {
  if (rahmenFertig(d.ref?.rahmen)) return rahmenMassstab(d.ref.rahmen);
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
  const flZeile = (x, abzug = false, text = '') => ({
    ...(x.rechteck
      ? { ...newZeile(), laenge: fmt(x.breite), hoehe: fmt(x.hoehe), abzug }
      : { ...newZeile(), wert: fmt(x.flaeche), abzug }),
    ...(text ? { text } : {}),
  });
  for (const f of teile.filter((x) => x.t.typ === 'flaeche')) {
    const oe = teile.filter((x) => x.in === f);
    const ueber = oe.filter((x) => !x.abzug).map((x) => x.t.name);
    out.push({
      bezeichnung: f.t.name + (ueber.length ? ` (übermessen: ${ueber.join(', ')})` : ''),
      einheit: 'm2',
      zeilen: [flZeile(f, false, oe.some((x) => x.abzug) ? f.t.name : ''), ...oe.filter((x) => x.abzug).map((x) => flZeile(x, true, x.t.name))],
    });
  }
  const frei = teile.filter((x) => x.t.typ === 'oeffnung' && !x.in);
  if (frei.length) out.push({ bezeichnung: frei.map((x) => x.t.name).join(', '), einheit: 'm2', zeilen: frei.map((x) => flZeile(x)) });
  // Laibungen je Tiefe eine Position; je Öffnung 2 × Laibung (Höhe), 1 × Sturz (Breite),
  // bei „unten“ 1 × Brüstung. Der Umlauf je Öffnung steht in der Bezeichnung.
  const tiefen = new Map();
  for (const x of teile.filter((y) => y.t.typ === 'oeffnung')) {
    const k = x.laibungTiefe ? fmt(x.laibungTiefe * 100) : '';
    tiefen.set(k, [...(tiefen.get(k) || []), x]);
  }
  const alsM2 = d.laibungAls !== 'm';
  for (const [cm, list] of tiefen) {
    const m2 = alsM2 && cm !== '';
    const tiefe = (x) => (m2 ? fmt(x.laibungTiefe) : '');
    // aus den gerundeten Zeilenwerten, damit Umlauf und Summe der Zeilen übereinstimmen
    const umlauf = (x) => fmt2(2 * zahl(fmt(x.hoehe)) + zahl(fmt(x.breite)) * (x.t.laibung?.unten ? 2 : 1));
    out.push({
      bezeichnung: cm ? `Laibungen Tiefe ${cm} cm` : 'Laibungen (ohne Tiefe)',
      einheit: m2 ? 'm2' : 'm',
      zeilen: list.flatMap((x) => [
        { ...newZeile(), text: `${x.t.name}: Umlauf ${umlauf(x)} m`, info: true },
        { ...newZeile(), stueck: '2', laenge: fmt(x.hoehe), breite: tiefe(x), text: `${x.t.name} Laibung` },
        { ...newZeile(), stueck: '1', laenge: fmt(x.breite), breite: tiefe(x), text: `${x.t.name} Sturz` },
        ...(x.t.laibung?.unten ? [{ ...newZeile(), stueck: '1', laenge: fmt(x.breite), breite: tiefe(x), text: `${x.t.name} Brüstung` }] : []),
      ]),
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
    const ecken = [[0, 0], [W, 0], [0, H], [W, H]].map(ms.inM).filter((q) => Number.isFinite(q[0]));
    let xs = ecken.map((q) => q[0]);
    let ys = ecken.map((q) => q[1]);
    if (ms.rahmen) {
      // Bei Perspektive laufen die Bildecken weit weg: Raster auf die Umgebung des Rahmens begrenzen
      const [b, h] = ms.groesse;
      const r = Math.max(b, h) * 4;
      xs = [Math.max(Math.min(...xs, -r), -r), Math.min(Math.max(...xs, b + r), b + r)];
      ys = [Math.max(Math.min(...ys, -r), -r), Math.min(Math.max(...ys, h + r), h + r)];
    }
    if (!xs.length) return { schritt: abstand };
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
  if (!Number.isFinite(m[0])) return p;
  return r.ms.inPx([Math.round(m[0] / r.schritt) * r.schritt, Math.round(m[1] / r.schritt) * r.schritt]) || p;
}
function zeichneRaster(ctx, r, W, H, basis) {
  ctx.save();
  const linie = (a, b, stark) => {
    if (!a || !b) return;
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
    if (r.x[1] - r.x[0] > 400 || r.y[1] - r.y[0] > 400) { ctx.restore(); return; }
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

function zeichneAlles(ctx, img, d, { basis, entwurf = null, griffe = false, auswahl = null, vorschau = null, raster = null, aktiv = null, kanten = [], schieber = null }) {
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
  // Perspektiv-Rahmen: gelbes Viereck
  const ra = d.ref.rahmen;
  if (ra?.punkte?.length === 4) {
    const q = ordneEcken(ra.punkte);
    ctx.save();
    ctx.strokeStyle = FARBE.ref;
    ctx.lineWidth = basis * 1.1;
    ctx.setLineDash([basis * 3, basis * 1.6]);
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = basis;
    pfad(q, true);
    ctx.stroke();
    ctx.restore();
    const masse = rahmenFertig(ra) ? `${fmt2(zahl(ra.b))} × ${fmt2(zahl(ra.h))} m` : 'Maße fehlen';
    etikett(ctx, `Rahmen ${masse}`, [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2 - schrift * 1.2], schrift * 0.9, FARBE.ref);
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
  // Entwurf (vorgeschlagene Form, wird über die Ecken angepasst)
  if (entwurf) {
    const p = vorschau ? [...entwurf.punkte, vorschau] : entwurf.punkte;
    const farbe = entwurf.typ === 'linie' ? FARBE.linie : entwurf.typ === 'flaeche' ? FARBE.flaeche : entwurf.typ === 'oeffnung' ? FARBE.abzug : FARBE.ref;
    const zu = ['rahmen', 'flaeche', 'oeffnung'].includes(entwurf.typ);
    ctx.save();
    pfad(p, zu);
    if (zu) { ctx.fillStyle = hexA(farbe, 0.16); ctx.fill(); }
    ctx.strokeStyle = farbe;
    ctx.lineWidth = basis * 1.1;
    ctx.setLineDash([basis * 2.5, basis * 1.5]);
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = basis;
    if (p.length > 1) ctx.stroke();
    ctx.restore();
  }
  if (griffe) {
    const punkt = ([x, y], farbe, r = 2.4) => {
      ctx.save();
      ctx.fillStyle = farbe;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = basis * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, basis * r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    // Blauer Schiebepunkt: verschiebt das ausgewählte Teil als Ganzes, Ecken bleiben, wie sie sind
    if (schieber) {
      const [x, y] = schieber;
      const r = basis * 3.4;
      const pfeil = basis * 2.3;
      const spitze = basis * 0.8;
      ctx.save();
      ctx.fillStyle = '#1e88e5';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = basis * 0.5;
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = basis;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = basis * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - pfeil, y); ctx.lineTo(x + pfeil, y);
      ctx.moveTo(x, y - pfeil); ctx.lineTo(x, y + pfeil);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const sx = x + dx * pfeil;
        const sy = y + dy * pfeil;
        ctx.moveTo(sx - dx * spitze - dy * spitze, sy - dy * spitze - dx * spitze);
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx - dx * spitze + dy * spitze, sy - dy * spitze + dx * spitze);
      }
      ctx.stroke();
      ctx.restore();
    }
    // Kleine Punkte auf den Kantenmitten: ziehen fügt eine Ecke ein
    for (const k of kanten) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = basis * 0.4;
      ctx.beginPath();
      ctx.arc(k[0], k[1], basis * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = basis * 0.35;
      ctx.beginPath();
      ctx.moveTo(k[0] - basis * 0.8, k[1]); ctx.lineTo(k[0] + basis * 0.8, k[1]);
      ctx.moveTo(k[0], k[1] - basis * 0.8); ctx.lineTo(k[0], k[1] + basis * 0.8);
      ctx.stroke();
      ctx.restore();
    }
    for (const key of ['laenge', 'hoehe']) if (d.ref[key]) { punkt(d.ref[key].a, FARBE.ref); punkt(d.ref[key].b, FARBE.ref); }
    (d.ref.rahmen?.punkte || []).forEach((q) => punkt(q, FARBE.ref));
    for (const t of d.teile) t.punkte.forEach((q) => punkt(q, '#fff', t === auswahl ? 2.8 : 1.6));
    if (entwurf) entwurf.punkte.forEach((q) => punkt(q, entwurf.typ === 'rahmen' ? FARBE.ref : '#fff', 2.8));
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
  const ref = rahmenFertig(d.ref.rahmen) ? `Rahmen ${fmt2(zahl(d.ref.rahmen.b))} × ${fmt2(zahl(d.ref.rahmen.h))} m (entzerrt)` : ['laenge', 'hoehe'].filter((k) => d.ref[k] && zahl(d.ref[k].m)).map((k) => `${k === 'laenge' ? 'Länge' : 'Höhe'} ${fmt2(zahl(d.ref[k].m))} m`).join(', ');
  const text = `${d.titel} · Referenz ${ref} · ${regelVon(d).label} · Maße aus Foto ermittelt, nur ungefähr`;
  ctx.fillText(text, basis * 3, H + fuss / 2, W - basis * 6);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.86));
}

// ---------- Oberfläche ----------

const WERKZEUGE = [
  { id: 'rahmen', label: 'Rahmen', svg: '<path d="M5 5l14 2-1 12-12-1z" fill="none" stroke="#fdd835" stroke-width="2" stroke-dasharray="3 2" stroke-linejoin="round"/><circle cx="5" cy="5" r="1.6" fill="#fdd835"/><circle cx="19" cy="7" r="1.6" fill="#fdd835"/><circle cx="18" cy="19" r="1.6" fill="#fdd835"/><circle cx="6" cy="18" r="1.6" fill="#fdd835"/>' },
  { id: 'laenge', label: 'Länge', svg: '<path d="M3 12h18M3 8v8M21 8v8" fill="none" stroke="#fdd835" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'hoehe', label: 'Höhe', svg: '<path d="M12 3v18M8 3h8M8 21h8" fill="none" stroke="#fdd835" stroke-width="2" stroke-linecap="round"/>' },
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
  const REF_WZ = ['rahmen', 'laenge', 'hoehe'];
  const ZU = ['rahmen', 'flaeche', 'oeffnung']; // geschlossene Formen
  const mindest = (typ) => (typ === 'rahmen' ? 4 : ZU.includes(typ) ? 3 : 2);
  let entwurf = null; // neue Form, die gerade abgesteckt wird: { typ, punkte }
  let ziehen = null; // aktuelle Fingerbewegung
  let auswahl = null; // ausgewähltes Teil (Ecken und Kantenpunkte sichtbar)
  let geaendert = false;
  let zoom = { z: 1, x: 0, y: 0 };
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
    </div>
    <div class="fa-zoomknoepfe"><button type="button" data-zoom="-" aria-label="Verkleinern">−</button><button type="button" data-zoom="+" aria-label="Vergrößern">+</button><button type="button" data-zoom="0" aria-label="Ganzes Foto">⤢</button></div>
    </div>
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
  const proPx = () => W / canvas.getBoundingClientRect().width; // Bildpunkte je Bildschirmpunkt
  const raster = () => (rasterModus === 'aus' ? null : rasterVon(d, W, H, 26 * proPx()));
  const fangen = (p) => (rasterModus === 'fang' ? rasterFang(raster(), p) : p);
  const punkteVon = (a) => {
    if (a.art === 'ref') return a.key === 'rahmen' ? d.ref.rahmen?.punkte : null;
    if (a.art === 'teil') return d.teile.includes(a.t) ? a.t.punkte : null;
    return entwurf?.punkte || null;
  };
  const lage = (a) => {
    if (!a) return null;
    if (a.art === 'ref' && a.key !== 'rahmen') return d.ref[a.key]?.[a.ende] || null;
    return punkteVon(a)?.[a.i] || null;
  };
  const setze = (a, p) => {
    if (a.art === 'ref' && a.key !== 'rahmen') d.ref[a.key][a.ende] = p;
    else punkteVon(a)[a.i] = p;
    geaendert = true;
  };
  // Kantenpunkte (zum Einfügen einer weiteren Ecke) für die Form in Bearbeitung
  const kantenVon = () => {
    const f = entwurf ? { punkte: entwurf.punkte, typ: entwurf.typ, ziel: { art: 'entwurf' } } : auswahl ? { punkte: auswahl.punkte, typ: auswahl.typ, ziel: { art: 'teil', t: auswahl } } : null;
    if (!f || f.typ === 'rahmen' || f.typ === 'laenge' || f.typ === 'hoehe') return [];
    const n = f.punkte.length;
    const k = [];
    for (let i = 0; i < (ZU.includes(f.typ) ? n : n - 1); i++) {
      const a = f.punkte[i];
      const b = f.punkte[(i + 1) % n];
      k.push({ p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ziel: { ...f.ziel, i } });
    }
    return k;
  };
  // Lage des blauen Schiebepunkts: außerhalb, mittig unter dem ausgewählten Teil (passt er dort
  // nicht mehr aufs Foto, darüber), damit Ecken und Beschriftung frei bleiben
  const schieberVon = () => {
    if (!auswahl || entwurf || !d.teile.includes(auswahl)) return null;
    const p = auswahl.punkte;
    const abstand = 38 * proPx();
    const ys = p.map((q) => q[1]);
    const x = mitte(p)[0];
    const unten = Math.max(...ys) + abstand;
    return [x, unten <= H ? unten : Math.max(0, Math.min(...ys) - abstand)];
  };
  const neuZeichnen = () => {
    if (aktiv && !lage(aktiv)) { aktiv = null; if (!ziehen) fk.hidden = true; }
    if (auswahl && !d.teile.includes(auswahl)) auswahl = null;
    // Beim Hineinzoomen bleiben Linien, Punkte und Schrift gleich groß auf dem Bildschirm
    zeichneAlles(ctx, img, d, { basis: basis / zoom.z, entwurf, griffe: true, auswahl, raster: raster(), aktiv: lage(aktiv), kanten: kantenVon().map((k) => k.p), schieber: schieberVon() });
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
    if (d.ref.rahmen?.punkte?.length === 4) strich(ordneEcken(d.ref.rahmen.punkte), FARBE.ref, true);
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

  const NAMEN = { rahmen: 'Rahmen', laenge: 'Länge', hoehe: 'Höhe', flaeche: 'Fläche', oeffnung: 'Öffnung', linie: 'Strecke' };
  function hinweis() {
    const txt = $('.fa-text');
    const kn = $('.fa-knoepfe');
    const ms = massstab(d);
    let t;
    let k = '';
    const knopf = (cls, label, an = false) => `<button type="button" class="chip ${cls}"${an ? ' aria-pressed="true"' : ''}>${label}</button>`;
    if (entwurf) {
      t = entwurf.typ === 'rahmen'
        ? 'Rahmen: die 4 gelben Ecken auf ein Rechteck ziehen, dessen Breite und Höhe du kennst (Fenster, Tür, Wand).'
        : ZU.includes(entwurf.typ)
          ? `${NAMEN[entwurf.typ]}: Ecken an die richtige Stelle ziehen. ⊕ auf einer Kante ziehen = neue Ecke.`
          : `${NAMEN[entwurf.typ]}: die Endpunkte an die richtige Stelle ziehen.`;
      k = knopf('fa-verwerfen', 'Verwerfen') + knopf('fa-schliessen', 'Fertig', true);
    } else if (auswahl) {
      const eckeWeg = aktiv?.art === 'teil' && aktiv.t === auswahl && auswahl.punkte.length > mindest(auswahl.typ);
      t = `${auswahl.name} (blauer Punkt: verschieben)`;
      k = knopf('fa-t-aendern', 'Name') + (eckeWeg ? knopf('fa-ecke-weg', 'Ecke weg') : knopf('fa-t-kopie', 'Kopie')) + knopf('fa-t-weg', 'Löschen') + knopf('fa-t-fertig', 'Fertig', true);
    } else if (aktiv?.art === 'ref') {
      t = aktiv.key === 'rahmen' ? 'Rahmen: Ecken ziehen, bis sie genau auf dem Rechteck sitzen.' : rahmenFertig(d.ref.rahmen) ? `${NAMEN[aktiv.key]}: wird nicht gebraucht, der Rahmen gibt den Maßstab vor.` : `${NAMEN[aktiv.key]}: Endpunkte ziehen.`;
      k = knopf('fa-ref-mass', 'Maße ändern') + knopf('fa-t-fertig', 'Fertig', true);
    } else if (!ms) {
      t = 'Zuerst „Rahmen“ tippen: ein Rechteck erscheint, dessen Ecken du auf ein Fenster, eine Tür oder die Wand ziehst.';
    } else if (ms.fehler) {
      t = ms.fehler;
    } else {
      t = 'Fläche, Öffnung oder Strecke tippen: die Form erscheint auf dem Foto und wird über die Ecken angepasst. Ein Teil antippen wählt es aus: Ecken ziehen, am blauen Punkt verschieben, kopieren oder löschen.';
      if (!ms.beide) t += ' Nur eine Referenz gesetzt: Maßstab gilt dann für beide Richtungen.';
    }
    txt.textContent = t;
    kn.innerHTML = k;
    const an = (cls, fn) => { const b = kn.querySelector(`.${cls}`); if (b) b.onclick = fn; };
    an('fa-verwerfen', () => { entwurf = null; aktiv = null; fk.hidden = true; neuZeichnen(); });
    an('fa-schliessen', () => abschliessen());
    an('fa-t-aendern', () => teilFragen(auswahl, false));
    an('fa-ecke-weg', () => { auswahl.punkte.splice(aktiv.i, 1); aktiv = null; fk.hidden = true; geaendert = true; neuZeichnen(); });
    an('fa-t-kopie', () => kopieren(auswahl));
    an('fa-t-weg', () => {
      if (!confirm(`„${auswahl.name}“ löschen?`)) return;
      d.teile.splice(d.teile.indexOf(auswahl), 1);
      auswahl = null; aktiv = null; fk.hidden = true; geaendert = true; neuZeichnen();
    });
    an('fa-t-fertig', () => { auswahl = null; aktiv = null; fk.hidden = true; neuZeichnen(); });
    an('fa-ref-mass', () => (aktiv.key === 'rahmen' ? fragRahmen(false) : fragMass(aktiv.key, false)));
    view.querySelectorAll('.mk-wz').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.wz === (entwurf?.typ || ''));
      b.classList.toggle('fa-unnoetig', (b.dataset.wz === 'laenge' || b.dataset.wz === 'hoehe') && rahmenFertig(d.ref.rahmen));
    });
    $('.fa-regel').textContent = `${regelVon(d).label.replace(/ \(.*/, '')}: ${regelVon(d).schwelle ? `bis ${fmt(regelVon(d).schwelle)} m² übermessen` : 'alles abziehen'}`;
    $('.fa-rueck').disabled = !entwurf && !d.teile.length && !d.ref.laenge && !d.ref.hoehe && !d.ref.rahmen;
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
      return true;
    }, () => { if (neu) { entwurf = { typ: key, punkte: [d.ref[key].a, d.ref[key].b] }; delete d.ref[key]; } });
  };

  const fragRahmen = (neu) => {
    const r = d.ref.rahmen;
    frage(`<p class="fa-klein">Maße des Rechtecks, dessen Ecken du abgesteckt hast (z. B. Fenster außen, Tür, ganze Wand):</p>
      <div class="fa-zeile fa-zwei"><label class="fa-feld"><span>Breite in m</span><input type="text" inputmode="decimal" class="fa-rb" value="${escH(r.b)}" placeholder="z. B. 1,01"></label>
      <label class="fa-feld"><span>Höhe in m</span><input type="text" inputmode="decimal" class="fa-rh" value="${escH(r.h)}" placeholder="z. B. 1,385"></label></div>`, (p) => {
      const b = p.querySelector('.fa-rb').value.trim();
      const h = p.querySelector('.fa-rh').value.trim();
      if (!(zahl(b) > 0)) { p.querySelector('.fa-rb').focus(); return false; }
      if (!(zahl(h) > 0)) { p.querySelector('.fa-rh').focus(); return false; }
      r.b = b;
      r.h = h;
      geaendert = true;
      return true;
    }, () => { if (neu) { entwurf = { typ: 'rahmen', punkte: r.punkte }; delete d.ref.rahmen; } });
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
    }, () => { if (neu) { d.teile.splice(d.teile.indexOf(t), 1); entwurf = { typ: t.typ, punkte: t.punkte }; } });
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
    if (!entwurf || entwurf.punkte.length < mindest(entwurf.typ)) return;
    const { typ, punkte } = entwurf;
    entwurf = null;
    aktiv = null;
    fk.hidden = true;
    geaendert = true;
    if (typ === 'rahmen') {
      const alt = d.ref.rahmen;
      d.ref.rahmen = { punkte, b: alt?.b || '', h: alt?.h || '' };
      neuZeichnen();
      fragRahmen(!alt);
      return;
    }
    if (typ === 'laenge' || typ === 'hoehe') {
      const alt = d.ref[typ];
      d.ref[typ] = { a: punkte[0], b: punkte[1], m: alt?.m || '' };
      neuZeichnen();
      fragMass(typ, !alt);
      return;
    }
    const t = { id: neueId(), typ, name: naechsterName(typ), punkte };
    d.teile.push(t);
    auswahl = null;
    neuZeichnen();
    teilFragen(t, true);
  };

  einpassen();
  window.addEventListener('resize', einpassen);

  // ---------- Zoomen und Verschieben ----------
  // Ein Finger auf dem Foto verschiebt es, zwei Finger zoomen, die Knöpfe +, − und ⤢ ebenso.
  const lageBox = () => {
    const fr = flaeche.getBoundingClientRect();
    return { fr, lx: fr.left + canvas.offsetLeft, ly: fr.top + canvas.offsetTop, cw: canvas.offsetWidth, ch: canvas.offsetHeight };
  };
  const zoomSetzen = () => {
    if (zoom.z <= 1.01) zoom = { z: 1, x: 0, y: 0 };
    else {
      // Foto nicht ganz aus dem Bild schieben: mindestens 60 Punkte bleiben sichtbar
      const { fr, lx, ly, cw, ch } = lageBox();
      const rand = 60;
      zoom.x = Math.min(fr.right - rand - lx, Math.max(fr.left + rand - lx - cw * zoom.z, zoom.x));
      zoom.y = Math.min(fr.bottom - rand - ly, Math.max(fr.top + rand - ly - ch * zoom.z, zoom.y));
    }
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = zoom.z === 1 ? '' : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`;
    neuZeichnen();
    if (aktiv) fensterAuf();
  };
  // Zoomen um einen Bildschirmpunkt (der Punkt bleibt, wo er ist)
  const zoomUm = (z, [mx, my], von = zoom, [ax, ay] = [mx, my]) => {
    const { lx, ly } = lageBox();
    const lokal = [(ax - lx - von.x) / von.z, (ay - ly - von.y) / von.z];
    const neu = Math.min(12, Math.max(1, z));
    zoom = { z: neu, x: mx - lx - neu * lokal[0], y: my - ly - neu * lokal[1] };
    zoomSetzen();
  };
  const mitteFlaeche = () => {
    const fr = flaeche.getBoundingClientRect();
    return [fr.left + fr.width / 2, fr.top + fr.height / 2];
  };
  view.querySelectorAll('[data-zoom]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.zoom === '0') { zoom = { z: 1, x: 0, y: 0 }; zoomSetzen(); return; }
      zoomUm(zoom.z * (b.dataset.zoom === '+' ? 1.6 : 1 / 1.6), mitteFlaeche());
    };
  });
  flaeche.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomUm(zoom.z * Math.exp(-e.deltaY / 300), [e.clientX, e.clientY]);
  }, { passive: false });

  // Sichtbarer Bildausschnitt in Bildpunkten, für neue Formen
  const sichtbar = () => {
    const r = canvas.getBoundingClientRect();
    const fr = flaeche.getBoundingClientRect();
    const f = proPx();
    const x0 = Math.max(0, (fr.left - r.left) * f);
    const x1 = Math.min(W, (fr.right - r.left) * f);
    const y0 = Math.max(0, (fr.top - r.top) * f);
    const y1 = Math.min(H, (fr.bottom - r.top) * f);
    return { c: [(x0 + x1) / 2, (y0 + y1) / 2], w: x1 - x0, h: y1 - y0 };
  };
  // Neue Form als Vorschlag mitten im sichtbaren Ausschnitt abstecken
  const abstecken = (typ) => {
    const { c, w, h } = sichtbar();
    const bx = w * 0.3;
    const by = h * 0.3;
    let punkte;
    if (typ === 'laenge') punkte = [[c[0] - bx, c[1]], [c[0] + bx, c[1]]];
    else if (typ === 'hoehe') punkte = [[c[0], c[1] - by], [c[0], c[1] + by]];
    else if (typ === 'linie') punkte = [[c[0] - bx, c[1] + by * 0.5], [c[0] + bx, c[1] + by * 0.5]];
    else {
      const sx = typ === 'oeffnung' ? bx * 0.5 : bx;
      const sy = typ === 'oeffnung' ? by * 0.7 : by;
      punkte = [[c[0] - sx, c[1] - sy], [c[0] + sx, c[1] - sy], [c[0] + sx, c[1] + sy], [c[0] - sx, c[1] + sy]];
    }
    entwurf = { typ, punkte };
    auswahl = null;
    aktiv = null;
    fk.hidden = true;
    neuZeichnen();
  };

  // ---------- Finger auf dem Foto ----------
  const punkt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const fangRadius = () => 26 * proPx();
  const treffer = (p) => {
    let best = null;
    let bestD = fangRadius();
    const pruefe = (q, ziel) => {
      const dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (dd < bestD) { bestD = dd; best = ziel; }
    };
    // Reihenfolge: zuletzt geprüft gewinnt bei gleichem Abstand nicht, also Wichtigstes zuerst
    const sp = schieberVon();
    if (sp) pruefe(sp, { art: 'schieber', t: auswahl });
    if (entwurf) entwurf.punkte.forEach((q, i) => pruefe(q, { art: 'entwurf', i }));
    if (auswahl) auswahl.punkte.forEach((q, i) => pruefe(q, { art: 'teil', t: auswahl, i }));
    (d.ref.rahmen?.punkte || []).forEach((q, i) => pruefe(q, { art: 'ref', key: 'rahmen', i }));
    for (const key of ['laenge', 'hoehe']) {
      if (d.ref[key]) { pruefe(d.ref[key].a, { art: 'ref', key, ende: 'a' }); pruefe(d.ref[key].b, { art: 'ref', key, ende: 'b' }); }
    }
    if (!entwurf) for (const t of d.teile) if (t !== auswahl) t.punkte.forEach((q, i) => pruefe(q, { art: 'teil', t, i }));
    // Kantenpunkte nur, wenn keine Ecke näher liegt
    if (!best) kantenVon().forEach((k) => pruefe(k.p, { art: 'kante', ziel: k.ziel }));
    return best;
  };

  // Punkte so verschieben, dass ein Teil auf der Wand gleich groß bleibt: mit Maßstab in Metern
  // (bei schrägem Foto wird das Teil dabei passend verzerrt), sonst einfach in Bildpunkten
  const verschoben = (punkte, von, nach) => {
    const ms = massstab(d);
    if (!ms || ms.fehler) return punkte.map(([x, y]) => [x + nach[0] - von[0], y + nach[1] - von[1]]);
    const a = ms.inM(von);
    const b = ms.inM(nach);
    return punkte.map((q) => {
      const m = ms.inM(q);
      return ms.inPx([m[0] + b[0] - a[0], m[1] + b[1] - a[1]]);
    });
  };
  // Name der Kopie: „Fenster 1“ → nächste freie Nummer („Fenster 2“)
  const kopieName = (name) => {
    const stamm = name.replace(/\s*\d+$/, '') || name;
    let n = 1;
    while (d.teile.some((t) => t.name === `${stamm} ${n}`)) n++;
    return `${stamm} ${n}`;
  };
  // Kopie gleich groß daneben setzen (rechts, sonst links, sonst darunter), dann ausgewählt lassen
  const kopieren = (t) => {
    const ms = massstab(d);
    const b = ms && !ms.fehler ? ms.inPx : null;
    const m = b ? t.punkte.map(ms.inM) : t.punkte;
    const xs = m.map((q) => q[0]);
    const ys = m.map((q) => q[1]);
    const breite = Math.max(...xs) - Math.min(...xs);
    const hoehe = Math.max(...ys) - Math.min(...ys);
    const luft = b ? 0.25 : breite * 0.2;
    const imBild = (pts) => pts.every(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H);
    const versuche = [[breite + luft, 0], [-(breite + luft), 0], [0, b ? -(hoehe + luft) : hoehe + luft]];
    const zuPx = (dx, dy) => m.map(([x, y]) => (b ? b([x + dx, y + dy]) : [x + dx, y + dy]));
    const punkte = versuche.map(([dx, dy]) => zuPx(dx, dy)).find(imBild) || zuPx(...versuche[0]);
    const neu = { ...JSON.parse(JSON.stringify(t)), id: neueId(), name: kopieName(t.name), punkte };
    d.teile.push(neu);
    auswahl = neu;
    aktiv = null;
    fk.hidden = true;
    geaendert = true;
    neuZeichnen();
  };

  // Teil unter dem Finger: Strecken (nah an einer Linie) vor Öffnungen vor Flächen
  const abstandStrecke = (p, a, b) => {
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const l2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
    return Math.hypot(p[0] - a[0] - k * vx, p[1] - a[1] - k * vy);
  };
  const teilUnter = (p) => {
    const r = fangRadius();
    const neu = [...d.teile].reverse();
    return neu.find((t) => t.typ === 'linie' && t.punkte.slice(1).some((q, i) => abstandStrecke(p, t.punkte[i], q) < r))
      || neu.find((t) => t.typ === 'oeffnung' && innen(p, t.punkte))
      || neu.find((t) => t.typ === 'flaeche' && innen(p, t.punkte))
      || null;
  };

  const finger = new Map();
  let pinch = null;
  const fingerMitte = () => {
    const [a, b] = [...finger.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, m: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
  };
  const abbrechen = () => {
    if (ziehen?.art === 'griff' && ziehen.bewegt) setze(ziehen.ziel, ziehen.startP);
    ziehen = null;
    neuZeichnen();
    if (aktiv) fensterAuf(); else fk.hidden = true;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!panel.hidden) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (finger.size >= 2) {
      abbrechen();
      if (finger.size === 2) pinch = { ...fingerMitte(), von: { ...zoom } };
      return;
    }
    const p = punkt(e);
    let t = treffer(p);
    if (t?.art === 'kante') {
      // Neue Ecke in der Kantenmitte einfügen und gleich ziehen
      const ziel = t.ziel;
      const pts = punkteVon(ziel);
      const a = pts[ziel.i];
      const b = pts[(ziel.i + 1) % pts.length];
      pts.splice(ziel.i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      t = { ...ziel, i: ziel.i + 1 };
      geaendert = true;
    }
    if (t?.art === 'schieber') {
      aktiv = null;
      fk.hidden = true;
      ziehen = { art: 'teilzug', t: t.t, x0: e.clientX, y0: e.clientY, p0: p, start: t.t.punkte.map((q) => [...q]), bewegt: false };
      neuZeichnen();
    } else if (t) {
      if (t.art === 'teil') auswahl = t.t;
      aktiv = t;
      ziehen = { art: 'griff', ziel: t, x0: e.clientX, y0: e.clientY, startP: [...lage(t)], bewegt: false };
      neuZeichnen();
      zeigeFenster(lage(t));
    } else {
      ziehen = { art: 'schieben', x0: e.clientX, y0: e.clientY, von: { ...zoom }, bewegt: false, p };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (finger.has(e.pointerId)) finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (finger.size >= 2) {
        const { d: dd, m } = fingerMitte();
        zoomUm((pinch.von.z * dd) / pinch.d, m, pinch.von, pinch.m);
      }
      return;
    }
    if (!ziehen) return;
    const dx = e.clientX - ziehen.x0;
    const dy = e.clientY - ziehen.y0;
    if (Math.hypot(dx, dy) > 4) ziehen.bewegt = true;
    if (!ziehen.bewegt) return;
    if (ziehen.art === 'teilzug') {
      const f = proPx();
      ziehen.t.punkte = verschoben(ziehen.start, ziehen.p0, [ziehen.p0[0] + dx * f, ziehen.p0[1] + dy * f]);
      geaendert = true;
      neuZeichnen();
    } else if (ziehen.art === 'griff') {
      // Punkt wandert um dieselbe Strecke wie der Finger, liegt also nie unter dem Finger
      const f = proPx();
      const p = fangen([
        Math.min(W, Math.max(0, ziehen.startP[0] + dx * f)),
        Math.min(H, Math.max(0, ziehen.startP[1] + dy * f)),
      ]);
      setze(ziehen.ziel, p);
      neuZeichnen();
      zeigeFenster(p);
    } else if (zoom.z > 1) {
      zoom = { ...zoom, x: ziehen.von.x + dx, y: ziehen.von.y + dy };
      canvas.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`;
    }
  });
  const hoch = (e) => {
    finger.delete(e.pointerId);
    if (pinch) { if (finger.size < 2) pinch = null; ziehen = null; return; }
    const z = ziehen;
    ziehen = null;
    if (!z) return;
    if (z.art === 'teilzug') { neuZeichnen(); return; }
    if (z.art === 'schieben') {
      if (z.bewegt) { zoomSetzen(); return; }
      // Antippen ohne Bewegung: Teil unter dem Finger auswählen, sonst Auswahl aufheben
      if (!entwurf) {
        auswahl = teilUnter(z.p);
        aktiv = null;
        fk.hidden = true;
      }
      neuZeichnen();
      return;
    }
    neuZeichnen();
    fensterAuf();
  };
  canvas.addEventListener('pointerup', hoch);
  canvas.addEventListener('pointercancel', hoch);

  view.querySelectorAll('.mk-wz').forEach((b) => {
    b.onclick = () => {
      const typ = b.dataset.wz;
      if ((typ === 'laenge' || typ === 'hoehe') && rahmenFertig(d.ref.rahmen) && !d.ref[typ]) {
        alert('Mit fertigem Rahmen braucht es keine Länge oder Höhe: der Rahmen gibt den Maßstab vor.');
        return;
      }
      // Vorhandene Referenz nicht doppelt anlegen, sondern zum Anpassen auswählen
      if (REF_WZ.includes(typ) && d.ref[typ] && !entwurf) {
        auswahl = null;
        aktiv = typ === 'rahmen' ? { art: 'ref', key: 'rahmen', i: 0 } : { art: 'ref', key: typ, ende: 'a' };
        neuZeichnen();
        fensterAuf();
        return;
      }
      abstecken(typ);
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
    if (entwurf) entwurf = null;
    else if (d.teile.length) d.teile.pop();
    else if (d.ref.rahmen) delete d.ref.rahmen;
    else if (d.ref.hoehe) delete d.ref.hoehe;
    else delete d.ref.laenge;
    geaendert = true;
    neuZeichnen();
  };
  neuZeichnen();
  // Ohne Referenz gleich mit dem Rahmen anfangen
  if (!d.ref.rahmen && !d.ref.laenge && !d.ref.hoehe) abstecken('rahmen');

  // Liste aller Teile mit Werten, Abzugsregel und Laibungen
  $('.fa-liste').onclick = () => {
    const zeichneListe = () => {
      const { ms, teile } = auswerten(d);
      const werte = new Map(teile.map((x) => [x.t, x]));
      const refZeile = (key) => {
        const r = d.ref[key];
        if (key === 'rahmen') {
          return r ? `<div class="fa-li"><span class="fa-dot" style="--c:${FARBE.ref}"></span><div><b>Perspektiv-Rahmen</b><small>${rahmenFertig(r) ? `${fmt2(zahl(r.b))} × ${fmt2(zahl(r.h))} m · entzerrt das Foto${d.ref.laenge || d.ref.hoehe ? '; Länge/Höhe werden dann nicht verwendet' : ''}` : 'Maße fehlen'}</small></div>
            <button type="button" class="chip" data-ref="rahmen">Maße ändern</button></div>` : '';
        }
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
        ${refZeile('rahmen')}${refZeile('laenge')}${refZeile('hoehe')}
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
      panel.querySelectorAll('[data-ref]').forEach((b) => { b.onclick = () => (b.dataset.ref === 'rahmen' ? fragRahmen(false) : fragMass(b.dataset.ref, false)); });
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

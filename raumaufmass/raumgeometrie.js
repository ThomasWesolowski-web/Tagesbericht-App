// Raumaufmaß: Rechenteil ohne Oberfläche (läuft auch in Node für die Tests).
// Vier Ebenen, die nicht vermischt werden:
//   Skizze      – Rohpunkte der Freihandzeichnung in Zeichen-Einheiten (raum.skizze)
//   Geometrie   – Ecken, Wände, Öffnungen in Metern (raum.ecken, raum.waende, raum.oeffnungen)
//   Berechnung  – Flächen, Umfang usw., immer neu aus der Geometrie (berechne)
//   Darstellung – Zeichen-Elemente für Bildschirm, SVG, PDF (planElemente), nie gespeichert
// Koordinaten: x nach rechts, y nach unten (wie am Bildschirm). Ein geschlossener Raum läuft am
// Bildschirm im Uhrzeigersinn, der Raum liegt also rechts von jeder Wand.
// Freihand und spätere Quellen (Foto-KI, LiDAR) liefern dasselbe Modell: raumAusEcken().

// Messzeile wie newZeile() in report.js (hier nachgebaut, damit report.js dieses Modul laden kann)
const newZeile = () => ({ stueck: '', laenge: '', breite: '', hoehe: '', wert: '', abzug: false });

export const RAUM_VERSION = 1;
export const RASTER = [0.1, 0.2, 0.5, 1];

export const STANDARD = {
  raster: 0.5, // Rasterweite in m (nur Anzeige, ändert die Geometrie nicht)
  rasterFang: false, // Wände beim Erkennen aufs Raster legen
  winkelToleranz: 8, // bis zu so viel Grad neben waagerecht/senkrecht wird ausgerichtet
  winkel45: true, // 45°-Wände ebenfalls ausrichten
  toleranz45: 5,
  eckWinkel: 28, // ab dieser Richtungsänderung ist es eine Ecke
  vereinfachen: 9, // Douglas-Peucker-Toleranz in Bildschirmpunkten
  schliessAbstand: 34, // Anfang und Ende so nah (Bildschirmpunkte) → Raum schließen
  minWand: 14, // kürzere gezeichnete Stücke zählen nicht als Wand (Bildschirmpunkte)
  abzug: 'alle', // 'alle' = Türen und Fenster immer abziehen, 'vob' = bis 2,5 m² übermessen
  masseZeigen: true,
  wandstaerke: 0.115, // Trennwand zwischen zwei Räumen eines Grundrisses in m
};
export const VOB_GRENZE = 2.5;
export const MIN_LAENGE = 0.01; // 1 cm: kürzere Wände sind ungültig

const neueId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const kopie = (x) => JSON.parse(JSON.stringify(x));
const rund = (n, s = 1000) => Math.round(n * s) / s;

export const fmt2 = (n) => (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const fmtPos = (n) => (Math.round(n * 1000) / 1000).toLocaleString('de-DE', { maximumFractionDigits: 3, useGrouping: false });

// Wandname aus der Nummer: A … Z, dann AA, AB …
export function wandName(i) {
  let s = '';
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

// Längeneingabe: „5,42“, „5.42 m“, „542 cm“, „5420 mm“ → Meter (oder null)
export function laengeLesen(text) {
  const m = /^\s*([0-9]+(?:[.,][0-9]*)?)\s*(m|cm|mm)?\s*$/i.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const e = (m[2] || 'm').toLowerCase();
  return e === 'cm' ? n / 100 : e === 'mm' ? n / 1000 : n;
}

// ---------- Vektoren ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const kreuz = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = (a) => Math.hypot(a[0], a[1]);
const abst = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const einheit = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l] : [1, 0]; };
const ausWinkel = (grad) => [Math.cos((grad * Math.PI) / 180), Math.sin((grad * Math.PI) / 180)];
// Richtung einer Wand in Grad: 0 = nach rechts, 90 = nach unten (Bildschirm), Bereich [0, 360)
export const winkelVon = (v) => ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360;

// Schnittpunkt zweier Geraden (Punkt + Richtung), null bei parallelen Geraden
export function schnitt(p, r, q, s) {
  const d = kreuz(r, s);
  if (Math.abs(d) < 1e-9) return null;
  const t = kreuz(sub(q, p), s) / d;
  return add(p, mul(r, t));
}

function abstandZuStrecke(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return { d: abst(p, add(a, mul(ab, t))), t };
}

// Gezeichnete Fläche mit Vorzeichen (y nach unten: positiv = im Uhrzeigersinn am Bildschirm)
export function flaecheMitVorzeichen(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

// Echte Kreuzung zweier Strecken (Berührung an gemeinsamen Ecken zählt nicht)
function kreuzen(a, b, c, d) {
  const o = (p, q, r) => kreuz(sub(q, p), sub(r, p));
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  const e = 1e-9;
  if (((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e))) return true;
  // Überlappung auf einer Linie
  const auf = (p, q, r) => Math.abs(o(p, q, r)) <= e && Math.min(p[0], q[0]) - e <= r[0] && r[0] <= Math.max(p[0], q[0]) + e && Math.min(p[1], q[1]) - e <= r[1] && r[1] <= Math.max(p[1], q[1]) + e;
  return (auf(c, d, a) && auf(c, d, b)) || (auf(a, b, c) && auf(a, b, d));
}

export function selbstUeberschneidungen(p) {
  const n = p.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // Nachbarn teilen eine Ecke
      if (kreuzen(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) out.push([i, j]);
    }
  }
  return out;
}

// ---------- Freihand-Erkennung ----------

// Ramer-Douglas-Peucker: Indizes der Punkte, die die Linie im Rahmen von eps beschreiben
export function douglasPeucker(p, eps) {
  if (p.length < 3) return p.map((_, i) => i);
  const behalten = new Uint8Array(p.length);
  behalten[0] = 1;
  behalten[p.length - 1] = 1;
  const stapel = [[0, p.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop();
    let max = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = abstandZuStrecke(p[i], p[a], p[b]).d;
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) {
      behalten[idx] = 1;
      stapel.push([a, idx], [idx, b]);
    }
  }
  const out = [];
  behalten.forEach((v, i) => { if (v) out.push(i); });
  return out;
}

// Gerade durch Punkte (Hauptachse): { p: Schwerpunkt, r: Einheitsrichtung }
function geradeDurch(pts, richtungVorher) {
  const n = pts.length;
  const m = [pts.reduce((s, q) => s + q[0], 0) / n, pts.reduce((s, q) => s + q[1], 0) / n];
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const q of pts) {
    const dx = q[0] - m[0];
    const dy = q[1] - m[1];
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  const w = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let r = [Math.cos(w), Math.sin(w)];
  if (dot(r, richtungVorher) < 0) r = mul(r, -1);
  return { p: m, r };
}

// Richtung auf waagerecht/senkrecht/45° legen, wenn sie nah genug dran ist
export function richtungAusrichten(r, e = STANDARD) {
  const w = winkelVon(r);
  const ziele = [0, 90, 180, 270, 360];
  for (const z of ziele) {
    if (Math.abs(w - z) <= e.winkelToleranz) return { r: ausWinkel(z % 360), art: z % 180 === 0 ? 'waagerecht' : 'senkrecht' };
  }
  if (e.winkel45) {
    for (const z of [45, 135, 225, 315]) if (Math.abs(w - z) <= e.toleranz45) return { r: ausWinkel(z), art: '45' };
  }
  return { r: einheit(r), art: 'schraeg' };
}

// Rückmeldung während des Zeichnens für die Richtung eines Stücks
export function richtungsText(r, e = STANDARD) {
  const a = richtungAusrichten(r, e);
  if (a.art === 'waagerecht') return 'Waagerecht';
  if (a.art === 'senkrecht') return 'Senkrecht';
  if (a.art === '45') return '45°';
  const w = winkelVon(r) % 180;
  return `Schräg ${Math.round(w > 90 ? 180 - w : w)}°`;
}

// Freihandpunkte → saubere Wände.
// punkte: [[x, y], …] in Zeichen-Einheiten, pxProEinheit: Bildschirmpunkte je Einheit (Zoom),
// schliessen: true = Kontur schließen, false = offen lassen, undefined = selbst erkennen.
// Ergebnis: { ecken, arten, geschlossen, schliessbar } oder null.
export function erkenneKontur(punkte, { pxProEinheit = 100, einstellungen = {}, schliessen } = {}) {
  const e = { ...STANDARD, ...einstellungen };
  const px = (v) => v / pxProEinheit;
  const pts = [];
  for (const q of punkte) if (!pts.length || abst(q, pts[pts.length - 1]) > 1e-9) pts.push([q[0], q[1]]);
  if (pts.length < 2) return null;
  let gesamt = 0;
  for (let i = 1; i < pts.length; i++) gesamt += abst(pts[i], pts[i - 1]);
  if (gesamt < px(e.minWand)) return null;

  // 1. Punktreduktion
  const idx = douglasPeucker(pts, px(e.vereinfachen));
  // 2. Stücke zwischen den verbliebenen Punkten, zu kurze an das vorige Stück hängen
  let stuecke = [];
  for (let k = 0; k < idx.length - 1; k++) {
    const a = idx[k];
    const b = idx[k + 1];
    const s = { a, b, r: einheit(sub(pts[b], pts[a])), l: abst(pts[a], pts[b]) };
    if (stuecke.length && s.l < px(e.minWand)) {
      const v = stuecke[stuecke.length - 1];
      v.b = b;
    } else stuecke.push(s);
  }
  if (stuecke.length > 1 && stuecke[0].l < px(e.minWand)) { stuecke[1].a = stuecke[0].a; stuecke.shift(); }
  // 3. Ecken: nur dort, wo die Richtung deutlich wechselt
  const gruppen = [];
  for (const s of stuecke) {
    const g = gruppen[gruppen.length - 1];
    if (g) {
      const rg = einheit(sub(pts[g.b], pts[g.a]));
      const wechsel = (Math.acos(Math.max(-1, Math.min(1, dot(rg, s.r)))) * 180) / Math.PI;
      if (wechsel < e.eckWinkel) { g.b = s.b; continue; }
    }
    gruppen.push({ a: s.a, b: s.b });
  }
  // 4. Geschlossen?
  const nahZu = abst(pts[0], pts[pts.length - 1]) <= px(e.schliessAbstand);
  const schliessbar = gruppen.length >= 3 || (gruppen.length >= 2 && nahZu);
  let zu = schliessen === undefined ? nahZu && gruppen.length >= 3 : Boolean(schliessen) && schliessbar;
  if (zu && gruppen.length >= 2) {
    // Letztes und erstes Stück gehören zur selben Wand, wenn der Anfang mitten in einer Wand lag
    const r1 = einheit(sub(pts[gruppen[0].b], pts[gruppen[0].a]));
    const rn = einheit(sub(pts[gruppen[gruppen.length - 1].b], pts[gruppen[gruppen.length - 1].a]));
    const wechsel = (Math.acos(Math.max(-1, Math.min(1, dot(r1, rn)))) * 180) / Math.PI;
    if (wechsel < e.eckWinkel && gruppen.length > 3) {
      const letzte = gruppen.pop();
      gruppen[0].vorne = letzte; // Punkte vom Ende gehören vorne dazu
    }
  }
  // 5. Gerade je Wand (Enden etwas kürzen, damit runde Ecken die Richtung nicht verfälschen)
  let linien = gruppen.map((g) => {
    const teil = (a, b) => pts.slice(a, b + 1);
    let roh = teil(g.a, g.b);
    if (g.vorne) roh = [...teil(g.vorne.a, g.vorne.b), ...roh];
    const lg = abst(roh[0], roh[roh.length - 1]);
    const rand = Math.min(lg * 0.15, px(e.vereinfachen) * 2);
    let kern = roh.filter((q) => abst(q, roh[0]) >= rand && abst(q, roh[roh.length - 1]) >= rand);
    if (kern.length < 2) kern = roh;
    const fit = geradeDurch(kern, sub(roh[roh.length - 1], roh[0]));
    const aus = richtungAusrichten(fit.r, e);
    return { p: fit.p, r: aus.r, art: aus.art, anfang: roh[0], ende: roh[roh.length - 1] };
  });
  // 5b. Abgerundete Ecken: ein kurzes schräges Stück zwischen zwei deutlich verschiedenen
  // Richtungen ist keine Wand, sondern eine schnell gezeichnete Ecke
  const kurz = px(e.minWand * 2.2);
  for (let i = 0; i < linien.length && linien.length > 2; i++) {
    const l = linien[i];
    const ohne = !zu && (i === 0 || i === linien.length - 1);
    if (ohne || (l.art !== 'schraeg' && l.art !== '45') || abst(l.anfang, l.ende) >= kurz) continue;
    const v = linien[(i - 1 + linien.length) % linien.length];
    const w = linien[(i + 1) % linien.length];
    if (Math.abs(kreuz(v.r, w.r)) < 0.5) continue; // Nachbarn fast parallel: echte Querwand
    v.ende = l.ende;
    linien.splice(i, 1);
    i--;
  }
  // 6. Parallele Nachbarn: fast auf einer Linie → eine Wand, sonst Versatz → kurze Querwand
  const zusammen = [];
  for (const l of linien) {
    const v = zusammen[zusammen.length - 1];
    if (v && Math.abs(kreuz(v.r, l.r)) < 0.02 && dot(v.r, l.r) > 0) {
      const n = [-v.r[1], v.r[0]];
      const versatz = dot(sub(l.p, v.p), n);
      if (Math.abs(versatz) < px(e.minWand)) {
        v.p = mul(add(v.p, l.p), 0.5);
        v.ende = l.ende;
        continue;
      }
      const m = mul(add(v.ende, l.anfang), 0.5);
      const quer = richtungAusrichten(mul(n, Math.sign(versatz)), e);
      zusammen.push({ p: m, r: quer.r, art: quer.art, anfang: v.ende, ende: l.anfang });
    }
    zusammen.push({ ...l });
  }
  linien = zusammen;
  if (zu && linien.length >= 2) {
    const a = linien[linien.length - 1];
    const b = linien[0];
    if (Math.abs(kreuz(a.r, b.r)) < 0.02 && dot(a.r, b.r) > 0) {
      const n = [-a.r[1], a.r[0]];
      if (Math.abs(dot(sub(b.p, a.p), n)) < px(e.minWand)) {
        b.p = mul(add(a.p, b.p), 0.5);
        linien.pop();
      } else {
        linien.push({ p: mul(add(a.ende, b.anfang), 0.5), r: richtungAusrichten(mul(n, Math.sign(dot(sub(b.p, a.p), n))), e).r, art: 'senkrecht', anfang: a.ende, ende: b.anfang });
      }
    }
  }
  if (zu && linien.length < 3) zu = false;
  // 7. Raster-Fang (nur waagerechte/senkrechte Wände, die Richtung bleibt)
  if (e.rasterFang && e.raster > 0) {
    for (const l of linien) {
      if (l.art === 'waagerecht') l.p = [l.p[0], Math.round(l.p[1] / e.raster) * e.raster];
      if (l.art === 'senkrecht') l.p = [Math.round(l.p[0] / e.raster) * e.raster, l.p[1]];
    }
  }
  // 8. Ecken = Schnittpunkte benachbarter Wände
  const n = linien.length;
  const ecke = (i, j) => schnitt(linien[i].p, linien[i].r, linien[j].p, linien[j].r) || mul(add(linien[i].ende, linien[j].anfang), 0.5);
  const proj = (l, q) => add(l.p, mul(l.r, dot(sub(q, l.p), l.r)));
  let ecken;
  if (zu) ecken = linien.map((_, i) => ecke((i - 1 + n) % n, i));
  else {
    ecken = [proj(linien[0], linien[0].anfang)];
    for (let i = 0; i < n - 1; i++) ecken.push(ecke(i, i + 1));
    ecken.push(proj(linien[n - 1], linien[n - 1].ende));
  }
  let arten = linien.map((l) => l.art);
  // 9. Aufräumen: doppelte Punkte, Null-Wände und gerade durchlaufende Ecken entfernen
  ({ ecken, arten } = aufraeumen(ecken, arten, zu, px(1)));
  if (zu && ecken.length < 3) return null;
  if (!zu && ecken.length < 2) return null;
  if (zu && flaecheMitVorzeichen(ecken) < 0) {
    // immer im Uhrzeigersinn speichern
    ecken = [ecken[0], ...ecken.slice(1).reverse()];
    arten = [...arten].reverse();
  }
  return { ecken: ecken.map((q) => [rund(q[0], 1e6), rund(q[1], 1e6)]), arten, geschlossen: zu, schliessbar: !zu && schliessbar };
}

function aufraeumen(ecken, arten, zu, tol) {
  let e = ecken.map((q) => [...q]);
  let a = [...arten];
  let geaendert = true;
  while (geaendert && e.length > (zu ? 3 : 2)) {
    geaendert = false;
    const n = e.length;
    const wn = zu ? n : n - 1;
    for (let i = 0; i < wn; i++) {
      const j = (i + 1) % n;
      if (abst(e[i], e[j]) < tol) {
        e.splice(j, 1);
        a.splice(i, 1);
        geaendert = true;
        break;
      }
    }
    if (geaendert) continue;
    // Ecke ohne Richtungswechsel (gerade durch) oder Spitze (180° zurück) entfernen
    for (let i = zu ? 0 : 1; i < (zu ? n : n - 1); i++) {
      const p = e[(i - 1 + n) % n];
      const q = e[i];
      const r = e[(i + 1) % n];
      const u = einheit(sub(q, p));
      const v = einheit(sub(r, q));
      if (Math.abs(kreuz(u, v)) < 1e-6) {
        e.splice(i, 1);
        a.splice(i, 1);
        geaendert = true;
        break;
      }
    }
  }
  return { ecken: e, arten: a };
}

// ---------- Raum-Modell ----------

export function neuerRaum(nr = 1, einstellungen = {}) {
  return {
    id: neueId(),
    version: RAUM_VERSION,
    quelle: 'freihand',
    name: `Raum ${nr}`,
    hoehe: 2.5,
    einheit: 'm',
    ecken: [],
    waende: [],
    oeffnungen: [],
    dachfenster: [],
    massstabGesetzt: false,
    skizze: { striche: [], faktor: 1 },
    einstellungen: { ...STANDARD, ...einstellungen },
  };
}

// Ecken (Meter, im Uhrzeigersinn) → Raum. Auch für spätere Quellen (Foto-KI, LiDAR).
export function raumAusEcken(raum, punkte, quelle) {
  const r = kopie(raum);
  let p = punkte.map((q) => [q[0], q[1]]);
  if (flaecheMitVorzeichen(p) < 0) p = [p[0], ...p.slice(1).reverse()];
  r.ecken = p.map(([x, y]) => ({ id: neueId(), x, y }));
  r.waende = r.ecken.map((e, i) => ({ id: neueId(), von: e.id, bis: r.ecken[(i + 1) % r.ecken.length].id, mass: null }));
  r.oeffnungen = [];
  r.dachfenster = [];
  if (quelle) r.quelle = quelle;
  return r;
}

export const punkteVon = (raum) => raum.ecken.map((e) => [e.x, e.y]);
export const geschlossen = (raum) => raum.ecken.length >= 3 && raum.waende.length === raum.ecken.length;

export function wandIndex(raum, wandId) {
  return raum.waende.findIndex((w) => w.id === wandId);
}

// Anfang, Ende, Richtung und Länge einer Wand
export function wandGeo(raum, i) {
  const n = raum.ecken.length;
  const a = [raum.ecken[i].x, raum.ecken[i].y];
  const b = [raum.ecken[(i + 1) % n].x, raum.ecken[(i + 1) % n].y];
  const l = abst(a, b);
  const r = einheit(sub(b, a));
  return { a, b, l, r, innen: [-r[1], r[0]] };
}

// Wände des Raums neu aus den Ecken aufbauen; IDs, Maße und Öffnungen bleiben erhalten
function waendeNeu(raum, ids) {
  const n = raum.ecken.length;
  raum.waende = raum.ecken.map((e, i) => {
    const alt = ids?.[i] ? raum.waende.find((w) => w.id === ids[i]) : null;
    const w = { id: ids?.[i] || neueId(), von: e.id, bis: raum.ecken[(i + 1) % n].id, mass: alt?.mass ?? null };
    if (alt?.schraege) w.schraege = alt.schraege;
    return w;
  });
}

// Mittelpunkt einer Öffnung in Metern
function oeffnungMitte(raum, o) {
  const i = wandIndex(raum, o.wand);
  if (i < 0) return null;
  const g = wandGeo(raum, i);
  return add(g.a, mul(g.r, o.abstand + o.breite / 2));
}

// Nach einer Änderung: Öffnungen dort lassen, wo sie im Raum waren (auf ihre Wand projiziert,
// fehlt die Wand, auf die nächste), und in die Wand einpassen.
function oeffnungenNachziehen(vorher, nachher, feld = 'oeffnungen') {
  const mitten = new Map((vorher[feld] || []).map((o) => [o.id, oeffnungMitte(vorher, o)]));
  const weg = [];
  nachher[feld] = (nachher[feld] || []).filter((o) => {
    const m = mitten.get(o.id);
    let i = wandIndex(nachher, o.wand);
    if (i < 0 && m) {
      let best = Infinity;
      nachher.waende.forEach((_, k) => {
        const g = wandGeo(nachher, k);
        const d = abstandZuStrecke(m, g.a, g.b).d;
        if (d < best) { best = d; i = k; }
      });
      if (i >= 0) o.wand = nachher.waende[i].id;
    }
    if (i < 0 || !m) { weg.push(o); return false; }
    const g = wandGeo(nachher, i);
    const t = dot(sub(m, g.a), g.r) - o.breite / 2;
    o.abstand = rund(Math.max(0, Math.min(Math.max(0, g.l - o.breite), t)), 1e6);
    return true;
  });
  return weg;
}

// Maße von Wänden, deren Länge sich geändert hat, gelten nicht mehr
function masseAufraeumen(raum) {
  const geloescht = [];
  raum.waende.forEach((w, i) => {
    if (w.mass == null) return;
    if (Math.abs(wandGeo(raum, i).l - w.mass) > 0.0005) { geloescht.push(w.id); w.mass = null; }
  });
  return geloescht;
}

function abschliessen(vorher, nachher) {
  const oeffnungenWeg = [...oeffnungenNachziehen(vorher, nachher), ...oeffnungenNachziehen(vorher, nachher, 'dachfenster')];
  const masseWeg = masseAufraeumen(nachher);
  return { raum: nachher, masseWeg, oeffnungenWeg };
}

function ungueltig(raum) {
  const p = punkteVon(raum);
  for (let i = 0; i < p.length; i++) if (abst(p[i], p[(i + 1) % p.length]) < MIN_LAENGE) return 'Eine Wand würde zu kurz.';
  if (selbstUeberschneidungen(p).length) return 'Die Wände würden sich überkreuzen.';
  if (flaecheMitVorzeichen(p) <= 0) return 'Der Raum würde sich umstülpen.';
  return null;
}

// Wand parallel verschieben (t in m, positiv = nach außen); Nachbarwände behalten ihre Richtung.
export function verschiebeWand(raum, wandId, t) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  const r = kopie(raum);
  const n = r.ecken.length;
  const g = wandGeo(r, i);
  const aussen = mul(g.innen, -1);
  const p = add(g.a, mul(aussen, t));
  const vor = wandGeo(r, (i - 1 + n) % n);
  const nach = wandGeo(r, (i + 1) % n);
  const a2 = schnitt(vor.a, vor.r, p, g.r) || add(g.a, mul(aussen, t));
  const b2 = schnitt(p, g.r, nach.a, nach.r) || add(g.b, mul(aussen, t));
  [r.ecken[i].x, r.ecken[i].y] = a2;
  [r.ecken[(i + 1) % n].x, r.ecken[(i + 1) % n].y] = b2;
  const f = ungueltig(r);
  if (f) return { fehler: f };
  return abschliessen(raum, r);
}

// Eckpunkt an eine neue Stelle setzen
export function verschiebeEcke(raum, eckeId, [x, y]) {
  const r = kopie(raum);
  const e = r.ecken.find((k) => k.id === eckeId);
  if (!e) return { fehler: 'Ecke nicht gefunden.' };
  e.x = x;
  e.y = y;
  const f = ungueltig(r);
  if (f) return { fehler: f };
  return abschliessen(raum, r);
}

// Neue Richtung einer Wand (Grad, 0 = nach rechts, 90 = nach unten). Die Wand dreht um ihre Mitte,
// die Nachbarwände behalten ihre Richtung.
export function setzeRichtung(raum, wandId, grad) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  const r = kopie(raum);
  const n = r.ecken.length;
  const g = wandGeo(r, i);
  let neu = ausWinkel(grad);
  if (dot(neu, g.r) < 0) neu = mul(neu, -1);
  const m = mul(add(g.a, g.b), 0.5);
  const vor = wandGeo(r, (i - 1 + n) % n);
  const nach = wandGeo(r, (i + 1) % n);
  const a2 = schnitt(vor.a, vor.r, m, neu);
  const b2 = schnitt(m, neu, nach.a, nach.r);
  if (!a2 || !b2) return { fehler: 'In diese Richtung geht es nicht: eine Nachbarwand läuft genauso.' };
  [r.ecken[i].x, r.ecken[i].y] = a2;
  [r.ecken[(i + 1) % n].x, r.ecken[(i + 1) % n].y] = b2;
  const f = ungueltig(r);
  if (f) return { fehler: f };
  return abschliessen(raum, r);
}

export function richtenAus(raum, wandId, art) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  const w = winkelVon(wandGeo(raum, i).r);
  const ziele = art === 'waagerecht' ? [0, 180, 360] : [90, 270];
  const z = ziele.reduce((b, q) => (Math.abs(w - q) < Math.abs(w - b) ? q : b));
  return setzeRichtung(raum, wandId, z % 360);
}

// Neue Ecke in der Wand (anteil 0…1): aus einer Wand werden zwei. So kommen Wände dazu.
export function teileWand(raum, wandId, anteil = 0.5) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  const r = kopie(raum);
  const g = wandGeo(r, i);
  const p = add(g.a, mul(g.r, g.l * anteil));
  const ids = r.waende.map((w) => w.id);
  const neuId = neueId();
  r.ecken.splice(i + 1, 0, { id: neueId(), x: p[0], y: p[1] });
  ids.splice(i + 1, 0, neuId);
  r.waende[i].mass = null;
  waendeNeu(r, ids);
  // beide Teile liegen auf derselben Linie und behalten die Dachschräge
  if (r.waende[i].schraege) r.waende[i + 1].schraege = kopie(r.waende[i].schraege);
  return { ...abschliessen(raum, r), neueWand: neuId, neueEcke: r.ecken[i + 1].id };
}

// Ecke entfernen: die beiden Wände daneben werden zu einer geraden Wand.
export function loescheEcke(raum, eckeId) {
  const k = raum.ecken.findIndex((e) => e.id === eckeId);
  if (k < 0) return { fehler: 'Ecke nicht gefunden.' };
  if (raum.ecken.length <= 3) return { fehler: 'Ein Raum braucht mindestens drei Wände.' };
  const r = kopie(raum);
  const n = r.ecken.length;
  const ids = r.waende.map((w) => w.id);
  const vorher = (k - 1 + n) % n;
  r.ecken.splice(k, 1);
  ids.splice(k, 1);
  const vi = vorher > k ? vorher - 1 : vorher;
  waendeNeu(r, ids);
  r.waende[vi].mass = null;
  const f = ungueltig(r);
  if (f) return { fehler: f };
  return abschliessen(raum, r);
}

// Wand löschen: die Nachbarwände werden verlängert, bis sie sich treffen. Laufen sie parallel,
// verschwindet stattdessen die Ecke am Wandende.
export function loescheWand(raum, wandId) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  if (raum.ecken.length <= 3) return { fehler: 'Ein Raum braucht mindestens drei Wände.' };
  const n = raum.ecken.length;
  const vor = wandGeo(raum, (i - 1 + n) % n);
  const nach = wandGeo(raum, (i + 1) % n);
  const s = schnitt(vor.a, vor.r, nach.a, nach.r);
  if (!s) return loescheEcke(raum, raum.ecken[(i + 1) % n].id);
  const r = kopie(raum);
  const ids = r.waende.map((w) => w.id);
  [r.ecken[i].x, r.ecken[i].y] = s;
  const k = (i + 1) % n;
  r.ecken.splice(k, 1);
  ids.splice(i, 1);
  waendeNeu(r, ids);
  const f = ungueltig(r);
  if (f) return { fehler: f };
  return abschliessen(raum, r);
}

// ---------- Maßstab und Maße ----------

export function skaliere(raum, faktor) {
  const r = kopie(raum);
  for (const e of r.ecken) { e.x *= faktor; e.y *= faktor; }
  for (const o of r.oeffnungen) o.abstand *= faktor;
  for (const o of r.dachfenster || []) o.abstand *= faktor;
  r.skizze = { ...(r.skizze || { striche: [] }), faktor: (r.skizze?.faktor || 1) * faktor };
  return r;
}

// Abstand zweier Wände in der Reihenfolge (rundherum)
const reihenAbstand = (i, j, n) => Math.min((i - j + n) % n, (j - i + n) % n);

// Längen suchen, bei denen alle festen Maße stimmen und der Raum geschlossen bleibt. Die Richtungen
// der Wände bleiben. Ausgeglichen wird zuerst mit den Wänden, die der geänderten Wand am nächsten sind.
function loeseLaengen(u, l, fest, k) {
  const n = u.length;
  const frei = [...Array(n).keys()].filter((i) => !fest.has(i)).sort((a, b) => reihenAbstand(a, k, n) - reihenAbstand(b, k, n) || ((a - k + n) % n) - ((b - k + n) % n));
  const stufen = [...new Set(frei.map((i) => reihenAbstand(i, k, n)))];
  for (const stufe of stufen) {
    const aktiv = frei.filter((i) => reihenAbstand(i, k, n) <= stufe);
    const L = l.map((x, i) => (fest.has(i) ? fest.get(i) : x));
    // Fehler e = was fehlt, damit die Summe aller Wandvektoren 0 wird
    let s = [0, 0];
    for (let i = 0; i < n; i++) s = add(s, mul(u[i], L[i]));
    const e = mul(s, -1);
    // min Σδ² mit Σ δ_i u_i = e
    let m00 = 0; let m01 = 0; let m11 = 0;
    for (const i of aktiv) { m00 += u[i][0] * u[i][0]; m01 += u[i][0] * u[i][1]; m11 += u[i][1] * u[i][1]; }
    const det = m00 * m11 - m01 * m01;
    let delta = null;
    if (det > 1e-9) {
      const lam = [(m11 * e[0] - m01 * e[1]) / det, (-m01 * e[0] + m00 * e[1]) / det];
      delta = aktiv.map((i) => dot(u[i], lam));
    } else if (aktiv.length) {
      const w = u[aktiv[0]];
      const sg = aktiv.map((i) => Math.sign(dot(u[i], w)) || 1);
      const proj = dot(e, w) / aktiv.length;
      delta = sg.map((x) => x * proj);
    }
    if (!delta) continue;
    aktiv.forEach((i, j) => { L[i] += delta[j]; });
    let rest = [0, 0];
    for (let i = 0; i < n; i++) rest = add(rest, mul(u[i], L[i]));
    if (len(rest) < 1e-7 && L.every((x) => x >= MIN_LAENGE)) return L;
  }
  // ohne freie Wände: nur gültig, wenn es schon passt
  if (!frei.length) {
    const L = l.map((x, i) => fest.get(i) ?? x);
    let rest = [0, 0];
    for (let i = 0; i < n; i++) rest = add(rest, mul(u[i], L[i]));
    if (len(rest) < 1e-7) return L;
  }
  return null;
}

function ausLaengen(raum, L, anker) {
  const r = kopie(raum);
  const n = r.ecken.length;
  const u = r.ecken.map((_, i) => wandGeo(raum, i).r);
  let p = [r.ecken[anker].x, r.ecken[anker].y];
  for (let s = 0; s < n; s++) {
    const i = (anker + s) % n;
    p = add(p, mul(u[i], L[i]));
    const j = (i + 1) % n;
    if (j !== anker) [r.ecken[j].x, r.ecken[j].y] = p;
  }
  for (const e of r.ecken) { e.x = rund(e.x, 1e9); e.y = rund(e.y, 1e9); }
  return r;
}

// Bekanntes Maß an einer Wand setzen. Das erste Maß legt den Maßstab fest (alles wird skaliert),
// jedes weitere ändert nur Längen. Ergebnis { raum } oder { konflikt } oder { fehler }.
export function setzeMass(raum, wandId, laenge) {
  const k = wandIndex(raum, wandId);
  if (k < 0) return { fehler: 'Wand nicht gefunden.' };
  if (!(laenge >= MIN_LAENGE)) return { fehler: 'Bitte eine Länge größer als 0 eingeben.' };
  if (!geschlossen(raum)) return { fehler: 'Bitte zuerst den Raum schließen.' };
  if (!raum.massstabGesetzt) {
    const g = wandGeo(raum, k);
    const r = skaliere(raum, laenge / g.l);
    r.massstabGesetzt = true;
    r.waende.forEach((w) => { w.mass = null; });
    r.waende[k].mass = laenge;
    // Ungenauigkeit aus der Gleitkommarechnung: die Wand bekommt genau ihr Maß
    return { raum: ausLaengen(r, r.ecken.map((_, i) => (i === k ? laenge : wandGeo(r, i).l)), k), skaliert: laenge / g.l };
  }
  const u = raum.ecken.map((_, i) => wandGeo(raum, i).r);
  const l = raum.ecken.map((_, i) => wandGeo(raum, i).l);
  const fest = new Map();
  raum.waende.forEach((w, i) => { if (w.mass != null && i !== k) fest.set(i, w.mass); });
  fest.set(k, laenge);
  const L = loeseLaengen(u, l, fest, k);
  if (!L) {
    // Welche Maße stehen im Weg? Jedes andere feste Maß einzeln weglassen und probieren.
    const gegen = [];
    for (const [i] of fest) {
      if (i === k) continue;
      const ohne = new Map(fest);
      ohne.delete(i);
      if (loeseLaengen(u, l, ohne, k)) gegen.push(raum.waende[i].id);
    }
    const geo = geometrieAnpassen(raum, k, laenge);
    return { konflikt: { wand: wandId, laenge, gegen, geometrieMoeglich: Boolean(geo.raum) } };
  }
  const r = ausLaengen(raum, L, k);
  r.waende[k].mass = laenge;
  const f = ungueltig(r);
  if (f) return { fehler: f };
  return abschliessen(raum, r);
}

// Widersprüchliche Maße: Lösung je nach Wahl
//   'neu'        – das neue Maß gilt, die widersprechenden alten Maße werden entfernt
//   'alt'        – das neue Maß wird verworfen
//   'geometrie'  – alle Maße bleiben; die nächste Wand ohne Maß wird schräg, damit es aufgeht
export function konfliktLoesen(raum, konflikt, wahl) {
  if (wahl === 'alt') return { raum: kopie(raum) };
  const k = wandIndex(raum, konflikt.wand);
  if (wahl === 'neu') {
    const r = kopie(raum);
    let gegen = konflikt.gegen;
    if (!gegen.length) gegen = r.waende.filter((w, i) => i !== k && w.mass != null).map((w) => w.id);
    for (const w of r.waende) if (gegen.includes(w.id)) w.mass = null;
    return setzeMass(r, konflikt.wand, konflikt.laenge);
  }
  if (wahl === 'geometrie') return geometrieAnpassen(raum, k, konflikt.laenge);
  return { fehler: 'Unbekannte Wahl.' };
}

function geometrieAnpassen(raum, k, laenge) {
  const n = raum.ecken.length;
  const u = raum.ecken.map((_, i) => wandGeo(raum, i).r);
  const L = raum.ecken.map((_, i) => (i === k ? laenge : raum.waende[i].mass ?? wandGeo(raum, i).l));
  const kandidaten = [...Array(n).keys()].filter((i) => i !== k && raum.waende[i].mass == null)
    .sort((a, b) => reihenAbstand(a, k, n) - reihenAbstand(b, k, n) || ((a - k + n) % n) - ((b - k + n) % n));
  for (const j of kandidaten) {
    // Wand j schließt den Raum: ihre Richtung und Länge ergeben sich aus allen anderen
    let s = [0, 0];
    for (let i = 0; i < n; i++) if (i !== j) s = add(s, mul(u[i], L[i]));
    const v = mul(s, -1);
    if (len(v) < MIN_LAENGE) continue;
    const r = kopie(raum);
    const start = (j + 1) % n; // Anfang der Wand nach j bleibt liegen
    let p = [r.ecken[start].x, r.ecken[start].y];
    for (let step = 0; step < n - 1; step++) {
      const i = (start + step) % n;
      p = add(p, mul(u[i], L[i]));
      [r.ecken[(i + 1) % n].x, r.ecken[(i + 1) % n].y] = p;
    }
    r.waende[k].mass = laenge;
    if (ungueltig(r)) continue;
    return { ...abschliessen(raum, r), schraeg: raum.waende[j].id };
  }
  return { fehler: 'Die Maße lassen sich nicht in einen geschlossenen Raum bringen.' };
}

// ---------- Öffnungen ----------

export const TUER_STANDARD = { breite: 0.885, hoehe: 2.01 };
export const FENSTER_STANDARD = { breite: 1.2, hoehe: 1.2, bruestung: 0.9 };

export function neueOeffnung(raum, typ, wandId, mitteAbstand) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  const g = wandGeo(raum, i);
  const std = typ === 'tuer' ? TUER_STANDARD : FENSTER_STANDARD;
  const breite = Math.min(std.breite, g.l);
  const nr = raum.oeffnungen.filter((o) => o.typ === typ).length + 1;
  const o = {
    id: neueId(),
    typ,
    name: `${typ === 'tuer' ? 'Tür' : 'Fenster'} ${nr}`,
    wand: wandId,
    abstand: rund(Math.max(0, Math.min(g.l - breite, mitteAbstand - breite / 2)), 1e6),
    breite,
    hoehe: std.hoehe,
    ...(typ === 'tuer' ? { anschlag: 'links', richtung: 'innen' } : { bruestung: std.bruestung }),
  };
  const r = kopie(raum);
  r.oeffnungen.push(o);
  return { raum: r, oeffnung: o.id };
}

export function aendereOeffnung(raum, id, felder) {
  const r = kopie(raum);
  const o = r.oeffnungen.find((x) => x.id === id);
  if (!o) return { fehler: 'Öffnung nicht gefunden.' };
  Object.assign(o, felder);
  const i = wandIndex(r, o.wand);
  if (i >= 0) {
    const g = wandGeo(r, i);
    if (o.breite > g.l) return { fehler: `Die ${o.typ === 'tuer' ? 'Tür' : 'Öffnung'} ist breiter als die Wand (${fmt2(g.l)} m).` };
    o.abstand = rund(Math.max(0, Math.min(g.l - o.breite, o.abstand)), 1e6);
  }
  return { raum: r };
}

export function loescheOeffnung(raum, id) {
  const r = kopie(raum);
  r.oeffnungen = r.oeffnungen.filter((o) => o.id !== id);
  return { raum: r };
}

// ---------- Dachschrägen und Kniestock ----------
// Eine Wand kann eine Dachschräge tragen: wand.schraege = { kniestock, art, wert }.
// kniestock = Höhe der Wand bis zum Beginn der Schräge (m). art sagt, wie die Schräge gemessen
// wurde: 'tiefe' = waagerechte Breite der Schräge im Grundriss (m), 'winkel' = Dachneigung (Grad),
// 'laenge' = Länge der Schräge selbst (m). Die Schräge steigt von der Wand nach innen bis zur
// Raumhöhe. Jede Schräge ist eine Ebene; die Decke liegt an jeder Stelle auf der niedrigsten
// Ebene, höchstens auf Raumhöhe. So ergeben sich Satteldach (zwei gegenüberliegende Schrägen),
// Walmdach (Schrägen an allen Seiten) und Giebelwände von selbst.

export const SCHRAEGE_STANDARD = { kniestock: 1, art: 'winkel', wert: 40 };

export function schraegeWerte(raum, i) {
  const s = raum.waende[i]?.schraege;
  if (!s) return null;
  const H = Number(raum.hoehe) || 0;
  const k = Number(s.kniestock);
  const w = Number(s.wert);
  const dh = H - k;
  const ungueltig = (grund) => ({ gueltig: false, grund });
  if (!(k >= 0)) return ungueltig('Kniestock fehlt.');
  if (!(dh > 0.005)) return ungueltig(`Der Kniestock (${fmt2(k)} m) muss niedriger sein als die Raumhöhe (${fmt2(H)} m).`);
  if (!(w > 0)) return ungueltig('Für die Schräge fehlt ein Wert.');
  let tiefe;
  if (s.art === 'winkel') {
    if (w >= 89) return ungueltig('Die Dachneigung muss unter 89° liegen.');
    tiefe = dh / Math.tan((w * Math.PI) / 180);
  } else if (s.art === 'laenge') {
    if (w <= dh + 0.005) return ungueltig(`Die Schräge muss länger sein als der Höhenunterschied (${fmt2(dh)} m).`);
    tiefe = Math.sqrt(w * w - dh * dh);
  } else tiefe = w;
  const steigung = dh / tiefe;
  return {
    gueltig: true, kniestock: k, tiefe, steigung,
    winkel: (Math.atan(steigung) * 180) / Math.PI,
    laenge: Math.hypot(tiefe, dh),
    faktor: Math.sqrt(1 + steigung * steigung), // Schrägfläche je m² Grundriss
  };
}

export const hatSchraegen = (raum) => raum.waende.some((w) => w.schraege);

// Dachebenen: h(p) = k + steigung · Abstand von der Wand nach innen
function ebenen(raum) {
  const out = [];
  raum.waende.forEach((w, i) => {
    const v = schraegeWerte(raum, i);
    if (!v?.gueltig) return;
    const g = wandGeo(raum, i);
    out.push({ i, wand: w.id, ...v, a: g.a, n: g.innen, h: (p) => v.kniestock + v.steigung * dot(sub(p, g.a), g.innen) });
  });
  return out;
}

// Deckenhöhe an einem Punkt (m)
export function hoeheBei(raum, p, E = ebenen(raum)) {
  const H = Number(raum.hoehe) || 0;
  return E.reduce((m, e) => Math.min(m, e.h(p)), H);
}

// Vieleck an einer Geraden abschneiden: behalten wird, wo f(p) <= 0 (f linear)
function abschneiden(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % poly.length];
    const fp = f(P);
    const fq = f(Q);
    if (fp <= 0) out.push(P);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) out.push(add(P, mul(sub(Q, P), fp / (fp - fq))));
  }
  return out;
}

// Grundriss aufteilen: flache Decke und je Schräge der Bereich, in dem sie die Decke bildet
function dachBereiche(raum, E = ebenen(raum)) {
  const p = punkteVon(raum);
  const H = Number(raum.hoehe) || 0;
  const flach = E.reduce((q, e) => (q.length ? abschneiden(q, (x) => H - e.h(x)) : q), p);
  const schraegen = E.map((e, j) => {
    let q = abschneiden(p, (x) => e.h(x) - H);
    E.forEach((v, m) => {
      // bei gleicher Ebene (z. B. geteilte Wand) bekommt die erste den Bereich
      if (m !== j && q.length) q = abschneiden(q, (x) => e.h(x) - v.h(x) + (m < j ? 1e-9 : 0));
    });
    return { ...e, poly: q, grundriss: q.length >= 3 ? Math.abs(flaecheMitVorzeichen(q)) : 0 };
  });
  return { flach, flachFlaeche: flach.length >= 3 ? Math.abs(flaecheMitVorzeichen(flach)) : 0, schraegen };
}

// Höhenverlauf entlang einer Wand: Fläche, niedrigste und höchste Stelle
function wandHoehen(raum, i, E) {
  const H = Number(raum.hoehe) || 0;
  const g = wandGeo(raum, i);
  const fn = [{ c: H, m: 0 }, ...E.map((e) => ({ c: e.h(g.a), m: e.steigung * dot(g.r, e.n) }))];
  const ts = [0, g.l];
  for (let x = 0; x < fn.length; x++) {
    for (let y = x + 1; y < fn.length; y++) {
      const dm = fn[x].m - fn[y].m;
      if (Math.abs(dm) < 1e-12) continue;
      const t = (fn[y].c - fn[x].c) / dm;
      if (t > 1e-9 && t < g.l - 1e-9) ts.push(t);
    }
  }
  ts.sort((a, b) => a - b);
  const h = (t) => fn.reduce((m, f) => Math.min(m, f.c + f.m * t), Infinity);
  const punkte = ts.map((t) => [t, h(t)]);
  let flaeche = 0;
  for (let k = 1; k < punkte.length; k++) flaeche += ((punkte[k][0] - punkte[k - 1][0]) * (Math.max(0, punkte[k][1]) + Math.max(0, punkte[k - 1][1]))) / 2;
  const hs = punkte.map((q) => q[1]);
  return { flaeche, min: Math.min(...hs), max: Math.max(...hs), punkte, h };
}

// ---------- Dachfenster ----------
// raum.dachfenster = [{ id, name, wand, abstand, breite, laenge, unten }]: liegt in der Schräge
// der Wand; abstand entlang der Wand, unten = Abstand der Unterkante vom Kniestock in der Schräge.

export const DACHFENSTER_STANDARD = { breite: 0.78, laenge: 1.18, unten: 0.5 };

export function neuesDachfenster(raum, wandId, mitteAbstand) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  if (!schraegeWerte(raum, i)?.gueltig) return { fehler: 'Diese Wand hat keine Dachschräge.' };
  const g = wandGeo(raum, i);
  const breite = Math.min(DACHFENSTER_STANDARD.breite, g.l);
  const r = kopie(raum);
  r.dachfenster = r.dachfenster || [];
  const o = {
    id: neueId(),
    name: `Dachfenster ${r.dachfenster.length + 1}`,
    wand: wandId,
    abstand: rund(Math.max(0, Math.min(g.l - breite, (mitteAbstand ?? g.l / 2) - breite / 2)), 1e6),
    breite,
    laenge: DACHFENSTER_STANDARD.laenge,
    unten: DACHFENSTER_STANDARD.unten,
  };
  r.dachfenster.push(o);
  return { raum: r, dachfenster: o.id };
}

// Ecken eines Dachfensters im Grundriss (Meter): Länge in der Schräge waagerecht projiziert
export function dachfensterEcken(raum, o) {
  const i = wandIndex(raum, o.wand);
  const v = i >= 0 ? schraegeWerte(raum, i) : null;
  if (!v?.gueltig) return null;
  const g = wandGeo(raum, i);
  const t0 = o.unten / v.faktor;
  const t1 = (o.unten + o.laenge) / v.faktor;
  const ecke = (s0, t) => add(add(g.a, mul(g.r, s0)), mul(g.innen, t));
  return [ecke(o.abstand, t0), ecke(o.abstand + o.breite, t0), ecke(o.abstand + o.breite, t1), ecke(o.abstand, t1)];
}

export function aendereDachfenster(raum, id, felder) {
  const r = kopie(raum);
  const o = (r.dachfenster || []).find((x) => x.id === id);
  if (!o) return { fehler: 'Dachfenster nicht gefunden.' };
  Object.assign(o, felder);
  const i = wandIndex(r, o.wand);
  if (i >= 0) {
    const g = wandGeo(r, i);
    if (o.breite > g.l) return { fehler: `Das Dachfenster ist breiter als die Wand (${fmt2(g.l)} m).` };
    o.abstand = rund(Math.max(0, Math.min(g.l - o.breite, o.abstand)), 1e6);
  }
  return { raum: r };
}

export function loescheDachfenster(raum, id) {
  const r = kopie(raum);
  r.dachfenster = (r.dachfenster || []).filter((o) => o.id !== id);
  return { raum: r };
}

// Dachschräge einer Wand setzen (null = entfernen)
export function setzeSchraege(raum, wandId, schraege) {
  const i = wandIndex(raum, wandId);
  if (i < 0) return { fehler: 'Wand nicht gefunden.' };
  const r = kopie(raum);
  if (schraege) {
    r.waende[i].schraege = { kniestock: Number(schraege.kniestock), art: schraege.art, wert: Number(schraege.wert) };
    const v = schraegeWerte(r, i);
    if (!v.gueltig) return { fehler: v.grund };
  } else {
    delete r.waende[i].schraege;
  }
  // Dachfenster brauchen eine Schräge
  const weg = (r.dachfenster || []).filter((o) => !r.waende.find((w) => w.id === o.wand)?.schraege);
  r.dachfenster = (r.dachfenster || []).filter((o) => !weg.includes(o));
  return { raum: r, oeffnungenWeg: weg };
}

// ---------- Berechnung ----------

export function berechne(raum) {
  const p = punkteVon(raum);
  const zu = geschlossen(raum);
  const waende = raum.waende.map((w, i) => {
    const g = wandGeo(raum, i);
    return { id: w.id, name: wandName(i), laenge: g.l, richtung: winkelVon(g.r), mass: w.mass };
  });
  const hoehe = Number(raum.hoehe) || 0;
  const flaeche = zu ? Math.abs(flaecheMitVorzeichen(p)) : 0;
  const umfang = waende.reduce((s, w) => s + w.laenge, 0);
  const vob = raum.einstellungen?.abzug === 'vob';
  const oeffnungen = raum.oeffnungen.map((o) => {
    const f = o.breite * o.hoehe;
    return { ...o, flaeche: f, abgezogen: !vob || f > VOB_GRENZE, wandName: wandName(wandIndex(raum, o.wand)) };
  });
  const summe = (typ, nur) => oeffnungen.filter((o) => o.typ === typ && (!nur || o.abgezogen)).reduce((s, o) => s + o.flaeche, 0);
  // Dachschrägen: Wandhöhen, flache Decke und Schrägflächen
  const E = zu ? ebenen(raum) : [];
  const mitSchraege = E.length > 0;
  if (mitSchraege) {
    waende.forEach((w, i) => {
      const wh = wandHoehen(raum, i, E);
      Object.assign(w, { flaeche: wh.flaeche, hoeheMin: wh.min, hoeheMax: wh.max });
    });
  } else waende.forEach((w) => Object.assign(w, { flaeche: w.laenge * hoehe, hoeheMin: hoehe, hoeheMax: hoehe }));
  const bereiche = mitSchraege ? dachBereiche(raum, E) : null;
  const schraegen = mitSchraege ? bereiche.schraegen.filter((e) => e.grundriss > 1e-9).map((e) => ({
    wand: e.wand, wandName: wandName(e.i), kniestock: e.kniestock, winkel: e.winkel, tiefe: e.tiefe, laenge: e.laenge,
    grundriss: e.grundriss, flaeche: e.grundriss * e.faktor, poly: e.poly,
  })) : [];
  const dachfenster = (raum.dachfenster || []).map((o) => ({ ...o, flaeche: o.breite * o.laenge, wandName: wandName(wandIndex(raum, o.wand)) }));
  const dachFlaeche = schraegen.reduce((s, e) => s + e.flaeche, 0);
  const dachfensterFlaeche = dachfenster.reduce((s, o) => s + o.flaeche, 0);
  const wandBrutto = mitSchraege ? waende.reduce((s, w) => s + w.flaeche, 0) : umfang * hoehe;
  const abzug = summe('tuer', true) + summe('fenster', true);
  // Innenwinkel an jeder Ecke (für die Anzeige)
  const winkel = zu ? raum.ecken.map((_, i) => {
    const n = p.length;
    const a = sub(p[(i - 1 + n) % n], p[i]);
    const b = sub(p[(i + 1) % n], p[i]);
    let w = (Math.atan2(kreuz(b, a), dot(b, a)) * 180) / Math.PI;
    if (w < 0) w += 360;
    return w;
  }) : [];
  return {
    geschlossen: zu,
    bodenflaeche: flaeche,
    deckenflaeche: mitSchraege ? bereiche.flachFlaeche : flaeche, // waagerechter Teil der Decke
    mitSchraege,
    schraegen,
    dachFlaeche,
    dachfenster,
    dachfensterFlaeche,
    dachNetto: dachFlaeche - dachfensterFlaeche,
    flachPoly: mitSchraege ? bereiche.flach : null,
    umfang,
    hoehe,
    wandBrutto,
    tuerFlaeche: summe('tuer'),
    fensterFlaeche: summe('fenster'),
    abzug,
    wandNetto: wandBrutto - abzug,
    waende,
    oeffnungen,
    winkel,
    rechteckig: zu && p.length === 4 && winkel.every((w) => Math.abs(w - 90) < 1e-6),
  };
}

// Kurzer Text für die Karte im Aufmaß
export function raumKurz(raum) {
  if (!geschlossen(raum)) return 'Raum noch nicht geschlossen';
  const b = berechne(raum);
  return `${fmt2(b.bodenflaeche)} m² Boden · ${fmt2(b.umfang)} m Umfang · ${fmt2(b.wandNetto)} m² Wand${b.mitSchraege ? ` · ${fmt2(b.dachNetto)} m² Schräge` : ''}`;
}

// ---------- Mehrere Räume (gemeinsamer Grundriss) ----------
// Räume mit derselben raum.gruppe liegen in einem gemeinsamen Meter-Koordinatensystem. Jeder Raum
// bleibt ein eigener Raum mit Innenmaßen; zwischen zwei Räumen liegt die Trennwand (wandstaerke).

export const neueGruppe = () => neueId();
const staerkeVon = (raum, o) => Math.max(0, Number(o?.staerke ?? raum.einstellungen?.wandstaerke ?? STANDARD.wandstaerke) || 0);

// Mitte zum Beschriften und Anfassen (auch bei L- und U-Form im Raum)
export function raumMitte(raum) {
  const p = punkteVon(raum);
  return p.length ? innenPunkt(p, schwerpunkt(p)) : [0, 0];
}

// Ganzen Raum verschieben (Meter)
export function verschiebeRaum(raum, [dx, dy]) {
  const r = kopie(raum);
  for (const e of r.ecken) { e.x = rund(e.x + dx, 1e6); e.y = rund(e.y + dy, 1e6); }
  for (const s of r.skizze?.striche || []) for (const q of s) { q[0] += dx / (r.skizze.faktor || 1); q[1] += dy / (r.skizze.faktor || 1); }
  return { raum: r };
}

// Neuen rechteckigen Raum auf der anderen Seite einer Wand anbauen (mit Trennwand dazwischen).
// breite/abstand entlang der Wand, tiefe nach außen. Die gemeinsame Wand ist Wand A des neuen Raums.
export function raumAnbauen(raum, wandId, o = {}) {
  const i = wandIndex(raum, wandId);
  if (i < 0 || !geschlossen(raum)) return { fehler: 'Wand nicht gefunden.' };
  const g = wandGeo(raum, i);
  const t = staerkeVon(raum, o);
  const tiefe = Number(o.tiefe ?? 3);
  const breite = Number(o.breite ?? g.l);
  const ab = Number(o.abstand ?? 0);
  if (!(tiefe >= MIN_LAENGE) || !(breite >= MIN_LAENGE)) return { fehler: 'Breite und Tiefe des neuen Raums fehlen.' };
  const aussen = mul(g.innen, -1);
  const a = add(add(g.a, mul(g.r, ab)), mul(aussen, t));
  const b = add(a, mul(g.r, breite));
  const gruppe = raum.gruppe || neueGruppe();
  const neu = raumAusEcken({ ...neuerRaum(1, raum.einstellungen), name: o.name || 'Raum', hoehe: raum.hoehe, gruppe }, [b, a, add(a, mul(aussen, tiefe)), add(b, mul(aussen, tiefe))], 'anbau');
  for (const e of neu.ecken) { e.x = rund(e.x, 1e6); e.y = rund(e.y, 1e6); }
  neu.massstabGesetzt = !!raum.massstabGesetzt;
  neu.skizze = { striche: [], faktor: raum.skizze?.faktor || 1 };
  if (o.breiteGemessen || (raum.waende[i].mass != null && Math.abs(breite - g.l) < 1e-9 && Math.abs(ab) < 1e-9)) neu.waende[0].mass = rund(wandGeo(neu, 0).l, 1e6);
  if (o.tiefeGemessen) neu.waende[1].mass = rund(wandGeo(neu, 1).l, 1e6);
  return { raum: { ...kopie(raum), gruppe }, neu };
}

// Raum an Nachbarräume andocken: liegt eine Wand fast parallel gegenüber einer Nachbarwand (bis fang m
// neben dem Abstand der Trennwand), wird der Raum so verschoben, dass genau die Wandstärke dazwischen
// liegt. Danach in der zweiten Richtung an eine weitere Wand oder bündig an eine Ecke.
export function andocken(raum, nachbarn, o = {}) {
  const t = staerkeVon(raum, o);
  const fang = o.fang ?? 0.3;
  if (!geschlossen(raum)) return { raum, an: null };
  const kand = [];
  raum.waende.forEach((_, i) => {
    const g = wandGeo(raum, i);
    const aus = mul(g.innen, -1);
    for (const nb of nachbarn) {
      if (!geschlossen(nb) || nb.id === raum.id) continue;
      nb.waende.forEach((__, j) => {
        const h = wandGeo(nb, j);
        if (dot(g.r, h.r) > -0.9995) return; // nur gegenläufig parallele Wände
        const u0 = dot(sub(h.a, g.a), g.r);
        const u1 = dot(sub(h.b, g.a), g.r);
        if (Math.min(g.l, Math.max(u0, u1)) - Math.max(0, Math.min(u0, u1)) < 0.05) return; // liegen nicht nebeneinander
        const v = dot(sub(h.a, g.a), aus) - t;
        if (Math.abs(v) <= fang) kand.push({ v, n: aus, g, h, nb });
      });
    }
  });
  if (!kand.length) return { raum, an: null };
  kand.sort((x, y) => Math.abs(x.v) - Math.abs(y.v));
  const erst = kand[0];
  let schub = mul(erst.n, erst.v);
  const zweit = kand.find((k) => Math.abs(dot(k.n, erst.n)) < 0.01);
  if (zweit) schub = add(schub, mul(zweit.n, zweit.v));
  else {
    // bündig an eine Ecke der Nachbarwand
    const { g, h } = erst;
    const versatz = [dot(sub(h.b, g.a), g.r), dot(sub(h.a, g.b), g.r), dot(sub(h.a, g.a), g.r), dot(sub(h.b, g.b), g.r)]
      .filter((x) => Math.abs(x) <= fang).sort((x, y) => Math.abs(x) - Math.abs(y));
    if (versatz.length) schub = add(schub, mul(g.r, versatz[0]));
  }
  return { raum: verschiebeRaum(raum, schub).raum, an: erst.nb.name || 'Raum', schub };
}

// Überschneiden sich zwei Räume? (Berühren an einer Wand zählt nicht)
export function ueberschneiden(r1, r2) {
  if (!geschlossen(r1) || !geschlossen(r2)) return false;
  const p = punkteVon(r1);
  const q = punkteVon(r2);
  const e = 1e-6;
  const o = (x, y, z) => kreuz(sub(y, x), sub(z, x));
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    for (let j = 0; j < q.length; j++) {
      const c = q[j];
      const d = q[(j + 1) % q.length];
      if (((o(c, d, a) > e && o(c, d, b) < -e) || (o(c, d, a) < -e && o(c, d, b) > e))
        && ((o(a, b, c) > e && o(a, b, d) < -e) || (o(a, b, c) < -e && o(a, b, d) > e))) return true;
    }
  }
  const tiefInnen = (x, poly) => punktInnen(x, poly) && poly.every((a, k) => abstandZuStrecke(x, a, poly[(k + 1) % poly.length]).d > 1e-4);
  return p.some((x) => tiefInnen(x, q)) || q.some((x) => tiefInnen(x, p)) || tiefInnen(raumMitte(r1), q) || tiefInnen(raumMitte(r2), p);
}

// Warnungen für den ganzen Grundriss
export function pruefeGruppe(raeume) {
  const warnungen = [];
  for (let i = 0; i < raeume.length; i++) {
    for (let j = i + 1; j < raeume.length; j++) {
      if (ueberschneiden(raeume[i], raeume[j])) warnungen.push(`${raeume[i].name || 'Raum'} und ${raeume[j].name || 'Raum'} überschneiden sich.`);
    }
  }
  return warnungen;
}

// Nächster freier Name „Raum n“
export function naechsterName(namen) {
  const nr = Math.max(0, ...namen.map((x) => (/^Raum (\d+)$/.exec(String(x)) || [])[1] || 0).map(Number), namen.length) + 1;
  return `Raum ${nr}`;
}

// ---------- Prüfung vor dem Speichern ----------

export function pruefe(raum) {
  const fehler = [];
  const warnungen = [];
  if (!geschlossen(raum)) {
    fehler.push('Der Raum ist nicht geschlossen. Bitte die Kontur fertig zeichnen oder „Schließen“ tippen.');
    return { fehler, warnungen };
  }
  const p = punkteVon(raum);
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (abst(p[i], p[j]) < 1e-6) fehler.push(`Die Ecken ${i + 1} und ${j + 1} liegen aufeinander.`);
  }
  raum.waende.forEach((w, i) => {
    const l = wandGeo(raum, i).l;
    if (l < MIN_LAENGE) fehler.push(`Wand ${wandName(i)} hat keine Länge.`);
    else if (l < 0.05) warnungen.push(`Wand ${wandName(i)} ist sehr kurz (${fmt2(l)} m).`);
    if (raum.massstabGesetzt && l > 100) warnungen.push(`Wand ${wandName(i)} ist sehr lang (${fmt2(l)} m).`);
    if (w.mass != null && Math.abs(w.mass - l) > 0.005) fehler.push(`Wand ${wandName(i)}: eingegebenes Maß ${fmt2(w.mass)} m passt nicht zur Zeichnung (${fmt2(l)} m).`);
  });
  if (selbstUeberschneidungen(p).length) fehler.push('Wände überkreuzen sich. Bitte die Ecken so verschieben, dass sich keine Wände schneiden.');
  if (!raum.massstabGesetzt) fehler.push('Es fehlt ein echtes Maß. Bitte mit „Maß“ eine Wand antippen und ihre Länge eingeben.');
  const h = Number(raum.hoehe);
  if (!(h > 0)) fehler.push('Bitte eine Raumhöhe eingeben.');
  const E = ebenen(raum);
  if (E.length && h > 0) {
    const tief = Math.min(...p.map((q) => hoeheBei(raum, q, E)));
    if (tief < -1e-6) fehler.push('Die Dachschrägen treffen sich unter dem Boden. Bitte Kniestock und Neigung prüfen.');
  }
  else if (h < 1.5 || h > 10) warnungen.push(`Die Raumhöhe ${fmt2(h)} m ist ungewöhnlich.`);
  const b = berechne(raum);
  if (raum.massstabGesetzt && b.bodenflaeche < 0.5) warnungen.push(`Die Bodenfläche ist sehr klein (${fmt2(b.bodenflaeche)} m²).`);
  for (const o of raum.oeffnungen) {
    const i = wandIndex(raum, o.wand);
    if (i < 0) { fehler.push(`${o.name} sitzt an keiner Wand.`); continue; }
    const l = wandGeo(raum, i).l;
    if (!(o.breite > 0) || !(o.hoehe > 0)) fehler.push(`${o.name}: Breite und Höhe fehlen.`);
    if (o.abstand < -1e-6 || o.abstand + o.breite > l + 1e-6) fehler.push(`${o.name} passt nicht in Wand ${wandName(i)} (${fmt2(l)} m).`);
    const oben = (o.typ === 'fenster' ? Number(o.bruestung) || 0 : 0) + o.hoehe;
    if (h > 0 && E.length) {
      const wh = wandHoehen(raum, i, E);
      const frei = Math.min(wh.h(o.abstand), wh.h(o.abstand + o.breite), ...wh.punkte.filter(([t]) => t > o.abstand && t < o.abstand + o.breite).map((q) => q[1]));
      if (oben > frei + 1e-6) warnungen.push(`${o.name} reicht in die Dachschräge (oben ${fmt2(oben)} m, Wand dort nur ${fmt2(frei)} m hoch).`);
    } else if (h > 0 && oben > h + 1e-6) warnungen.push(`${o.name} reicht über die Raumhöhe (${fmt2(oben)} m).`);
  }
  // Dachschrägen und Dachfenster
  raum.waende.forEach((w, i) => {
    const v = schraegeWerte(raum, i);
    if (v && !v.gueltig) fehler.push(`Dachschräge an Wand ${wandName(i)}: ${v.grund}`);
  });
  for (const o of raum.dachfenster || []) {
    const i = wandIndex(raum, o.wand);
    const v = i >= 0 ? schraegeWerte(raum, i) : null;
    if (!v?.gueltig) { fehler.push(`${o.name} sitzt an keiner Dachschräge.`); continue; }
    if (!(o.breite > 0) || !(o.laenge > 0)) fehler.push(`${o.name}: Breite und Länge fehlen.`);
    if (o.unten < 0 || o.unten + o.laenge > v.laenge + 1e-6) warnungen.push(`${o.name} passt nicht in die Schräge an Wand ${wandName(i)} (Schräge ${fmt2(v.laenge)} m lang).`);
  }
  // Öffnungen in derselben Wand dürfen sich nicht überlappen
  for (const w of raum.waende) {
    const liste = raum.oeffnungen.filter((o) => o.wand === w.id).sort((a, c) => a.abstand - c.abstand);
    for (let i = 1; i < liste.length; i++) {
      if (liste[i].abstand < liste[i - 1].abstand + liste[i - 1].breite - 1e-6) warnungen.push(`${liste[i - 1].name} und ${liste[i].name} überlappen sich.`);
    }
  }
  return { fehler: [...new Set(fehler)], warnungen: [...new Set(warnungen)] };
}

// ---------- Aufmaß-Positionen ----------

export function alsPositionen(raum) {
  const b = berechne(raum);
  const n = raum.name || 'Raum';
  const hoehe = fmtPos(b.hoehe);
  const boden = b.rechteckig
    ? (() => {
      const l0 = b.waende[0].laenge;
      const l1 = b.waende[1].laenge;
      return { ...newZeile(), laenge: fmtPos(Math.max(l0, l1)), breite: fmtPos(Math.min(l0, l1)) };
    })()
    : { ...newZeile(), wert: fmtPos(b.bodenflaeche), text: `Fläche aus Grundriss (${b.waende.length} Wände)` };
  const oeZeile = (o) => ({ ...newZeile(), stueck: '1', laenge: fmtPos(o.breite), hoehe: fmtPos(o.hoehe), abzug: true, text: `${o.name} (Wand ${o.wandName})` });
  const ueber = (o) => ({ ...newZeile(), text: `${o.name} (Wand ${o.wandName}): ${fmt2(o.breite)} × ${fmt2(o.hoehe)} m = ${fmt2(o.flaeche)} m², übermessen`, info: true });
  // Mit Dachschrägen: Wände einzeln (Kniestock- und Giebelwände sind nicht raumhoch)
  const wandZeilen = b.mitSchraege
    ? b.waende.map((w) => (Math.abs(w.hoeheMax - w.hoeheMin) < 0.0005
      ? { ...newZeile(), laenge: fmtPos(w.laenge), hoehe: fmtPos(w.hoeheMin), text: `Wand ${w.name}${w.hoeheMin < b.hoehe - 0.0005 ? ' (Kniestock)' : ''}` }
      : { ...newZeile(), wert: fmtPos(w.flaeche), text: `Wand ${w.name}: ${fmt2(w.laenge)} m lang, ${fmt2(w.hoeheMin)} bis ${fmt2(w.hoeheMax)} m hoch` }))
    : [{ ...newZeile(), laenge: fmtPos(b.umfang), hoehe, text: `Umfang × Raumhöhe` }];
  const decke = b.mitSchraege
    ? [{ bezeichnung: `${n}: Deckenfläche (waagerecht)`, einheit: 'm2', zeilen: [{ ...newZeile(), wert: fmtPos(b.deckenflaeche), text: 'Flacher Teil der Decke aus Grundriss' }] },
      {
        bezeichnung: `${n}: Dachschräge`,
        einheit: 'm2',
        zeilen: [
          ...b.schraegen.map((e) => ({ ...newZeile(), wert: fmtPos(e.flaeche), text: `Schräge an Wand ${e.wandName}: Kniestock ${fmt2(e.kniestock)} m, ${fmt2(e.winkel)}°, ${fmt2(e.grundriss)} m² im Grundriss` })),
          ...b.dachfenster.map((o) => ({ ...newZeile(), stueck: '1', laenge: fmtPos(o.breite), breite: fmtPos(o.laenge), abzug: true, text: `${o.name} (Wand ${o.wandName})` })),
        ],
      }]
    : [{ bezeichnung: `${n}: Deckenfläche`, einheit: 'm2', zeilen: [{ ...boden }] }];
  const out = [
    { bezeichnung: `${n}: Bodenfläche`, einheit: 'm2', zeilen: [boden] },
    ...decke,
    {
      bezeichnung: `${n}: Wandfläche`,
      einheit: 'm2',
      zeilen: [
        ...wandZeilen,
        ...b.oeffnungen.filter((o) => o.abgezogen).map(oeZeile),
        ...b.oeffnungen.filter((o) => !o.abgezogen).map(ueber),
      ],
    },
    {
      bezeichnung: `${n}: Umfang`,
      einheit: 'm',
      zeilen: b.waende.map((w) => ({ ...newZeile(), laenge: fmtPos(w.laenge), text: `Wand ${w.name}` })),
    },
  ];
  return out.map((p) => ({ ...p, raum: raum.id }));
}

// Daten fürs Repo (report.json): Geometrie plus berechnete Werte
export function raumJson(raum) {
  const b = berechne(raum);
  const r3 = (x) => rund(x, 1000);
  return {
    ...raum,
    berechnet: {
      bodenflaeche: r3(b.bodenflaeche),
      deckenflaeche: r3(b.deckenflaeche),
      umfang: r3(b.umfang),
      wandBrutto: r3(b.wandBrutto),
      tuerFlaeche: r3(b.tuerFlaeche),
      fensterFlaeche: r3(b.fensterFlaeche),
      wandNetto: r3(b.wandNetto),
      waende: b.waende.map((w) => ({ id: w.id, name: w.name, laenge: r3(w.laenge), richtung: rund(w.richtung, 100), mass: w.mass, flaeche: r3(w.flaeche), hoeheMin: r3(w.hoeheMin), hoeheMax: r3(w.hoeheMax) })),
      ...(b.mitSchraege ? {
        dachFlaeche: r3(b.dachFlaeche),
        dachfensterFlaeche: r3(b.dachfensterFlaeche),
        dachNetto: r3(b.dachNetto),
        schraegen: b.schraegen.map((e) => ({ wand: e.wand, name: e.wandName, kniestock: r3(e.kniestock), winkel: rund(e.winkel, 100), tiefe: r3(e.tiefe), laenge: r3(e.laenge), grundriss: r3(e.grundriss), flaeche: r3(e.flaeche) })),
      } : {}),
    },
  };
}

// ---------- Rückgängig / Wiederholen ----------

export class Verlauf {
  constructor(start, max = 100) {
    this.stapel = [kopie(start)];
    this.pos = 0;
    this.max = max;
  }
  get aktuell() { return kopie(this.stapel[this.pos]); }
  merken(zustand) {
    this.stapel = this.stapel.slice(0, this.pos + 1);
    this.stapel.push(kopie(zustand));
    if (this.stapel.length > this.max) this.stapel.shift();
    this.pos = this.stapel.length - 1;
  }
  get kannZurueck() { return this.pos > 0; }
  get kannVor() { return this.pos < this.stapel.length - 1; }
  zurueck() { if (this.kannZurueck) this.pos--; return this.aktuell; }
  vor() { if (this.kannVor) this.pos++; return this.aktuell; }
}

// ---------- Darstellung ----------

// Zeichen-Elemente des Grundrisses für Bildschirm, SVG und PDF. abb bildet Meter auf die
// Ausgabe ab, die Größen (Strichstärken, Abstände, Schrift) sind in Ausgabe-Einheiten.
// Elemente: { art: 'linie', a, b, breite, farbe, gestrichelt } · { art: 'bogen', m, r, von, bis, breite, farbe }
//           { art: 'text', p, text, groesse, winkel, fett, farbe, anker } · { art: 'flaeche', punkte, farbe }
export function planElemente(raum, abb, o = {}) {
  const g = {
    wand: 3, duenn: 1, schrift: 11, massAbstand: 20, farbe: '#1d232a', mass: '#3a4450', fest: '#0b57d0', flaeche: '#eef2f6',
    masse: true, namen: true, ungefaehr: !raum.massstabGesetzt, mitFlaeche: true, ...o,
  };
  const els = [];
  const p = punkteVon(raum);
  const n = p.length;
  if (!n) return els;
  const zu = geschlossen(raum);
  const P = p.map(abb);
  if (zu && g.mitFlaeche) els.push({ art: 'flaeche', punkte: P, farbe: g.flaeche });
  // Dachschrägen: Fläche dunkler, Knick- und Gratlinien gestrichelt, Neigung und Kniestock als Text
  const E = zu ? ebenen(raum) : [];
  if (E.length) {
    const amRand = (q) => p.some((a, i) => abstandZuStrecke(q, a, p[(i + 1) % n]).d < 1e-6);
    for (const e of dachBereiche(raum, E).schraegen) {
      if (e.poly.length < 3 || Math.abs(flaecheMitVorzeichen(e.poly)) < 1e-9) continue;
      if (g.mitFlaeche) els.push({ art: 'flaeche', punkte: e.poly.map(abb), farbe: g.schraege || '#dce4ee' });
      e.poly.forEach((a, k) => {
        const b = e.poly[(k + 1) % e.poly.length];
        if (abst(a, b) < 1e-6 || amRand(mul(add(a, b), 0.5))) return;
        els.push({ art: 'linie', a: abb(a), b: abb(b), breite: g.duenn, farbe: g.mass, gestrichelt: true });
      });
      // Beschriftung im Streifen vor der Wand, parallel zur Wand, neben den Dachfenstern
      const wg = wandGeo(raum, e.i);
      const m = add(add(wg.a, mul(wg.r, wg.l / 2)), mul(wg.innen, Math.min(freieTiefe(raum, e), wg.l)));
      if (punktInnen(m, e.poly)) {
        els.push({ art: 'text', p: abb(m), text: `Schräge ${fmtPos(Math.round(e.winkel * 10) / 10)}° · Kniestock ${fmt2(e.kniestock)}`, groesse: g.schrift * 0.72, winkel: lesbar(wg.r), farbe: g.mass, anker: 'mitte' });
      }
    }
    // Dachfenster als Rechteck im Grundriss (Länge in der Schräge waagerecht projiziert)
    for (const o of raum.dachfenster || []) {
      const qm = dachfensterEcken(raum, o);
      if (!qm) continue;
      const wg = wandGeo(raum, wandIndex(raum, o.wand));
      const q = qm.map(abb);
      q.forEach((a, k) => els.push({ art: 'linie', a, b: q[(k + 1) % 4], breite: g.duenn * 1.3, farbe: g.farbe }));
      els.push({ art: 'linie', a: q[0], b: q[2], breite: g.duenn * 0.7, farbe: g.mass });
      els.push({ art: 'linie', a: q[1], b: q[3], breite: g.duenn * 0.7, farbe: g.mass });
      const mt = mul(add(q[0], q[2]), 0.5);
      els.push({ art: 'text', p: add(mt, mul(einheit(sub(q[3], q[0])), Math.max(abst(q[0], q[3]) / 2 + g.schrift * 0.8, g.schrift))), text: `DF ${fmtPos(o.breite * 100)}/${fmtPos(o.laenge * 100)}`, groesse: g.schrift * 0.72, winkel: lesbar(wg.r), farbe: g.mass, anker: 'mitte' });
    }
  }
  // Wände mit Lücken für Öffnungen
  const wn = zu ? n : n - 1;
  for (let i = 0; i < wn; i++) {
    const wand = raum.waende[i];
    const ge = zu ? wandGeo(raum, i) : (() => { const a = p[i]; const b = p[i + 1]; return { a, b, l: abst(a, b), r: einheit(sub(b, a)), innen: einheit([-(b[1] - a[1]), b[0] - a[0]]) }; })();
    const luecken = (wand ? raum.oeffnungen.filter((x) => x.wand === wand.id) : []).map((x) => [x.abstand, x.abstand + x.breite]).sort((a, b) => a[0] - b[0]);
    let t = 0;
    for (const [von, bis] of [...luecken, [ge.l, ge.l]]) {
      if (von > t + 1e-6) els.push({ art: 'linie', a: abb(add(ge.a, mul(ge.r, t))), b: abb(add(ge.a, mul(ge.r, von))), breite: g.wand, farbe: g.farbe, rund: true });
      t = Math.max(t, bis);
    }
  }
  // Türen und Fenster
  for (const x of raum.oeffnungen) {
    const i = wandIndex(raum, x.wand);
    if (i < 0 || !zu) continue;
    const ge = wandGeo(raum, i);
    const A = add(ge.a, mul(ge.r, x.abstand));
    const B = add(ge.a, mul(ge.r, x.abstand + x.breite));
    const a = abb(A);
    const b = abb(B);
    const s = abst(a, b) / x.breite || 1; // Ausgabe-Einheiten je m
    const nOut = einheit(sub(abb(add(A, ge.innen)), a)); // nach innen, in Ausgabe-Koordinaten
    const quer = g.wand * 1.6;
    // Laibungsstriche
    for (const q of [a, b]) els.push({ art: 'linie', a: add(q, mul(nOut, -quer)), b: add(q, mul(nOut, quer)), breite: g.duenn * 1.4, farbe: g.farbe });
    if (x.typ === 'fenster') {
      for (const v of [-0.6, 0, 0.6]) els.push({ art: 'linie', a: add(a, mul(nOut, v * quer)), b: add(b, mul(nOut, v * quer)), breite: g.duenn, farbe: g.farbe });
    } else {
      const angel = x.anschlag === 'rechts' ? b : a;
      const zu2 = x.anschlag === 'rechts' ? a : b;
      const dir = x.richtung === 'aussen' ? mul(nOut, -1) : nOut;
      const blatt = add(angel, mul(dir, x.breite * s));
      els.push({ art: 'linie', a: angel, b: blatt, breite: g.duenn * 1.6, farbe: g.farbe });
      const w1 = Math.atan2(blatt[1] - angel[1], blatt[0] - angel[0]);
      const w2 = Math.atan2(zu2[1] - angel[1], zu2[0] - angel[0]);
      els.push({ art: 'bogen', m: angel, r: x.breite * s, von: w1, bis: w2, breite: g.duenn, farbe: g.mass, gestrichelt: true });
    }
    // Beschriftung innen
    const m = mul(add(a, b), 0.5);
    const tp = add(m, mul(nOut, x.typ === 'tuer' && x.richtung !== 'aussen' ? x.breite * s + g.schrift * 0.9 : g.schrift * 1.5));
    const txt = x.typ === 'tuer' ? `${fmtPos(x.breite * 100)}/${fmtPos(x.hoehe * 100)}` : `${fmtPos(x.breite * 100)}/${fmtPos(x.hoehe * 100)} Br ${fmtPos((x.bruestung || 0) * 100)}`;
    els.push({ art: 'text', p: tp, text: txt, groesse: g.schrift * 0.78, winkel: lesbar(sub(b, a)), farbe: g.mass, anker: 'mitte' });
  }
  // Maßketten außen an jeder Wand; Wände an einspringenden Ecken (Nische, L-Form) bekommen ihr
  // Maß innen, sonst kreuzen sich die Maßlinien in der Ecke
  if (g.masse === 'innen') {
    // Gesamtgrundriss: Maß nur als Zahl innen an der Wand, im längsten Stück ohne Öffnung
    for (let i = 0; i < wn; i++) {
      const ge = wandGeo(raum, i);
      if (ge.l < 1e-6) continue;
      const w = raum.waende[i];
      const luecken = raum.oeffnungen.filter((x) => x.wand === w.id).map((x) => [x.abstand, x.abstand + x.breite]).sort((a, b) => a[0] - b[0]);
      let frei = null;
      let t = 0;
      for (const [von, bis] of [...luecken, [ge.l, ge.l]]) {
        if (!frei || von - t > frei[1] - frei[0]) frei = [t, Math.max(t, von)];
        t = Math.max(t, bis);
      }
      const m = add(ge.a, mul(ge.r, (frei[0] + frei[1]) / 2));
      const a = abb(m);
      const nIn = einheit(sub(abb(add(m, ge.innen)), a));
      const fest = w?.mass != null;
      els.push({ art: 'text', p: add(a, mul(nIn, g.schrift * 0.8)), text: `${g.namen ? `${wandName(i)}: ` : ''}${g.ungefaehr ? '≈ ' : ''}${fmt2(ge.l)}`, groesse: g.schrift * 0.85, winkel: lesbar(sub(abb(ge.b), abb(ge.a))), fett: fest, farbe: fest ? g.fest : g.mass, anker: 'mitte', wand: w?.id });
    }
  } else if (g.masse) {
    const einspringend = p.map((q, i) => zu && kreuz(sub(q, p[(i - 1 + n) % n]), sub(p[(i + 1) % n], q)) < -1e-9);
    for (let i = 0; i < wn; i++) {
      const a = P[i];
      const b = P[(i + 1) % n];
      const lw = abst(a, b);
      if (lw < 1e-6) continue;
      const r = einheit(sub(b, a));
      // außen = links der Laufrichtung (im Uhrzeigersinn)
      const innen = einspringend[i] || einspringend[(i + 1) % n];
      const aus = mul(einheit([r[1], -r[0]]), innen ? -1 : 1);
      const off = mul(aus, g.massAbstand);
      const a2 = add(a, off);
      const b2 = add(b, off);
      els.push({ art: 'linie', a: a2, b: b2, breite: g.duenn, farbe: g.mass });
      for (const [q, q2] of [[a, a2], [b, b2]]) {
        els.push({ art: 'linie', a: add(q, mul(aus, g.massAbstand * 0.25)), b: add(q2, mul(aus, g.massAbstand * 0.2)), breite: g.duenn * 0.7, farbe: g.mass });
        const tick = mul(einheit(add(r, aus)), g.massAbstand * 0.22);
        els.push({ art: 'linie', a: sub(q2, tick), b: add(q2, tick), breite: g.duenn * 1.3, farbe: g.mass });
      }
      const w = raum.waende[i];
      const lm = zu ? wandGeo(raum, i).l : abst(p[i], p[i + 1]);
      const fest = w?.mass != null;
      const txt = `${g.namen ? `${wandName(i)}: ` : ''}${g.ungefaehr ? '≈ ' : ''}${fmt2(lm)}`;
      els.push({ art: 'text', p: add(mul(add(a2, b2), 0.5), mul(aus, g.schrift * 0.55)), text: txt, groesse: g.schrift, winkel: lesbar(r), fett: fest, farbe: fest ? g.fest : g.mass, anker: 'mitte', wand: w?.id });
    }
  }
  // Raumname und Fläche in der Mitte
  if (zu && g.mitFlaeche) {
    const b = berechne(raum);
    const c = schwerpunkt(p);
    const cp = abb(innenPunkt(p, c));
    els.push({ art: 'text', p: [cp[0], cp[1] - g.schrift * 0.7], text: raum.name || 'Raum', groesse: g.schrift * 1.15, fett: true, farbe: g.farbe, anker: 'mitte', winkel: 0 });
    els.push({ art: 'text', p: [cp[0], cp[1] + g.schrift * 0.75], text: `${g.ungefaehr ? '≈ ' : ''}${fmt2(b.bodenflaeche)} m²`, groesse: g.schrift, farbe: g.mass, anker: 'mitte', winkel: 0 });
  }
  return els;
}

// Abstand von der Wand für die Beschriftung einer Schräge: Mitte des breitesten Streifens ohne
// Dachfenster (die Fenster liegen meist mitten in der Schräge)
function freieTiefe(raum, e) {
  const belegt = (raum.dachfenster || []).filter((o) => o.wand === e.wand)
    .map((o) => [o.unten / e.faktor - 0.05, (o.unten + o.laenge) / e.faktor + 0.05]).sort((a, b) => a[0] - b[0]);
  let best = null;
  let t = 0;
  for (const [von, bis] of [...belegt, [e.tiefe, e.tiefe]]) {
    const a = Math.max(0, t);
    const b = Math.min(von, e.tiefe);
    if (b > a && (!best || b - a > best[1] - best[0])) best = [a, b];
    t = Math.max(t, bis);
  }
  return best ? (best[0] + best[1]) / 2 : e.tiefe / 2;
}

// Text immer von links lesbar
function lesbar(r) {
  let w = (Math.atan2(r[1], r[0]) * 180) / Math.PI;
  if (w > 90.01) w -= 180;
  if (w <= -90.01) w += 180;
  return w;
}

function schwerpunkt(p) {
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) return p[0];
  return [cx / (3 * a), cy / (3 * a)];
}

export function punktInnen([x, y], poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

// Bei L- oder U-Form liegt der Schwerpunkt evtl. außerhalb: dann die Mitte des breitesten Stücks
// einer waagerechten Linie durch den Raum nehmen.
function innenPunkt(p, c) {
  if (punktInnen(c, p)) return c;
  const ys = p.map((q) => q[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  let best = c;
  let breit = -1;
  for (let k = 1; k < 20; k++) {
    const y = min + ((max - min) * k) / 20;
    const xs = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((u, v) => u - v);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > breit) { breit = xs[i + 1] - xs[i]; best = [(xs[i] + xs[i + 1]) / 2, y]; }
    }
  }
  return best;
}

const escX = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Zeichen-Elemente → SVG-Markup
export function elementeAlsSvg(els) {
  const f = (n) => Math.round(n * 100) / 100;
  return els.map((e) => {
    if (e.art === 'flaeche') return `<polygon points="${e.punkte.map((q) => `${f(q[0])},${f(q[1])}`).join(' ')}" fill="${e.farbe}"/>`;
    if (e.art === 'linie') return `<line x1="${f(e.a[0])}" y1="${f(e.a[1])}" x2="${f(e.b[0])}" y2="${f(e.b[1])}" stroke="${e.farbe}" stroke-width="${f(e.breite)}"${e.rund ? ' stroke-linecap="round"' : ''}${e.gestrichelt ? ` stroke-dasharray="${f(e.breite * 4)} ${f(e.breite * 3)}"` : ''}/>`;
    if (e.art === 'bogen') {
      const s = [e.m[0] + e.r * Math.cos(e.von), e.m[1] + e.r * Math.sin(e.von)];
      const z = [e.m[0] + e.r * Math.cos(e.bis), e.m[1] + e.r * Math.sin(e.bis)];
      let d = e.bis - e.von;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      return `<path d="M${f(s[0])} ${f(s[1])} A${f(e.r)} ${f(e.r)} 0 0 ${d > 0 ? 1 : 0} ${f(z[0])} ${f(z[1])}" fill="none" stroke="${e.farbe}" stroke-width="${f(e.breite)}"${e.gestrichelt ? ` stroke-dasharray="${f(e.breite * 4)} ${f(e.breite * 3)}"` : ''}/>`;
    }
    if (e.art === 'text') {
      return `<text x="${f(e.p[0])}" y="${f(e.p[1])}" font-size="${f(e.groesse)}" font-family="Helvetica, Arial, sans-serif" fill="${e.farbe}" text-anchor="middle" dominant-baseline="central"${e.fett ? ' font-weight="700"' : ''}${e.winkel ? ` transform="rotate(${f(e.winkel)} ${f(e.p[0])} ${f(e.p[1])})"` : ''}>${escX(e.text)}</text>`;
    }
    return '';
  }).join('');
}

// Rahmen aller Ecken in Metern
export function grenzen(raum) {
  const p = Array.isArray(raum) ? raum.flatMap(punkteVon) : punkteVon(raum);
  if (!p.length) return null;
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Größter üblicher Maßstab, bei dem der Raum (oder eine Liste von Räumen) auf eine A4-Seite
// (ca. 170 × 150 mm) passt
export function massstabFuer(raum, breiteMm = 170, hoeheMm = 150) {
  const g = grenzen(raum);
  if (!g) return 50;
  const w = g.x1 - g.x0 + 1;
  const h = g.y1 - g.y0 + 1;
  for (const m of [20, 25, 50, 75, 100, 200, 250, 500]) if ((w * 1000) / m <= breiteMm && (h * 1000) / m <= hoeheMm) return m;
  return 1000;
}

// Zeichen-Elemente für mehrere Räume eines Grundrisses (Maße innen an den Wänden)
export function gruppeElemente(raeume, abb, o = {}) {
  return raeume.flatMap((r) => planElemente(r, abb, { namen: false, ...o, masse: o.masse === false ? false : 'innen' }));
}

// Maßstäbliches SVG (Einheit mm auf dem Papier), z. B. 1:50. Mit einer Liste von Räumen: Grundriss gesamt.
export function alsSvg(raum, massstab = 50) {
  const liste = Array.isArray(raum) ? raum : [raum];
  const gr = grenzen(liste);
  const s = 1000 / massstab; // mm Papier je m
  const rand = 18;
  const w = (gr.x1 - gr.x0) * s + 2 * rand;
  const h = (gr.y1 - gr.y0) * s + 2 * rand + 12;
  const abb = ([x, y]) => [rand + (x - gr.x0) * s, rand + (y - gr.y0) * s];
  const o = { wand: 0.6, duenn: 0.18, schrift: 2.6, massAbstand: 6 };
  const els = liste.length > 1 ? gruppeElemente(liste, abb, o) : planElemente(liste[0], abb, o);
  const titel = liste.length > 1 ? `Grundriss gesamt (${liste.map((r) => r.name || 'Raum').join(', ')})` : (liste[0].name || 'Raum');
  const r = (n) => Math.round(n * 100) / 100;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${r(w)}mm" height="${r(h)}mm" viewBox="0 0 ${r(w)} ${r(h)}">
<rect width="100%" height="100%" fill="#fff"/>
${elementeAlsSvg(els)}
<text x="${rand}" y="${r(h - 5)}" font-size="2.6" font-family="Helvetica, Arial, sans-serif" fill="#3a4450">${escX(titel)} · Maßstab 1:${massstab} · Maße in m</text>
</svg>`;
}

// DXF (AutoCAD R12, Einheit mm, y nach oben) für CAD-Programme; auch für eine Liste von Räumen
export function alsDxf(raum) {
  const z = [];
  for (const r of Array.isArray(raum) ? raum : [raum]) dxfRaum(r, z);
  return ['0', 'SECTION', '2', 'ENTITIES', ...z.map(String), '0', 'ENDSEC', '0', 'EOF', ''].join('\n');
}

function dxfRaum(raum, z) {
  const pt = ([x, y], c = 10) => [c, (x * 1000).toFixed(1), c + 10, (-y * 1000).toFixed(1), c + 20, '0.0'];
  const linie = (a, b, layer) => z.push(0, 'LINE', 8, layer, ...pt(a, 10), ...pt(b, 11));
  const text = (p, t, hoehe, layer) => z.push(0, 'TEXT', 8, layer, ...pt(p, 10), 40, hoehe.toFixed(1), 1, t.replace(/[^\x20-\x7e]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss', '²': '2', '×': 'x' }[c] || '?')));
  const n = raum.ecken.length;
  raum.waende.forEach((w, i) => {
    const g = wandGeo(raum, i);
    const luecken = raum.oeffnungen.filter((o) => o.wand === w.id).map((o) => [o.abstand, o.abstand + o.breite]).sort((a, b) => a[0] - b[0]);
    let t = 0;
    for (const [von, bis] of [...luecken, [g.l, g.l]]) {
      if (von > t + 1e-6) linie(add(g.a, mul(g.r, t)), add(g.a, mul(g.r, von)), 'WAENDE');
      t = Math.max(t, bis);
    }
    text(add(mul(add(g.a, g.b), 0.5), mul(g.innen, -0.25)), `${wandName(i)} ${fmt2(g.l)}`, 120, 'MASSE');
  });
  for (const o of raum.oeffnungen) {
    const i = wandIndex(raum, o.wand);
    if (i < 0) continue;
    const g = wandGeo(raum, i);
    const A = add(g.a, mul(g.r, o.abstand));
    const B = add(g.a, mul(g.r, o.abstand + o.breite));
    if (o.typ === 'fenster') {
      linie(A, B, 'FENSTER');
      linie(add(A, mul(g.innen, 0.05)), add(B, mul(g.innen, 0.05)), 'FENSTER');
    } else {
      const angel = o.anschlag === 'rechts' ? B : A;
      const dir = o.richtung === 'aussen' ? mul(g.innen, -1) : g.innen;
      linie(angel, add(angel, mul(dir, o.breite)), 'TUEREN');
    }
    text(add(mul(add(A, B), 0.5), mul(g.innen, 0.3)), `${o.name} ${fmt2(o.breite)}x${fmt2(o.hoehe)}`, 100, o.typ === 'tuer' ? 'TUEREN' : 'FENSTER');
  }
  // Dachschrägen: Knick- und Gratlinien, Dachfenster
  const E = n >= 3 ? ebenen(raum) : [];
  if (E.length) {
    const p = punkteVon(raum);
    const amRand = (q) => p.some((a, i) => abstandZuStrecke(q, a, p[(i + 1) % n]).d < 1e-6);
    for (const e of dachBereiche(raum, E).schraegen) {
      e.poly.forEach((a, k) => {
        const b = e.poly[(k + 1) % e.poly.length];
        if (abst(a, b) > 1e-6 && !amRand(mul(add(a, b), 0.5))) linie(a, b, 'DACHSCHRAEGE');
      });
      const g = wandGeo(raum, e.i);
      text(add(add(g.a, mul(g.r, g.l / 2)), mul(g.innen, Math.min(e.tiefe / 2, g.l))), `Schraege ${fmt2(e.winkel)} Grad, Kniestock ${fmt2(e.kniestock)}`, 100, 'DACHSCHRAEGE');
    }
    for (const o of raum.dachfenster || []) {
      const q = dachfensterEcken(raum, o);
      if (!q) continue;
      q.forEach((a, k) => linie(a, q[(k + 1) % 4], 'DACHFENSTER'));
      text(mul(add(q[0], q[2]), 0.5), `${o.name} ${fmt2(o.breite)}x${fmt2(o.laenge)}`, 80, 'DACHFENSTER');
    }
  }
  if (n >= 3) {
    const b = berechne(raum);
    const c = innenPunkt(punkteVon(raum), schwerpunkt(punkteVon(raum)));
    text(c, `${raum.name || 'Raum'} ${fmt2(b.bodenflaeche)} m2`, 150, 'TEXT');
  }
}


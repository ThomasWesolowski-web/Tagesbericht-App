// Tests für den Rechenteil des Raumaufmaßes: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerRaum, raumAusEcken, berechne, erkenneKontur, setzeMass, konfliktLoesen, verschiebeWand, verschiebeEcke,
  teileWand, loescheWand, loescheEcke, richtenAus, neueOeffnung, aendereOeffnung, pruefe, alsPositionen, Verlauf,
  laengeLesen, wandGeo, alsSvg, alsDxf, raumJson, douglasPeucker, punkteVon,
} from '../raumgeometrie.js';
import { positionSumme } from '../report.js';

const nah = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, ist ${a}`);

// Raum mit Maßstab aus Ecken in Metern
function raum(ecken, felder = {}) {
  const r = raumAusEcken(neuerRaum(1), ecken);
  return { ...r, massstabGesetzt: true, ...felder };
}

// Gleichmäßig verteilte „Handpunkte“ entlang eines Linienzugs, mit Zittern (fester Zufall)
function handzeichnung(ecken, { zittern = 0.03, schritt = 0.05, drehung = 0, rundung = 0.15, luecke = 0.1 } = {}) {
  let s = 12345;
  const zufall = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 - 0.5; };
  const c = Math.cos((drehung * Math.PI) / 180);
  const si = Math.sin((drehung * Math.PI) / 180);
  const pts = [];
  const zug = [...ecken, ecken[0]];
  for (let i = 0; i < zug.length - 1; i++) {
    const [ax, ay] = zug[i];
    const [bx, by] = zug[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < l; t += schritt) {
      // runde Ecken: die ersten/letzten cm abschneiden
      if (i > 0 && t < rundung) continue;
      if (t > l - rundung && i < zug.length - 2) continue;
      if (i === zug.length - 2 && t > l - luecke) continue;
      pts.push([ax + ((bx - ax) * t) / l + zufall() * zittern, ay + ((by - ay) * t) / l + zufall() * zittern]);
    }
  }
  return pts.map(([x, y]) => [x * c - y * si, x * si + y * c]);
}

test('1 Rechteck 5,00 × 4,00 m = 20,00 m²', () => {
  const b = berechne(raum([[0, 0], [5, 0], [5, 4], [0, 4]], { hoehe: 2.5 }));
  nah(b.bodenflaeche, 20);
  nah(b.deckenflaeche, 20);
  nah(b.umfang, 18);
  nah(b.wandBrutto, 45);
  nah(b.wandNetto, 45);
  assert.equal(b.rechteckig, true);
});

test('2 L-förmiger Raum', () => {
  // 6 × 4 m, rechts unten 2 × 1,5 m ausgespart
  const b = berechne(raum([[0, 0], [6, 0], [6, 2.5], [4, 2.5], [4, 4], [0, 4]]));
  nah(b.bodenflaeche, 24 - 3);
  nah(b.umfang, 20);
  assert.equal(b.waende.length, 6);
  assert.equal(b.rechteckig, false);
  b.winkel.forEach((w) => assert.ok([90, 270].some((z) => Math.abs(w - z) < 1e-6)));
});

test('3 Raum mit schräger Wand', () => {
  // Trapez: oben 4 m, unten 6 m, Höhe 3 m, rechte Wand schräg
  const b = berechne(raum([[0, 0], [4, 0], [6, 3], [0, 3]]));
  nah(b.bodenflaeche, 15);
  nah(b.umfang, 4 + Math.hypot(2, 3) + 6 + 3);
});

test('4 Raum mit Tür', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]], { hoehe: 2.5 });
  const t = neueOeffnung(r, 'tuer', r.waende[2].id, 2.5);
  r = aendereOeffnung(t.raum, t.oeffnung, { breite: 0.9, hoehe: 2 }).raum;
  const b = berechne(r);
  nah(b.tuerFlaeche, 1.8);
  nah(b.wandNetto, 45 - 1.8);
  nah(r.oeffnungen[0].abstand, 2.5 - 0.885 / 2);
  assert.deepEqual(pruefe(r).fehler, []);
});

test('5 Raum mit mehreren Fenstern', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]], { hoehe: 2.6 });
  for (const [w, m] of [[0, 1.5], [0, 3.8], [1, 2]]) {
    const f = neueOeffnung(r, 'fenster', r.waende[w].id, m);
    r = f.raum;
  }
  const b = berechne(r);
  nah(b.fensterFlaeche, 3 * 1.2 * 1.2);
  nah(b.wandNetto, 18 * 2.6 - 3 * 1.44);
  assert.equal(b.oeffnungen.length, 3);
  // VOB: Fenster ≤ 2,5 m² werden übermessen
  const v = berechne({ ...r, einstellungen: { ...r.einstellungen, abzug: 'vob' } });
  nah(v.wandNetto, 18 * 2.6);
  // Fenster ragt nicht über die Raumhöhe: keine Warnung
  assert.deepEqual(pruefe(r).fehler, []);
});

test('6 Freihandzeichnung mit ungenauen Linien → saubere L-Form', () => {
  const soll = [[0, 0], [6, 0], [6, 2.5], [4, 2.5], [4, 4], [0, 4]];
  const pts = handzeichnung(soll, { drehung: 3, zittern: 0.04 });
  const e = erkenneKontur(pts, { pxProEinheit: 60 });
  assert.ok(e, 'nichts erkannt');
  assert.equal(e.geschlossen, true);
  assert.equal(e.ecken.length, 6);
  assert.ok(e.arten.every((a) => a === 'waagerecht' || a === 'senkrecht'), e.arten.join());
  const r = raumAusEcken(neuerRaum(1), e.ecken);
  const b = berechne(r);
  b.winkel.forEach((w) => assert.ok([90, 270].some((z) => Math.abs(w - z) < 1e-6), `Winkel ${w}`));
  nah(b.bodenflaeche, 21, 0.6);
  // Wände wirklich exakt waagerecht/senkrecht
  for (let i = 0; i < r.ecken.length; i++) {
    const g = wandGeo(r, i);
    assert.ok(Math.abs(g.r[0]) < 1e-9 || Math.abs(g.r[1]) < 1e-9);
  }
});

test('6b Linie bei ungefähr 88° wird senkrecht, echte Schräge bleibt schräg', () => {
  const steil = [];
  for (let t = 0; t <= 3; t += 0.05) steil.push([t * Math.cos((88 * Math.PI) / 180), t * Math.sin((88 * Math.PI) / 180)]);
  const e = erkenneKontur(steil, { pxProEinheit: 60 });
  assert.equal(e.ecken.length, 2);
  nah(e.ecken[0][0], e.ecken[1][0], 1e-9, 'x gleich');
  assert.equal(e.arten[0], 'senkrecht');
  // Trapez mit schräger Wand (≈ 56°) bleibt schräg
  const pts = handzeichnung([[0, 0], [4, 0], [6, 3], [0, 3]], { zittern: 0.02 });
  const t = erkenneKontur(pts, { pxProEinheit: 60 });
  assert.equal(t.ecken.length, 4);
  assert.ok(t.arten.includes('schraeg'));
  nah(berechne(raumAusEcken(neuerRaum(1), t.ecken)).bodenflaeche, 15, 0.4);
});

test('6c offene Kontur wird nicht von selbst geschlossen, auf Wunsch schon', () => {
  const offen = handzeichnung([[0, 0], [5, 0], [5, 4], [0, 4]], { luecke: 2 });
  const e = erkenneKontur(offen, { pxProEinheit: 60 });
  assert.equal(e.geschlossen, false);
  assert.equal(e.schliessbar, true);
  const z = erkenneKontur(offen, { pxProEinheit: 60, schliessen: true });
  assert.equal(z.geschlossen, true);
  assert.equal(z.ecken.length, 4);
});

test('Douglas-Peucker behält Ecken', () => {
  const p = [[0, 0], [1, 0.01], [2, 0], [2, 1], [2.01, 2]];
  assert.deepEqual(douglasPeucker(p, 0.05), [0, 2, 4]);
});

test('7 Maßstab anhand einer Referenzwand', () => {
  // gezeichnet 542 Einheiten breit, 380 hoch
  let r = raumAusEcken(neuerRaum(1), [[0, 0], [542, 0], [542, 380], [0, 380]]);
  const m = setzeMass(r, r.waende[0].id, 5.42);
  r = m.raum;
  nah(m.skaliert, 0.01);
  assert.equal(r.massstabGesetzt, true);
  nah(wandGeo(r, 0).l, 5.42);
  nah(wandGeo(r, 1).l, 3.8);
  nah(berechne(r).bodenflaeche, 5.42 * 3.8);
  assert.equal(r.waende[0].mass, 5.42);
});

test('8 Wandlänge ändern: gegenüberliegende Wand gleicht aus', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r.waende[0].mass = 5;
  r = setzeMass(r, r.waende[1].id, 3.5).raum;
  nah(wandGeo(r, 1).l, 3.5);
  nah(wandGeo(r, 3).l, 3.5);
  nah(wandGeo(r, 0).l, 5);
  nah(berechne(r).bodenflaeche, 17.5);
  // L-Form: obere Wand länger → nächste waagerechte Wand ohne Maß gleicht aus, Winkel bleiben
  let l = raum([[0, 0], [6, 0], [6, 2.5], [4, 2.5], [4, 4], [0, 4]]);
  l = setzeMass(l, l.waende[0].id, 6.5).raum;
  nah(wandGeo(l, 0).l, 6.5);
  berechne(l).winkel.forEach((w) => assert.ok([90, 270].some((z) => Math.abs(w - z) < 1e-6)));
  assert.deepEqual(pruefe(l).fehler, []);
});

test('9 widersprüchliche Maße werden gemeldet, nicht still übernommen', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r = setzeMass(r, r.waende[0].id, 5).raum;
  r = setzeMass(r, r.waende[1].id, 4).raum;
  r = setzeMass(r, r.waende[3].id, 4).raum;
  const k = setzeMass(r, r.waende[2].id, 5.3);
  assert.ok(k.konflikt, 'Konflikt erwartet');
  assert.deepEqual(k.konflikt.gegen, [r.waende[0].id]);
  // Maß 1 (neu) verwenden: obere Wand verliert ihr Maß
  const neu = konfliktLoesen(r, k.konflikt, 'neu').raum;
  nah(wandGeo(neu, 2).l, 5.3);
  nah(wandGeo(neu, 0).l, 5.3);
  assert.equal(neu.waende[0].mass, null);
  // Maß 2 (alt) verwenden: nichts ändert sich
  const alt = konfliktLoesen(r, k.konflikt, 'alt').raum;
  nah(wandGeo(alt, 2).l, 5);
  // Geometrie anpassen geht hier nicht (alle Wände haben ein Maß)
  assert.equal(k.konflikt.geometrieMoeglich, false);
  // Mit einer Wand ohne Maß: Geometrie anpassen macht sie schräg, alle Maße stimmen
  let s = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  s = setzeMass(s, s.waende[0].id, 5).raum;
  s = setzeMass(s, s.waende[3].id, 4).raum;
  const k2 = setzeMass(s, s.waende[2].id, 5.3);
  assert.ok(k2.konflikt);
  assert.equal(k2.konflikt.geometrieMoeglich, true);
  const g = konfliktLoesen(s, k2.konflikt, 'geometrie');
  nah(wandGeo(g.raum, 0).l, 5);
  nah(wandGeo(g.raum, 2).l, 5.3);
  nah(wandGeo(g.raum, 3).l, 4);
  assert.equal(g.schraeg, s.waende[1].id);
  assert.deepEqual(pruefe(g.raum).fehler, []);
});

test('10 Wand verschieben, Ecke verschieben, Wand teilen/löschen, ausrichten', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r = verschiebeWand(r, r.waende[1].id, 1).raum; // rechte Wand 1 m nach außen
  nah(berechne(r).bodenflaeche, 24);
  const t = teileWand(r, r.waende[0].id);
  assert.equal(t.raum.ecken.length, 5);
  r = verschiebeEcke(t.raum, t.neueEcke, [3, -1]).raum; // Spitze nach oben
  nah(berechne(r).bodenflaeche, 24 + 3);
  r = loescheEcke(r, r.ecken[1].id).raum;
  nah(berechne(r).bodenflaeche, 24);
  // schiefe Wand ausrichten
  let s = raum([[0, 0], [5, 0.2], [5, 4], [0, 4]]);
  s = richtenAus(s, s.waende[0].id, 'waagerecht').raum;
  nah(wandGeo(s, 0).r[1], 0);
  // Wand löschen: Nachbarn treffen sich (Dreieck aus Trapez)
  const tr = raum([[0, 0], [4, 0], [6, 3], [0, 3]]);
  const d = loescheWand(tr, tr.waende[0].id);
  assert.equal(d.raum.ecken.length, 3);
  // Überkreuzen wird abgelehnt
  const x = verschiebeWand(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), raum([[0, 0], [5, 0], [5, 4], [0, 4]]).waende[1].id, -6);
  assert.ok(x.fehler);
});

test('11 Öffnungen bleiben an ihrer Stelle, wenn die Wand sich ändert', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r = neueOeffnung(r, 'tuer', r.waende[0].id, 1).raum;
  const t = teileWand(r, r.waende[0].id, 0.8);
  // Tür liegt bei x 0,56…1,44 → bleibt auf dem ersten Teil
  assert.equal(t.raum.oeffnungen[0].wand, r.waende[0].id);
  nah(t.raum.oeffnungen[0].abstand, 1 - 0.885 / 2);
  // linke Wand nach außen: Tür bleibt bei x = 0,5575 im Raum (Abstand ab neuer Ecke größer)
  const v = verschiebeWand(r, r.waende[3].id, 1).raum;
  nah(v.oeffnungen[0].abstand, 1 - 0.885 / 2 + 1);
});

test('12 Rückgängig / Wiederholen', () => {
  const r0 = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  const v = new Verlauf({ raum: r0 });
  const r1 = verschiebeWand(r0, r0.waende[1].id, 1).raum;
  v.merken({ raum: r1 });
  const r2 = neueOeffnung(r1, 'fenster', r1.waende[0].id, 2).raum;
  v.merken({ raum: r2 });
  assert.equal(v.zurueck().raum.oeffnungen.length, 0);
  nah(berechne(v.zurueck().raum).bodenflaeche, 20);
  assert.equal(v.kannZurueck, false);
  nah(berechne(v.vor().raum).bodenflaeche, 24);
  assert.equal(v.vor().raum.oeffnungen.length, 1);
  assert.equal(v.kannVor, false);
  // neuer Schritt nach Rückgängig verwirft den Rest
  v.zurueck();
  v.merken({ raum: r0 });
  assert.equal(v.kannVor, false);
});

test('13 Speichern und erneut öffnen (JSON hin und zurück)', () => {
  let r = raum([[0, 0], [6, 0], [6, 2.5], [4, 2.5], [4, 4], [0, 4]], { hoehe: 2.62, name: 'Wohnzimmer' });
  r = setzeMass(r, r.waende[0].id, 6).raum;
  r = neueOeffnung(r, 'tuer', r.waende[5].id, 2).raum;
  const text = JSON.stringify({ raeume: [raumJson(r)] });
  const zurueck = JSON.parse(text).raeume[0];
  assert.deepEqual(punkteVon(zurueck), punkteVon(r));
  assert.deepEqual(zurueck.oeffnungen, r.oeffnungen);
  assert.equal(zurueck.hoehe, 2.62);
  const a = berechne(r);
  const b = berechne(zurueck);
  nah(b.wandNetto, a.wandNetto);
  nah(zurueck.berechnet.bodenflaeche, 21);
});

test('14 Prüfung findet Fehler verständlich', () => {
  const offen = { ...neuerRaum(1), ecken: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }], waende: [{ id: 'w', von: 'a', bis: 'b' }] };
  assert.match(pruefe(offen).fehler[0], /nicht geschlossen/);
  const kreuz = raum([[0, 0], [4, 4], [4, 0], [0, 4]]);
  assert.ok(pruefe(kreuz).fehler.some((f) => /überkreuzen/.test(f)));
  const ohneMass = raumAusEcken(neuerRaum(1), [[0, 0], [5, 0], [5, 4], [0, 4]]);
  assert.ok(pruefe(ohneMass).fehler.some((f) => /echtes Maß/.test(f)));
  let tuerZuBreit = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  tuerZuBreit = neueOeffnung(tuerZuBreit, 'tuer', tuerZuBreit.waende[0].id, 1).raum;
  assert.ok(aendereOeffnung(tuerZuBreit, tuerZuBreit.oeffnungen[0].id, { breite: 6 }).fehler);
});

test('15 Positionen fürs Aufmaß stimmen mit der Berechnung überein', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]], { hoehe: 2.5, name: 'Bad' });
  r = neueOeffnung(r, 'tuer', r.waende[2].id, 2.5).raum;
  r = neueOeffnung(r, 'fenster', r.waende[0].id, 2.5).raum;
  const pos = alsPositionen(r);
  assert.deepEqual(pos.map((p) => p.bezeichnung), ['Bad: Bodenfläche', 'Bad: Deckenfläche', 'Bad: Wandfläche', 'Bad: Umfang']);
  nah(positionSumme(pos[0]).netto, 20, 1e-9);
  nah(positionSumme(pos[2]).netto, 45 - 0.885 * 2.01 - 1.44, 0.0005);
  nah(positionSumme(pos[3]).netto, 18, 1e-9);
  assert.ok(pos.every((p) => p.raum === r.id));
});

test('16 Export SVG und DXF aus denselben Daten', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]], { name: 'Küche' });
  r = neueOeffnung(r, 'tuer', r.waende[2].id, 2.5).raum;
  const svg = alsSvg(r, 50);
  assert.match(svg, /width="136mm"/); // 5 m bei 1:50 = 100 mm + 2 × 18 mm Rand
  assert.match(svg, /Maßstab 1:50/);
  assert.match(svg, /5,00/);
  const dxf = alsDxf(r);
  assert.match(dxf, /^0\nSECTION\n2\nENTITIES/);
  assert.match(dxf, /LINE/);
  assert.match(dxf, /\n5000\.0\n/);
  assert.match(dxf, /Kueche/);
});

test('Längeneingabe', () => {
  assert.equal(laengeLesen('5,42'), 5.42);
  assert.equal(laengeLesen('5.42 m'), 5.42);
  assert.equal(laengeLesen('542 cm'), 5.42);
  assert.equal(laengeLesen('5420mm'), 5.42);
  assert.equal(laengeLesen('abc'), null);
  assert.equal(laengeLesen('0'), null);
});

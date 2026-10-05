// Tests für mehrere Räume in einem Grundriss (Teilen, Anbauen, Andocken): node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerRaum, raumAusEcken, berechne, teileRaum, raumAnbauen, andocken, verschiebeRaum, ueberschneiden,
  pruefeGruppe, pruefe, neueOeffnung, alsSvg, alsDxf, massstabFuer, naechsterName, wandGeo, setzeMass, punkteVon,
} from '../raumgeometrie.js';

const nah = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, ist ${a}`);

function raum(ecken, felder = {}) {
  const r = raumAusEcken(neuerRaum(1), ecken);
  return { ...r, massstabGesetzt: true, hoehe: 2.5, ...felder };
}

test('Rechteck teilen: Trennwand geht von beiden Räumen ab', () => {
  let r = raum([[0, 0], [6, 0], [6, 4], [0, 4]]);
  r.waende.forEach((w, i) => { w.mass = wandGeo(r, i).l; });
  r = neueOeffnung(r, 'tuer', r.waende[2].id, 5).raum; // Wand C (unten) bei x = 1 → neuer Raum
  r = neueOeffnung(r, 'fenster', r.waende[1].id, 2).raum; // Wand B rechts → bleibt
  const erg = teileRaum(r, r.waende[0].id, 2 + 0.115 / 2, { name: 'Bad' });
  assert.ok(!erg.fehler, erg.fehler);
  const a = berechne(erg.raum);
  const b = berechne(erg.neu);
  nah(a.bodenflaeche, 3.885 * 4, 1e-9, 'Rest');
  nah(b.bodenflaeche, 2 * 4, 1e-9, 'neuer Raum');
  nah(a.bodenflaeche + b.bodenflaeche + 0.115 * 4, 24, 1e-9, 'zusammen mit Trennwand');
  assert.equal(erg.raum.id, r.id, 'Raum behält seine ID');
  assert.notEqual(erg.neu.id, r.id);
  assert.equal(erg.neu.name, 'Bad');
  assert.ok(erg.raum.gruppe && erg.raum.gruppe === erg.neu.gruppe, 'gemeinsamer Grundriss');
  assert.equal(erg.raum.oeffnungen.length, 1);
  assert.equal(erg.raum.oeffnungen[0].typ, 'fenster');
  assert.equal(erg.neu.oeffnungen.length, 1);
  assert.equal(erg.neu.oeffnungen[0].typ, 'tuer');
  // Maße: geteilte Wände verlieren ihr Maß, ungeteilte behalten es
  assert.deepEqual(pruefe(erg.raum).fehler, []);
  assert.deepEqual(pruefe(erg.neu).fehler, []);
  assert.ok(erg.raum.waende.some((w) => w.mass === 4), 'Wand B behält 4,00');
  assert.ok(erg.neu.waende.some((w) => w.mass === 4), 'Wand D behält 4,00');
  assert.equal(ueberschneiden(erg.raum, erg.neu), false);
  assert.deepEqual(pruefeGruppe([erg.raum, erg.neu]), []);
});

test('L-Form teilen: Trennwand bis zur nächsten Wand', () => {
  // L: 6 breit, links 5 tief, rechts nur 3 tief
  const r = raum([[0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]]);
  const erg = teileRaum(r, r.waende[0].id, 3, { staerke: 0 });
  assert.ok(!erg.fehler, erg.fehler);
  nah(berechne(erg.raum).bodenflaeche, 9, 1e-9);
  nah(berechne(erg.neu).bodenflaeche, 15, 1e-9);
  // Teilen an der Ecke geht nicht
  assert.match(teileRaum(r, r.waende[0].id, 0.02).fehler, /ganz auf Wand A/);
});

test('Raum anbauen und andocken', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r.waende[1].mass = 4;
  const erg = raumAnbauen(r, r.waende[1].id, { tiefe: 3, tiefeGemessen: true, name: 'Küche' });
  assert.ok(!erg.fehler, erg.fehler);
  const k = erg.neu;
  nah(berechne(k).bodenflaeche, 12, 1e-9);
  const xs = punkteVon(k).map((p) => p[0]);
  nah(Math.min(...xs), 5.115, 1e-9, 'Trennwand 11,5 cm');
  nah(Math.max(...xs), 8.115, 1e-9);
  assert.equal(k.waende[0].mass, 4, 'gemeinsame Wand gemessen');
  assert.equal(k.waende[1].mass, 3, 'Tiefe gemessen');
  assert.equal(erg.raum.gruppe, k.gruppe);
  assert.equal(k.name, 'Küche');
  assert.equal(ueberschneiden(erg.raum, k), false);
  // Maß am neuen Raum ändern geht wie gewohnt
  assert.ok(!setzeMass(k, k.waende[1].id, 3.5).fehler);
  // verschoben und wieder angedockt
  const weg = verschiebeRaum(k, [0.2, 0.17]).raum;
  const d = andocken(weg, [erg.raum]);
  assert.equal(d.an, r.name);
  nah(Math.min(...punkteVon(d.raum).map((p) => p[0])), 5.115, 1e-9, 'Abstand Trennwand');
  nah(Math.min(...punkteVon(d.raum).map((p) => p[1])), 0, 1e-9, 'bündig an der Ecke');
  // zu weit weg: bleibt, wo er ist
  assert.equal(andocken(verschiebeRaum(k, [1, 0]).raum, [erg.raum]).an, null);
});

test('Überschneidung wird gemeldet', () => {
  const a = raum([[0, 0], [4, 0], [4, 4], [0, 4]], { name: 'Flur' });
  const b = raum([[3, 1], [6, 1], [6, 3], [3, 3]], { name: 'Bad' });
  assert.equal(ueberschneiden(a, b), true);
  assert.deepEqual(pruefeGruppe([a, b]), ['Flur und Bad überschneiden sich.']);
  const innen = raum([[1, 1], [2, 1], [2, 2], [1, 2]], { name: 'WC' });
  assert.equal(ueberschneiden(a, innen), true, 'ganz innen');
  const daneben = raum([[4, 0], [6, 0], [6, 4], [4, 4]]);
  assert.equal(ueberschneiden(a, daneben), false, 'nur berühren');
});

test('Grundriss gesamt als SVG und DXF, Namen', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]], { name: 'Wohnen' });
  const { raum: w, neu } = raumAnbauen(r, r.waende[1].id, { name: 'Küche' });
  const svg = alsSvg([w, neu], massstabFuer([w, neu]));
  assert.ok(svg.includes('Grundriss gesamt (Wohnen, Küche)'));
  assert.ok(svg.includes('>Küche<') && svg.includes('>Wohnen<'));
  assert.ok(!svg.includes('A: '), 'keine Maßketten mit Wandnamen im Gesamtplan');
  const dxf = alsDxf([w, neu]);
  assert.ok(dxf.includes('Kueche') && dxf.includes('Wohnen'));
  assert.equal(naechsterName(['Raum 1', 'Küche']), 'Raum 3');
  assert.equal(naechsterName(['Raum 4']), 'Raum 5');
});

// Tests für mehrere Räume in einem Grundriss (Anbauen, Andocken): node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerRaum, raumAusEcken, berechne, raumAnbauen, andocken, verschiebeRaum, ueberschneiden,
  pruefeGruppe, pruefe, neueOeffnung, alsSvg, alsDxf, massstabFuer, naechsterName, wandGeo, setzeMass, punkteVon,
} from '../raumaufmass/raumgeometrie.js';

const nah = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, ist ${a}`);

function raum(ecken, felder = {}) {
  const r = raumAusEcken(neuerRaum(1), ecken);
  return { ...r, massstabGesetzt: true, hoehe: 2.5, ...felder };
}

test('Raum anbauen und andocken', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r.waende[1].mass = 4;
  const erg = raumAnbauen(r, r.waende[1].id, { tiefe: 3, tiefeGemessen: true, name: 'Küche' });
  assert.ok(!erg.fehler, erg.fehler);
  const k = erg.neu;
  nah(berechne(k).bodenflaeche, 12, 1e-9);
  const xs = punkteVon(k).map((p) => p[0]);
  nah(Math.min(...xs), 5, 1e-9, 'Wand an Wand, ohne Lücke');
  nah(Math.max(...xs), 8, 1e-9);
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
  nah(Math.min(...punkteVon(d.raum).map((p) => p[0])), 5, 1e-9, 'Wand an Wand angedockt');
  nah(Math.min(...punkteVon(d.raum).map((p) => p[1])), 0, 1e-9, 'bündig an der Ecke');
  // zu weit weg: bleibt, wo er ist
  assert.equal(andocken(verschiebeRaum(k, [1, 0]).raum, [erg.raum]).an, null);
  // mit eingestelltem Abstand (Wandstärke) bleibt die Lücke möglich
  const mitLuecke = raumAnbauen(r, r.waende[1].id, { tiefe: 3, staerke: 0.115 }).neu;
  nah(Math.min(...punkteVon(mitLuecke).map((p) => p[0])), 5.115, 1e-9, 'Abstand 11,5 cm');
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
  // Wand an Wand mit gerundeten Koordinaten (Bruchteile eines Millimeters) ist keine Überschneidung
  const oben = raum([[0.1265416, -0.6361613], [6.1265416, -0.6361613], [6.1265416, 3.3638387], [0.1265416, 3.3638387]]);
  const dran = raum([[6.126542, -0.636161], [0.126542, -0.636161], [0.126542, -3.636161], [6.126542, -3.636161]]);
  assert.equal(ueberschneiden(oben, dran), false, 'gerundet Wand an Wand');
  assert.equal(ueberschneiden(oben, verschiebeRaum(dran, [0.5, 0.01]).raum), true, '1 cm drin');
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

// Tests: ganzen Raum um 90° drehen (node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, dreheRaum, berechne, wandGeo, grenzen } from '../raumaufmass/raumgeometrie.js';

const raum = (ecken) => ({ ...raumAusEcken(neuerRaum(1), ecken), massstabGesetzt: true });

test('Rechteck 5 × 3 wird 3 × 5, Fläche und Wandlängen bleiben, Mitte bleibt', () => {
  const r = raum([[0, 0], [5, 0], [5, 3], [0, 3]]);
  r.waende[0].mass = 5;
  const { raum: g } = dreheRaum(r);
  const b = grenzen(g);
  assert.ok(Math.abs(b.x1 - b.x0 - 3) < 1e-6 && Math.abs(b.y1 - b.y0 - 5) < 1e-6, JSON.stringify(b));
  assert.ok(Math.abs((b.x0 + b.x1) / 2 - 2.5) < 1e-6 && Math.abs((b.y0 + b.y1) / 2 - 1.5) < 1e-6);
  assert.ok(Math.abs(berechne(g).bodenflaeche - berechne(r).bodenflaeche) < 1e-6);
  g.waende.forEach((w, i) => assert.ok(Math.abs(wandGeo(g, i).l - wandGeo(r, i).l) < 1e-6));
  assert.equal(g.waende[0].mass, 5);
  assert.equal(g.waende[0].id, r.waende[0].id);
});

test('Viermal drehen ergibt den alten Raum; Körper und Treppe drehen mit', () => {
  const r = raum([[0, 0], [6, 0], [6, 4], [0, 4]]);
  r.koerper = [{ id: 'k', name: 'Körper 1', x: 1, y: 1, breite: 0.5, tiefe: 1, bisDecke: true },
    { id: 't', art: 'treppe', name: 'Treppe', x: 4, y: 2, breite: 1, tiefe: 3, richtung: 'oben' }];
  const einmal = dreheRaum(r).raum;
  assert.equal(einmal.koerper[0].breite, 1);
  assert.equal(einmal.koerper[1].richtung, 'rechts');
  let g = r;
  for (let i = 0; i < 4; i++) g = dreheRaum(g).raum;
  g.ecken.forEach((e, i) => { assert.ok(Math.abs(e.x - r.ecken[i].x) < 1e-6 && Math.abs(e.y - r.ecken[i].y) < 1e-6); });
  assert.deepEqual(g.koerper.map((k) => [k.x, k.y, k.breite, k.richtung]), r.koerper.map((k) => [k.x, k.y, k.breite, k.richtung]));
});

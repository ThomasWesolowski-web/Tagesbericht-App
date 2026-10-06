// Tests für die Flächen der 3-D-Ansicht: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, neueOeffnung, neuerKoerper, setzeSchraege, alsFlaechen3d } from '../raumaufmass/raumgeometrie.js';

const raum = (ecken, felder = {}) => ({ ...raumAusEcken(neuerRaum(1), ecken), massstabGesetzt: true, hoehe: 2.5, ...felder });

test('3-D: Boden, Wände, Tür, Fenster, Körper', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]], { name: 'Wohnen' });
  r = neueOeffnung(r, 'tuer', r.waende[3].id, 2).raum;
  r = neueOeffnung(r, 'fenster', r.waende[0].id, 2.5).raum;
  r = neuerKoerper(r, [1, 1]).raum;
  const f = alsFlaechen3d([r]);
  const art = (a) => f.filter((x) => x.art === a);
  assert.equal(art('boden').length, 1);
  assert.equal(art('wand').length, 4);
  assert.equal(art('tuer').length, 1);
  assert.equal(art('fenster').length, 1);
  assert.equal(art('koerper').length, 5);
  // Wände 2,50 m hoch, Fenster ab 90 cm Brüstung
  assert.ok(art('wand').every((w) => Math.max(...w.pts.map((q) => q[2])) === 2.5));
  assert.equal(Math.min(...art('fenster')[0].pts.map((q) => q[2])), 0.9);
  assert.equal(Math.min(...art('tuer')[0].pts.map((q) => q[2])), 0);
});

test('3-D: Wand mit Dachschräge ist niedriger, Schräge als Fläche', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r = setzeSchraege(r, r.waende[0].id, { kniestock: 1, art: 'winkel', wert: 45 }).raum;
  const f = alsFlaechen3d([r]);
  const wandA = f.find((x) => x.art === 'wand' && x.wand === r.waende[0].id);
  assert.equal(Math.max(...wandA.pts.map((q) => q[2])), 1);
  assert.equal(f.filter((x) => x.art === 'schraege').length, 1);
  // Seitenwand steigt vom Kniestock bis zur Raumhöhe
  const wandB = f.find((x) => x.art === 'wand' && x.wand === r.waende[1].id);
  assert.ok(wandB.pts.some((q) => Math.abs(q[2] - 1) < 1e-9) && wandB.pts.some((q) => Math.abs(q[2] - 2.5) < 1e-9));
});

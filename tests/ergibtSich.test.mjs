// Wände, deren Länge sich aus den gemessenen ergibt (Rechteck: zwei Maße über Eck reichen)
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, setzeMass, ergibtSich } from '../raumaufmass/raumgeometrie.js';

const raum = (punkte) => raumAusEcken(neuerRaum(1), punkte);
const messen = (r, i, l) => setzeMass(r, r.waende[i].id, l).raum;

test('Rechteck: ohne Maßstab ergibt sich nichts', () => {
  assert.deepEqual([...ergibtSich(raum([[0, 0], [4, 0], [4, 3], [0, 3]]))], []);
});

test('Rechteck: ein Maß ergibt die gegenüberliegende Wand', () => {
  const r = messen(raum([[0, 0], [4, 0], [4, 3], [0, 3]]), 0, 5);
  assert.deepEqual([...ergibtSich(r)], [2]);
});

test('Rechteck: zwei Maße über Eck ergeben den ganzen Raum', () => {
  let r = messen(raum([[0, 0], [4, 0], [4, 3], [0, 3]]), 0, 5);
  r = messen(r, 1, 3.5);
  assert.deepEqual([...ergibtSich(r)].sort(), [2, 3]);
});

test('Rechteck: zwei gegenüberliegende Maße reichen nicht', () => {
  let r = messen(raum([[0, 0], [4, 0], [4, 3], [0, 3]]), 0, 5);
  r = messen(r, 2, 5);
  assert.deepEqual([...ergibtSich(r)], []);
});

test('L-Raum: vier passende Maße ergeben die übrigen zwei Wände', () => {
  // 6 Wände: 0 oben, 1 rechts, 2 unten rechts, 3 Stufe senkrecht, 4 unten links, 5 links
  let r = messen(raum([[0, 0], [6, 0], [6, 2], [3, 2], [3, 4], [0, 4]]), 0, 6);
  r = messen(r, 1, 2);
  r = messen(r, 2, 3);
  assert.equal(ergibtSich(r).size, 1); // Wand 4 (unten links) = 6 − 3 ergibt sich schon
  r = messen(r, 5, 4);
  assert.equal(ergibtSich(r).size, 2);
});

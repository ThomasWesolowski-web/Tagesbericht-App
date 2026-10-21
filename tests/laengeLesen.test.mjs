// Tests für die Längeneingabe (getippt, diktiert, vom Laser): node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { laengeLesen } from '../raumaufmass/raumgeometrie.js';

test('Länge: getippt und vom Laser im Tastatur-Modus', () => {
  assert.equal(laengeLesen('5,42'), 5.42);
  assert.equal(laengeLesen('5.42'), 5.42);
  assert.equal(laengeLesen('3.452 m'), 3.452);
  assert.equal(laengeLesen('345 cm'), 3.45);
  assert.equal(laengeLesen('3452 mm'), 3.452);
});

test('Länge: diktiert', () => {
  assert.equal(laengeLesen('3,45 Meter'), 3.45);
  assert.equal(laengeLesen('3,45 m.'), 3.45);
  assert.equal(laengeLesen('345 Zentimeter'), 3.45);
  assert.equal(laengeLesen('3 Komma 45'), 3.45);
  assert.equal(laengeLesen('3 Meter 45'), 3.45);
  assert.equal(laengeLesen('3 Meter 5'), 3.05);
});

test('Länge: Unsinn wird abgelehnt', () => {
  assert.equal(laengeLesen('0'), null);
  assert.equal(laengeLesen('abc'), null);
  assert.equal(laengeLesen(''), null);
});

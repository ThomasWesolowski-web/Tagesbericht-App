// Tests: offen gezeichnete Wände an vorhandene Räume heften (node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, anNachbarnSchliessen, flaecheMitVorzeichen } from '../raumaufmass/raumgeometrie.js';

const raum = (ecken) => ({ ...raumAusEcken(neuerRaum(1), ecken), massstabGesetzt: true });
const flaeche = (p) => Math.abs(flaecheMitVorzeichen(p));
const nachbar = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);

test('U an einer Wand: Enden bis an die Wand, geschlossen an der Wand', () => {
  // unter dem Raum, Enden 20 cm vor der Wand
  const p = anNachbarnSchliessen([[1, 4.2], [1, 7], [4, 7], [4, 4.2]], [nachbar]);
  assert.equal(p.length, 4);
  assert.ok(Math.abs(flaeche(p) - 9) < 1e-6, `Fläche ${flaeche(p)}`);
  assert.ok(p.every((q) => q[1] >= 4 - 1e-9), 'nicht in den Nachbarraum');
});

test('U, Enden schießen etwas über die Wand hinaus', () => {
  const p = anNachbarnSchliessen([[1, 3.8], [1, 7], [4, 7], [4, 3.9]], [nachbar]);
  assert.ok(Math.abs(flaeche(p) - 9) < 1e-6, `Fläche ${flaeche(p)}`);
});

test('L um eine Ecke: Ecke des Nachbarn wird Raumecke', () => {
  // von der rechten Wand nach rechts, dann nach unten, dann nach links bis unter den Raum
  const p = anNachbarnSchliessen([[5.1, 2], [8, 2], [8, 6], [3, 6], [3, 4.1]], [nachbar]);
  assert.ok(p.some((q) => Math.abs(q[0] - 5) < 1e-9 && Math.abs(q[1] - 4) < 1e-9), 'Ecke 5/4 dabei');
  // 3×4 (rechts) + 2×2 (unten) = 16 m²... genau: Rechteck 3..8 × 2..6 = 20 minus Nachbar-Ecke 3..5 × 2..4 = 4
  assert.ok(Math.abs(flaeche(p) - 16) < 1e-6, `Fläche ${flaeche(p)}`);
});

test('weit weg: nichts angeheftet', () => {
  assert.equal(anNachbarnSchliessen([[1, 5], [1, 7], [4, 7], [4, 5]], [nachbar]), null);
});

test('Enden an zwei verschiedenen Räumen: verlängern, gerade schließen', () => {
  const zweiter = raum([[5, 0], [9, 0], [9, 4], [5, 4]]);
  const p = anNachbarnSchliessen([[2, 4.2], [2, 7], [7, 7], [7, 4.2]], [nachbar, zweiter]);
  assert.ok(Math.abs(flaeche(p) - 15) < 1e-6, `Fläche ${flaeche(p)}`);
});

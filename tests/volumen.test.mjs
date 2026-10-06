// Tests für den Rauminhalt (Volumen) im Raumaufmaß: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, berechne, setzeSchraege, hoeheBei } from '../raumaufmass/raumgeometrie.js';

const nah = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, ist ${a}`);
function raum(ecken, felder = {}) {
  const r = raumAusEcken(neuerRaum(1), ecken);
  return { ...r, massstabGesetzt: true, hoehe: 2.5, ...felder };
}
const schraege = (r, i, s) => setzeSchraege(r, r.waende[i].id, s).raum;
// Vergleich: Deckenhöhe auf feinem Raster aufsummieren
const gezaehlt = (r, x1, y1, n = 400) => {
  let v = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) v += hoeheBei(r, [((i + 0.5) / n) * x1, ((j + 0.5) / n) * y1]);
  return (v * x1 * y1) / (n * n);
};

test('Volumen Quader: Fläche × Höhe', () => {
  const b = berechne(raum([[0, 0], [5, 0], [5, 4], [0, 4]]));
  nah(b.volumen, 50);
});

test('Volumen mit Dachschräge und Satteldach', () => {
  const r1 = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'winkel', wert: 45 });
  // flach 5 × 2,5 × 2,5 + Schräge 5 × 1,5 × (1 + 2,5) / 2
  nah(berechne(r1).volumen, 31.25 + 13.125);
  nah(berechne(r1).volumen, gezaehlt(r1, 5, 4), 1e-3, 'Raster');
  const r2 = schraege(schraege(raum([[0, 0], [6, 0], [6, 4], [0, 4]], { hoehe: 3 }), 0, { kniestock: 0.8, art: 'winkel', wert: 40 }), 2, { kniestock: 0.8, art: 'winkel', wert: 40 });
  nah(berechne(r2).volumen, gezaehlt(r2, 6, 4), 2e-3, 'Satteldach');
});

test('Volumen: Körper bis zur Decke abgezogen, niedrige nicht', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r.koerper = [
    { id: 'k1', name: 'Kamin', x: 1, y: 1, breite: 0.5, tiefe: 0.4, bisDecke: true },
    { id: 'k2', name: 'Podest', x: 3, y: 3, breite: 1, tiefe: 1, bisDecke: false },
  ];
  const b = berechne(r);
  nah(b.volumenBrutto, 50);
  nah(b.volumen, 50 - 0.2 * 2.5);
});

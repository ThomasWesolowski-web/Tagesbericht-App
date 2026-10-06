// Tests für Körper in der Fläche (Kamin, Säule) und feste Maße: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerRaum, raumAusEcken, berechne, neuerKoerper, aendereKoerper, loescheKoerper, pruefe, alsSvg, alsDxf,
  verschiebeRaum, verschiebeWand, verschiebeEcke, skaliere, raumJson,
} from '../raumaufmass/raumgeometrie.js';

const nah = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, ist ${a}`);

function raum(ecken, felder = {}) {
  const r = raumAusEcken(neuerRaum(1), ecken);
  return { ...r, massstabGesetzt: true, hoehe: 2.5, ...felder };
}

test('Körper wird von Boden und Decke abgezogen', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  let { raum: x, koerper: id } = neuerKoerper(r, [1, 1]);
  x = aendereKoerper(x, id, { name: 'Kamin', breite: 0.6, tiefe: 0.4 }).raum;
  let b = berechne(x);
  nah(b.bodenBrutto, 20);
  nah(b.koerperFlaeche, 0.24);
  nah(b.bodenflaeche, 19.76);
  nah(b.deckenflaeche, 19.76, 1e-9, 'bis zur Decke');
  nah(b.wandNetto, berechne(r).wandNetto, 1e-9, 'Wand unverändert');
  // nur am Boden (z. B. Podest)
  x = aendereKoerper(x, id, { bisDecke: false }).raum;
  b = berechne(x);
  nah(b.bodenflaeche, 19.76);
  nah(b.deckenflaeche, 20);
  assert.deepEqual(pruefe(x).warnungen, []);
  // Darstellung und Daten
  assert.ok(alsSvg(x).includes('Kamin 60/40'));
  assert.ok(alsDxf(x).includes('KOERPER'));
  assert.equal(raumJson(x).berechnet.koerperFlaeche, 0.24);
  // außerhalb des Raums: Warnung
  const aussen = aendereKoerper(x, id, { x: 6, y: 1 }).raum;
  assert.match(pruefe(aussen).warnungen.join(' '), /Kamin liegt nicht ganz im Raum/);
  // ohne Breite: Fehler
  assert.ok(aendereKoerper(x, id, { breite: 0 }).fehler);
  // löschen
  nah(berechne(loescheKoerper(x, id).raum).bodenflaeche, 20);
});

test('Körper wandert mit dem Raum und mit dem Maßstab', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  const { raum: x } = neuerKoerper(r, [1, 1]);
  const v = verschiebeRaum(x, [2, 3]).raum;
  assert.deepEqual([v.koerper[0].x, v.koerper[0].y], [3, 4]);
  const s = skaliere(x, 2);
  assert.deepEqual([s.koerper[0].x, s.koerper[0].breite], [2, 1]);
});

test('Gemessene Wände: Verschieben meldet weggefallene Maße', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r.waende[0].mass = 5;
  // Wand B (rechts) verschieben ändert die Länge von A → Maß fiele weg (die App sperrt das)
  assert.deepEqual(verschiebeWand(r, r.waende[1].id, 0.5).masseWeg, [r.waende[0].id]);
  // Wand C (unten) verschieben ändert A nicht
  assert.deepEqual(verschiebeWand(r, r.waende[2].id, 0.5).masseWeg, []);
  // Ecke an der gemessenen Wand
  assert.ok(verschiebeEcke(r, r.ecken[1].id, [5.5, 0]).masseWeg.length);
});

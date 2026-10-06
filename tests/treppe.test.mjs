// Tests für die Treppe im Raumaufmaß: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, berechne, neueTreppe, aendereKoerper, treppenLinien, alsFlaechen3d, planElemente, alsDxf } from '../raumaufmass/raumgeometrie.js';

const raum = () => ({ ...raumAusEcken(neuerRaum(1), [[0, 0], [5, 0], [5, 4], [0, 4]]), massstabGesetzt: true, hoehe: 2.5 });

test('Treppe: nur eingezeichnet, mit Treppenloch abgezogen', () => {
  const { raum: r, koerper: id } = neueTreppe(raum(), [0.2, 0.2]);
  const t = r.koerper.find((k) => k.id === id);
  // in den Raum geschoben (1 × 3 m)
  assert.deepEqual([t.x, t.y], [0.5, 1.5]);
  assert.equal(berechne(r).bodenflaeche, 20);
  assert.equal(berechne(r).volumen, 50);
  assert.equal(berechne(r).treppen.length, 1);
  const mitLoch = aendereKoerper(r, id, { abzug: true }).raum;
  assert.equal(berechne(mitLoch).bodenflaeche, 17);
  assert.equal(berechne(mitLoch).deckenflaeche, 20, 'Decke bleibt');
});

test('Treppe: Stufen, Laufrichtung, 3-D, Zeichnung', () => {
  const { raum: r, koerper: id } = neueTreppe(raum(), [2.5, 2]);
  const t = r.koerper.find((k) => k.id === id);
  const l = treppenLinien(t);
  assert.equal(l.kanten.length, 14);
  assert.ok(l.bis[1] < l.von[1], 'oben: Pfeil zeigt nach oben (kleineres y)');
  const rechts = treppenLinien({ ...t, richtung: 'rechts', breite: 3, tiefe: 1 });
  assert.ok(rechts.bis[0] > rechts.von[0]);
  const f = alsFlaechen3d([r]).filter((x) => x.art === 'treppe');
  assert.equal(f.length, 30, 'je Stufe Setzstufe und Tritt');
  assert.ok(Math.abs(Math.max(...f.flatMap((x) => x.pts.map((p) => p[2]))) - 2.5) < 1e-9, 'oben auf Deckenhöhe');
  const els = planElemente(r, (p) => p);
  assert.ok(els.some((e) => e.art === 'text' && /Treppe 100\/300, 15 Stg\./.test(e.text)));
  assert.match(alsDxf(r), /TREPPE/);
});

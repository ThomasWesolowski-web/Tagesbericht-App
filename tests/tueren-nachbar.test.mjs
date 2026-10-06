// Tests für Türen in gemeinsamen Wänden: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, berechne, raumAnbauen, neueOeffnung, loescheOeffnung, verschiebeRaum, tuerenAbgleichen, wandGeo } from '../raumaufmass/raumgeometrie.js';

const flurUndBad = (staerke = 0) => {
  const r = { ...raumAusEcken({ ...neuerRaum(1), name: 'Bad', gruppe: 'g' }, [[0, 0], [4, 0], [4, 3], [0, 3]]), massstabGesetzt: true, hoehe: 2.5 };
  const { raum, neu } = raumAnbauen(r, r.waende[1].id, { tiefe: 2, name: 'Flur', staerke });
  return [raum, neu];
};

test('Tür in gemeinsamer Wand zählt auch im Nachbarraum', () => {
  const [bad0, flur0] = flurUndBad();
  const { raum: bad } = neueOeffnung(bad0, 'tuer', bad0.waende[1].id, 1); // Wand B, Mitte 1 m von Ecke 2
  const [b, f] = tuerenAbgleichen([bad, flur0]);
  assert.equal(b, bad, 'Bad bleibt unverändert');
  const kopie = f.oeffnungen.find((o) => o.von);
  assert.ok(kopie, 'Flur hat die Tür');
  assert.equal(kopie.name, 'Tür 1 (Bad)');
  assert.equal(kopie.wand, f.waende[0].id, 'gemeinsame Wand A des Flurs');
  // gleiche Stelle: Bad-Tür 0,6–1,4 m ab (4|0) nach unten → im Flur von (4|3) nach oben 1,6–2,4 m
  const o = bad.oeffnungen[0];
  const g = wandGeo(bad, 1);
  const h = wandGeo(f, 0);
  const mitteBad = g.a[1] + g.r[1] * (o.abstand + o.breite / 2);
  const mitteFlur = h.a[1] + h.r[1] * (kopie.abstand + kopie.breite / 2);
  assert.ok(Math.abs(mitteBad - mitteFlur) < 1e-9);
  assert.equal(kopie.richtung, 'aussen');
  assert.equal(kopie.anschlag, 'rechts');
  assert.ok(Math.abs(berechne(f).tuerFlaeche - o.breite * o.hoehe) < 1e-9);
  // zweimal abgleichen ändert nichts
  const [b2, f2] = tuerenAbgleichen([b, f]);
  assert.equal(b2, b);
  assert.equal(f2, f);
});

test('Kopie verschwindet mit der Tür, beim Auseinanderschieben und bei eigener Tür', () => {
  const [bad0, flur0] = flurUndBad(0.115);
  const { raum: bad, oeffnung } = neueOeffnung(bad0, 'tuer', bad0.waende[1].id, 1.5);
  const [, f] = tuerenAbgleichen([bad, flur0]);
  assert.equal(f.oeffnungen.length, 1, 'auch mit 11,5 cm Wand');
  const [, ohne] = tuerenAbgleichen([loescheOeffnung(bad, oeffnung).raum, f]);
  assert.equal(ohne.oeffnungen.length, 0);
  const [, weit] = tuerenAbgleichen([bad, verschiebeRaum(f, [2, 0]).raum]);
  assert.equal(weit.oeffnungen.length, 0);
  // Flur hat dort schon eine eigene Tür: keine zweite
  const { raum: flurMitTuer } = neueOeffnung(flur0, 'tuer', flur0.waende[0].id, 1.5);
  const [b3, f3] = tuerenAbgleichen([bad, flurMitTuer]);
  assert.equal(f3.oeffnungen.length, 1);
  assert.equal(b3.oeffnungen.length, 1);
  // neue Tür im Flur heißt trotzdem „Tür 1“
  assert.equal(neueOeffnung(f, 'tuer', f.waende[2].id, 1).raum.oeffnungen.at(-1).name, 'Tür 1');
});

test('Fenster und Räume ohne Grundriss bleiben, wie sie sind', () => {
  const [bad0, flur0] = flurUndBad();
  const { raum: bad } = neueOeffnung(bad0, 'fenster', bad0.waende[1].id, 1);
  assert.equal(tuerenAbgleichen([bad, flur0])[1], flur0);
  const { raum: badT } = neueOeffnung(bad0, 'tuer', bad0.waende[1].id, 1);
  assert.equal(tuerenAbgleichen([{ ...badT, gruppe: 'x' }, flur0])[1], flur0);
});

test('Grundriss gesamt zeichnet die Tür nur einmal', async () => {
  const { gruppeElemente, planElemente } = await import('../raumaufmass/raumgeometrie.js');
  const [bad0, flur0] = flurUndBad();
  const { raum: bad } = neueOeffnung(bad0, 'tuer', bad0.waende[1].id, 1);
  const [b, f] = tuerenAbgleichen([bad, flur0]);
  const boegen = (els) => els.filter((e) => e.art === 'bogen').length;
  assert.equal(boegen(planElemente(f, (p) => p)), 1, 'im Flur-Plan sichtbar');
  assert.equal(boegen(gruppeElemente([b, f], (p) => p)), 1);
});

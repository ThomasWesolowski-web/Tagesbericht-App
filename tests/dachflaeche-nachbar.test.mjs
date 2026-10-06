// Tests für die Dachfläche vom Nachbarraum: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerRaum, raumAusEcken, wandGeo, setzeSchraege, hoeheBei, schraegeWerte, berechne,
  dachflaechenVonNachbarn, schraegeWieNachbar, schraegenAbgleichen, grundrissAbgleichen,
} from '../raumaufmass/raumgeometrie.js';

const raum = (name, ecken, hoehe) => ({ ...raumAusEcken({ ...neuerRaum(1), name, gruppe: 'g' }, ecken), massstabGesetzt: true, hoehe });
// Wand, deren Innenseite nach unten (+y) zeigt: die obere Wand, an der das Dach herunterkommt
const obereWand = (r) => r.waende.findIndex((_, i) => wandGeo(r, i).innen[1] > 0.99);

const zimmerUndFlur = () => {
  let zimmer = raum('Zimmer', [[0, 0], [4, 0], [4, 3], [0, 3]], 2.6);
  zimmer = setzeSchraege(zimmer, zimmer.waende[obereWand(zimmer)].id, { kniestock: 0.84, art: 'winkel', wert: 30 }).raum;
  // Flur daneben, seine obere Wand liegt 0,90 m weiter innen (andere Flucht)
  let flur = raum('Flur', [[4, 0.9], [6, 0.9], [6, 3], [4, 3]], 2.5);
  flur = setzeSchraege(flur, flur.waende[obereWand(flur)].id, { kniestock: 0.32, art: 'winkel', wert: 30 }).raum;
  return { zimmer, flur };
};

test('Schräge vom Nachbarraum: eine Ebene, gleiche Raumhöhe, Knick in einer Flucht', () => {
  const { zimmer, flur } = zimmerUndFlur();
  const i = obereWand(flur);
  const k = dachflaechenVonNachbarn(flur, i, [zimmer]);
  assert.equal(k.length, 1);
  assert.equal(k[0].raumName, 'Zimmer');
  assert.ok(Math.abs(k[0].kniestock - (0.84 + Math.tan(Math.PI / 6) * 0.9)) < 1e-9);
  const { raum: f } = schraegeWieNachbar(flur, flur.waende[i].id, zimmer, k[0].wand);
  assert.equal(f.hoehe, 2.6);
  assert.deepEqual(f.waende[i].schraege.von, { raum: zimmer.id, wand: k[0].wand });
  // gleiche Höhe links und rechts der Trennwand, überall
  for (const y of [0.95, 1.5, 2, 2.9]) assert.ok(Math.abs(hoeheBei(zimmer, [3.999, y]) - hoeheBei(f, [4.001, y])) < 1e-2, `y=${y}`);
  // Knick zur flachen Decke an derselben Stelle
  const tiefeZ = schraegeWerte(zimmer, obereWand(zimmer)).tiefe;
  const tiefeF = schraegeWerte(f, i).tiefe;
  assert.ok(Math.abs(tiefeZ - (tiefeF + 0.9)) < 1e-5);
  assert.ok(berechne(f).mitSchraege);
});

test('Übernommene Schräge folgt dem Nachbarraum, eigene Werte lösen die Verbindung', () => {
  const { zimmer, flur } = zimmerUndFlur();
  const i = obereWand(flur);
  const j = obereWand(zimmer);
  const f = schraegeWieNachbar(flur, flur.waende[i].id, zimmer, zimmer.waende[j].id).raum;
  const z2 = setzeSchraege(zimmer, zimmer.waende[j].id, { kniestock: 1, art: 'winkel', wert: 35 }).raum;
  const [, f2] = schraegenAbgleichen([{ ...z2, hoehe: 2.7 }, f]);
  assert.equal(f2.hoehe, 2.7);
  assert.ok(Math.abs(f2.waende[i].schraege.kniestock - (1 + Math.tan((35 * Math.PI) / 180) * 0.9)) < 1e-6);
  assert.ok(Math.abs(f2.waende[i].schraege.wert - 35) < 1e-6);
  // zweimal abgleichen ändert nichts
  const [z3, f3] = grundrissAbgleichen([{ ...z2, hoehe: 2.7 }, f2]);
  assert.equal(f3, f2);
  assert.equal(z3.hoehe, 2.7);
  // eigene Werte: keine Verbindung mehr, Nachbar ändert nichts
  const eigen = setzeSchraege(f2, f2.waende[i].id, { kniestock: 0.5, art: 'winkel', wert: 40 }).raum;
  assert.equal(eigen.waende[i].schraege.von, undefined);
  assert.equal(schraegenAbgleichen([z2, eigen])[1], eigen);
  // Nachbarraum entfernt: Werte bleiben, Verbindung fällt weg
  const [allein] = schraegenAbgleichen([f2]);
  assert.equal(allein.waende[i].schraege.von, undefined);
  assert.equal(allein.waende[i].schraege.kniestock, f2.waende[i].schraege.kniestock);
});

test('Nur Wände in derselben Richtung; zu hoch geht nicht', () => {
  const { zimmer, flur } = zimmerUndFlur();
  const unten = flur.waende.findIndex((_, i) => wandGeo(flur, i).innen[1] < -0.99);
  assert.equal(dachflaechenVonNachbarn(flur, unten, [zimmer]).length, 0);
  // Raum, dessen obere Wand 3,5 m weiter innen liegt: dort ist das Dach schon über der Raumhöhe
  const weit = raum('Kammer', [[4, 3.5], [6, 3.5], [6, 5], [4, 5]], 2.5);
  const [f] = dachflaechenVonNachbarn(weit, obereWand(weit), [zimmer]);
  assert.match(f.fehler, /höher als die Raumhöhe/);
});

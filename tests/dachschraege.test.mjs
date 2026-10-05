// Tests für Dachschrägen, Kniestock und Dachfenster im Raumaufmaß: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerRaum, raumAusEcken, berechne, setzeSchraege, schraegeWerte, neuesDachfenster, aendereDachfenster,
  neueOeffnung, teileWand, pruefe, alsPositionen, raumJson, alsSvg, alsDxf, hoeheBei,
} from '../raumgeometrie.js';
import { positionSumme } from '../report.js';

const nah = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, ist ${a}`);

function raum(ecken, felder = {}) {
  const r = raumAusEcken(neuerRaum(1), ecken);
  return { ...r, massstabGesetzt: true, hoehe: 2.5, ...felder };
}
const schraege = (r, i, s) => {
  const erg = setzeSchraege(r, r.waende[i].id, s);
  assert.ok(!erg.fehler, erg.fehler);
  return erg.raum;
};
const summe = (pos, bezeichnung) => positionSumme(pos.find((p) => p.bezeichnung.endsWith(bezeichnung))).netto;

test('Schräge aus Neigung, Tiefe oder Länge', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  const v = (s) => schraegeWerte(schraege(r, 0, s), 0);
  const a = v({ kniestock: 1, art: 'winkel', wert: 45 });
  nah(a.tiefe, 1.5); nah(a.laenge, 1.5 * Math.SQRT2);
  const b = v({ kniestock: 1, art: 'tiefe', wert: 2 });
  nah(b.winkel, (Math.atan(1.5 / 2) * 180) / Math.PI);
  const c = v({ kniestock: 1, art: 'laenge', wert: 2.5 });
  nah(c.tiefe, 2); nah(c.laenge, 2.5);
});

test('Kniestock einseitig: Decke, Schräge, Giebelwände', () => {
  // 5 × 4 m, Raumhöhe 2,50, Kniestock 1,00 an Wand A, Schräge 2,50 m lang (2,00 m tief)
  const r = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'laenge', wert: 2.5 });
  const b = berechne(r);
  nah(b.bodenflaeche, 20);
  nah(b.deckenflaeche, 10, 1e-9, 'flache Decke');
  assert.equal(b.schraegen.length, 1);
  nah(b.schraegen[0].grundriss, 10, 1e-9);
  nah(b.dachFlaeche, 12.5, 1e-9, 'Schrägfläche 5 × 2,50');
  nah(b.waende[0].flaeche, 5, 1e-9, 'Kniestockwand');
  nah(b.waende[2].flaeche, 12.5, 1e-9, 'volle Wand');
  nah(b.waende[1].flaeche, 8.5, 1e-9, 'Giebelwand B');
  nah(b.waende[3].flaeche, 8.5, 1e-9, 'Giebelwand D');
  nah(b.wandBrutto, 34.5, 1e-9);
  nah(hoeheBei(r, [2.5, 1]), 1.75, 1e-9, 'Höhe 1 m vor der Kniestockwand');
});

test('Satteldach: zwei gegenüberliegende Schrägen', () => {
  let r = raum([[0, 0], [6, 0], [6, 4], [0, 4]]);
  r = schraege(r, 0, { kniestock: 1, art: 'tiefe', wert: 1.5 });
  r = schraege(r, 2, { kniestock: 1, art: 'winkel', wert: 45 });
  const b = berechne(r);
  nah(b.deckenflaeche, 6, 1e-9);
  nah(b.dachFlaeche, 18 * Math.SQRT2, 1e-9);
  nah(b.waende[1].flaeche, 7.75, 1e-9);
  nah(b.wandBrutto, 27.5, 1e-9);
  // Positionen = Berechnung
  const pos = alsPositionen(r);
  nah(summe(pos, 'Deckenfläche (waagerecht)'), 6, 0.001);
  nah(summe(pos, 'Dachschräge'), 18 * Math.SQRT2, 0.001);
  nah(summe(pos, 'Wandfläche'), b.wandNetto, 0.001);
  assert.ok(!pos.some((p) => p.bezeichnung.endsWith(': Deckenfläche')), 'ohne flache Decke als ganze Fläche');
});

test('Walmdach: Schrägen an allen Wänden', () => {
  let r = raum([[0, 0], [6, 0], [6, 4], [0, 4]]);
  for (let i = 0; i < 4; i++) r = schraege(r, i, { kniestock: 1, art: 'winkel', wert: 45 });
  const b = berechne(r);
  nah(b.deckenflaeche, 3, 1e-6);
  nah(b.schraegen.reduce((s, e) => s + e.grundriss, 0), 21, 1e-6);
  nah(b.wandBrutto, 20, 1e-9, 'alle Wände nur Kniestock');
});

test('Dachfenster werden von der Schräge abgezogen', () => {
  let r = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'laenge', wert: 2.5 });
  const erg = neuesDachfenster(r, r.waende[0].id);
  r = erg.raum;
  const b = berechne(r);
  nah(b.dachfensterFlaeche, 0.78 * 1.18, 1e-9);
  nah(b.dachNetto, 12.5 - 0.78 * 1.18, 1e-9);
  nah(summe(alsPositionen(r), 'Dachschräge'), 12.5 - 0.78 * 1.18, 0.001);
  // passt nicht mehr in die Schräge → Warnung
  r = aendereDachfenster(r, erg.dachfenster, { unten: 2 }).raum;
  assert.ok(pruefe(r).warnungen.some((w) => w.includes('passt nicht in die Schräge')));
  // Schräge entfernen → Dachfenster fällt weg
  const ohne = setzeSchraege(r, r.waende[0].id, null);
  assert.equal(ohne.raum.dachfenster.length, 0);
  assert.equal(ohne.oeffnungenWeg.length, 1);
});

test('Fenster in der Kniestockwand ist zu hoch', () => {
  let r = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'winkel', wert: 40 });
  r = neueOeffnung(r, 'fenster', r.waende[0].id, 2.5).raum;
  assert.ok(pruefe(r).warnungen.some((w) => w.includes('reicht in die Dachschräge')));
  // in der Giebelwand mitten unter dem höchsten Punkt passt es
  let g = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'winkel', wert: 40 });
  g = neueOeffnung(g, 'fenster', g.waende[2].id, 2.5).raum;
  assert.deepEqual(pruefe(g).warnungen, []);
});

test('Ungültige Schrägen werden abgelehnt oder gemeldet', () => {
  const r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  assert.match(setzeSchraege(r, r.waende[0].id, { kniestock: 2.6, art: 'winkel', wert: 40 }).fehler, /niedriger/);
  assert.match(setzeSchraege(r, r.waende[0].id, { kniestock: 1, art: 'laenge', wert: 1.2 }).fehler, /länger/);
  assert.match(setzeSchraege(r, r.waende[0].id, { kniestock: 1, art: 'winkel', wert: 90 }).fehler, /89/);
  // Raumhöhe später unter den Kniestock gesetzt
  const s = { ...schraege(r, 0, { kniestock: 1.2, art: 'winkel', wert: 40 }), hoehe: 1.1 };
  assert.ok(pruefe(s).fehler.some((f) => f.includes('Dachschräge an Wand A')));
});

test('Schräge bleibt beim Teilen, Speichern und in alten Räumen', () => {
  let r = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'winkel', wert: 45 });
  const vorher = berechne(r);
  r = teileWand(r, r.waende[0].id, 0.4).raum;
  assert.ok(r.waende[0].schraege && r.waende[1].schraege);
  const b = berechne(r);
  nah(b.dachFlaeche, vorher.dachFlaeche, 1e-6, 'geteilte Wand zählt nicht doppelt');
  nah(b.wandBrutto, vorher.wandBrutto, 1e-6);
  r = neuesDachfenster(r, r.waende[1].id).raum;
  const zurueck = JSON.parse(JSON.stringify(raumJson(r)));
  delete zurueck.berechnet;
  nah(berechne(zurueck).dachNetto, berechne(r).dachNetto, 1e-9);
  assert.ok(raumJson(r).berechnet.schraegen.length >= 1);
  // Raum aus Version 1.43.0 ohne Dachfenster-Liste
  const alt = raum([[0, 0], [4, 0], [4, 3], [0, 3]]);
  delete alt.dachfenster;
  assert.equal(berechne(alt).mitSchraege, false);
  nah(berechne(alt).wandBrutto, 14 * 2.5);
  assert.deepEqual(pruefe(alt).fehler, []);
  assert.equal(alsPositionen(alt).length, 4);
});

test('Plan, SVG und DXF zeigen die Schräge', () => {
  let r = schraege(raum([[0, 0], [5, 0], [5, 4], [0, 4]]), 0, { kniestock: 1, art: 'winkel', wert: 40 });
  r = neuesDachfenster(r, r.waende[0].id).raum;
  const svg = alsSvg(r, 50);
  assert.ok(svg.includes('Schräge 40° · Kniestock 1,00'));
  assert.ok(svg.includes('DF 78/118'));
  assert.ok(svg.includes('stroke-dasharray'), 'Knicklinie gestrichelt');
  const dxf = alsDxf(r);
  assert.ok(dxf.includes('DACHSCHRAEGE'));
  assert.ok(dxf.includes('DACHFENSTER'));
});

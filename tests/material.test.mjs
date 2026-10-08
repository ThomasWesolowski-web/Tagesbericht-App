// Tests für den Material-Planer: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerRaum, raumAusEcken, neueOeffnung, setzeSchraege, berechne } from '../raumaufmass/raumgeometrie.js';
import { systemeMischen, flaechenVon, systemFuer, bedarf, STANDARD_SYSTEME, aufbauSvg, BEREICHE } from '../raumaufmass/material.js';

const raum = (ecken, felder = {}) => ({ ...raumAusEcken(neuerRaum(1), ecken), massstabGesetzt: true, hoehe: 2.5, ...felder });

const PUTZ = {
  id: 'test-putz', name: 'Testputz', bereiche: ['wand', 'decke'], verschnitt: 10,
  parameter: [{ key: 'dicke', name: 'Putzdicke', einheit: 'mm', wert: 10 }],
  aufbau: [{ name: 'Mauerwerk', dicke: 175, art: 'massiv' }, { name: 'Putz', dicke: 10, art: 'putz' }],
  positionen: [
    { name: 'Putz', menge: 10, einheit: 'kg', jeParameter: 'dicke', bezug: 10, gebinde: { name: 'Sack', inhalt: 30, einheit: 'kg' } },
    { name: 'Eckschiene', menge: 0.5, einheit: 'm', ohneVerschnitt: true },
  ],
};

test('Material: mitgelieferte Systeme sind vollständig', () => {
  assert.ok(STANDARD_SYSTEME.length >= 6);
  const ids = new Set();
  for (const s of STANDARD_SYSTEME) {
    assert.ok(!ids.has(s.id), `doppelte id ${s.id}`); ids.add(s.id);
    assert.ok(s.name && s.quelle, `${s.id}: Name und Quelle`);
    assert.ok(s.bereiche.length && s.bereiche.every((b) => b in BEREICHE), `${s.id}: Bereiche`);
    assert.ok(s.aufbau.length && s.positionen.length, `${s.id}: Aufbau und Material`);
    for (const p of s.positionen) {
      assert.ok(Number.isFinite(p.menge) && p.menge > 0 && p.einheit, `${s.id}: ${p.name}`);
      if (p.jeParameter) assert.ok(s.parameter.some((q) => q.key === p.jeParameter), `${s.id}: Parameter ${p.jeParameter}`);
    }
    assert.match(aufbauSvg(s), /^<svg/);
  }
});

test('Material: eigene Systeme überschreiben, löschen, ergänzen', () => {
  const erste = STANDARD_SYSTEME[0];
  const m = systemeMischen([{ ...erste, name: 'Geändert' }, PUTZ]);
  assert.equal(m.find((s) => s.id === erste.id).name, 'Geändert');
  assert.equal(m.find((s) => s.id === erste.id).geaendert, true);
  assert.equal(m.find((s) => s.id === 'test-putz').geaendert, false);
  assert.equal(m.length, STANDARD_SYSTEME.length + 1);
  assert.equal(systemeMischen([{ id: erste.id, geloescht: true }]).length, STANDARD_SYSTEME.length - 1);
});

test('Material: Wand netto, Decke, Vorrang Wand > Raum > alle', () => {
  let r = raum([[0, 0], [4, 0], [4, 3], [0, 3]]);
  r = neueOeffnung(r, 'tuer', r.waende[0].id, 2).raum;
  const b = berechne(r);
  const f = flaechenVon(r, b);
  assert.equal(f.filter((x) => x.bereich === 'wand').length, 4);
  const wa = f.find((x) => x.wand === r.waende[0].id);
  const ab = b.oeffnungen.filter((o) => o.wand === wa.wand && o.abgezogen).reduce((s, o) => s + o.flaeche, 0);
  assert.ok(Math.abs(wa.flaeche - (10 - ab)) < 1e-9);
  assert.ok(Math.abs(f.find((x) => x.bereich === 'decke').flaeche - 12) < 1e-9);

  const mat = { standard: { wand: 'a' }, raeume: { [r.id]: { wand: 'b', waende: { [r.waende[1].id]: 'c', [r.waende[2].id]: null } } } };
  const sys = (wid) => systemFuer(mat, r.id, f.find((x) => x.wand === wid));
  assert.equal(sys(r.waende[0].id), 'b');
  assert.equal(sys(r.waende[1].id), 'c');
  assert.equal(sys(r.waende[2].id), null);
  assert.equal(systemFuer(mat, 'anderer', wa), 'a');
});

test('Material: Bedarf mit Putzdicke, Verschnitt und Gebinden', () => {
  const r = raum([[0, 0], [4, 0], [4, 3], [0, 3]]);
  const b = berechne(r);
  const erg = bedarf({ standard: { wand: 'test-putz', decke: 'test-putz' }, parameter: { 'test-putz': { dicke: 15 } } }, [{ raum: r, b }], [PUTZ]);
  // Wände 14 m × 2,5 m = 35 m², Decke 12 m² → 47 m²
  assert.ok(Math.abs(erg.jeSystem[0].m2 - 47) < 1e-9);
  const putz = erg.material.find((x) => x.name === 'Putz');
  // 10 kg je 10 mm → 15 kg/m² bei 15 mm, +10 % Verschnitt
  assert.ok(Math.abs(putz.menge - 47 * 15 * 1.1) < 1e-9);
  assert.equal(putz.anzahl, Math.ceil((47 * 15 * 1.1) / 30));
  const ecke = erg.material.find((x) => x.name === 'Eckschiene');
  assert.ok(Math.abs(ecke.menge - 47 * 0.5) < 1e-9);
  assert.equal(erg.zuordnung.length, 5);
});

test('Material: Dachschrägen eigener Bereich', () => {
  let r = raum([[0, 0], [5, 0], [5, 4], [0, 4]]);
  r = setzeSchraege(r, r.waende[0].id, { kniestock: 1, art: 'winkel', wert: 45 }).raum;
  const b = berechne(r);
  const f = flaechenVon(r, b);
  const s = f.find((x) => x.bereich === 'schraege');
  assert.ok(s && Math.abs(s.flaeche - b.dachNetto) < 1e-9);
  const erg = bedarf({ standard: { schraege: 'test-putz' } }, [{ raum: r, b }], [{ ...PUTZ, bereiche: ['schraege'] }]);
  assert.equal(erg.zuordnung.length, 1);
  assert.equal(erg.zuordnung[0].flaeche.bereich, 'schraege');
});

test('Material: Trennwand rechnet je Raum die Hälfte', () => {
  const r = raum([[0, 0], [4, 0], [4, 3], [0, 3]]);
  const b = berechne(r);
  const tw = { ...PUTZ, id: 'tw', trennwand: true, positionen: [{ name: 'Platte', menge: 2, einheit: 'm²' }], verschnitt: 0 };
  const erg = bedarf({ standard: { wand: 'tw' } }, [{ raum: r, b }], [tw]);
  // 35 m² Wandfläche, 2 m² Platte je m² Wand (beide Seiten) → je Raumseite 1 m²
  assert.ok(Math.abs(erg.material[0].menge - 35) < 1e-9);
  assert.ok(STANDARD_SYSTEME.filter((s) => s.trennwand).length >= 5);
});

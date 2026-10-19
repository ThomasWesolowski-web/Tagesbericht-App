// Rechnung des Baustellen-Zeitplans: Vorlagen, Gerüst-Standzeit, Verschieben, Auslastung und Konflikte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VORLAGEN, abschnitteAusVorlage, geruestInfo, verschieben, planRechnen, neuerAuftrag, neuerAbschnitt, plusArbeitstage, abschnittKonflikte,
} from '../zeitplan.js';

const vorlage = (id) => VORLAGEN.find((v) => v.id === id);
const max = { id: 'p1', name: 'Max Mustermann', kategorie: 'Facharbeiter', gewerk: 'Putz' };
const erika = { id: 'p2', name: 'Erika Musterfrau', kategorie: 'Lehrling', gewerk: 'Putz', schultag: 4 };
const buero = { id: 'p3', name: 'Moritz Beispiel', kategorie: 'Büro' };

test('Arbeitstage überspringen Wochenende und Feiertage', () => {
  // Fr 30.10.2026 + 2 Arbeitstage = Mo 02.11. (Allerheiligen ist ein Sonntag)
  assert.equal(plusArbeitstage('2026-10-30', 2), '2026-11-02');
  // 24.12.2026 (Do) + 2 = 28.12. (25./26. Feiertage, dann Wochenende)
  assert.equal(plusArbeitstage('2026-12-24', 2), '2026-12-28');
});

test('Vorlage Nur Gerüst: Aufbau, 4 Wochen Standzeit, Abbau', () => {
  const ab = abschnitteAusVorlage(vorlage('geruest'), '2026-11-09');
  assert.deepEqual(ab.map((x) => [x.typ, x.von, x.bis]), [['auf', '2026-11-09', '2026-11-10'], ['ab', '2026-12-09', '2026-12-09']]);
  const a = neuerAuftrag({ art: 'geruest', abschnitte: ab });
  const g = geruestInfo(a);
  assert.equal(g.standVon, '2026-11-11');
  assert.equal(g.standBis, '2026-12-08');
  assert.equal(g.tage, 28);
  assert.equal(g.verlaengerung, 0);
  // Abbau eine Woche später: eine Woche über der Grundstandzeit
  assert.equal(geruestInfo(verschieben(a, ab[1].id, 7)).verlaengerung, 1);
});

test('Verschieben nimmt die folgenden Abschnitte mit', () => {
  const a = neuerAuftrag({ abschnitte: abschnitteAusVorlage(vorlage('innenputz'), '2026-11-16') });
  const [putz, trocknen, maler] = a.abschnitte;
  const mit = verschieben(a, trocknen.id, 7, true);
  assert.equal(mit.abschnitte[0].von, putz.von);
  assert.equal(mit.abschnitte[1].von, '2026-11-30');
  assert.equal(mit.abschnitte[2].bis > maler.bis, true);
  const ohne = verschieben(a, trocknen.id, 7, false);
  assert.equal(ohne.abschnitte[2].von, maler.von);
});

test('Auslastung: 8 h pro Tag, Urlaub und Berufsschule zählen nicht, Büro gar nicht', () => {
  const a = neuerAuftrag({
    abschnitte: [neuerAbschnitt({ name: 'Putz', gewerk: 'Putz', von: '2026-11-16', bis: '2026-11-20', leute: [{ personId: 'p1', name: max.name, stunden: 8 }, { personId: 'p2', name: erika.name, stunden: 8 }] })],
  });
  const urlaub = [{ status: 'genehmigt', personId: 'p1', name: max.name, von: '2026-11-19', bis: '2026-11-20' }];
  const r = planRechnen([a], [max, erika, buero], '2026-11-16', 1, urlaub);
  assert.equal(r.personen.length, 2);
  const w = r.wochen[0];
  const pm = w.proPerson.find((x) => x.person.id === 'p1');
  const pe = w.proPerson.find((x) => x.person.id === 'p2');
  assert.equal(pm.plan, 40);
  assert.equal(pm.frei, 24);
  assert.deepEqual(pm.konflikte.map((k) => k.art), ['urlaub', 'urlaub']);
  assert.equal(pe.plan, 32); // freitags Berufsschule: nicht eingeplant gezählt
  assert.equal(pe.frei, 32);
  assert.equal(w.plan, 72);
  assert.equal(w.frei, 56);
  assert.equal(abschnittKonflikte(a.abschnitte[0], r).length, 1);
});

test('Doppelt eingeplant und Gerüstfläche je Woche', () => {
  const eins = neuerAuftrag({ baustelle: 'A', flaeche: '280', art: 'geruest', abschnitte: abschnitteAusVorlage(vorlage('geruest'), '2026-11-09') });
  const zwei = neuerAuftrag({
    baustelle: 'B',
    abschnitte: [neuerAbschnitt({ von: '2026-11-09', bis: '2026-11-13', leute: [{ personId: 'p1', stunden: 8 }] }),
      neuerAbschnitt({ von: '2026-11-11', bis: '2026-11-11', leute: [{ personId: 'p1', stunden: 4 }] })],
  });
  const r = planRechnen([eins, zwei], [max], '2026-11-09', 2, []);
  assert.deepEqual(r.wochen[0].proPerson[0].konflikte, [{ tag: '2026-11-11', art: 'doppelt' }]);
  assert.equal(r.wochen[0].geruestFlaeche, 280);
  assert.equal(r.wochen[1].geruestFlaeche, 280);
  assert.equal(r.wochen[1].plan, 0);
});

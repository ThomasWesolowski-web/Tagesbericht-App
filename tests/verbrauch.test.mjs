// Materialliste aus Rapporten: Freitext „Material und Geräte“ lesen und zusammenfassen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zerlegen, materialLesen, materialListe, mengeText } from '../verbrauch.js';

const lies = (t) => zerlegen(t).map((s) => { const m = materialLesen(s); return [m.name, m.menge, m.einheit]; });

test('Verbrauch: einfache Zeilen mit Menge und Einheit', () => {
  assert.deepEqual(lies('7 Kg Kalkglätte'), [['Kalkglätte', 7, 'kg']]);
  assert.deepEqual(lies('5kg Streichputz'), [['Streichputz', 5, 'kg']]);
  assert.deepEqual(lies('3 l Kalkfarbe'), [['Kalkfarbe', 3, 'l']]);
  assert.deepEqual(lies('250 ml Tapetenentferner'), [['Tapetenentferner', 0.25, 'l']]);
  assert.deepEqual(lies('0,5 Kubik Bauschutt, gemischt'), [['Bauschutt (Entsorgung)', 0.5, 'm³']]);
  assert.deepEqual(lies('Drei Dosen PU Schaum'), [['PU-Schaum', 3, 'Dosen']]);
});

test('Verbrauch: Komma trennt Materialien, aber nicht Dezimalzahlen und Namensteile', () => {
  assert.deepEqual(lies('20 kg Kalkzement, leicht Putz\n10 kg Armierung Spachtel grau'),
    [['Kalkzement-Leichtputz', 20, 'kg'], ['Armierungsspachtel', 10, 'kg']]);
  assert.deepEqual(lies('10 kg Fugenfüller, 5 à 2,5m Aluminiumeckwinkel. '),
    [['Fugenfüller', 10, 'kg'], ['Alu-Eckwinkel', 12.5, 'm']]);
  assert.deepEqual(lies('EPS 120 mm, circa 11 m² inklusive Verschnitt'), [['EPS-Dämmplatten 120 mm', 11, 'm²']]);
  assert.deepEqual(lies('Vier Platten gkb 10m2 inklusive Verschnitt,  50 Kilo HP, 100'),
    [['Gipskartonplatten GKB', 10, 'm²'], ['Haftputz HP 100', 50, 'kg']]);
  assert.deepEqual(lies('25 kg Kalkglätte, 10 m² abdeckt Vlies, eine Rolle fünfziger Goldband.'),
    [['Kalkglätte', 25, 'kg'], ['Abdeckvlies', 10, 'm²'], ['Klebeband', 1, 'Rollen']]);
});

test('Verbrauch: Hinweise für ca., Verschnitt und zweite Menge', () => {
  assert.equal(materialLesen('EPS 120 mm, circa 11 m² inklusive Verschnitt').hinweis, 'ca., inkl. Verschnitt');
  assert.equal(materialLesen('Vier Platten gkb 10m2 inklusive Verschnitt').hinweis, 'inkl. Verschnitt, 4 Platten');
  assert.equal(mengeText(1, 'Rollen'), '1 Rolle');
  assert.equal(mengeText(3.2, 'm'), '3,2 m');
});

test('Verbrauch: unbekanntes Material bleibt mit eigenem Namen, ohne Menge extra', () => {
  const m = materialLesen('2 Sack Sondermörtel XY');
  assert.deepEqual([m.name, m.menge, m.einheit, m.gruppe], ['Sondermörtel XY', 2, 'Sack', 'Sonstiges']);
  const l = materialListe([{ id: 'a', datum: '2026-01-02', material: 'Dichtband und Gewebe' }]);
  assert.equal(l.summen.length, 0);
  assert.equal(l.ohneMenge.length, 1);
});

test('Verbrauch: gleiche Materialien werden über mehrere Rapporte addiert', () => {
  const l = materialListe([
    { id: 'b', datum: '2026-01-05', material: '9 m² GKB\n10 kg Fugenfüller' },
    { id: 'a', datum: '2026-01-02', material: '1 m² GKB, 5 kg Fugenfüller' },
    { id: 'c', datum: '2026-01-07', material: 'Vier Platten gkb 10m2 inklusive Verschnitt' },
  ]);
  const gkb = l.summen.find((s) => s.name === 'Gipskartonplatten GKB');
  assert.equal(gkb.menge, 20);
  assert.equal(gkb.hinweis, '');
  assert.deepEqual(gkb.daten.map((d) => d.datum), ['2026-01-02', '2026-01-05', '2026-01-07']);
  assert.equal(l.summen.find((s) => s.name === 'Fugenfüller').menge, 15);
  assert.equal(l.summen[0].gruppe, 'Trockenbau');
});

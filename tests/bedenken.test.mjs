import test from 'node:test';
import assert from 'node:assert/strict';
import { ANLAESSE, GEGEN, bedenkenBrief, bedenkenFehlt, bedenkenMarkdown, fristVorschlag, textDazu, textWeg } from '../bedenken.js';

test('jeder Anlass hat Texte und gültige Bedenken-Richtung', () => {
  const ids = new Set(GEGEN.map((g) => g.id));
  for (const a of ANLAESSE) {
    assert.ok(a.sachverhalt && a.folgen && a.vorschlag, a.id);
    assert.ok(a.gegen.length && a.gegen.every((g) => ids.has(g)), a.id);
  }
  assert.equal(new Set(ANLAESSE.map((a) => a.id)).size, ANLAESSE.length);
});

test('Texte übernehmen und wieder herausnehmen', () => {
  let f = textDazu('', 'A.');
  f = textDazu(f, 'B.');
  assert.equal(f, 'A.\nB.');
  assert.equal(textDazu(f, 'A.'), f);
  assert.equal(textWeg(f, 'A.'), 'B.');
  assert.equal(textWeg('eigener Text', 'A.'), 'eigener Text');
});

test('Frist 5 Tage nach Datum, auch über den Monatswechsel', () => {
  assert.equal(fristVorschlag('2026-11-28'), '2026-12-03');
  assert.equal(fristVorschlag(''), '');
});

test('Pflichtangaben', () => {
  assert.match(bedenkenFehlt({}).text, /Auftraggeber/);
  assert.match(bedenkenFehlt({ auftraggeber: 'X' }).text, /wogegen/);
  assert.match(bedenkenFehlt({ auftraggeber: 'X', bdGegen: ['vorleistung'] }).text, /Sachverhalt/);
  assert.equal(bedenkenFehlt({ auftraggeber: 'X', bdGegen: ['vorleistung'], bdSachverhalt: 'feucht' }), null);
});

test('Brief nennt § 4 Abs. 3 und § 13 Abs. 3 VOB/B, Frist und Optionen', () => {
  const r = { auftraggeber: 'Max Mustermann', bdGegen: ['vorleistung', 'ausfuehrung'], bdVorleister: 'Muster Fensterbau', bdSachverhalt: 'Putzgrund feucht.', bdFolgen: 'Ablösungen.', bdVorschlag: 'Trocknen.', bdFrist: '2026-11-18', bdBehinderung: true };
  const b = bedenkenBrief(r, { fotos: 3 });
  const text = b.absaetze.map((a) => [a.text, ...(a.liste || [])].join(' ')).join(' ');
  assert.match(b.betreff, /§ 4 Abs\. 3 VOB\/B/);
  assert.match(text, /§ 13 Abs\. 3 VOB\/B/);
  assert.match(text, /bis spätestens 18\.11\.2026/);
  assert.match(text, /zurück\./);
  assert.match(text, /§ 6 Abs\. 1 VOB\/B/);
  assert.match(text, /Muster Fensterbau/);
  assert.match(text, /beigefügten Fotos/);
  assert.equal(b.anlagen, 'Anlage: 3 Fotos');
  const ohne = bedenkenBrief({ ...r, bdRuhen: false, bdBehinderung: false, bdFrist: '' });
  const t2 = ohne.absaetze.map((a) => a.text || '').join(' ');
  assert.doesNotMatch(t2, /§ 6/);
  assert.doesNotMatch(t2, /stellen wir/);
  assert.match(t2, /umgehend/);
  assert.match(bedenkenMarkdown(r, { fotos: 1 }), /Antwort erbeten bis:\*\* 18\.11\.2026/);
});

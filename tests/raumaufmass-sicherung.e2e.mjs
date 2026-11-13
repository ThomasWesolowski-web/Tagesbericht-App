// Sicherung der Raumaufmaße im Repo (raumaufmass/ra-sync.js), im Browser mit einem nachgebauten
// GitHub (nur im Speicher, nichts geht ins Netz). Vorher im Hauptordner: python3 -m http.server 8000
// Aufruf: node tests/raumaufmass-sicherung.e2e.mjs
// Prüft: Gerät A sichert ein Aufmaß und ein eigenes System, ein neues Gerät B mit demselben Namen bekommt
// beides zurück, ein Mitarbeiter mit anderem Namen nicht, der Administrator schon; ändern beide Geräte
// dasselbe Aufmaß, bleiben beide Fassungen erhalten; Löschen markiert die Datei nur als gelöscht.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const URL0 = process.env.APP_URL || 'http://localhost:8000/raumaufmass/';

// ---------- nachgebautes Repo ----------
const repo = new Map(); // pfad -> { text, sha }
let shaZaehler = 0;
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');

async function githubRoute(route) {
  const req = route.request();
  const url = new URL(req.url());
  const m = /^\/repos\/[^/]+\/[^/]+(.*)$/.exec(url.pathname);
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (!m) return json(404, {});
  const rest = m[1];
  if (rest === '' || rest.startsWith('/branches/')) return json(200, { permissions: { push: true } });
  const c = /^\/contents\/(.*)$/.exec(rest);
  if (!c) return json(404, { message: 'nicht nachgebaut' });
  const pfad = c[1].split('/').map(decodeURIComponent).join('/');
  if (req.method() === 'GET') {
    const f = repo.get(pfad);
    if (f) return json(200, { path: pfad, sha: f.sha, content: b64(f.text), type: 'file' });
    const kinder = [...repo.entries()].filter(([p]) => p.startsWith(`${pfad}/`) && !p.slice(pfad.length + 1).includes('/'));
    if (kinder.length) return json(200, kinder.map(([p, x]) => ({ path: p, name: p.split('/').pop(), sha: x.sha, type: 'file' })));
    return json(404, { message: 'Not Found' });
  }
  if (req.method() === 'PUT') {
    const body = JSON.parse(req.postData());
    const alt = repo.get(pfad);
    if (alt && body.sha !== alt.sha) return json(409, { message: 'sha passt nicht' });
    if (!alt && body.sha) return json(422, { message: 'gibt es nicht' });
    const sha = `sha${++shaZaehler}`;
    repo.set(pfad, { text: Buffer.from(body.content, 'base64').toString('utf8'), sha });
    return json(200, { content: { sha, path: pfad } });
  }
  return json(405, {});
}

const browser = await chromium.launch();
async function geraet({ name, admin = false }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://api.github.com/**', githubRoute);
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', (e) => fehler.push(e.message));
  await p.goto(URL0);
  await p.evaluate(({ name, admin }) => localStorage.setItem('tagesberichte.settings', JSON.stringify({ token: 'test', author: name, admin })), { name, admin });
  await p.reload();
  await p.waitForSelector('#neu');
  await abgleichen(p); // der Abgleich, den die Liste beim Öffnen von selbst startet
  return { ctx, p, fehler };
}
const abgleichen = async (p) => p.evaluate(async () => {
  const { raumaufmassAbgleichen } = await import('./ra-sync.js');
  const db = await import('../db.js');
  const s = db.loadSettings();
  return raumaufmassAbgleichen(s, { alle: s.admin === true });
});
const speicher = (p, code, arg) => p.evaluate(async ({ code, arg }) => {
  const sp = await import('./ra-speicher.js');
  const g = await import('./raumgeometrie.js');
  const raum = (name) => ({ ...g.neuerRaum(1), name });
  return (new Function('sp', 'raum', 'arg', `return (async () => { ${code} })();`))(sp, raum, arg);
}, { code, arg });
const projekte = (p) => speicher(p, 'return (await sp.alleProjekte()).map((x) => ({ id: x.id, name: x.name, raeume: x.raeume.length }));');
const aufmassDateien = () => [...repo.keys()].filter((k) => k.startsWith('raumaufmass/') && k !== 'raumaufmass/systeme.json');

// 1. Gerät A legt ein Aufmaß und ein eigenes System an und sichert
const A = await geraet({ name: 'Max Mustermann' });
await speicher(A.p, `await sp.projektSpeichern({ id: 'p-1111-aaaa', name: 'Musterstraße 1', baustelle: { id: 'b1', name: 'Musterstraße 1' }, datum: '13.11.2026', raeume: [raum('Küche')], erstellt: 1 });
  await sp.systemRoh({ id: 'eigen-1', name: 'Eigenes System', geaendertAm: Date.now(), positionen: [] });`);
let erg = await abgleichen(A.p);
assert.equal(erg.hochgeladen, 1);
assert.deepEqual(aufmassDateien(), ['raumaufmass/musterstrasse-1_p-1111-a.json']);
const datei = JSON.parse(repo.get(aufmassDateien()[0]).text);
assert.equal(datei.erstelltVon, 'Max Mustermann');
assert.equal(datei.raeume.length, 1);
assert.equal(JSON.parse(repo.get('raumaufmass/systeme.json').text).systeme[0].id, 'eigen-1');
erg = await abgleichen(A.p);
assert.equal(erg.hochgeladen, 0, 'unverändert wird nicht neu hochgeladen');
// Liste zeigt „gesichert“
await A.p.reload();
await A.p.waitForSelector('#ra-sicherung');
assert.match(await A.p.textContent('#ra-sicherung'), /im Repo gesichert/);
console.log('Gerät A sichert: ok');

// 2. Neues Gerät B (derselbe Name) bekommt Aufmaß und System zurück
const B = await geraet({ name: 'max mustermann' }); // holt schon beim Öffnen der Liste
assert.deepEqual((await projekte(B.p)).map((x) => x.name), ['Musterstraße 1']);
assert.equal((await speicher(B.p, 'return (await sp.alleSysteme()).length;')), 1);
console.log('Neues Gerät holt zurück: ok');

// 3. Anderer Mitarbeiter bekommt es nicht, der Administrator schon
const C = await geraet({ name: 'Erika Musterfrau' });
await abgleichen(C.p);
assert.equal((await projekte(C.p)).length, 0);
const D = await geraet({ name: 'Chef', admin: true });
await abgleichen(D.p);
assert.equal((await projekte(D.p)).length, 1);
console.log('Nur eigene / Admin alle: ok');

// 4. Beide Geräte ändern dasselbe Aufmaß: nichts geht verloren
await speicher(A.p, `const x = await sp.projektLaden('p-1111-aaaa'); x.raeume.push(raum('Bad')); await sp.projektSpeichern(x);`);
await speicher(B.p, `const x = await sp.projektLaden('p-1111-aaaa'); x.raeume.push(raum('Flur'), raum('WC')); await sp.projektSpeichern(x);`);
erg = await abgleichen(A.p);
assert.equal(erg.hochgeladen, 1);
erg = await abgleichen(B.p);
assert.equal(erg.kopien, 1, 'B behält seine Fassung als Kopie');
const beiB = await projekte(B.p);
assert.equal(beiB.length, 2);
assert.equal(beiB.find((x) => x.id === 'p-1111-aaaa').raeume, 2, 'Fassung von A übernommen');
assert.equal(beiB.find((x) => x.id !== 'p-1111-aaaa').raeume, 3, 'eigene Fassung als Kopie');
assert.equal(aufmassDateien().length, 2, 'Kopie ebenfalls gesichert');
assert.equal(JSON.parse(repo.get('raumaufmass/musterstrasse-1_p-1111-a.json').text).raeume.length, 2);
console.log('Gleichzeitig geändert, beide Fassungen bleiben: ok');

// 5. Löschen: Datei bleibt mit Inhalt, wird als gelöscht markiert und verschwindet auf dem anderen Gerät
await speicher(A.p, `await sp.projektLoeschen('p-1111-aaaa');`);
await abgleichen(A.p);
const geloescht = JSON.parse(repo.get('raumaufmass/musterstrasse-1_p-1111-a.json').text);
assert.ok(geloescht.geloescht);
assert.equal(geloescht.raeume.length, 2, 'Inhalt bleibt im Repo');
await abgleichen(B.p);
assert.ok(!(await projekte(B.p)).some((x) => x.id === 'p-1111-aaaa'));
// Gelöschtes System verschwindet ebenfalls
await A.p.evaluate(async () => { (await import('./ra-speicher.js')).systemGeloeschtMerken('eigen-1'); await (await import('./ra-speicher.js')).systemEntfernen('eigen-1'); });
await abgleichen(A.p);
await abgleichen(B.p);
assert.equal((await speicher(B.p, 'return (await sp.alleSysteme()).length;')), 0);
console.log('Löschen nur als Markierung: ok');

for (const g of [A, B, C, D]) assert.deepEqual(g.fehler, []);
await browser.close();
console.log('Alle Prüfungen der Sicherung bestanden.');

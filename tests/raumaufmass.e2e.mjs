// Bedien-Test des Raumaufmaßes im Browser (Chromium über Playwright), Handy-Format 390 × 844.
// Vorher die App starten: python3 -m http.server 8000
// Aufruf: node tests/raumaufmass.e2e.mjs [Ordner für Bildschirmfotos]
// Zeichnet ein L mit Finger (Touch) und eines mit Maus, setzt Maße, verschiebt eine Wand,
// testet Rückgängig/Wiederholen, Tür, Fenster, Raumhöhe, Speichern, Neuladen, PDF.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
const URL0 = process.env.APP_URL || 'http://localhost:8000/';
const SHOTS = process.argv[2] || null;
let letzteSeite = null;
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };

// L-Form als Freihandlinie in Bildschirmpunkten (40 px ≈ 1 m), mit Zittern und runden Ecken
function lPunkte(x0, y0) {
  const m = 40;
  const ecken = [[0, 0], [6, 0], [6, 2.5], [4, 2.5], [4, 4], [0, 4]].map(([x, y]) => [x0 + x * m, y0 + y * m]);
  let s = 7;
  const z = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 3; };
  const pts = [];
  const zug = [...ecken, [ecken[0][0] + 4, ecken[0][1] + 6]];
  for (let i = 0; i < zug.length - 1; i++) {
    const [ax, ay] = zug[i];
    const [bx, by] = zug[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    for (let t = i ? 6 : 0; t < l - 6; t += 6) pts.push([ax + ((bx - ax) * t) / l + z(), ay + ((by - ay) * t) / l + z() + t * 0.03]);
  }
  pts.push(zug[zug.length - 1]);
  return pts;
}

async function zeichneTouch(p, cdp, pts) {
  const box = await p.locator('.ra-svg').boundingBox();
  const tp = ([x, y]) => [{ x: box.x + x, y: box.y + y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
  for (const q of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(q) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function zeichneMaus(p, pts) {
  const box = await p.locator('.ra-svg').boundingBox();
  await p.mouse.move(box.x + pts[0][0], box.y + pts[0][1]);
  await p.mouse.down();
  for (const q of pts.slice(1)) await p.mouse.move(box.x + q[0], box.y + q[1]);
  await p.mouse.up();
}
// Maßzahl einer Wand am Bildschirm finden (Text „A: 6,00“); Antippen der Maßzahl zählt wie die Wand
async function wandPunkt(p, name) {
  return p.evaluate((n) => {
    const svg = document.querySelector('.ra-svg');
    const r = svg.getBoundingClientRect();
    const t = [...svg.querySelectorAll('text')].find((x) => x.textContent.startsWith(`${n}: `));
    const b = t.getBoundingClientRect();
    return [b.x + b.width / 2 - r.x, b.y + b.height / 2 - r.y];
  }, name);
}
const werte = (p) => p.locator('.ra-werte').innerText();

async function neuesAufmass(p) {
  await p.goto(URL0);
  const de = p.getByText('Deutsch', { exact: true });
  if (await de.isVisible().catch(() => false)) await de.click();
  await p.goto(`${URL0}#/aufmass/neu`);
  await p.fill('#sheet-frei', 'Musterbaustelle');
  await p.click('#sheet-frei-ok');
  await p.click('#ra-neu');
  await p.waitForSelector('.ra-view');
}

async function lauf(opt) {
  const b = await chromium.launch();
  try {
    await ablauf(b, opt);
  } catch (e) {
    if (SHOTS && letzteSeite) await letzteSeite.screenshot({ path: `${SHOTS}/fehler.png` }).catch(() => {});
    throw e;
  } finally {
    await b.close();
  }
}

async function ablauf(b, { touch }) {
  const ctx = await b.newContext(touch ? { ...devices['iPhone 13'] } : { viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  letzteSeite = p;
  const fehler = [];
  p.on('pageerror', (e) => fehler.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  await neuesAufmass(p);
  const art = touch ? 'touch' : 'maus';
  await shot(p, `${art}-1-leer`);

  // Zeichnen, Seite darf dabei nicht scrollen
  const scrollVor = await p.evaluate(() => [window.scrollX, window.scrollY]);
  const pts = lPunkte(50, 60);
  if (touch) await zeichneTouch(p, await ctx.newCDPSession(p), pts);
  else await zeichneMaus(p, pts);
  assert.deepEqual(await p.evaluate(() => [window.scrollX, window.scrollY]), scrollVor, 'Seite hat beim Zeichnen gescrollt');
  await p.waitForSelector('.ra-dialog:not([hidden])');
  assert.match(await p.locator('.ra-dialog-box').innerText(), /Raum schließen\?[\s\S]*6 Wände/);
  await shot(p, `${art}-2-schliessen`);
  await p.click('.ra-dialog [data-wert="ja"]');
  await shot(p, `${art}-3-erkannt`);
  // Maßstab: Wand A (oben) antippen, 6,00 m eingeben
  const a = await wandPunkt(p, 'A');
  const box = await p.locator('.ra-svg').boundingBox();
  const tippe = async ([x, y]) => (touch ? p.touchscreen.tap(box.x + x, box.y + y) : p.mouse.click(box.x + x, box.y + y));
  await tippe(a);
  await p.waitForSelector('.ra-dialog:not([hidden]) .ra-eingabe');
  await p.fill('.ra-eingabe', '6,00');
  await p.click('.ra-dialog .ra-ok');
  assert.match(await werte(p), /^[^≈]*m²/, 'nach dem Maß kein ≈ mehr');
  // weitere Maße in der Liste: B = 2,50, C = 2,00, F = 4,00
  await p.click('.ra-massstab');
  for (const [w, v] of [['B', '2,5'], ['C', '2'], ['F', '4']]) {
    const inp = p.locator('.ra-wandzeile').filter({ has: p.locator('b', { hasText: new RegExp(`^${w}$`) }) }).locator('input');
    await inp.fill(v);
    await inp.press('Enter');
    await inp.blur().catch(() => {});
    await p.waitForTimeout(100);
  }
  await p.click('.ra-panel .ra-p-ok');
  let w = await werte(p);
  assert.match(w, /21,00 m²/, `Fläche erwartet 21,00 m², ist ${w}`);
  assert.match(w, /Umfang 20,00 m/);
  await shot(p, `${art}-4-massstab`);

  // Wand D (rechts unten, senkrecht bei x = 4) um 1 m nach außen ziehen
  await p.click('.mk-wz[data-wz="auswahl"]');
  const d1 = await wandPunkt(p, 'D');
  const s = await p.evaluate(() => {
    const t = [...document.querySelectorAll('.ra-svg text')].find((x) => x.textContent === 'A: 6,00');
    return t ? 1 : 0;
  });
  assert.equal(s, 1);
  // Maßstab am Bildschirm aus der Länge der Wand A
  const pxProM = await p.evaluate(() => {
    const ls = [...document.querySelectorAll('.ra-svg line')].filter((l) => l.getAttribute('stroke-width') === '3.5');
    const lens = ls.map((l) => Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value));
    return Math.max(...lens) / 6;
  });
  const start = d1;
  const ziel = [start[0] + pxProM * 1, start[1]];
  if (touch) {
    const cdp = await ctx.newCDPSession(p);
    await zeichneTouch(p, cdp, [start, ...Array.from({ length: 10 }, (_, k) => [start[0] + ((ziel[0] - start[0]) * (k + 1)) / 10, start[1]])]);
  } else await zeichneMaus(p, [start, ...Array.from({ length: 10 }, (_, k) => [start[0] + ((ziel[0] - start[0]) * (k + 1)) / 10, start[1]])]);
  w = await werte(p);
  assert.match(w, /22,50 m²/, `nach Verschieben 22,50 m² erwartet, ist ${w}`);
  await shot(p, `${art}-5-verschoben`);
  // Rückgängig / Wiederholen
  await p.click('.ra-zurueck');
  assert.match(await werte(p), /21,00 m²/);
  await p.click('.ra-vor');
  assert.match(await werte(p), /22,50 m²/);
  await p.click('.ra-zurueck');
  assert.match(await werte(p), /21,00 m²/);

  // Tür an Wand F (links), Fenster an Wand A (oben)
  for (const [wz, wand] of [['tuer', 'F'], ['fenster', 'A']]) {
    await p.click(`.mk-wz[data-wz="${wz}"]`);
    const q = await wandPunkt(p, wand);
    await tippe(q);
    await p.waitForSelector('.ra-panel:not([hidden])');
    await p.click('.ra-panel .ra-p-ok');
  }
  // Raumhöhe 2,62 m
  await p.click('.ra-einst');
  await p.fill('[data-raum="hoehe"]', '2,62');
  await p.press('[data-raum="hoehe"]', 'Tab');
  await p.fill('[data-raum="name"]', 'Wohnzimmer');
  await p.press('[data-raum="name"]', 'Tab');
  const liste = await p.locator('.ra-werteliste').innerText();
  // 20 m × 2,62 m = 52,40 m²; Tür 0,885 × 2,01 = 1,77885; Fenster 1,44
  assert.match(liste, /Wandfläche brutto\s*52,40 m²/);
  assert.match(liste, /Türflächen\s*1,78 m²/);
  assert.match(liste, /Fensterflächen\s*1,44 m²/);
  assert.match(liste, /Wandfläche netto\s*49,18 m²/);
  await shot(p, `${art}-6-einstellungen`);
  await p.click('.ra-panel .ra-p-ok');
  await shot(p, `${art}-7-fertig`);
  await p.click('.ra-fertig');
  await p.waitForSelector('.ra-view', { state: 'detached' });
  await p.waitForSelector('#ra-karten .fa-karte', { timeout: 5000 });
  const karte = await p.locator('#ra-karten').innerText();
  assert.match(karte, /Wohnzimmer[\s\S]*21,00 m² Boden · 20,00 m Umfang · 49,18 m² Wand/);
  const pos = await p.evaluate(() => [...document.querySelectorAll('#positionen input, #positionen textarea')].map((x) => x.value).join(' | '));
  assert.match(pos, /Wohnzimmer: Bodenfläche/);
  assert.match(pos, /Wohnzimmer: Wandfläche/);
  await shot(p, `${art}-8-positionen`);

  // Speichern, neu laden, wieder öffnen
  await p.click('#save-btn');
  await p.waitForURL(/#\/aufmass$/);
  await p.reload();
  await p.waitForTimeout(500);
  await p.locator('.rcard, .card, a[href^="#/bericht/"]').first().click();
  await p.waitForSelector('#ra-karten .fa-karte');
  assert.match(await p.locator('#ra-karten').innerText(), /21,00 m² Boden/);
  // PDF bauen (wie beim Teilen) und prüfen, dass der Grundriss drin ist
  const pdf = await p.evaluate(async () => {
    const db = await import('./db.js');
    const { buildPdf } = await import('./pdf.js');
    const r = (await db.allReports()).find((x) => x.art === 'aufmass');
    const files = await db.filesFor(r.id);
    const blob = await buildPdf(r, files, 'Max Mustermann');
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), raeume: r.raeume.length, dateien: files.map((f) => f.name) };
  });
  assert.equal(pdf.raeume, 1);
  assert.ok(pdf.dateien.some((n) => /^grundriss-.*\.svg$/.test(n)));
  if (SHOTS) writeFileSync(`${SHOTS}/${art}-aufmass.pdf`, Buffer.from(pdf.b64, 'base64'));
  await p.click('#ra-karten .ra-bearbeiten');
  await p.waitForSelector('.ra-view');
  w = await werte(p);
  assert.match(w, /21,00 m²/);
  assert.match(w, /Höhe 2,62 m/);
  assert.match(w, /Wand netto 49,18 m²/);
  await shot(p, `${art}-9-wieder-offen`);

  // Dachschräge an Wand B (rechts, 2,50 m): Kniestock 1,00 m, 45° → 1,62 m tief (Raumhöhe 2,62)
  // Grundriss der Schräge: 1,62 × 2,50 = 4,05 m² → 5,73 m² Schrägfläche, Decke 21 − 4,05 = 16,95 m²
  await p.click('.mk-wz[data-wz="auswahl"]');
  const box2 = await p.locator('.ra-svg').boundingBox();
  const [bx, by] = await wandPunkt(p, 'B');
  await (touch ? p.touchscreen.tap(box2.x + bx, box2.y + by) : p.mouse.click(box2.x + bx, box2.y + by));
  await p.waitForSelector('.ra-panel [data-tun="schraege"]');
  await p.click('.ra-panel [data-tun="schraege"]');
  await p.waitForSelector('.ra-dialog:not([hidden]) .ra-kn');
  await p.fill('.ra-kn', '1');
  await p.click('.ra-dialog [data-art="winkel"]');
  await p.fill('.ra-wert-ein', '45');
  assert.match(await p.locator('.ra-vorschau').innerText(), /1,62 m tief/);
  await p.click('.ra-dialog .ra-ok');
  w = await werte(p);
  assert.match(w, /Schräge 5,73 m² · Decke 16,95 m²/, `Schräge falsch: ${w}`);
  // Dachfenster 78 × 118 cm einsetzen → 5,73 − 0,92 = 4,81 m²
  await p.click('.ra-panel [data-tun="dachfenster"]');
  await p.waitForSelector('.ra-panel [data-feld="laenge"]');
  assert.match(await werte(p), /Schräge 4,81 m²/);
  await shot(p, `${art}-10-dachschraege`);
  await p.click('.ra-panel .ra-p-ok');
  await p.click('.ra-fertig');
  await p.waitForSelector('.ra-view', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#ra-karten')?.innerText.includes('Schräge'), null, { timeout: 5000 });
  assert.match(await p.locator('#ra-karten').innerText(), /4,81 m² Schräge/);
  const pos2 = await p.evaluate(() => [...document.querySelectorAll('#positionen input, #positionen textarea')].map((x) => x.value).join(' | '));
  assert.match(pos2, /Wohnzimmer: Dachschräge/);
  assert.match(pos2, /Wohnzimmer: Deckenfläche \(waagerecht\)/);
  await p.click('#save-btn');
  await p.waitForURL(/#\/aufmass$/);
  const pdf3 = await p.evaluate(async () => {
    const db = await import('./db.js');
    const { buildPdf } = await import('./pdf.js');
    const r = (await db.allReports()).find((x) => x.art === 'aufmass');
    const blob = await buildPdf(r, await db.filesFor(r.id), 'Max Mustermann');
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), schraege: !!r.raeume[0].waende.find((x) => x.schraege), df: r.raeume[0].dachfenster.length };
  });
  assert.ok(pdf3.schraege);
  assert.equal(pdf3.df, 1);
  if (SHOTS) writeFileSync(`${SHOTS}/${art}-aufmass-dachschraege.pdf`, Buffer.from(pdf3.b64, 'base64'));
  assert.deepEqual(fehler, [], `Fehler in der Konsole: ${fehler.join(' | ')}`);
}

await lauf({ touch: true });
console.log('Touch (iPhone-Format): ok');
await lauf({ touch: false });
console.log('Maus: ok');

// Bedien-Test der eigenen Raumaufmaß-App (raumaufmass/) im Browser (Chromium über Playwright),
// Handy-Format 390 × 844. Vorher im Hauptordner starten: python3 -m http.server 8000
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
const URL0 = process.env.APP_URL || 'http://localhost:8000/raumaufmass/';
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
// PDF des (einzigen) gespeicherten Aufmaßes bauen, wie beim Teilen
const pdfHolen = (p) => p.evaluate(async () => {
  const [pr] = await window.raumaufmassProjekte();
  const blob = await window.raumaufmassPdf(pr.id);
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { b64: btoa(s), text: s, raeume: pr.raeume.length, gruppen: new Set(pr.raeume.map((x) => x.gruppe)).size, schraege: !!pr.raeume[0].waende.find((x) => x.schraege), df: pr.raeume[0].dachfenster.length };
});

async function neuesAufmass(p) {
  await p.goto(URL0);
  await p.click('#neu');
  await p.waitForSelector('#name');
  await p.fill('#name', 'Musterbaustelle');
  await p.press('#name', 'Tab');
  await p.click('#raum-neu');
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
  p.on('pageerror', (e) => { fehler.push(String(e)); if (process.env.DEBUG) console.log('pageerror', e); });
  p.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); if (process.env.DEBUG && m.type() === 'error') console.log(m.text()); });
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
  await p.waitForTimeout(120); // Dialog fokussiert nach 50 ms das erste Feld
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
  await p.waitForTimeout(120); // Dialog fokussiert nach 50 ms das erste Feld
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
  const zieheD = async () => {
    const st = await wandPunkt(p, 'D');
    const pxM = await p.evaluate(() => {
      const ls = [...document.querySelectorAll('.ra-svg line')].filter((l) => l.getAttribute('stroke-width') === '3.5');
      return Math.max(...ls.map((l) => Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value))) / 6;
    });
    const zug = [st, ...Array.from({ length: 10 }, (_, k) => [st[0] + (pxM * (k + 1)) / 10, st[1]])];
    if (touch) await zeichneTouch(p, await ctx.newCDPSession(p), zug); else await zeichneMaus(p, zug);
  };
  // C hat ein Maß: D lässt sich nicht verschieben (C würde länger)
  await zieheD();
  assert.match(await werte(p), /21,00 m²/, 'gemessene Wand C darf sich nicht ändern');
  await p.click('.ra-panel .ra-p-ok').catch(() => {});
  // Maß an C entfernen, dann geht es
  await p.click('.ra-massstab');
  await p.locator('.ra-wandzeile').filter({ has: p.locator('b', { hasText: /^C$/ }) }).locator('[data-weg]').click();
  await p.click('.ra-panel .ra-p-ok');
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

  // Körper (Kamin 50 × 40 cm) in den Raum setzen: 21,00 − 0,20 = 20,80 m², danach rückgängig
  await p.click('.mk-wz[data-wz="koerper"]');
  const innen = await p.evaluate(() => {
    const svg = document.querySelector('.ra-svg');
    const r = svg.getBoundingClientRect();
    const b = svg.querySelector('polygon').getBoundingClientRect();
    return [b.x + b.width * 0.2 - r.x, b.y + b.height * 0.25 - r.y];
  });
  await tippe(innen);
  await p.waitForSelector('.ra-panel [data-feld="breite"]');
  await p.click('.ra-panel [data-name-wahl="Kamin"]');
  await p.fill('.ra-panel [data-feld="breite"]', '0,5');
  await p.press('.ra-panel [data-feld="breite"]', 'Tab');
  await p.fill('.ra-panel [data-feld="tiefe"]', '0,4');
  await p.press('.ra-panel [data-feld="tiefe"]', 'Tab');
  w = await werte(p);
  assert.match(w, /^20,80 m²/, `mit Kamin: ${w}`);
  assert.match(await p.locator('.ra-panel').innerText(), /Kamin · 0,20 m² Abzug/);
  await shot(p, `${art}-5b-koerper`);
  await p.click('.ra-panel .ra-p-ok');
  for (let k = 0; k < 4; k++) await p.click('.ra-zurueck');
  assert.match(await werte(p), /^21,00 m²/, 'Kamin rückgängig');

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
  await p.waitForSelector('#karten .fa-karte', { timeout: 5000 });
  const karte = await p.locator('#karten').innerText();
  assert.match(karte, /Wohnzimmer[\s\S]*21,00 m² Boden · 20,00 m Umfang · 49,18 m² Wand/);
  await shot(p, `${art}-8-karten`);

  // ist schon gespeichert: neu laden, Aufmaß wieder öffnen
  await p.reload();
  await p.waitForSelector('#karten .fa-karte');
  assert.match(await p.locator('#karten').innerText(), /21,00 m² Boden/);
  await p.goto(URL0);
  await p.click('.proj');
  await p.waitForSelector('#karten .fa-karte');
  assert.match(await p.locator('#karten').innerText(), /Wohnzimmer[\s\S]*21,00 m² Boden/);
  // PDF bauen und prüfen, dass der Raum drin ist
  const pdf = await pdfHolen(p);
  assert.equal(pdf.raeume, 1);
  if (SHOTS) writeFileSync(`${SHOTS}/${art}-aufmass.pdf`, Buffer.from(pdf.b64, 'base64'));
  await p.click('#karten .ra-bearbeiten');
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
  await p.waitForTimeout(120); // Dialog fokussiert nach 50 ms das erste Feld
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
  await p.waitForFunction(() => document.querySelector('#karten')?.innerText.includes('Schräge'), null, { timeout: 5000 });
  assert.match(await p.locator('#karten').innerText(), /4,81 m² Schräge/);
  const pdf3 = await pdfHolen(p);
  assert.ok(pdf3.schraege);
  assert.equal(pdf3.df, 1);
  if (SHOTS) writeFileSync(`${SHOTS}/${art}-aufmass-dachschraege.pdf`, Buffer.from(pdf3.b64, 'base64'));

  // Mehrere Räume: oben an Wand A (6,00 m) „Raum 2“ anbauen, 3,00 m tief, dann Raum wechseln
  await p.click('#karten .ra-bearbeiten');
  await p.waitForSelector('.ra-view');
  await p.click('.mk-wz[data-wz="auswahl"]');
  const tippe3 = async ([x, y]) => {
    const bx3 = await p.locator('.ra-svg').boundingBox();
    await (touch ? p.touchscreen.tap(bx3.x + x, bx3.y + y) : p.mouse.click(bx3.x + x, bx3.y + y));
  };
  const textPunkt = (inhalt) => p.evaluate((n) => {
    const svg = document.querySelector('.ra-svg');
    const r = svg.getBoundingClientRect();
    const t = [...svg.querySelectorAll('text')].find((x) => x.textContent === n);
    const b = t.getBoundingClientRect();
    return [b.x + b.width / 2 - r.x, b.y + b.height / 2 - r.y];
  }, inhalt);
  await tippe3(await wandPunkt(p, 'A'));
  await p.waitForSelector('.ra-panel [data-tun="anbauen"]');
  await p.click('.ra-panel [data-tun="anbauen"]');
  await p.waitForSelector('.ra-dialog:not([hidden]) .ra-tiefe');
  await p.waitForTimeout(120); // Dialog fokussiert nach 50 ms das erste Feld
  assert.equal(await p.inputValue('.ra-dialog .ra-n'), 'Raum 2');
  await p.fill('.ra-dialog .ra-tiefe', '3');
  await shot(p, `${art}-11-anbauen`);
  await p.click('.ra-dialog .ra-ok');
  w = await werte(p);
  assert.match(w, /^18,00 m²/, `angebaut: ${w}`);
  assert.match(await p.locator('.ra-titel').innerText(), /Raum 2 · 2 Räume/);
  await shot(p, `${art}-13-angebaut`);
  // grauen Wohnzimmer antippen → wird bearbeitet
  await tippe3(await textPunkt('Wohnzimmer'));
  await p.waitForFunction(() => document.querySelector('.ra-titel')?.textContent.startsWith('Wohnzimmer'));
  assert.match(await werte(p), /^21,00 m²/);
  // zurück zu Raum 2
  // grauen Raum 2 antippen → wird bearbeitet
  await tippe3(await textPunkt('Raum 2'));
  await p.waitForFunction(() => document.querySelector('.ra-titel')?.textContent.startsWith('Raum 2'));
  assert.match(await werte(p), /^18,00 m²/);
  // im eigenen Raum antippen: Raum-Panel mit Schiebepunkt
  await tippe3(await textPunkt('Raum 2'));
  await p.waitForSelector('.ra-panel [data-tun="weiter"]');
  assert.ok(await p.locator('.ra-griff').count());
  await shot(p, `${art}-14-gewechselt`);
  await p.click('.ra-panel .ra-p-ok');
  await p.click('.ra-fertig');
  await p.waitForSelector('.ra-view', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#karten')?.innerText.includes('Grundriss gesamt'), null, { timeout: 5000 });
  const karten = await p.locator('#karten').innerText();
  assert.match(karten, /Grundriss gesamt[\s\S]*2 Räume · 39,00 m² Boden/, karten);
  await shot(p, `${art}-15-karten`);
  const pdf4 = await pdfHolen(p);
  assert.equal(pdf4.raeume, 2);
  assert.equal(pdf4.gruppen, 1);
  if (SHOTS) writeFileSync(`${SHOTS}/${art}-aufmass-mehrere-raeume.pdf`, Buffer.from(pdf4.b64, 'base64'));
  assert.deepEqual(fehler, [], `Fehler in der Konsole: ${fehler.join(' | ')}`);
}

await lauf({ touch: true });
console.log('Touch (iPhone-Format): ok');
await lauf({ touch: false });
console.log('Maus: ok');

// Raumaufmaß: Raum grob mit Finger, Stift oder Maus auf einem Raster skizzieren. Die App erkennt
// daraus gerade Wände und Ecken (raumgeometrie.js), ein echtes Maß legt den Maßstab fest. Danach
// lassen sich Wände, Ecken, Maße, Türen und Fenster ändern. Alles läuft im Browser, ohne Server.
// openRaumAufmass(raum, { nachbarn, namen }) liefert { daten, svg, raeume, gesamtSvg } oder null:
// daten/svg = der zuletzt bearbeitete Raum, raeume = alle geänderten oder neuen Räume des Grundrisses
// ({ daten, svg } je Raum), gesamtSvg = Grundriss gesamt, wenn mehrere Räume zusammengehören.
// nachbarn = die anderen Räume desselben Grundrisses (gleiche gruppe), namen = alle Raumnamen im Aufmaß.

import {
  STANDARD, RASTER, erkenneKontur, raumAusEcken, geschlossen, wandGeo, wandIndex, berechne, pruefe, setzeMass,
  konfliktLoesen, verschiebeWand, verschiebeEcke, setzeRichtung, richtenAus, teileWand, loescheWand, loescheEcke,
  neueOeffnung, aendereOeffnung, loescheOeffnung, planElemente, elementeAlsSvg, richtungsText, richtungAusrichten,
  Verlauf, laengeLesen, wandName, fmt2, alsSvg, alsDxf, winkelVon, punkteVon, massstabFuer,
  schraegeWerte, setzeSchraege, SCHRAEGE_STANDARD, neuesDachfenster, aendereDachfenster, loescheDachfenster,
  dachfensterEcken, punktInnen, teileRaum, raumAnbauen, andocken, verschiebeRaum, raumMitte, pruefeGruppe,
  naechsterName, neuerRaum,
} from './raumgeometrie.js';

const NS = 'http://www.w3.org/2000/svg';
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kopie = (x) => JSON.parse(JSON.stringify(x));
const zahlText = (n, st = 2) => (Math.round(n * 10 ** st) / 10 ** st).toLocaleString('de-DE', { maximumFractionDigits: st, useGrouping: false });

const WERKZEUGE = [
  { id: 'zeichnen', label: 'Zeichnen', svg: '<path d="M4 20l1-5L16 4l4 4L9 19z M14 6l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'auswahl', label: 'Auswahl', svg: '<path d="M6 3l12 9-5.5 1.2L15 20l-2.6 1.2-2.6-6.6L6 18z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'mass', label: 'Maß', svg: '<path d="M3 8h18v8H3z M7 8v3M11 8v4M15 8v3M19 8v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'tuer', label: 'Tür', svg: '<path d="M4 20h16 M6 20V5h9v15 M12 13h.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
  { id: 'fenster', label: 'Fenster', svg: '<path d="M5 4h14v16H5z M12 4v16 M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
];
const IC = {
  rueck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L4 9l5 5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  vor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l5 5-5 5M20 9H10a6 6 0 0 0 0 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ansicht: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  massstab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  einst: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const HINWEIS = {
  zeichnen: 'Raum grob mit dem Finger nachfahren. Ecken müssen nicht genau sein, die App macht gerade Wände daraus.',
  auswahl: 'Wand, Ecke, Tür oder Fenster antippen zum Ändern. Ziehen verschiebt. Auf leerer Fläche ziehen verschiebt die Ansicht.',
  gruppe: 'Wand, Ecke, Tür oder Fenster antippen zum Ändern. Einen grauen Raum antippen, um ihn zu bearbeiten.',
  mass: 'Wand antippen und ihre echte Länge eingeben.',
  tuer: 'Auf eine Wand tippen, um dort eine Tür einzusetzen.',
  fenster: 'Auf eine Wand tippen, um dort ein Fenster einzusetzen.',
};

export async function openRaumAufmass(vorlage, { nachbarn = [], namen = [] } = {}) {
  let d = kopie(vorlage);
  let andere = kopie(nachbarn); // die anderen Räume des Grundrisses (grau)
  const anfangs = new Map([vorlage, ...nachbarn].map((r) => [r.id, JSON.stringify(r)]));
  d.einstellungen = { ...STANDARD, ...(d.einstellungen || {}) };
  d.skizze = d.skizze || { striche: [], faktor: 1 };
  d.oeffnungen = d.oeffnungen || [];
  d.dachfenster = d.dachfenster || [];
  let entwurf = null; // offene Kontur: { punkte, offen } (offen = „offen lassen“ gewählt)
  let werkzeug = geschlossen(d) ? (d.massstabGesetzt ? 'auswahl' : 'mass') : 'zeichnen';
  let auswahl = null; // { art: 'wand'|'ecke'|'oeffnung', id }
  let geaendert = false;
  const verlauf = new Verlauf({ raum: d, andere, entwurf });
  let ansicht = { s: 60, ox: 0, oy: 0 }; // Bildschirmpunkte je Meter, Verschiebung
  let strich = null; // Freihandstrich in Arbeit: { punkte, modus }
  let vorschau = null; // vorübergehender Raum beim Ziehen
  let meldung = '';
  let meldungZeit = 0;

  const view = document.createElement('div');
  view.className = 'mk-view ra-view';
  view.innerHTML = `
    <div class="mk-top">
      <button type="button" class="btn ghost ra-abbrechen">Abbrechen</button>
      <b class="ra-titel"></b>
      <button type="button" class="btn primary ra-fertig">Übernehmen</button>
    </div>
    <div class="fa-hinweis"><span class="fa-text ra-text"></span><span class="fa-knoepfe ra-knoepfe"></span></div>
    <div class="mk-flaeche ra-flaeche">
      <svg class="ra-svg" xmlns="${NS}"></svg>
      <button type="button" class="ra-werte" hidden></button>
      <div class="fa-zoomknoepfe"><button type="button" data-zoom="-" aria-label="Verkleinern">−</button><button type="button" data-zoom="+" aria-label="Vergrößern">+</button></div>
      <div class="fa-panel ra-panel" hidden></div>
    </div>
    <div class="mk-leiste">
      <div class="mk-werkzeuge">${WERKZEUGE.map((w) => `<button type="button" class="mk-wz" data-wz="${w.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${w.svg}</svg><span>${w.label}</span></button>`).join('')}</div>
      <div class="mk-farben ra-leiste2">
        <button type="button" class="mk-rueck ra-zurueck">${IC.rueck}<span>Rückgängig</span></button>
        <button type="button" class="mk-rueck ra-vor">${IC.vor}<span>Wiederholen</span></button>
        <button type="button" class="mk-rueck ra-ansicht">${IC.ansicht}<span>Alles zeigen</span></button>
        <button type="button" class="mk-rueck ra-massstab">${IC.massstab}<span>Maße</span></button>
        <button type="button" class="mk-rueck ra-einst">${IC.einst}<span>Einstellungen</span></button>
      </div>
    </div>
    <div class="ra-dialog" hidden><div class="ra-dialog-box"></div></div>`;
  document.body.appendChild(view);
  document.documentElement.classList.add('mk-offen');
  const $ = (s) => view.querySelector(s);
  const svg = $('.ra-svg');
  const panel = $('.ra-panel');
  const dialogBox = $('.ra-dialog-box');

  // ---------- Ansicht ----------
  const abb = ([x, y]) => [ansicht.ox + x * ansicht.s, ansicht.oy + y * ansicht.s];
  const welt = ([sx, sy]) => [(sx - ansicht.ox) / ansicht.s, (sy - ansicht.oy) / ansicht.s];
  const lokal = (e) => {
    const r = svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const groesse = () => {
    const r = svg.getBoundingClientRect();
    return [r.width || 1, r.height || 1];
  };
  const einpassen = () => {
    const [w, h] = groesse();
    const eigene = geschlossen(d) ? punkteVon(d) : (entwurf?.punkte || []);
    const pts = [...eigene, ...andere.filter(geschlossen).flatMap(punkteVon)];
    if (pts.length < 2) {
      // leeres Blatt: etwa 7 m Breite sichtbar, Nullpunkt links oben mit etwas Rand
      ansicht.s = Math.max(20, Math.min(w, h) / 7 / (d.skizze?.faktor || 1));
      ansicht.ox = w * 0.12;
      ansicht.oy = h * 0.15;
      return;
    }
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const bw = Math.max(...xs) - Math.min(...xs) || 1;
    const bh = Math.max(...ys) - Math.min(...ys) || 1;
    ansicht.s = Math.min((w - 110) / bw, (h - 130) / bh);
    ansicht.ox = w / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * ansicht.s;
    ansicht.oy = h / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * ansicht.s;
  };
  const zoomUm = (faktor, [sx, sy]) => {
    const neu = Math.max(4, Math.min(4000, ansicht.s * faktor));
    const f = neu / ansicht.s;
    ansicht.ox = sx - (sx - ansicht.ox) * f;
    ansicht.oy = sy - (sy - ansicht.oy) * f;
    ansicht.s = neu;
  };

  // ---------- Zeichnen ----------
  const rasterSvg = () => {
    const [w, h] = groesse();
    const einheit = d.massstabGesetzt ? 1 : (d.skizze?.faktor || 1);
    // Rasterweite in Metern (vor dem Maßstab in Zeichen-Einheiten, die etwa Metern entsprechen)
    let g = d.einstellungen.raster / einheit;
    const stufen = [1, 2, 5];
    let k = 0;
    while (g * ansicht.s < 12 && k < 30) { g = (g / stufen[k % 3]) * stufen[(k + 1) % 3] * (k % 3 === 2 ? 2 : 1); k++; }
    const gross = g < 1 / einheit ? 1 / einheit : g * 5;
    const [x0, y0] = welt([0, 0]);
    const [x1, y1] = welt([w, h]);
    let fein = '';
    let stark = '';
    const linien = (von, bis, schritt, fn) => {
      for (let v = Math.floor(von / schritt) * schritt; v <= bis; v += schritt) fn(v);
    };
    const istGross = (v) => Math.abs(v / gross - Math.round(v / gross)) < 1e-6;
    linien(x0, x1, g, (x) => { const s = ansicht.ox + x * ansicht.s; (istGross(x) ? (stark += `M${s.toFixed(1)} 0V${h}`) : (fein += `M${s.toFixed(1)} 0V${h}`)); });
    linien(y0, y1, g, (y) => { const s = ansicht.oy + y * ansicht.s; (istGross(y) ? (stark += `M0 ${s.toFixed(1)}H${w}`) : (fein += `M0 ${s.toFixed(1)}H${w}`)); });
    return `<path d="${fein}" stroke="#e3e7ec" stroke-width="1"/><path d="${stark}" stroke="#c9d0d8" stroke-width="1"/>`;
  };

  const anzeigeRaum = () => vorschau || d;
  // Schiebepunkt eines Raums: unter dem Namen und der Fläche in der Mitte
  const griffPunkt = (r) => { const m = abb(raumMitte(r)); return [m[0], m[1] + 44]; };
  const gruppenMassstab = () => andere.some((x) => geschlossen(x) && x.massstabGesetzt);
  // offene Kontur als vorläufiger Raum (ohne letzte Wand)
  const offeneKontur = (punkte, schliessen) => {
    if (!punkte || punkte.length < 2) return null;
    const e = erkenneKontur(punkte, { pxProEinheit: ansicht.s, einstellungen: d.einstellungen, schliessen });
    return e;
  };
  const offenerRaum = (e) => {
    const r = { ...d, ecken: e.ecken.map(([x, y], i) => ({ id: `o${i}`, x, y })), oeffnungen: [] };
    r.waende = e.ecken.slice(0, -1).map((_, i) => ({ id: `ow${i}`, von: `o${i}`, bis: `o${i + 1}`, mass: null }));
    return r;
  };

  let entwurfErkannt = null;
  const zeichne = () => {
    const r = anzeigeRaum();
    let html = rasterSvg();
    // mit Nachbarräumen stehen die Maße innen an den Wänden, sonst laufen die Maßketten in den Nachbarraum
    const optionen = { schrift: 13, wand: 3.5, duenn: 1.2, massAbstand: 24, masse: d.einstellungen.masseZeigen && (andere.length ? 'innen' : true), namen: geschlossen(r), ungefaehr: !d.massstabGesetzt };
    // andere Räume des Grundrisses grau, Maße innen
    for (const x of andere) {
      if (!geschlossen(x)) continue;
      html += elementeAlsSvg(planElemente(x, abb, { namen: false, schrift: 12, wand: 3, duenn: 1, massAbstand: 20, masse: d.einstellungen.masseZeigen ? 'innen' : false, ungefaehr: !x.massstabGesetzt, farbe: '#9aa3ad', mass: '#8a939d', fest: '#8a939d', flaeche: '#f4f6f8', schraege: '#e9edf1' }));
    }
    if (geschlossen(r)) {
      html += elementeAlsSvg(planElemente(r, abb, optionen));
    } else if (entwurfErkannt && !strich) {
      html += elementeAlsSvg(planElemente(offenerRaum(entwurfErkannt), abb, { ...optionen, mitFlaeche: false }));
      const a = abb(entwurfErkannt.ecken[0]);
      const b = abb(entwurfErkannt.ecken[entwurfErkannt.ecken.length - 1]);
      html += `<circle cx="${a[0]}" cy="${a[1]}" r="9" fill="#2e7d32" opacity=".85"/><circle cx="${b[0]}" cy="${b[1]}" r="11" fill="#0b57d0" opacity=".85"/>`;
    }
    // Auswahl hervorheben
    if (auswahl && geschlossen(r)) {
      if (auswahl.art === 'wand') {
        const i = wandIndex(r, auswahl.id);
        if (i >= 0) {
          const g = wandGeo(r, i);
          const a = abb(g.a);
          const b = abb(g.b);
          html += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" opacity=".55"/>`;
        }
      }
      if (auswahl.art === 'oeffnung') {
        const o = r.oeffnungen.find((x) => x.id === auswahl.id);
        const i = o ? wandIndex(r, o.wand) : -1;
        if (i >= 0) {
          const g = wandGeo(r, i);
          const a = abb([g.a[0] + g.r[0] * o.abstand, g.a[1] + g.r[1] * o.abstand]);
          const b = abb([g.a[0] + g.r[0] * (o.abstand + o.breite), g.a[1] + g.r[1] * (o.abstand + o.breite)]);
          html += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" opacity=".6"/>`;
        }
      }
      if (auswahl.art === 'raum') {
        html += `<polygon points="${punkteVon(r).map(abb).map((x) => x.join(',')).join(' ')}" fill="var(--accent)" fill-opacity=".08" stroke="var(--accent)" stroke-width="3" stroke-dasharray="8 6"/>`;
        const [x, y] = griffPunkt(r);
        html += `<g class="ra-griff"><circle cx="${x}" cy="${y}" r="17" fill="#0b57d0"/><path d="M${x - 10} ${y}h20M${x} ${y - 10}v20M${x - 10} ${y}l4-4M${x - 10} ${y}l4 4M${x + 10} ${y}l-4-4M${x + 10} ${y}l-4 4M${x} ${y - 10}l-4 4M${x} ${y - 10}l4 4M${x} ${y + 10}l-4-4M${x} ${y + 10}l4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></g>`;
      }
      if (auswahl.art === 'dachfenster') {
        const o = (r.dachfenster || []).find((x) => x.id === auswahl.id);
        const q = o ? dachfensterEcken(r, o) : null;
        if (q) html += `<polygon points="${q.map(abb).map((x) => x.join(',')).join(' ')}" fill="var(--accent)" fill-opacity=".25" stroke="var(--accent)" stroke-width="4"/>`;
      }
    }
    // Ecken als Griffe
    if (geschlossen(r)) {
      const gross = werkzeug === 'auswahl';
      r.ecken.forEach((e) => {
        const [x, y] = abb([e.x, e.y]);
        const an = auswahl?.art === 'ecke' && auswahl.id === e.id;
        html += `<circle cx="${x}" cy="${y}" r="${an ? 11 : gross ? 7 : 3.5}" fill="${an ? 'var(--accent)' : '#fff'}" stroke="#1d232a" stroke-width="${gross ? 2 : 1.5}"/>`;
      });
    }
    // Freihandstrich in Arbeit (blau) und erkannte Wände dazu (gestrichelt)
    if (strich) {
      const alle = strich.alle();
      if (strich.erkannt) {
        const e = strich.erkannt;
        const pts = [...e.ecken, ...(e.geschlossen ? [e.ecken[0]] : [])].map(abb);
        html += `<polyline points="${pts.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#1d232a" stroke-width="2.5" stroke-dasharray="7 5" opacity=".6"/>`;
      }
      html += `<polyline points="${alle.map(abb).map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')}" fill="none" stroke="#0b57d0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
      if (strich.nahAnfang) {
        const a = abb(alle[0]);
        html += `<circle cx="${a[0]}" cy="${a[1]}" r="16" fill="none" stroke="#2e7d32" stroke-width="3"/>`;
      }
    }
    svg.innerHTML = html;
    leisteAktualisieren();
  };

  const leisteAktualisieren = () => {
    view.querySelectorAll('.mk-wz').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wz === werkzeug)));
    $('.ra-zurueck').disabled = !verlauf.kannZurueck;
    $('.ra-vor').disabled = !verlauf.kannVor;
    $('.ra-titel').textContent = andere.length ? `${d.name || 'Raum'} · ${andere.length + 1} Räume` : (d.name || 'Raumaufmaß');
    const w = $('.ra-werte');
    if (geschlossen(d)) {
      const b = berechne(d);
      const u = d.massstabGesetzt ? '' : '≈ ';
      w.hidden = false;
      w.innerHTML = `<b>${u}${fmt2(b.bodenflaeche)} m²</b><span>Umfang ${u}${fmt2(b.umfang)} m · Höhe ${fmt2(b.hoehe)} m</span><span>Wand netto ${u}${fmt2(b.wandNetto)} m²</span>${b.mitSchraege ? `<span>Schräge ${u}${fmt2(b.dachNetto)} m² · Decke ${u}${fmt2(b.deckenflaeche)} m²</span>` : ''}`;
    } else w.hidden = true;
    hinweis();
  };

  const hinweis = (text) => {
    const t = $('.ra-text');
    const k = $('.ra-knoepfe');
    k.innerHTML = '';
    if (text) { meldung = text; meldungZeit = Date.now(); }
    if (strich?.rueckmeldung) { t.textContent = strich.rueckmeldung; return; }
    if (meldung && Date.now() - meldungZeit < 4000) { t.textContent = meldung; return; }
    meldung = '';
    if (werkzeug === 'zeichnen' && entwurf && entwurfErkannt) {
      t.textContent = 'Am blauen Punkt weiterzeichnen. Ist der Raum fertig, „Schließen“ tippen.';
      if (entwurfErkannt.schliessbar || entwurfErkannt.ecken.length >= 3) k.innerHTML = '<button type="button" class="chip ra-schliessen">Schließen</button>';
      k.innerHTML += '<button type="button" class="chip ra-verwerfen">Verwerfen</button>';
      k.querySelector('.ra-schliessen')?.addEventListener('click', () => konturSchliessen(entwurf.punkte));
      k.querySelector('.ra-verwerfen').onclick = () => { entwurf = null; entwurfErkannt = null; merken(); zeichne(); };
      return;
    }
    if (werkzeug === 'zeichnen' && geschlossen(d)) { t.textContent = 'Der Raum ist geschlossen. Mit „Auswahl“ Wände und Ecken ändern, mit „Maß“ Längen eingeben.'; return; }
    if (werkzeug !== 'zeichnen' && !geschlossen(d)) { t.textContent = 'Zuerst den Raum mit „Zeichnen“ skizzieren.'; return; }
    if (werkzeug === 'mass' && !d.massstabGesetzt) { t.textContent = 'Jetzt ein echtes Maß eingeben: eine Wand antippen. Danach stimmt der ganze Raum im Maßstab.'; return; }
    t.textContent = werkzeug === 'auswahl' && andere.length ? HINWEIS.gruppe : HINWEIS[werkzeug];
  };

  const merken = () => {
    verlauf.merken({ raum: d, andere, entwurf });
    geaendert = true;
  };
  const melden = (erg) => {
    const teile = [];
    if (erg?.masseWeg?.length) teile.push(`Maß an Wand ${erg.masseWeg.map((id) => wandName(wandIndex(erg.raum, id))).join(', ')} entfernt, weil sich die Länge geändert hat.`);
    if (erg?.oeffnungenWeg?.length) teile.push(`${erg.oeffnungenWeg.map((o) => o.name).join(', ')} entfernt.`);
    if (teile.length) hinweis(teile.join(' '));
  };
  const uebernehme = (erg, { still = false } = {}) => {
    if (!erg) return false;
    if (erg.fehler) { hinweis(erg.fehler); zeichne(); return false; }
    d = erg.raum;
    if (!still) melden(erg);
    merken();
    zeichne();
    return true;
  };

  const konturSchliessen = (punkte) => {
    const e = offeneKontur(punkte, true);
    if (!e || !e.geschlossen) { hinweis('Daraus lässt sich kein Raum schließen. Bitte mindestens drei Wände zeichnen.'); zeichne(); return; }
    const vorher = d;
    d = raumAusEcken(d, e.ecken);
    // im Grundriss mit anderen Räumen ist der Maßstab schon da: gezeichnet wird in Metern
    d.massstabGesetzt = gruppenMassstab();
    d.skizze = { striche: [...(vorher.skizze?.striche || []), ...(entwurf?.striche || [])], faktor: vorher.skizze?.faktor || 1 };
    let an = null;
    if (d.massstabGesetzt) ({ raum: d, an } = andocken(d, andere, { fang: 0.4 }));
    entwurf = null;
    entwurfErkannt = null;
    werkzeug = 'mass';
    auswahl = null;
    merken();
    zeichne();
    hinweis(`Raum mit ${d.waende.length} Wänden erkannt${an ? `, an ${an} angedockt` : ''}. Jetzt eine Wand antippen und ihre echte Länge eingeben.`);
  };

  // ---------- Dialoge ----------
  const dialog = (html, binden) => new Promise((resolve) => {
    dialogBox.innerHTML = html;
    const dl = $('.ra-dialog');
    dl.hidden = false;
    const fertig = (wert) => { dl.hidden = true; dialogBox.innerHTML = ''; resolve(wert); };
    dialogBox.querySelectorAll('[data-wert]').forEach((b) => { b.onclick = () => fertig(b.dataset.wert); });
    binden?.(fertig);
    const inp = dialogBox.querySelector('input');
    if (inp) setTimeout(() => { inp.focus(); inp.select?.(); }, 50);
  });

  const massFragen = async (wandId) => {
    const i = wandIndex(d, wandId);
    if (i < 0) return;
    const g = wandGeo(d, i);
    const w = d.waende[i];
    const erst = !d.massstabGesetzt;
    const wert = await dialog(`
      <b>Wie lang ist Wand ${wandName(i)}?</b>
      <p class="fa-klein">${erst ? 'Das erste Maß legt den Maßstab fest. Alle anderen Längen werden daraus berechnet.' : `Gezeichnet: ${fmt2(g.l)} m. Die Nachbarwände werden angepasst, damit der Raum geschlossen bleibt.`}</p>
      <label class="fa-feld"><span>Länge in m</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-eingabe" value="${w.mass != null ? zahlText(w.mass, 3) : ''}" placeholder="z. B. 5,42"></label>
      <p class="fa-klein fa-warn ra-fehler"></p>
      <div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Abbrechen</button><button type="button" class="btn primary ra-ok">Übernehmen</button></div>`, (fertig) => {
      const inp = dialogBox.querySelector('.ra-eingabe');
      const ok = () => {
        const l = laengeLesen(inp.value);
        if (!l) { dialogBox.querySelector('.ra-fehler').textContent = 'Bitte eine Länge eingeben, z. B. 5,42.'; return; }
        fertig(String(l));
      };
      dialogBox.querySelector('.ra-ok').onclick = ok;
      inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    });
    if (!wert) return;
    massSetzen(wandId, Number(wert));
  };

  const massSetzen = async (wandId, laenge) => {
    const erg = setzeMass(d, wandId, laenge);
    if (erg.konflikt) { await konflikt(erg.konflikt); return; }
    if (erg.skaliert) {
      // Ansicht mitskalieren, damit die Zeichnung nicht springt
      ansicht.s /= erg.skaliert;
    }
    if (uebernehme(erg) && erg.skaliert) {
      hinweis('Maßstab gesetzt. Alle Längen sind jetzt in Metern. Weitere Maße eingeben oder mit „Tür“ und „Fenster“ weitermachen.');
      werkzeug = 'mass';
      zeichne();
    }
  };

  const konflikt = async (k) => {
    const i = wandIndex(d, k.wand);
    const gegen = k.gegen.map((id) => { const j = wandIndex(d, id); return `Wand ${wandName(j)} = ${fmt2(d.waende[j].mass)} m`; });
    const wahl = await dialog(`
      <b>Die eingegebenen Maße passen geometrisch nicht vollständig zusammen.</b>
      <p class="fa-klein">Neu: Wand ${wandName(i)} = ${fmt2(k.laenge)} m${gegen.length ? `. Dagegen steht: ${gegen.join(', ')}` : ''}.</p>
      <div class="ra-wahl">
        <button type="button" class="btn soft" data-wert="neu"><b>Maß 1 verwenden</b><small>Wand ${wandName(i)} = ${fmt2(k.laenge)} m gilt${gegen.length ? `, ${gegen.length === 1 ? 'das andere Maß wird' : 'die anderen Maße werden'} entfernt` : ''}</small></button>
        <button type="button" class="btn soft" data-wert="alt"><b>Maß 2 verwenden</b><small>${gegen.length ? gegen.join(', ') : 'Bisherige Maße'} ${gegen.length === 1 ? 'bleibt' : 'bleiben'}, das neue Maß wird verworfen</small></button>
        <button type="button" class="btn soft" data-wert="geometrie" ${k.geometrieMoeglich ? '' : 'disabled'}><b>Geometrie anpassen</b><small>${k.geometrieMoeglich ? 'Alle Maße bleiben, eine Wand ohne Maß wird dafür schräg' : 'Geht nicht: jede passende Wand hat schon ein Maß'}</small></button>
        <button type="button" class="btn soft" data-wert="pruefen"><b>Maße überprüfen</b><small>Liste aller Maße öffnen, nichts ändern</small></button>
      </div>`);
    if (wahl === 'pruefen') { masseZeigen(); return; }
    if (!wahl || wahl === 'alt') { hinweis('Das neue Maß wurde verworfen.'); zeichne(); return; }
    const erg = konfliktLoesen(d, k, wahl);
    if (erg.konflikt) { await konflikt(erg.konflikt); return; }
    if (uebernehme(erg) && erg.schraeg) hinweis(`Wand ${wandName(wandIndex(d, erg.schraeg))} ist jetzt schräg, damit alle Maße stimmen.`);
  };

  // ---------- Panels ----------
  const panelZu = () => { panel.hidden = true; panel.innerHTML = ''; };
  // Nach dem Antippen schickt der Browser noch einen „click“ an dieselbe Stelle. Liegt dort jetzt das
  // gerade geöffnete Panel oder ein Dialog, darf dieser Klick keinen Knopf auslösen.
  for (const el of [panel, $('.ra-dialog')]) {
    el.addEventListener('click', (e) => {
      if (letzterTipp && Date.now() - letzterTipp.zeit < 600 && Math.hypot(e.clientX - letzterTipp.x, e.clientY - letzterTipp.y) < 12) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }
  const panelAuf = (html, binden) => {
    panel.innerHTML = html;
    panel.hidden = false;
    panel.querySelector('.ra-p-ok')?.addEventListener('click', () => { auswahl = null; panelZu(); zeichne(); });
    binden?.();
  };

  const wandPanel = (id) => {
    const i = wandIndex(d, id);
    if (i < 0) { panelZu(); return; }
    const g = wandGeo(d, i);
    const w = d.waende[i];
    const richtung = winkelVon(g.r);
    panelAuf(`
      <div class="fa-panel-kopf"><b>Wand ${wandName(i)} · ${d.massstabGesetzt ? '' : '≈ '}${fmt2(g.l)} m${w.mass != null ? ' (gemessen)' : ''}</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      <div class="ra-reihe"><label class="fa-feld"><span>Länge in m</span><input type="text" inputmode="decimal" class="ra-laenge" value="${w.mass != null ? zahlText(w.mass, 3) : ''}" placeholder="${zahlText(g.l)}"></label><button type="button" class="btn soft ra-laenge-ok">Setzen</button></div>
      <div class="fa-vorschlaege">
        <button type="button" class="chip" data-tun="waagerecht">Waagerecht</button>
        <button type="button" class="chip" data-tun="senkrecht">Senkrecht</button>
        <button type="button" class="chip" data-tun="winkel">Winkel ${zahlText(richtung % 180, 1)}°</button>
        <button type="button" class="chip" data-tun="teilen">Ecke einfügen</button>
        <button type="button" class="chip" data-tun="schraege">${w.schraege ? 'Dachschräge ändern' : 'Dachschräge'}</button>
        ${schraegeWerte(d, i)?.gueltig ? '<button type="button" class="chip" data-tun="dachfenster">Dachfenster einsetzen</button>' : ''}
        <button type="button" class="chip" data-tun="anbauen">Raum anbauen</button>
        <button type="button" class="chip" data-tun="raumteilen">Raum teilen</button>
        <button type="button" class="chip ra-gefahr" data-tun="loeschen">Wand löschen</button>
      </div>
      ${w.schraege ? `<p class="fa-klein">${schraegeText(i)}</p>` : ''}`, () => {
      const inp = panel.querySelector('.ra-laenge');
      const ok = () => {
        const l = laengeLesen(inp.value);
        if (!l) { hinweis('Bitte eine Länge eingeben, z. B. 5,42.'); return; }
        inp.blur();
        massSetzen(id, l).then(() => { if (auswahl?.id === id) wandPanel(id); });
      };
      panel.querySelector('.ra-laenge-ok').onclick = ok;
      inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
      panel.querySelectorAll('[data-tun]').forEach((b) => {
        b.onclick = async () => {
          const tun = b.dataset.tun;
          if (tun === 'waagerecht' || tun === 'senkrecht') uebernehme(richtenAus(d, id, tun));
          if (tun === 'winkel') {
            const wert = await dialog(`<b>Winkel von Wand ${wandName(i)}</b>
              <p class="fa-klein">0° = waagerecht, 90° = senkrecht. Die Wand dreht um ihre Mitte, die Nachbarwände behalten ihre Richtung.</p>
              <label class="fa-feld"><span>Winkel in Grad</span><input type="text" inputmode="decimal" class="ra-eingabe" value="${zahlText(richtung % 180, 1)}"></label>
              <div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Abbrechen</button><button type="button" class="btn primary ra-ok">Übernehmen</button></div>`, (fertig) => {
              dialogBox.querySelector('.ra-ok').onclick = () => fertig(dialogBox.querySelector('.ra-eingabe').value);
            });
            const grad = Number(String(wert || '').replace(',', '.'));
            if (wert && Number.isFinite(grad)) {
              // Richtung so wählen, dass die Wand ihre Laufrichtung behält
              const alt = richtung;
              const kandidat = [grad, grad + 180].map((x) => ((x % 360) + 360) % 360).reduce((a, c) => (Math.abs(((c - alt + 540) % 360) - 180) < Math.abs(((a - alt + 540) % 360) - 180) ? c : a));
              uebernehme(setzeRichtung(d, id, kandidat));
            }
          }
          if (tun === 'teilen') {
            const erg = teileWand(d, id);
            if (uebernehme(erg)) { auswahl = { art: 'ecke', id: erg.neueEcke }; hinweis('Neue Ecke eingefügt. Ziehen, um eine weitere Wand zu bilden.'); eckePanel(erg.neueEcke); zeichne(); return; }
          }
          if (tun === 'loeschen') {
            if (uebernehme(loescheWand(d, id))) { auswahl = null; panelZu(); zeichne(); return; }
          }
          if (tun === 'schraege') await schraegeFragen(id);
          if (tun === 'anbauen' || tun === 'raumteilen') {
            if (!d.massstabGesetzt) { hinweis('Zuerst ein echtes Maß eingeben, dann lassen sich Räume anbauen oder teilen.'); return; }
            if (tun === 'anbauen') { await anbauenFragen(id); return; }
            await teilenFragen(id);
            return;
          }
          if (tun === 'dachfenster') {
            const erg = neuesDachfenster(d, id);
            if (uebernehme(erg)) { auswaehlen({ art: 'dachfenster', id: erg.dachfenster }); return; }
          }
          if (auswahl?.id === id) wandPanel(id);
        };
      });
    });
  };

  // Kurzbeschreibung der Schräge einer Wand
  const schraegeText = (i) => {
    const v = schraegeWerte(d, i);
    if (!v) return '';
    if (!v.gueltig) return `Dachschräge: ${v.grund}`;
    return `Dachschräge: Kniestock ${fmt2(v.kniestock)} m, Neigung ${zahlText(v.winkel, 1)}°, ${fmt2(v.tiefe)} m tief, Schräge ${fmt2(v.laenge)} m lang.`;
  };

  const schraegeFragen = async (wandId) => {
    const i = wandIndex(d, wandId);
    if (i < 0) return;
    const alt = d.waende[i].schraege;
    const s = { ...SCHRAEGE_STANDARD, ...(alt || {}) };
    const ARTEN = [
      { id: 'winkel', label: 'Neigung', feld: 'Neigung in Grad', tipp: 'z. B. 40' },
      { id: 'tiefe', label: 'Tiefe', feld: 'Tiefe in m (waagerecht von der Wand)', tipp: 'z. B. 1,80' },
      { id: 'laenge', label: 'Länge der Schräge', feld: 'Länge der Schräge in m', tipp: 'z. B. 2,30' },
    ];
    const wert = await dialog(`
      <b>Dachschräge an Wand ${wandName(i)}</b>
      <p class="fa-klein">Kniestock = Wandhöhe bis dort, wo die Schräge beginnt. Die Schräge steigt nach innen bis zur Raumhöhe (flache Decke oder First). Gegenüberliegende Schrägen ergeben ein Satteldach, die Giebelwände rechnet die App selbst.</p>
      <label class="fa-feld"><span>Kniestock in m</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-kn" value="${zahlText(s.kniestock, 3)}"></label>
      <div class="fa-feld"><span>Schräge gemessen als</span><div class="seg ra-art">${ARTEN.map((a) => `<button type="button" data-art="${a.id}" aria-pressed="${s.art === a.id}">${a.label}</button>`).join('')}</div></div>
      <label class="fa-feld"><span class="ra-art-label"></span><input type="text" inputmode="decimal" autocomplete="off" class="ra-wert-ein" value="${zahlText(s.wert, 3)}"></label>
      <p class="fa-klein ra-vorschau"></p>
      <p class="fa-klein fa-warn ra-fehler"></p>
      <div class="fa-panel-knoepfe">${alt ? '<button type="button" class="btn ghost ra-gefahr" data-wert="weg">Entfernen</button>' : ''}<button type="button" class="btn ghost" data-wert="">Abbrechen</button><button type="button" class="btn primary ra-ok">Übernehmen</button></div>`, (fertig) => {
      let art = s.art;
      const kn = dialogBox.querySelector('.ra-kn');
      const ein = dialogBox.querySelector('.ra-wert-ein');
      const lesen = () => ({ kniestock: Number(String(kn.value).replace(',', '.')), art, wert: Number(String(ein.value).replace(',', '.')) });
      const zeigen = () => {
        const a = ARTEN.find((x) => x.id === art);
        dialogBox.querySelector('.ra-art-label').textContent = a.feld;
        ein.placeholder = a.tipp;
        dialogBox.querySelectorAll('[data-art]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.art === art)));
        const probe = { ...d, waende: d.waende.map((x, k) => (k === i ? { ...x, schraege: lesen() } : x)) };
        const v = schraegeWerte(probe, i);
        dialogBox.querySelector('.ra-vorschau').textContent = v?.gueltig ? `Ergibt: Neigung ${zahlText(v.winkel, 1)}°, ${fmt2(v.tiefe)} m tief, Schräge ${fmt2(v.laenge)} m lang.` : '';
        dialogBox.querySelector('.ra-fehler').textContent = v && !v.gueltig && kn.value && ein.value ? v.grund : '';
      };
      dialogBox.querySelectorAll('[data-art]').forEach((b) => {
        b.onclick = () => {
          // bisherigen Wert in die neue Messart umrechnen, damit nichts verloren geht
          const probe = { ...d, waende: d.waende.map((x, k) => (k === i ? { ...x, schraege: lesen() } : x)) };
          const v = schraegeWerte(probe, i);
          art = b.dataset.art;
          if (v?.gueltig) ein.value = zahlText(art === 'winkel' ? v.winkel : art === 'tiefe' ? v.tiefe : v.laenge, art === 'winkel' ? 1 : 3);
          zeigen();
        };
      });
      kn.oninput = zeigen;
      ein.oninput = zeigen;
      dialogBox.querySelector('.ra-ok').onclick = () => {
        const x = lesen();
        const probe = { ...d, waende: d.waende.map((w, k) => (k === i ? { ...w, schraege: x } : w)) };
        const v = schraegeWerte(probe, i);
        if (!v.gueltig) { dialogBox.querySelector('.ra-fehler').textContent = v.grund; return; }
        fertig(JSON.stringify(x));
      };
      zeigen();
    });
    if (!wert) return;
    const erg = setzeSchraege(d, wandId, wert === 'weg' ? null : JSON.parse(wert));
    if (uebernehme(erg)) hinweis(wert === 'weg' ? `Dachschräge an Wand ${wandName(i)} entfernt.` : `Dachschräge an Wand ${wandName(i)} gesetzt. ${schraegeText(i)}`);
  };

  // ---------- Mehrere Räume ----------
  const neuerName = () => naechsterName([...namen, d.name, ...andere.map((x) => x.name)]);
  const cm = (m) => zahlText(m * 100, 1);
  const staerkeLesen = (wert) => {
    const x = Number(String(wert).replace(',', '.'));
    return Number.isFinite(x) && x >= 0 && x <= 100 ? x / 100 : null;
  };
  const staerkeMerken = (t) => {
    if (Math.abs(t - (d.einstellungen.wandstaerke ?? 0.115)) > 1e-9) d.einstellungen = { ...d.einstellungen, wandstaerke: t };
  };

  // Aktiven Raum wechseln (der bisherige wird grau)
  const wechseln = (id, text) => {
    const k = andere.findIndex((x) => x.id === id);
    if (k < 0) return;
    if (!geschlossen(d) && (d.ecken.length || entwurf)) { hinweis('Zuerst diesen Raum fertig zeichnen oder „Verwerfen“.'); zeichne(); return; }
    const neu = andere[k];
    andere = [...andere.slice(0, k), ...andere.slice(k + 1), ...(geschlossen(d) ? [d] : [])];
    d = neu;
    entwurf = null;
    entwurfErkannt = null;
    auswahl = null;
    panelZu();
    merken();
    zeichne();
    hinweis(text || `Jetzt wird ${d.name} bearbeitet.`);
  };

  const anbauenFragen = async (wandId) => {
    const i = wandIndex(d, wandId);
    const g = wandGeo(d, i);
    const t = d.einstellungen.wandstaerke ?? 0.115;
    const wert = await dialog(`
      <b>Raum an Wand ${wandName(i)} anbauen</b>
      <p class="fa-klein">Auf der anderen Seite der Wand entsteht ein neuer Raum (Innenmaße). Danach wie gewohnt Maße eingeben, Wände ziehen, Türen und Fenster setzen.</p>
      <label class="fa-feld"><span>Name</span><input type="text" class="ra-n" value="${escH(neuerName())}"></label>
      <div class="ra-raster2">
        <label class="fa-feld"><span>Tiefe in m</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-tiefe" placeholder="z. B. 3,00"></label>
        <label class="fa-feld"><span>Breite in m</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-breite" value="${zahlText(g.l, 3)}"></label>
        <label class="fa-feld"><span>Abstand von Ecke ${i + 1} in m</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-ab" value="0"></label>
        <label class="fa-feld"><span>Wandstärke dazwischen in cm</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-t" value="${cm(t)}"></label>
      </div>
      <p class="fa-klein fa-warn ra-fehler"></p>
      <div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Abbrechen</button><button type="button" class="btn primary ra-ok">Anbauen</button></div>`, (fertig) => {
      const q = (k) => dialogBox.querySelector(k);
      q('.ra-ok').onclick = () => {
        const tiefeText = q('.ra-tiefe').value.trim();
        const tiefe = tiefeText ? laengeLesen(tiefeText) : 3;
        const breite = laengeLesen(q('.ra-breite').value);
        const ab = Number(String(q('.ra-ab').value || '0').replace(',', '.'));
        const st = staerkeLesen(q('.ra-t').value);
        if (!tiefe || !breite || !Number.isFinite(ab) || st == null) { q('.ra-fehler').textContent = 'Bitte Zahlen eingeben, z. B. 3,00.'; return; }
        fertig(JSON.stringify({ name: q('.ra-n').value.trim() || neuerName(), tiefe, tiefeGemessen: !!tiefeText, breite, breiteGemessen: Math.abs(breite - g.l) > 0.0005, abstand: ab, staerke: st }));
      };
    });
    if (!wert) return;
    const o = JSON.parse(wert);
    const erg = raumAnbauen(d, wandId, o);
    if (erg.fehler) { hinweis(erg.fehler); return; }
    d = erg.raum;
    staerkeMerken(o.staerke);
    andere = [...andere, d];
    d = erg.neu;
    d.einstellungen = { ...d.einstellungen, wandstaerke: o.staerke };
    werkzeug = 'auswahl';
    auswahl = null;
    panelZu();
    einpassen();
    merken();
    zeichne();
    hinweis(`${d.name} angebaut${o.tiefeGemessen ? '' : ' (Tiefe vorläufig 3,00 m)'}. Jetzt Maße eingeben oder Wände ziehen.`);
  };

  const teilenFragen = async (wandId) => {
    const i = wandIndex(d, wandId);
    const g = wandGeo(d, i);
    const t = d.einstellungen.wandstaerke ?? 0.115;
    const tipp = auswahl?.t != null ? Math.round(auswahl.t * g.l * 100) / 100 : Math.round((g.l / 2) * 100) / 100;
    const wert = await dialog(`
      <b>Raum teilen</b>
      <p class="fa-klein">Eine Trennwand quer zu Wand ${wandName(i)} teilt den Raum in zwei Räume. So wird aus dem Umriss von Haus oder Wohnung Raum für Raum.</p>
      <label class="fa-feld"><span>Name des neuen Raums (ab Ecke ${i + 1})</span><input type="text" class="ra-n" value="${escH(neuerName())}"></label>
      <div class="ra-raster2">
        <label class="fa-feld"><span>Breite des neuen Raums in m</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-breite" value="${zahlText(Math.max(0.1, tipp - t / 2), 3)}"></label>
        <label class="fa-feld"><span>Wandstärke in cm</span><input type="text" inputmode="decimal" autocomplete="off" class="ra-t" value="${cm(t)}"></label>
      </div>
      <p class="fa-klein">Wand ${wandName(i)} ist ${fmt2(g.l)} m lang. Gemessen wird innen ab Ecke ${i + 1} bis zur Trennwand.</p>
      <p class="fa-klein fa-warn ra-fehler"></p>
      <div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Abbrechen</button><button type="button" class="btn primary ra-ok">Teilen</button></div>`, (fertig) => {
      const q = (k) => dialogBox.querySelector(k);
      q('.ra-ok').onclick = () => {
        const breite = laengeLesen(q('.ra-breite').value);
        const st = staerkeLesen(q('.ra-t').value);
        if (!breite || st == null) { q('.ra-fehler').textContent = 'Bitte Zahlen eingeben, z. B. 2,10.'; return; }
        const probe = teileRaum(d, wandId, breite + st / 2, { staerke: st });
        if (probe.fehler) { q('.ra-fehler').textContent = probe.fehler; return; }
        fertig(JSON.stringify({ name: q('.ra-n').value.trim() || neuerName(), breite, staerke: st }));
      };
    });
    if (!wert) return;
    const o = JSON.parse(wert);
    const erg = teileRaum(d, wandId, o.breite + o.staerke / 2, { staerke: o.staerke, name: o.name });
    if (erg.fehler) { hinweis(erg.fehler); return; }
    d = erg.raum;
    staerkeMerken(o.staerke);
    andere = [...andere, erg.neu];
    auswahl = null;
    panelZu();
    merken();
    zeichne();
    hinweis(`Geteilt: ${d.name} und ${erg.neu.name}. Den grauen Raum antippen, um ihn zu bearbeiten.`);
  };

  const weitererRaum = () => {
    if (!geschlossen(d)) { hinweis('Zuerst diesen Raum fertig zeichnen.'); return; }
    if (!d.massstabGesetzt) { hinweis('Zuerst ein echtes Maß eingeben, dann lassen sich weitere Räume zeichnen.'); return; }
    if (!d.gruppe) d = { ...d, gruppe: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`) };
    andere = [...andere, d];
    d = { ...neuerRaum(1, d.einstellungen), name: neuerName(), hoehe: d.hoehe, gruppe: d.gruppe };
    werkzeug = 'zeichnen';
    auswahl = null;
    panelZu();
    merken();
    zeichne();
    hinweis('Neuen Raum daneben zeichnen. Nah an einem anderen Raum dockt er mit der Wandstärke an.');
  };

  const raumPanel = () => {
    panelAuf(`
      <div class="fa-panel-kopf"><b>${escH(d.name)} · ${d.massstabGesetzt ? '' : '≈ '}${fmt2(berechne(d).bodenflaeche)} m²</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      <p class="fa-klein">Am blauen Punkt ziehen, um den ganzen Raum zu verschieben. Nah an einem anderen Raum rastet er mit der Wandstärke ein.</p>
      <label class="fa-feld"><span>Raumname</span><input type="text" data-name value="${escH(d.name)}"></label>
      <div class="fa-vorschlaege"><button type="button" class="chip" data-tun="weiter">Weiteren Raum zeichnen</button></div>
      <p class="fa-klein">Zum Anbauen oder Teilen eine Wand antippen.</p>`, () => {
      panel.querySelector('[data-name]').onchange = (e) => { const r = kopie(d); r.name = e.target.value.trim() || d.name; uebernehme({ raum: r }); raumPanel(); };
      panel.querySelector('[data-tun="weiter"]').onclick = weitererRaum;
    });
  };

  const dachfensterPanel = (id) => {
    const o = (d.dachfenster || []).find((x) => x.id === id);
    if (!o) { panelZu(); return; }
    const i = wandIndex(d, o.wand);
    const v = schraegeWerte(d, i);
    const feld = (key, label, wert) => `<label class="fa-feld"><span>${label}</span><input type="text" inputmode="decimal" data-feld="${key}" value="${zahlText(wert, 3)}"></label>`;
    panelAuf(`
      <div class="fa-panel-kopf"><b>${escH(o.name)} · Wand ${wandName(i)}</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      <div class="ra-raster2">
        ${feld('breite', 'Breite in m', o.breite)}
        ${feld('laenge', 'Länge in der Schräge in m', o.laenge)}
        ${feld('unten', 'Abstand vom Kniestock in m', o.unten)}
        ${feld('abstand', `Abstand von Ecke ${i + 1} in m`, o.abstand)}
      </div>
      <p class="fa-klein">${v?.gueltig ? `Die Schräge ist ${fmt2(v.laenge)} m lang. Die Fensterfläche wird von der Dachschräge abgezogen.` : ''}</p>
      <label class="fa-feld"><span>Bezeichnung</span><input type="text" data-name value="${escH(o.name)}"></label>
      <div class="fa-vorschlaege"><button type="button" class="chip ra-gefahr" data-tun="loeschen">Dachfenster löschen</button></div>`, () => {
      const setze = (felder) => {
        if (uebernehme(aendereDachfenster(d, id, felder))) dachfensterPanel(id);
      };
      panel.querySelectorAll('[data-feld]').forEach((inp) => {
        inp.onchange = () => {
          const x = Number(String(inp.value).replace(',', '.'));
          const nullErlaubt = inp.dataset.feld === 'abstand' || inp.dataset.feld === 'unten';
          if (!Number.isFinite(x) || x < 0 || (!nullErlaubt && x <= 0)) { hinweis('Bitte eine Zahl eingeben, z. B. 0,78.'); dachfensterPanel(id); return; }
          setze({ [inp.dataset.feld]: x });
        };
      });
      panel.querySelector('[data-name]').onchange = (e) => setze({ name: e.target.value.trim() || o.name });
      panel.querySelector('[data-tun="loeschen"]').onclick = () => {
        if (uebernehme(loescheDachfenster(d, id))) { auswahl = null; panelZu(); zeichne(); }
      };
    });
  };

  const eckePanel = (id) => {
    const k = d.ecken.findIndex((e) => e.id === id);
    if (k < 0) { panelZu(); return; }
    const b = berechne(d);
    panelAuf(`
      <div class="fa-panel-kopf"><b>Ecke ${k + 1} · Innenwinkel ${zahlText(b.winkel[k], 1)}°</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      <p class="fa-klein">Ecke ziehen, um sie zu verschieben. Nahe waagerecht oder senkrecht rastet sie ein.</p>
      <div class="fa-vorschlaege"><button type="button" class="chip ra-gefahr" data-tun="loeschen">Ecke löschen</button></div>`, () => {
      panel.querySelector('[data-tun="loeschen"]').onclick = () => {
        if (uebernehme(loescheEcke(d, id))) { auswahl = null; panelZu(); zeichne(); }
      };
    });
  };

  const oeffnungPanel = (id) => {
    const o = d.oeffnungen.find((x) => x.id === id);
    if (!o) { panelZu(); return; }
    const i = wandIndex(d, o.wand);
    const tuer = o.typ === 'tuer';
    const feld = (key, label, wert) => `<label class="fa-feld"><span>${label}</span><input type="text" inputmode="decimal" data-feld="${key}" value="${zahlText(wert, 3)}"></label>`;
    panelAuf(`
      <div class="fa-panel-kopf"><b>${escH(o.name)} · Wand ${wandName(i)}</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      ${tuer ? `<div class="fa-vorschlaege">${[0.76, 0.885, 1.01].map((b) => `<button type="button" class="chip" data-breite="${b}" aria-pressed="${Math.abs(o.breite - b) < 1e-6}">${zahlText(b * 100, 1)} cm</button>`).join('')}</div>` : ''}
      <div class="ra-raster2">
        ${feld('breite', 'Breite in m', o.breite)}
        ${feld('hoehe', 'Höhe in m', o.hoehe)}
        ${tuer ? '' : feld('bruestung', 'Brüstung in m', o.bruestung || 0)}
        ${feld('abstand', `Abstand von Ecke ${i + 1} in m`, o.abstand)}
      </div>
      ${tuer ? `<div class="ra-raster2">
        <div class="fa-feld"><span>Anschlag</span><div class="seg"><button type="button" data-set="anschlag:links" aria-pressed="${o.anschlag !== 'rechts'}">links</button><button type="button" data-set="anschlag:rechts" aria-pressed="${o.anschlag === 'rechts'}">rechts</button></div></div>
        <div class="fa-feld"><span>Öffnet nach</span><div class="seg"><button type="button" data-set="richtung:innen" aria-pressed="${o.richtung !== 'aussen'}">innen</button><button type="button" data-set="richtung:aussen" aria-pressed="${o.richtung === 'aussen'}">außen</button></div></div>
      </div>` : ''}
      <label class="fa-feld"><span>Bezeichnung</span><input type="text" data-name value="${escH(o.name)}"></label>
      <div class="fa-vorschlaege"><button type="button" class="chip ra-gefahr" data-tun="loeschen">${tuer ? 'Tür' : 'Fenster'} löschen</button></div>`, () => {
      const setze = (felder) => {
        const erg = aendereOeffnung(d, id, felder);
        if (uebernehme(erg)) oeffnungPanel(id);
      };
      panel.querySelectorAll('[data-breite]').forEach((b) => { b.onclick = () => setze({ breite: Number(b.dataset.breite) }); });
      panel.querySelectorAll('[data-set]').forEach((b) => { b.onclick = () => { const [k, v] = b.dataset.set.split(':'); setze({ [k]: v }); }; });
      panel.querySelectorAll('[data-feld]').forEach((inp) => {
        inp.onchange = () => {
          const v = Number(String(inp.value).replace(',', '.'));
          if (!Number.isFinite(v) || v < 0 || (inp.dataset.feld !== 'abstand' && inp.dataset.feld !== 'bruestung' && v <= 0)) { hinweis('Bitte eine Zahl eingeben, z. B. 1,20.'); oeffnungPanel(id); return; }
          setze({ [inp.dataset.feld]: v });
        };
      });
      panel.querySelector('[data-name]').onchange = (e) => setze({ name: e.target.value.trim() || o.name });
      panel.querySelector('[data-tun="loeschen"]').onclick = () => {
        if (uebernehme(loescheOeffnung(d, id))) { auswahl = null; panelZu(); zeichne(); }
      };
    });
  };

  const auswaehlen = (a) => {
    auswahl = a;
    if (!a) panelZu();
    else if (a.art === 'wand') wandPanel(a.id);
    else if (a.art === 'ecke') eckePanel(a.id);
    else if (a.art === 'dachfenster') dachfensterPanel(a.id);
    else if (a.art === 'raum') raumPanel();
    else oeffnungPanel(a.id);
    zeichne();
  };

  // Liste aller Wände mit Länge und Maß („Maßstab“)
  function masseZeigen() {
    auswahl = null;
    if (!geschlossen(d)) { hinweis('Zuerst den Raum zeichnen und schließen.'); zeichne(); return; }
    const b = berechne(d);
    const gemessen = b.waende.filter((w) => w.mass != null);
    panelAuf(`
      <div class="fa-panel-kopf"><b>Maße und Maßstab</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      <p class="fa-klein">${d.massstabGesetzt ? `Maßstab aus ${gemessen.length ? `Wand ${gemessen[0].name}` : 'dem ersten Maß'}. Blau = gemessen, die anderen Längen sind daraus berechnet.` : 'Noch kein Maßstab. Bei einer Wand die echte Länge eingeben: dann wird der ganze Raum maßstäblich.'}</p>
      ${b.waende.map((w) => `<div class="ra-wandzeile"><b>${w.name}</b><span>${d.massstabGesetzt ? '' : '≈ '}${fmt2(w.laenge)} m</span>
        <input type="text" inputmode="decimal" data-wand="${w.id}" value="${w.mass != null ? zahlText(w.mass, 3) : ''}" placeholder="Maß" class="${w.mass != null ? 'gemessen' : ''}">
        ${w.mass != null ? `<button type="button" class="chip" data-weg="${w.id}" aria-label="Maß entfernen">✕</button>` : '<span></span>'}</div>`).join('')}`, () => {
      panel.querySelectorAll('[data-wand]').forEach((inp) => {
        inp.onchange = async () => {
          if (!inp.value.trim()) return;
          const l = laengeLesen(inp.value);
          if (!l) { hinweis('Bitte eine Länge eingeben, z. B. 5,42.'); return; }
          await massSetzen(inp.dataset.wand, l);
          if (!panel.hidden) masseZeigen();
        };
      });
      panel.querySelectorAll('[data-weg]').forEach((btn) => {
        btn.onclick = () => {
          const r = kopie(d);
          r.waende.find((w) => w.id === btn.dataset.weg).mass = null;
          uebernehme({ raum: r });
          masseZeigen();
        };
      });
    });
    zeichne();
  }

  function einstellungen() {
    auswahl = null;
    const e = d.einstellungen;
    const b = geschlossen(d) ? berechne(d) : null;
    const u = d.massstabGesetzt ? '' : '≈ ';
    const zeile = (t, v) => `<div class="ra-wert"><span>${t}</span><b>${v}</b></div>`;
    panelAuf(`
      <div class="fa-panel-kopf"><b>Raum und Einstellungen</b><button type="button" class="btn primary ra-p-ok">Fertig</button></div>
      <div class="ra-raster2">
        <label class="fa-feld"><span>Raumname</span><input type="text" data-raum="name" value="${escH(d.name)}"></label>
        <label class="fa-feld"><span>${b?.mitSchraege ? 'Raumhöhe (flache Decke) in m' : 'Raumhöhe in m'}</span><input type="text" inputmode="decimal" data-raum="hoehe" value="${zahlText(d.hoehe, 3)}"></label>
      </div>
      ${b ? `<div class="ra-werteliste">
        ${zeile('Bodenfläche', `${u}${fmt2(b.bodenflaeche)} m²`)}
        ${zeile(b.mitSchraege ? 'Decke waagerecht' : 'Deckenfläche', `${u}${fmt2(b.deckenflaeche)} m²`)}
        ${b.mitSchraege ? zeile('Dachschrägen', `${u}${fmt2(b.dachFlaeche)} m²`) : ''}
        ${b.dachfenster.length ? zeile('Dachfenster', `${fmt2(b.dachfensterFlaeche)} m²`) : ''}
        ${b.mitSchraege ? zeile('Dachschrägen netto', `${u}${fmt2(b.dachNetto)} m²`) : ''}
        ${zeile('Wandumfang', `${u}${fmt2(b.umfang)} lfm`)}
        ${zeile('Wandfläche brutto', `${u}${fmt2(b.wandBrutto)} m²`)}
        ${zeile('Türflächen', `${u === '' ? '' : ''}${fmt2(b.tuerFlaeche)} m²`)}
        ${zeile('Fensterflächen', `${fmt2(b.fensterFlaeche)} m²`)}
        ${zeile('Wandfläche netto', `${u}${fmt2(b.wandNetto)} m²`)}
      </div>` : ''}
      <div class="fa-feld"><span>Türen und Fenster bei der Wandfläche</span><div class="seg">
        <button type="button" data-abzug="alle" aria-pressed="${e.abzug !== 'vob'}">alle abziehen</button>
        <button type="button" data-abzug="vob" aria-pressed="${e.abzug === 'vob'}">bis 2,5 m² übermessen</button></div></div>
      <div class="fa-feld"><span>Raster</span><div class="seg">${RASTER.map((r) => `<button type="button" data-raster="${r}" aria-pressed="${Math.abs(e.raster - r) < 1e-9}">${r < 1 ? `${Math.round(r * 100)} cm` : '1,00 m'}</button>`).join('')}</div></div>
      <label class="fa-check"><input type="checkbox" data-schalter="masseZeigen" ${e.masseZeigen ? 'checked' : ''}> Maße an den Wänden zeigen</label>
      <label class="fa-check"><input type="checkbox" data-schalter="rasterFang" ${e.rasterFang ? 'checked' : ''}> Beim Zeichnen Wände aufs Raster legen</label>
      <label class="fa-check"><input type="checkbox" data-schalter="winkel45" ${e.winkel45 ? 'checked' : ''}> 45°-Wände ausrichten</label>
      <div class="ra-raster2">
        <label class="fa-feld"><span>Ausrichten bis ± Grad</span><input type="text" inputmode="decimal" data-zahl="winkelToleranz" value="${zahlText(e.winkelToleranz, 1)}"></label>
        <label class="fa-feld"><span>Ecke ab Grad</span><input type="text" inputmode="decimal" data-zahl="eckWinkel" value="${zahlText(e.eckWinkel, 1)}"></label>
        <label class="fa-feld"><span>Schließen bis Punkte</span><input type="text" inputmode="decimal" data-zahl="schliessAbstand" value="${zahlText(e.schliessAbstand, 0)}"></label>
        <label class="fa-feld"><span>Glätten Punkte</span><input type="text" inputmode="decimal" data-zahl="vereinfachen" value="${zahlText(e.vereinfachen, 0)}"></label>
        <label class="fa-feld"><span>Wandstärke zwischen Räumen in cm</span><input type="text" inputmode="decimal" data-staerke value="${cm(e.wandstaerke ?? 0.115)}"></label>
      </div>
      ${geschlossen(d) ? `<div class="fa-vorschlaege"><button type="button" class="chip" data-export="svg">Grundriss als SVG</button><button type="button" class="chip" data-export="dxf">Grundriss als DXF (CAD)</button>${andere.length ? '<button type="button" class="chip" data-export="svg" data-gesamt>Grundriss gesamt als SVG</button><button type="button" class="chip" data-export="dxf" data-gesamt>Grundriss gesamt als DXF</button>' : ''}<button type="button" class="chip" data-tun="weiter">Weiteren Raum zeichnen</button></div>` : ''}
      <div class="fa-vorschlaege"><button type="button" class="chip ra-gefahr" data-tun="neu">Neu zeichnen</button></div>`, () => {
      panel.querySelectorAll('[data-raum]').forEach((inp) => {
        inp.onchange = () => {
          const r = kopie(d);
          if (inp.dataset.raum === 'name') r.name = inp.value.trim() || d.name;
          else {
            const h = laengeLesen(inp.value);
            if (!h) { hinweis('Bitte eine Raumhöhe eingeben, z. B. 2,50.'); einstellungen(); return; }
            r.hoehe = h;
          }
          uebernehme({ raum: r });
          einstellungen();
        };
      });
      const einst = (felder) => { const r = kopie(d); r.einstellungen = { ...r.einstellungen, ...felder }; uebernehme({ raum: r }); einstellungen(); };
      panel.querySelectorAll('[data-abzug]').forEach((btn) => { btn.onclick = () => einst({ abzug: btn.dataset.abzug }); });
      panel.querySelectorAll('[data-raster]').forEach((btn) => { btn.onclick = () => einst({ raster: Number(btn.dataset.raster) }); });
      panel.querySelectorAll('[data-schalter]').forEach((c) => { c.onchange = () => einst({ [c.dataset.schalter]: c.checked }); });
      panel.querySelectorAll('[data-zahl]').forEach((inp) => {
        inp.onchange = () => {
          const v = Number(String(inp.value).replace(',', '.'));
          if (!(v > 0)) { einstellungen(); return; }
          einst({ [inp.dataset.zahl]: v });
        };
      });
      panel.querySelectorAll('[data-export]').forEach((btn) => { btn.onclick = () => exportieren(btn.dataset.export, btn.hasAttribute('data-gesamt')); });
      const st = panel.querySelector('[data-staerke]');
      st.onchange = () => { const t = staerkeLesen(st.value); if (t == null) { einstellungen(); return; } einst({ wandstaerke: t }); };
      panel.querySelector('[data-tun="weiter"]')?.addEventListener('click', weitererRaum);
      panel.querySelector('[data-tun="neu"]').onclick = async () => {
        const ja = await dialog('<b>Den Raum neu zeichnen?</b><p class="fa-klein">Wände, Maße, Türen und Fenster werden entfernt. Mit „Rückgängig“ kommt alles zurück.</p><div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Abbrechen</button><button type="button" class="btn primary" data-wert="ja">Neu zeichnen</button></div>');
        if (!ja) return;
        const r = kopie(d);
        Object.assign(r, { ecken: [], waende: [], oeffnungen: [], dachfenster: [], massstabGesetzt: gruppenMassstab(), skizze: { striche: [], faktor: 1 } });
        d = r;
        entwurf = null;
        entwurfErkannt = null;
        werkzeug = 'zeichnen';
        panelZu();
        einpassen();
        merken();
        zeichne();
      };
    });
    zeichne();
  }

  const exportieren = async (art, gesamt = false) => {
    const p = pruefe(d);
    if (!d.massstabGesetzt) { hinweis('Für den Export bitte zuerst ein echtes Maß eingeben.'); return; }
    const was = gesamt ? [d, ...andere].filter((x) => geschlossen(x) && x.massstabGesetzt) : d;
    const name = `${(gesamt ? 'grundriss-gesamt' : d.name || 'raum').replace(/[^\wäöüÄÖÜß-]+/g, '_')}.${art}`;
    const blob = art === 'svg'
      ? new Blob([alsSvg(was, massstabFuer(was))], { type: 'image/svg+xml' })
      : new Blob([alsDxf(was)], { type: 'application/dxf' });
    const datei = new File([blob], name, { type: blob.type });
    try {
      if (navigator.canShare?.({ files: [datei] })) { await navigator.share({ files: [datei], title: name }); return; }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (p.fehler.length) hinweis('Achtung: Der Raum hat noch Fehler, siehe „Übernehmen“.');
  };

  // ---------- Treffer ----------
  const trefferWand = (sp, r = anzeigeRaum(), max = 22) => {
    if (!geschlossen(r)) return null;
    let best = null;
    r.waende.forEach((w, i) => {
      const g = wandGeo(r, i);
      const a = abb(g.a);
      const b = abb(g.b);
      const ab = [b[0] - a[0], b[1] - a[1]];
      const l2 = ab[0] ** 2 + ab[1] ** 2;
      const t = l2 ? Math.max(0, Math.min(1, ((sp[0] - a[0]) * ab[0] + (sp[1] - a[1]) * ab[1]) / l2)) : 0;
      const dd = Math.hypot(sp[0] - a[0] - ab[0] * t, sp[1] - a[1] - ab[1] * t);
      if (dd <= max && (!best || dd < best.d)) best = { id: w.id, d: dd, t, i };
    });
    // Maßzahl antippen zählt wie die Wand
    if (!best && d.einstellungen.masseZeigen) {
      for (const el of planElemente(r, abb, { schrift: 13, massAbstand: 24, masse: andere.length ? 'innen' : true })) {
        if (el.art === 'text' && el.wand && Math.hypot(sp[0] - el.p[0], sp[1] - el.p[1]) < 24) {
          const i = wandIndex(r, el.wand);
          return { id: el.wand, d: 0, t: 0.5, i };
        }
      }
    }
    return best;
  };
  const trefferEcke = (sp) => {
    if (!geschlossen(d)) return null;
    let best = null;
    d.ecken.forEach((e) => {
      const [x, y] = abb([e.x, e.y]);
      const dd = Math.hypot(sp[0] - x, sp[1] - y);
      if (dd <= 24 && (!best || dd < best.d)) best = { id: e.id, d: dd };
    });
    return best;
  };
  const trefferOeffnung = (sp) => {
    let best = null;
    for (const o of d.oeffnungen) {
      const i = wandIndex(d, o.wand);
      if (i < 0) continue;
      const g = wandGeo(d, i);
      const a = abb([g.a[0] + g.r[0] * o.abstand, g.a[1] + g.r[1] * o.abstand]);
      const b = abb([g.a[0] + g.r[0] * (o.abstand + o.breite), g.a[1] + g.r[1] * (o.abstand + o.breite)]);
      const ab = [b[0] - a[0], b[1] - a[1]];
      const l2 = ab[0] ** 2 + ab[1] ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((sp[0] - a[0]) * ab[0] + (sp[1] - a[1]) * ab[1]) / l2));
      const dd = Math.hypot(sp[0] - a[0] - ab[0] * t, sp[1] - a[1] - ab[1] * t);
      if (dd <= 20 && (!best || dd < best.d)) best = { id: o.id, d: dd };
    }
    return best;
  };

  const trefferDachfenster = (sp) => {
    for (const o of d.dachfenster || []) {
      const q = dachfensterEcken(d, o);
      if (!q) continue;
      const qs = q.map(abb);
      // kleine Fenster etwas großzügiger treffen
      const m = [(qs[0][0] + qs[2][0]) / 2, (qs[0][1] + qs[2][1]) / 2];
      if (punktInnen(sp, qs) || Math.hypot(sp[0] - m[0], sp[1] - m[1]) < 18) return { id: o.id };
    }
    return null;
  };

  // ---------- Zeiger (Finger, Stift, Maus) ----------
  const zeiger = new Map();
  let geste = null; // Zwei-Finger-Zoom/Verschieben: { abstand, mitte, s, ox, oy }
  let zug = null; // Ziehen mit einem Zeiger: { art, start, … }
  let rafId = 0;
  const spaeter = () => { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; zeichne(); }); };

  const gesteStart = () => {
    const [p1, p2] = [...zeiger.values()];
    geste = { abstand: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1, mitte: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], s: ansicht.s, ox: ansicht.ox, oy: ansicht.oy };
  };

  const strichNeu = (p) => {
    // Anschließen an die offene Kontur: am Ende weiter, am Anfang davor (umgedreht)
    let vorher = entwurf?.punkte || [];
    let modus = 'neu';
    if (vorher.length && entwurfErkannt) {
      const ende = abb(entwurfErkannt.ecken[entwurfErkannt.ecken.length - 1]);
      const anfang = abb(entwurfErkannt.ecken[0]);
      const sp = abb(p);
      const grenze = Math.max(40, d.einstellungen.schliessAbstand * 1.5);
      if (Math.hypot(sp[0] - ende[0], sp[1] - ende[1]) <= grenze) modus = 'weiter';
      else if (Math.hypot(sp[0] - anfang[0], sp[1] - anfang[1]) <= grenze) { modus = 'weiter'; vorher = [...vorher].reverse(); }
      else return null;
    }
    const s = { punkte: [p], vorher, modus, erkannt: null, rueckmeldung: '', nahAnfang: false };
    s.alle = () => (s.modus === 'weiter' ? [...s.vorher, ...s.punkte] : s.punkte);
    return s;
  };
  const strichRueckmeldung = () => {
    const alle = strich.alle();
    const pxE = ansicht.s;
    const lang = alle.reduce((sum, q, i) => (i ? sum + Math.hypot(q[0] - alle[i - 1][0], q[1] - alle[i - 1][1]) : 0), 0) * pxE;
    const a = abb(alle[0]);
    const z = abb(alle[alle.length - 1]);
    strich.nahAnfang = lang > 150 && Math.hypot(a[0] - z[0], a[1] - z[1]) <= d.einstellungen.schliessAbstand;
    strich.erkannt = offeneKontur(alle) || null;
    if (strich.nahAnfang) { strich.rueckmeldung = 'Wand schließen: loslassen, um den Raum zu schließen'; return; }
    // Richtung des letzten Stücks
    const e = strich.erkannt;
    if (e && e.ecken.length >= 2) {
      const p = e.ecken[e.ecken.length - 2];
      const q = e.ecken[e.ecken.length - 1];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      strich.rueckmeldung = l * pxE > 20 ? richtungsText([q[0] - p[0], q[1] - p[1]], d.einstellungen) : 'Weiterzeichnen …';
    } else strich.rueckmeldung = 'Weiterzeichnen …';
  };
  const strichFertig = async () => {
    const s = strich;
    strich = null;
    const alle = s.alle();
    d.skizze = d.skizze || { striche: [], faktor: 1 };
    const neuerStrich = s.punkte.map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]);
    const e = offeneKontur(alle, entwurf?.offen ? false : undefined);
    if (!e) {
      if (!entwurf) hinweis('Zu kurz. Bitte den Raum größer zeichnen oder hineinzoomen.');
      zeichne();
      return;
    }
    entwurf = { punkte: alle, offen: entwurf?.offen || false, striche: [...(entwurf?.striche || []), neuerStrich] };
    entwurfErkannt = e;
    if (e.geschlossen) {
      const ja = await dialog(`<b>Raum schließen?</b><p class="fa-klein">Anfang und Ende liegen nah beieinander. Erkannt: ${e.ecken.length} Wände.</p>
        <div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="offen">Weiterzeichnen</button><button type="button" class="btn primary" data-wert="ja">Raum schließen</button></div>`);
      if (ja === 'ja') { konturSchliessen(alle); return; }
      entwurf.offen = true;
      entwurfErkannt = offeneKontur(alle, false);
    }
    merken();
    zeichne();
  };

  const eckeZiehen = (zg, sp) => {
    const p = welt(sp);
    const k = zg.start.ecken.findIndex((e) => e.id === zg.id);
    const n = zg.start.ecken.length;
    const nb = [zg.start.ecken[(k - 1 + n) % n], zg.start.ecken[(k + 1) % n]];
    // Einrasten: Nachbarwand fast waagerecht/senkrecht → Koordinate der Nachbarecke übernehmen
    let [x, y] = p;
    const toleranz = 14 / ansicht.s;
    const art = [];
    for (const q of nb) {
      const r = richtungAusrichten([x - q.x, y - q.y], d.einstellungen);
      if (r.art === 'waagerecht' || Math.abs(y - q.y) < toleranz) { y = q.y; art.push('Waagerecht'); } else if (r.art === 'senkrecht' || Math.abs(x - q.x) < toleranz) { x = q.x; art.push('Senkrecht'); }
    }
    const erg = verschiebeEcke(zg.start, zg.id, [x, y]);
    if (!erg.fehler) { vorschau = erg.raum; zg.erg = erg; }
    meldung = '';
    $('.ra-text').textContent = erg.fehler || (art.length ? `${[...new Set(art)].join(' · ')} eingerastet` : 'Ecke frei verschieben');
    spaeter();
  };
  const wandZiehen = (zg, sp) => {
    const i = wandIndex(zg.start, zg.id);
    const g = wandGeo(zg.start, i);
    const p0 = welt(zg.sp);
    const p1 = welt(sp);
    let t = -((p1[0] - p0[0]) * g.innen[0] + (p1[1] - p0[1]) * g.innen[1]);
    if (d.massstabGesetzt) t = Math.round(t * 100) / 100; // auf cm
    const erg = verschiebeWand(zg.start, zg.id, t);
    if (!erg.fehler) { vorschau = erg.raum; zg.erg = erg; }
    meldung = '';
    $('.ra-text').textContent = erg.fehler || `Wand ${wandName(i)} um ${fmt2(Math.abs(t))} m nach ${t >= 0 ? 'außen' : 'innen'}`;
    spaeter();
  };
  const dachfensterZiehen = (zg, sp) => {
    const o = zg.start.dachfenster.find((x) => x.id === zg.id);
    const i = wandIndex(zg.start, o.wand);
    const g = wandGeo(zg.start, i);
    const v = schraegeWerte(zg.start, i);
    const p0 = welt(zg.sp);
    const p1 = welt(sp);
    const dx = [p1[0] - p0[0], p1[1] - p0[1]];
    const ab = Math.max(0, Math.min(g.l - o.breite, Math.round((o.abstand + dx[0] * g.r[0] + dx[1] * g.r[1]) * 100) / 100));
    const unten = Math.max(0, Math.min(Math.max(0, v.laenge - o.laenge), Math.round((o.unten + (dx[0] * g.innen[0] + dx[1] * g.innen[1]) * v.faktor) * 100) / 100));
    const erg = aendereDachfenster(zg.start, zg.id, { abstand: ab, unten });
    if (!erg.fehler) { vorschau = erg.raum; zg.erg = erg; }
    $('.ra-text').textContent = `Abstand ${fmt2(ab)} m · vom Kniestock ${fmt2(unten)} m`;
    spaeter();
  };
  const raumZiehen = (zg, sp) => {
    const p0 = welt(zg.sp);
    const p1 = welt(sp);
    const dx = [Math.round((p1[0] - p0[0]) * 100) / 100, Math.round((p1[1] - p0[1]) * 100) / 100];
    const { raum } = verschiebeRaum(zg.start, dx);
    const dock = andocken(raum, andere, { fang: Math.max(0.05, 16 / ansicht.s) });
    vorschau = dock.raum;
    zg.erg = { raum: dock.raum };
    $('.ra-text').textContent = dock.an ? `An ${dock.an} angedockt` : 'Raum verschieben';
    spaeter();
  };
  // Welcher Raum liegt unter dem Finger? (aktiver Raum zuerst)
  const raumUnter = (sp) => {
    const p = welt(sp);
    if (geschlossen(d) && punktInnen(p, punkteVon(d))) return d;
    return andere.find((x) => geschlossen(x) && punktInnen(p, punkteVon(x))) || null;
  };
  const oeffnungZiehen = (zg, sp) => {
    const o = zg.start.oeffnungen.find((x) => x.id === zg.id);
    const i = wandIndex(zg.start, o.wand);
    const g = wandGeo(zg.start, i);
    const p0 = welt(zg.sp);
    const p1 = welt(sp);
    let ab = o.abstand + ((p1[0] - p0[0]) * g.r[0] + (p1[1] - p0[1]) * g.r[1]);
    ab = Math.max(0, Math.min(g.l - o.breite, Math.round(ab * 100) / 100));
    const erg = aendereOeffnung(zg.start, zg.id, { abstand: ab });
    if (!erg.fehler) { vorschau = erg.raum; zg.erg = erg; }
    $('.ra-text').textContent = `Abstand ${fmt2(ab)} m`;
    spaeter();
  };

  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!panel.hidden && !auswahl) panelZu();
    svg.setPointerCapture?.(e.pointerId);
    const sp = lokal(e);
    zeiger.set(e.pointerId, sp);
    if (zeiger.size === 2) {
      // zweiter Finger: Zeichnen/Ziehen abbrechen, Ansicht bewegen
      if (strich) { strich = null; }
      if (zug) { vorschau = null; zug = null; }
      gesteStart();
      zeichne();
      return;
    }
    if (zeiger.size > 2) return;
    // Maus: mittlere/rechte Taste oder Leertaste verschiebt die Ansicht
    if (e.pointerType === 'mouse' && e.button !== 0) { zug = { art: 'pan', sp, ox: ansicht.ox, oy: ansicht.oy }; return; }
    const p = welt(sp);
    if (werkzeug === 'zeichnen') {
      if (geschlossen(d)) { zug = { art: 'pan', sp, ox: ansicht.ox, oy: ansicht.oy }; hinweis('Der Raum ist geschlossen. Zum Ändern „Auswahl“ wählen.'); return; }
      const s = strichNeu(p);
      if (!s) { zug = { art: 'pan', sp, ox: ansicht.ox, oy: ansicht.oy }; hinweis('Bitte am blauen Punkt weiterzeichnen (oder „Verwerfen“).'); return; }
      strich = s;
      zug = { art: 'strich', zeit: e.timeStamp };
      return;
    }
    if (werkzeug === 'auswahl') {
      if (auswahl?.art === 'raum' && geschlossen(d)) {
        const [gx, gy] = griffPunkt(d);
        if (Math.hypot(sp[0] - gx, sp[1] - gy) <= 26) { zug = { art: 'raum', start: kopie(d), sp, bewegt: false }; return; }
      }
      const ecke = trefferEcke(sp);
      if (ecke) { zug = { art: 'ecke', id: ecke.id, start: kopie(d), sp, bewegt: false }; return; }
      const oe = trefferOeffnung(sp);
      if (oe) { zug = { art: 'oeffnung', id: oe.id, start: kopie(d), sp, bewegt: false }; return; }
      const df = trefferDachfenster(sp);
      if (df) { zug = { art: 'dachfenster', id: df.id, start: kopie(d), sp, bewegt: false }; return; }
      const w = trefferWand(sp);
      if (w) { zug = { art: 'wand', id: w.id, start: kopie(d), sp, bewegt: false, t: w.t }; return; }
      zug = { art: 'pan', sp, ox: ansicht.ox, oy: ansicht.oy, leer: true };
      return;
    }
    zug = { art: 'tipp', sp, pan: { ox: ansicht.ox, oy: ansicht.oy } };
  });

  svg.addEventListener('pointermove', (e) => {
    if (!zeiger.has(e.pointerId)) return;
    const sp = lokal(e);
    zeiger.set(e.pointerId, sp);
    if (geste && zeiger.size >= 2) {
      const [p1, p2] = [...zeiger.values()];
      const ab = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1;
      const m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const s = Math.max(4, Math.min(4000, geste.s * (ab / geste.abstand)));
      ansicht.s = s;
      ansicht.ox = m[0] - (geste.mitte[0] - geste.ox) * (s / geste.s);
      ansicht.oy = m[1] - (geste.mitte[1] - geste.oy) * (s / geste.s);
      spaeter();
      return;
    }
    if (!zug) return;
    if (zug.art === 'strich' && strich) {
      const p = welt(sp);
      const l = strich.punkte[strich.punkte.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) * ansicht.s >= 1.5) {
        // gebündelte Zwischenpunkte (Stift, schnelle Finger) mitnehmen
        const ereignisse = e.getCoalescedEvents?.() || [e];
        for (const ev of ereignisse) strich.punkte.push(welt(lokal(ev)));
        strichRueckmeldung();
        spaeter();
        $('.ra-text').textContent = strich.rueckmeldung;
      }
      return;
    }
    if (zug.art === 'pan' || zug.art === 'tipp') {
      const dx = sp[0] - zug.sp[0];
      const dy = sp[1] - zug.sp[1];
      if (zug.art === 'tipp' && Math.hypot(dx, dy) < 8) return;
      if (zug.art === 'tipp') zug = { art: 'pan', sp: zug.sp, ox: zug.pan.ox, oy: zug.pan.oy };
      ansicht.ox = zug.ox + dx;
      ansicht.oy = zug.oy + dy;
      zug.bewegt = true;
      spaeter();
      return;
    }
    if (!zug.bewegt && Math.hypot(sp[0] - zug.sp[0], sp[1] - zug.sp[1]) < 6) return;
    zug.bewegt = true;
    if (zug.art === 'ecke') eckeZiehen(zug, sp);
    if (zug.art === 'wand') wandZiehen(zug, sp);
    if (zug.art === 'oeffnung') oeffnungZiehen(zug, sp);
    if (zug.art === 'dachfenster') dachfensterZiehen(zug, sp);
    if (zug.art === 'raum') raumZiehen(zug, sp);
  });

  let letzterTipp = null; // Ort und Zeit des letzten Loslassens (gegen den nachfolgenden Klick)
  const zeigerEnde = async (e) => {
    if (!zeiger.has(e.pointerId)) return;
    letzterTipp = { x: e.clientX, y: e.clientY, zeit: Date.now() };
    zeiger.delete(e.pointerId);
    if (geste) {
      if (zeiger.size < 2) geste = null;
      if (zeiger.size === 1) {
        // restlicher Finger verschiebt weiter
        const [rest] = [...zeiger.values()];
        zug = { art: 'pan', sp: rest, ox: ansicht.ox, oy: ansicht.oy };
      } else zug = null;
      zeichne();
      return;
    }
    const zg = zug;
    zug = null;
    if (!zg) return;
    if (e.type === 'pointercancel') { strich = null; vorschau = null; zeichne(); return; }
    if (zg.art === 'strich' && strich) { await strichFertig(); return; }
    if (zg.art === 'pan') {
      if (zg.leer && !zg.bewegt) {
        const x = raumUnter(lokal(e));
        if (x && x !== d) wechseln(x.id);
        else if (x && auswahl?.art !== 'raum') auswaehlen({ art: 'raum' });
        else auswaehlen(null);
      }
      return;
    }
    if (zg.art === 'raum') {
      vorschau = null;
      if (zg.bewegt && zg.erg) uebernehme(zg.erg);
      auswaehlen({ art: 'raum' });
      return;
    }
    const sp = lokal(e);
    if (zg.art === 'ecke' || zg.art === 'wand' || zg.art === 'oeffnung' || zg.art === 'dachfenster') {
      const art = zg.art;
      if (zg.bewegt && zg.erg) {
        vorschau = null;
        uebernehme(zg.erg);
        auswaehlen({ art, id: zg.id });
      } else {
        vorschau = null;
        auswaehlen({ art, id: zg.id, ...(zg.t != null ? { t: zg.t } : {}) });
      }
      return;
    }
    if (zg.art === 'tipp') {
      if (!geschlossen(d)) { hinweis('Zuerst den Raum mit „Zeichnen“ skizzieren.'); zeichne(); return; }
      const w = trefferWand(sp, d, werkzeug === 'mass' ? 26 : 34);
      const unter = w ? null : raumUnter(sp);
      if (unter && unter !== d) { wechseln(unter.id); return; }
      if (!w) { hinweis(werkzeug === 'mass' ? 'Bitte direkt auf eine Wand oder ihre Maßzahl tippen.' : 'Bitte direkt auf eine Wand tippen.'); zeichne(); return; }
      if (werkzeug === 'mass') { massFragen(w.id); return; }
      if (werkzeug === 'tuer' || werkzeug === 'fenster') {
        if (!d.massstabGesetzt) hinweis('Tipp: zuerst ein echtes Maß eingeben, dann stimmen Lage und Größe.');
        const g = wandGeo(d, w.i);
        const erg = neueOeffnung(d, werkzeug, w.id, g.l * w.t);
        if (uebernehme(erg)) auswaehlen({ art: 'oeffnung', id: erg.oeffnung });
      }
    }
  };
  svg.addEventListener('pointerup', zeigerEnde);
  svg.addEventListener('pointercancel', zeigerEnde);
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sp = lokal(e);
    if (e.ctrlKey || e.deltaMode === 1 || Math.abs(e.deltaY) >= 40 || !e.deltaX) zoomUm(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), sp);
    else { ansicht.ox -= e.deltaX; ansicht.oy -= e.deltaY; }
    spaeter();
  }, { passive: false });

  // ---------- Knöpfe ----------
  view.querySelectorAll('.mk-wz').forEach((b) => {
    b.onclick = () => {
      werkzeug = b.dataset.wz;
      if (werkzeug !== 'auswahl') { auswahl = null; panelZu(); }
      meldung = '';
      zeichne();
    };
  });
  view.querySelectorAll('[data-zoom]').forEach((b) => {
    b.onclick = () => {
      const [w, h] = groesse();
      zoomUm(b.dataset.zoom === '+' ? 1.4 : 1 / 1.4, [w / 2, h / 2]);
      zeichne();
    };
  });
  const verlaufLaden = (z) => {
    const faktorVorher = d.skizze?.faktor || 1;
    d = z.raum;
    andere = z.andere || [];
    entwurf = z.entwurf;
    entwurfErkannt = entwurf ? offeneKontur(entwurf.punkte, entwurf.offen ? false : undefined) : null;
    if (entwurfErkannt?.geschlossen) entwurfErkannt = offeneKontur(entwurf.punkte, false);
    const faktor = d.skizze?.faktor || 1;
    if (faktor !== faktorVorher) ansicht.s *= faktorVorher / faktor;
    auswahl = null;
    vorschau = null;
    panelZu();
    geaendert = true;
    zeichne();
  };
  $('.ra-zurueck').onclick = () => verlaufLaden(verlauf.zurueck());
  $('.ra-vor').onclick = () => verlaufLaden(verlauf.vor());
  $('.ra-ansicht').onclick = () => { einpassen(); zeichne(); };
  $('.ra-massstab').onclick = () => masseZeigen();
  $('.ra-einst').onclick = () => einstellungen();
  $('.ra-werte').onclick = () => einstellungen();
  $('.ra-dialog').addEventListener('pointerdown', (e) => e.stopPropagation());

  const groesseGeaendert = () => zeichne();
  window.addEventListener('resize', groesseGeaendert);
  einpassen();
  zeichne();

  return new Promise((resolve) => {
    const schliessen = (ergebnis) => {
      window.removeEventListener('resize', groesseGeaendert);
      document.documentElement.classList.remove('mk-offen');
      view.remove();
      resolve(ergebnis);
    };
    $('.ra-abbrechen').onclick = async () => {
      if (geaendert) {
        const ja = await dialog('<b>Raumaufmaß verwerfen?</b><p class="fa-klein">Die Änderungen gehen verloren.</p><div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Weiter bearbeiten</button><button type="button" class="btn primary" data-wert="ja">Verwerfen</button></div>');
        if (!ja) return;
      }
      schliessen(null);
    };
    $('.ra-fertig').onclick = async () => {
      // ein neuer, noch leerer Raum im Grundriss fällt weg
      const alle = [d, ...andere].filter((x) => x === d ? (geschlossen(x) || !andere.length || x.ecken.length || entwurf) : true);
      const p = { fehler: [], warnungen: [] };
      for (const x of alle) {
        const px = pruefe(x);
        const vor = alle.length > 1 ? `${x.name || 'Raum'}: ` : '';
        p.fehler.push(...px.fehler.map((f) => vor + f));
        p.warnungen.push(...px.warnungen.map((f) => vor + f));
      }
      p.warnungen.push(...pruefeGruppe(alle.filter(geschlossen)));
      if (p.fehler.length) {
        await dialog(`<b>Bitte noch korrigieren</b><ul class="ra-liste">${p.fehler.map((f) => `<li>${escH(f)}</li>`).join('')}</ul>${p.warnungen.length ? `<p class="fa-klein">Außerdem:</p><ul class="ra-liste">${p.warnungen.map((f) => `<li>${escH(f)}</li>`).join('')}</ul>` : ''}
          <div class="fa-panel-knoepfe"><button type="button" class="btn primary" data-wert="ok">OK</button></div>`);
        return;
      }
      if (p.warnungen.length) {
        const ja = await dialog(`<b>Bitte prüfen</b><ul class="ra-liste">${p.warnungen.map((f) => `<li>${escH(f)}</li>`).join('')}</ul>
          <div class="fa-panel-knoepfe"><button type="button" class="btn ghost" data-wert="">Zurück</button><button type="button" class="btn primary" data-wert="ja">Trotzdem übernehmen</button></div>`);
        if (!ja) return;
      }
      const geaenderte = alle.filter((x) => x === d || anfangs.get(x.id) !== JSON.stringify(x));
      const aktiv = alle.includes(d) ? d : geaenderte[0];
      if (!aktiv) { schliessen(null); return; }
      schliessen({
        daten: aktiv,
        svg: alsSvg(aktiv, massstabFuer(aktiv)),
        raeume: geaenderte.map((x) => ({ daten: x, svg: alsSvg(x, massstabFuer(x)) })),
        gesamtSvg: alle.length > 1 ? alsSvg(alle, massstabFuer(alle)) : null,
      });
    };
  });
}


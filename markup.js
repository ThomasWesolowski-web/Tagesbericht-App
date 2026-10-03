// Foto markieren: mit dem Finger zeichnen, Pfeile, Kreise, Rechtecke und Text.
// openMarkup(blob) liefert das bearbeitete Bild als JPEG oder null bei „Abbrechen“.
// Für Pläne: openMarkup(blob, { formen, fotos, pinNr, titel, mitFormen: true }) liefert
// { blob, formen }, damit der Plan später weiter bearbeitet werden kann. Dort gibt es zusätzlich
// „Fläche“ (bearbeitete Flächen halb durchsichtig ausmalen) und „Foto“ (nummerierter Foto-Pin).
// Überall: Hand zum Verschieben, Zoomen mit zwei Fingern, Strichstärke Dünn/Mittel/Dick oder Regler.

const FARBEN = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#111111', '#ffffff'];
const WERKZEUGE = [
  { id: 'stift', label: 'Stift', svg: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'pfeil', label: 'Pfeil', svg: '<path d="M5 19L19 5M10 5h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'kreis', label: 'Kreis', svg: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'rechteck', label: 'Rechteck', svg: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'text', label: 'Text', svg: '<path d="M5 6h14M12 6v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
];
const PLAN_WERKZEUGE = [
  { id: 'flaeche', label: 'Fläche', svg: '<path d="M5 8c3-4 9-4 13-1s2 9-3 10-12 0-11-4 0-3 1-5z" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'foto', label: 'Foto', svg: '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10.5" r="2.2" fill="currentColor"/>' },
];
export const PIN_FARBE = '#e2611b';
const RUECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -3)"/></svg>';

async function ladeBild(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function zeichne(ctx, s) {
  ctx.save();
  ctx.strokeStyle = s.farbe;
  ctx.fillStyle = s.farbe;
  ctx.lineWidth = s.breite;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Dunkler Rand bei hellen Farben, damit sie auf hellem Grund sichtbar bleiben
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = s.breite * 0.8;
  if (s.typ === 'stift') {
    ctx.beginPath();
    s.punkte.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (s.punkte.length === 1) ctx.lineTo(s.punkte[0][0] + 0.1, s.punkte[0][1]);
    ctx.stroke();
  } else if (s.typ === 'pfeil') {
    const [x1, y1] = s.von;
    const [x2, y2] = s.bis;
    const w = Math.atan2(y2 - y1, x2 - x1);
    const kopf = Math.max(s.breite * 4.5, 18);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(w) * kopf * 0.6, y2 - Math.sin(w) * kopf * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - kopf * Math.cos(w - 0.45), y2 - kopf * Math.sin(w - 0.45));
    ctx.lineTo(x2 - kopf * Math.cos(w + 0.45), y2 - kopf * Math.sin(w + 0.45));
    ctx.closePath();
    ctx.fill();
  } else if (s.typ === 'kreis') {
    const cx = (s.von[0] + s.bis[0]) / 2;
    const cy = (s.von[1] + s.bis[1]) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, Math.abs(s.bis[0] - s.von[0]) / 2), Math.max(1, Math.abs(s.bis[1] - s.von[1]) / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.typ === 'rechteck') {
    ctx.strokeRect(Math.min(s.von[0], s.bis[0]), Math.min(s.von[1], s.bis[1]), Math.abs(s.bis[0] - s.von[0]), Math.abs(s.bis[1] - s.von[1]));
  } else if (s.typ === 'flaeche') {
    ctx.shadowBlur = 0;
    ctx.beginPath();
    s.punkte.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, s.breite * 0.6);
    ctx.stroke();
  } else if (s.typ === 'pin') {
    const r = s.breite * 3.4;
    const [x, y] = s.von;
    // Tropfenform: Spitze zeigt auf die Stelle
    ctx.shadowBlur = s.breite;
    ctx.fillStyle = PIN_FARBE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - r * 0.4, y - r * 0.9, x - r, y - r * 1.25, x - r, y - r * 2);
    ctx.arc(x, y - r * 2, r, Math.PI, 0);
    ctx.bezierCurveTo(x + r, y - r * 1.25, x + r * 0.4, y - r * 0.9, x, y);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${r * (String(s.nr).length > 1 ? 1.05 : 1.3)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(s.nr), x, y - r * 1.95);
  } else if (s.typ === 'text') {
    const groesse = s.breite * 6;
    ctx.font = `700 ${groesse}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(3, groesse / 7);
    ctx.strokeStyle = s.farbe === '#111111' ? '#ffffff' : '#111111';
    ctx.strokeText(s.text, s.von[0], s.von[1]);
    ctx.fillText(s.text, s.von[0], s.von[1]);
  }
  ctx.restore();
}

// Strichstärke: Faktor zur Grundbreite (Mittel = 1)
const STAERKEN = [{ id: 'duenn', label: 'Dünn', f: 0.5 }, { id: 'mittel', label: 'Mittel', f: 1 }, { id: 'dick', label: 'Dick', f: 2.2 }];
const KAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const GALERIE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="M4 17l5-5 4 4 2.5-2.5L20 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const HAND = { id: 'hand', label: 'Hand', svg: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.3 15.6a1.6 1.6 0 0 1 2.4-2.1L8 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' };

export async function openMarkup(blob, opts = {}) {
  const { titel = 'Foto markieren', fotos = null, mitFormen = false, kachel = null, nurAnsehen = false, fotoNeu = null } = opts;
  let pinNr = opts.pinNr ?? null;
  const plan = mitFormen;
  const img = await ladeBild(blob);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const basis = Math.max(3, Math.round(Math.max(W, H) / (plan ? 220 : 140)));
  const werkzeuge = plan ? [HAND, ...WERKZEUGE, ...PLAN_WERKZEUGE] : [HAND, ...WERKZEUGE];
  let werkzeug = nurAnsehen ? 'hand' : pinNr != null ? 'foto' : plan ? 'flaeche' : 'stift';
  let farbe = plan && pinNr == null ? FARBEN[2] : FARBEN[0];
  let staerke = 1;
  const formen = (opts.formen || []).map((f) => JSON.parse(JSON.stringify(f)));
  const anfang = JSON.stringify(formen);
  let aktuell = null;
  let textPunkt = null;

  const view = document.createElement('div');
  view.className = `mk-view mk-markup${plan ? ' mk-plan' : ''}${nurAnsehen ? ' mk-ansehen' : ''}`;
  view.innerHTML = `
    <div class="mk-top">
      <button type="button" class="btn ghost mk-abbrechen">${nurAnsehen ? 'Schließen' : 'Abbrechen'}</button>
      <b>${titel.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</b>
      <button type="button" class="btn primary mk-fertig">Fertig</button>
    </div>
    <div class="mk-flaeche"><canvas></canvas>
      <div class="fa-zoomknoepfe"><button type="button" data-zoom="+" aria-label="Vergrößern">+</button><button type="button" data-zoom="-" aria-label="Verkleinern">−</button><button type="button" data-zoom="0" aria-label="Ganz zeigen">⤢</button></div>
      <div class="mk-hinweis" hidden></div>
    </div>
    <div class="mk-text" hidden>
      <input type="text" placeholder="Text eingeben" enterkeyhint="done">
      <button type="button" class="btn primary mk-text-ok">OK</button>
    </div>
    <div class="mk-fotowahl" hidden><div class="mk-fw-kopf"><b>Welches Foto ist hier entstanden?</b><button type="button" class="btn ghost mk-fw-zu">Abbrechen</button></div>${fotoNeu ? `<div class="mk-fw-neu">
      <label class="btn primary">${KAMERA}<span>Foto aufnehmen</span><input type="file" accept="image/*" capture="environment" hidden></label>
      <label class="btn soft">${GALERIE}<span>Vorhandenes Foto</span><input type="file" accept="image/*" hidden></label></div>` : ''}<div class="mk-fw-liste"></div></div>
    <div class="mk-leiste">
      <div class="mk-werkzeuge" style="--n:${werkzeuge.length}">${werkzeuge.map((w) => `<button type="button" class="mk-wz" data-wz="${w.id}" aria-pressed="${w.id === werkzeug}"><svg viewBox="0 0 24 24" aria-hidden="true">${w.svg}</svg><span>${w.label}</span></button>`).join('')}</div>
      <div class="mk-farben">
        ${FARBEN.map((f) => `<button type="button" class="mk-farbe" data-farbe="${f}" style="--f:${f}" aria-label="Farbe" aria-pressed="${f === farbe}"></button>`).join('')}
        <button type="button" class="mk-rueck" aria-label="Rückgängig">${RUECK}<span>Rückgängig</span></button>
      </div>
      <div class="mk-staerke">
        ${STAERKEN.map((x) => `<button type="button" class="mk-st" data-f="${x.f}" aria-pressed="${x.f === staerke}"><i style="--h:${Math.round(2 + x.f * 3)}px"></i>${x.label}</button>`).join('')}
        <input type="range" class="mk-regler" min="0.25" max="4" step="0.05" value="${staerke}" aria-label="Strichstärke">
      </div>
    </div>`;
  document.body.appendChild(view);
  document.documentElement.classList.add('mk-offen');

  const canvas = view.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const flaeche = view.querySelector('.mk-flaeche');
  const textBox = view.querySelector('.mk-text');
  const textInput = textBox.querySelector('input');
  const hinweisBox = view.querySelector('.mk-hinweis');
  const fotoWahl = view.querySelector('.mk-fotowahl');

  let hinweisUhr = null;
  const hinweis = (t) => {
    hinweisBox.textContent = t || '';
    hinweisBox.hidden = !t;
    clearTimeout(hinweisUhr);
    if (t) hinweisUhr = setTimeout(() => { hinweisBox.hidden = true; }, 6000);
  };

  // Ansicht: Bildschirmpunkt = Bildpunkt × s + (x, y). Gezeichnet wird nur, was zu sehen ist,
  // beim Hineinzoomen in Plänen mit einem scharf nachgezeichneten Ausschnitt (kachel).
  let ansicht = { s: 1, x: 0, y: 0 };
  let fitS = 1;
  let dpr = 1;
  let scharf = null; // { x, y, w, h, c }
  const groesseSetzen = () => {
    const r = flaeche.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const alt = fitS;
    fitS = Math.min((r.width - 8) / W, (r.height - 8) / H);
    if (ansicht.s <= alt * 1.001) ansicht = { s: fitS, x: (r.width - W * fitS) / 2, y: (r.height - H * fitS) / 2 };
    else begrenzen();
  };
  const begrenzen = () => {
    const r = flaeche.getBoundingClientRect();
    ansicht.s = Math.min(fitS * 16, Math.max(fitS, ansicht.s));
    if (ansicht.s <= fitS * 1.001) { ansicht = { s: fitS, x: (r.width - W * fitS) / 2, y: (r.height - H * fitS) / 2 }; return; }
    const rand = 60;
    ansicht.x = Math.min(r.width - rand, Math.max(rand - W * ansicht.s, ansicht.x));
    ansicht.y = Math.min(r.height - rand, Math.max(rand - H * ansicht.s, ansicht.y));
  };
  const neuZeichnen = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16191d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { s, x, y } = ansicht;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
    if (scharf) ctx.drawImage(scharf.c, scharf.x, scharf.y, scharf.w, scharf.h);
    formen.forEach((f) => zeichne(ctx, f));
    if (aktuell) zeichne(ctx, aktuell);
    view.querySelector('.mk-rueck').disabled = !formen.length;
  };
  let scharfUhr = null;
  let scharfNr = 0;
  const scharfNachladen = () => {
    clearTimeout(scharfUhr);
    if (!kachel) return;
    const k = ansicht.s * dpr;
    if (k <= 1.15) { if (scharf) { scharf = null; neuZeichnen(); } return; }
    scharfUhr = setTimeout(async () => {
      const r = flaeche.getBoundingClientRect();
      const x0 = Math.max(0, -ansicht.x / ansicht.s);
      const y0 = Math.max(0, -ansicht.y / ansicht.s);
      const x1 = Math.min(W, (r.width - ansicht.x) / ansicht.s);
      const y1 = Math.min(H, (r.height - ansicht.y) / ansicht.s);
      if (x1 <= x0 || y1 <= y0) return;
      const nr = ++scharfNr;
      const c = await kachel(x0, y0, x1 - x0, y1 - y0, k).catch(() => null);
      if (!c || nr !== scharfNr) return;
      scharf = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, c };
      neuZeichnen();
    }, 220);
  };
  const ansichtGeaendert = () => { begrenzen(); neuZeichnen(); scharfNachladen(); };
  groesseSetzen();
  neuZeichnen();
  const beiGroesse = () => { groesseSetzen(); neuZeichnen(); scharfNachladen(); };
  window.addEventListener('resize', beiGroesse);
  const wzHinweis = () => hinweis(werkzeug === 'foto'
    ? (pinNr != null ? `Tippe auf die Stelle im Plan, an der Foto ${pinNr} entstanden ist.` : (fotoNeu ? 'Tippe auf die Stelle im Plan, dann Foto aufnehmen oder auswählen.' : 'Tippe auf die Stelle, an der ein Foto entstanden ist.'))
    : werkzeug === 'hand' ? 'Mit einem Finger verschieben, mit zwei Fingern zoomen.'
    : plan && werkzeug === 'flaeche' ? 'Bearbeitete Fläche mit dem Finger umfahren. Zwei Finger zoomen.' : '');
  wzHinweis();

  // Zoomen um einen Bildschirmpunkt (relativ zur Fläche), der Punkt bleibt stehen
  const lokal = (cx, cy) => {
    const r = flaeche.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  };
  const zoomUm = (neuS, [mx, my], von = ansicht, [ax, ay] = [mx, my]) => {
    const bx = (ax - von.x) / von.s;
    const by = (ay - von.y) / von.s;
    ansicht = { s: neuS, x: mx - neuS * bx, y: my - neuS * by };
    ansichtGeaendert();
  };
  const mitte = () => {
    const r = flaeche.getBoundingClientRect();
    return [r.width / 2, r.height / 2];
  };
  view.querySelectorAll('[data-zoom]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.zoom === '0') { ansicht.s = fitS; ansichtGeaendert(); return; }
      zoomUm(ansicht.s * (b.dataset.zoom === '+' ? 1.6 : 1 / 1.6), mitte());
    };
  });
  flaeche.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomUm(ansicht.s * Math.exp(-e.deltaY / 300), lokal(e.clientX, e.clientY));
  }, { passive: false });

  const punkt = (e) => {
    const [lx, ly] = lokal(e.clientX, e.clientY);
    return [(lx - ansicht.x) / ansicht.s, (ly - ansicht.y) / ansicht.s];
  };
  // Strichbreite in Bildpunkten: gleich dick auf dem Bildschirm, egal wie weit hineingezoomt ist
  const breite = () => staerke * basis * (fitS / ansicht.s);

  const pinSetzen = (p, nr) => {
    formen.push({ typ: 'pin', farbe: PIN_FARBE, breite: basis, von: p, nr });
    neuZeichnen();
  };
  // Foto zur Stelle p: neu aufnehmen, vom Handy wählen oder eines aus dem Bericht nehmen
  let wahlPunkt = null;
  const fotoWaehlen = (p) => {
    if (!fotos?.length && !fotoNeu) { hinweis('Im Bericht sind noch keine Fotos. Erst Fotos aufnehmen, dann hier zuordnen.'); return; }
    wahlPunkt = p;
    const liste = fotoWahl.querySelector('.mk-fw-liste');
    liste.innerHTML = (fotos || []).map((f) => `<button type="button" data-nr="${f.nr}"><img src="${f.url}" alt=""><span>Foto ${f.nr}</span></button>`).join('');
    fotoWahl.hidden = false;
    liste.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { fotoWahl.hidden = true; pinSetzen(p, Number(b.dataset.nr)); };
    });
  };
  fotoWahl.querySelectorAll('.mk-fw-neu input').forEach((inp) => {
    inp.onchange = async () => {
      const datei = inp.files[0];
      inp.value = '';
      if (!datei || !wahlPunkt) return;
      const p = wahlPunkt;
      fotoWahl.hidden = true;
      hinweis('Foto wird angehängt …');
      try {
        const neu = await fotoNeu(datei);
        if (!neu) { hinweis(''); return; }
        fotos.push(neu);
        pinSetzen(p, neu.nr);
        hinweis(`Foto ${neu.nr} ist im Bericht und auf dem Plan.`);
      } catch (err) {
        hinweis(`Das Foto ließ sich nicht anhängen (${err.message}).`);
      }
    };
  });
  fotoWahl.querySelector('.mk-fw-zu').onclick = () => { fotoWahl.hidden = true; };

  // Finger: mit der Hand (oder zwei Fingern) verschieben und zoomen, sonst zeichnen
  const finger = new Map();
  let geste = null;
  const gesteStarten = () => {
    const f = [...finger.values()];
    const m = f.length > 1 ? [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2] : f[0];
    geste = { d: f.length > 1 ? Math.hypot(f[0][0] - f[1][0], f[0][1] - f[1][1]) : 0, m, von: { ...ansicht } };
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    finger.set(e.pointerId, lokal(e.clientX, e.clientY));
    canvas.setPointerCapture(e.pointerId);
    if (finger.size >= 2 || werkzeug === 'hand') {
      if (aktuell) { aktuell = null; neuZeichnen(); }
      gesteStarten();
      return;
    }
    const p = punkt(e);
    if (werkzeug === 'text') {
      textPunkt = p;
      textBox.hidden = false;
      textInput.value = '';
      textInput.focus();
      return;
    }
    if (werkzeug === 'foto') {
      aktuell = { typ: 'tipp', von: p };
      return;
    }
    aktuell = werkzeug === 'stift' || werkzeug === 'flaeche'
      ? { typ: werkzeug, farbe, breite: breite(), punkte: [p] }
      : { typ: werkzeug, farbe, breite: breite(), von: p, bis: p };
    neuZeichnen();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!finger.has(e.pointerId)) return;
    finger.set(e.pointerId, lokal(e.clientX, e.clientY));
    if (geste) {
      const f = [...finger.values()];
      if (f.length > 1) {
        const d = Math.hypot(f[0][0] - f[1][0], f[0][1] - f[1][1]);
        zoomUm(geste.von.s * (d / geste.d), [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2], geste.von, geste.m);
      } else {
        ansicht = { s: geste.von.s, x: geste.von.x + f[0][0] - geste.m[0], y: geste.von.y + f[0][1] - geste.m[1] };
        ansichtGeaendert();
      }
      return;
    }
    if (!aktuell || aktuell.typ === 'tipp') return;
    const p = punkt(e);
    if (aktuell.typ === 'stift' || aktuell.typ === 'flaeche') aktuell.punkte.push(p);
    else aktuell.bis = p;
    neuZeichnen();
  });
  const loslassen = (e) => {
    finger.delete(e.pointerId);
    if (geste) {
      // Mit dem verbleibenden Finger nahtlos weiter verschieben
      if (finger.size) gesteStarten(); else geste = null;
      return;
    }
    if (!aktuell) return;
    if (aktuell.typ === 'tipp') {
      const p = aktuell.von;
      aktuell = null;
      if (e.type === 'pointercancel') return;
      if (pinNr != null) { pinSetzen(p, pinNr); pinNr = null; wzHinweis(); } else fotoWaehlen(p);
      return;
    }
    const klein = aktuell.von
      ? Math.hypot(aktuell.bis[0] - aktuell.von[0], aktuell.bis[1] - aktuell.von[1]) < aktuell.breite * 2
      : aktuell.typ === 'flaeche' && aktuell.punkte.length < 3;
    if (!klein) formen.push(aktuell);
    aktuell = null;
    neuZeichnen();
  };
  canvas.addEventListener('pointerup', loslassen);
  canvas.addEventListener('pointercancel', loslassen);

  const textFertig = () => {
    const t = textInput.value.trim();
    if (t && textPunkt) formen.push({ typ: 'text', farbe, breite: breite(), von: textPunkt, text: t });
    textBox.hidden = true;
    textPunkt = null;
    textInput.blur();
    neuZeichnen();
  };
  textBox.querySelector('.mk-text-ok').onclick = textFertig;
  textInput.onkeydown = (e) => { if (e.key === 'Enter') textFertig(); };

  view.querySelectorAll('.mk-wz').forEach((b) => {
    b.onclick = () => {
      werkzeug = b.dataset.wz;
      view.querySelectorAll('.mk-wz').forEach((x) => x.setAttribute('aria-pressed', x === b));
      if (werkzeug !== 'text') textBox.hidden = true;
      wzHinweis();
    };
  });
  view.querySelectorAll('.mk-farbe').forEach((b) => {
    b.onclick = () => {
      farbe = b.dataset.farbe;
      view.querySelectorAll('.mk-farbe').forEach((x) => x.setAttribute('aria-pressed', x === b));
    };
  });
  const regler = view.querySelector('.mk-regler');
  const staerkeSetzen = (f) => {
    staerke = f;
    regler.value = f;
    view.querySelectorAll('.mk-st').forEach((x) => x.setAttribute('aria-pressed', Math.abs(Number(x.dataset.f) - f) < 0.01));
  };
  view.querySelectorAll('.mk-st').forEach((b) => { b.onclick = () => staerkeSetzen(Number(b.dataset.f)); });
  regler.oninput = () => staerkeSetzen(Number(regler.value));
  view.querySelector('.mk-rueck').onclick = () => { formen.pop(); neuZeichnen(); };

  return new Promise((resolve) => {
    const schliessen = (ergebnis) => {
      window.removeEventListener('resize', beiGroesse);
      clearTimeout(scharfUhr);
      scharfNr++;
      document.documentElement.classList.remove('mk-offen');
      view.remove();
      resolve(ergebnis);
    };
    view.querySelector('.mk-abbrechen').onclick = () => {
      if (JSON.stringify(formen) !== anfang && !confirm('Markierungen verwerfen?')) return;
      schliessen(null);
    };
    view.querySelector('.mk-fertig').onclick = () => {
      if (JSON.stringify(formen) === anfang && !(plan && !opts.formen)) { schliessen(null); return; }
      // Ergebnis in voller Größe zeichnen
      const aus = document.createElement('canvas');
      aus.width = W;
      aus.height = H;
      const a = aus.getContext('2d');
      a.drawImage(img, 0, 0, W, H);
      formen.forEach((f) => zeichne(a, f));
      aus.toBlob((b) => {
        aus.width = 1;
        aus.height = 1;
        schliessen(mitFormen ? { blob: b, formen, w: W, h: H } : b);
      }, 'image/jpeg', plan ? 0.9 : 0.88);
    };
  });
}

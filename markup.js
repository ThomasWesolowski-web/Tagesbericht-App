// Foto markieren: mit dem Finger zeichnen, Pfeile, Kreise, Rechtecke und Text.
// openMarkup(blob) liefert das bearbeitete Bild als JPEG oder null bei „Abbrechen“.
// Für Pläne: openMarkup(blob, { formen, fotos, pinNr, titel, mitFormen: true }) liefert
// { blob, formen }, damit der Plan später weiter bearbeitet werden kann. Dort gibt es zusätzlich
// „Fläche“ (bearbeitete Flächen halb durchsichtig ausmalen), „Foto“ (nummerierter Foto-Pin)
// und Zoomen mit zwei Fingern.

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

export async function openMarkup(blob, opts = {}) {
  const { titel = 'Foto markieren', fotos = null, mitFormen = false } = opts;
  let pinNr = opts.pinNr ?? null;
  const plan = mitFormen;
  const img = await ladeBild(blob);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const basis = Math.max(3, Math.round(Math.max(W, H) / (plan ? 220 : 140)));
  const werkzeuge = plan ? [...WERKZEUGE, ...PLAN_WERKZEUGE] : WERKZEUGE;
  let werkzeug = pinNr != null ? 'foto' : plan ? 'flaeche' : 'stift';
  let farbe = plan && pinNr == null ? FARBEN[2] : FARBEN[0];
  let dick = false;
  const formen = (opts.formen || []).map((f) => JSON.parse(JSON.stringify(f)));
  const anfang = JSON.stringify(formen);
  let aktuell = null;
  let textPunkt = null;

  const view = document.createElement('div');
  view.className = `mk-view${plan ? ' mk-plan' : ''}`;
  view.innerHTML = `
    <div class="mk-top">
      <button type="button" class="btn ghost mk-abbrechen">Abbrechen</button>
      <b>${titel.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</b>
      <button type="button" class="btn primary mk-fertig">Fertig</button>
    </div>
    <div class="mk-flaeche"><canvas></canvas>
      ${plan ? '<div class="fa-zoomknoepfe"><button type="button" data-zoom="+" aria-label="Vergrößern">+</button><button type="button" data-zoom="-" aria-label="Verkleinern">−</button><button type="button" data-zoom="0" aria-label="Ganzer Plan">⤢</button></div>' : ''}
      <div class="mk-hinweis" hidden></div>
    </div>
    <div class="mk-text" hidden>
      <input type="text" placeholder="Text eingeben" enterkeyhint="done">
      <button type="button" class="btn primary mk-text-ok">OK</button>
    </div>
    <div class="mk-fotowahl" hidden><div class="mk-fw-kopf"><b>Welches Foto ist hier entstanden?</b><button type="button" class="btn ghost mk-fw-zu">Abbrechen</button></div><div class="mk-fw-liste"></div></div>
    <div class="mk-leiste">
      <div class="mk-werkzeuge">${werkzeuge.map((w) => `<button type="button" class="mk-wz" data-wz="${w.id}" aria-pressed="${w.id === werkzeug}"><svg viewBox="0 0 24 24" aria-hidden="true">${w.svg}</svg><span>${w.label}</span></button>`).join('')}</div>
      <div class="mk-farben">
        ${FARBEN.map((f) => `<button type="button" class="mk-farbe" data-farbe="${f}" style="--f:${f}" aria-label="Farbe" aria-pressed="${f === farbe}"></button>`).join('')}
        <button type="button" class="mk-dicke" aria-pressed="false"><span>Dick</span></button>
        <button type="button" class="mk-rueck" aria-label="Rückgängig">${RUECK}<span>Rückgängig</span></button>
      </div>
    </div>`;
  document.body.appendChild(view);
  document.documentElement.classList.add('mk-offen');

  const canvas = view.querySelector('canvas');
  canvas.width = W;
  canvas.height = H;
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
  const einpassen = () => {
    const r = flaeche.getBoundingClientRect();
    const s = Math.min((r.width - 8) / W, (r.height - 8) / H);
    canvas.style.width = `${Math.floor(W * s)}px`;
    canvas.style.height = `${Math.floor(H * s)}px`;
  };
  const neuZeichnen = () => {
    ctx.drawImage(img, 0, 0, W, H);
    formen.forEach((f) => zeichne(ctx, f));
    if (aktuell) zeichne(ctx, aktuell);
    view.querySelector('.mk-rueck').disabled = !formen.length;
  };
  einpassen();
  neuZeichnen();
  window.addEventListener('resize', einpassen);
  const wzHinweis = () => hinweis(werkzeug === 'foto'
    ? (pinNr != null ? `Tippe auf die Stelle im Plan, an der Foto ${pinNr} entstanden ist.` : 'Tippe auf die Stelle, an der ein Foto entstanden ist.')
    : plan && werkzeug === 'flaeche' ? 'Bearbeitete Fläche mit dem Finger umfahren. Zwei Finger zoomen.' : '');
  wzHinweis();

  // Zoomen (nur bei Plänen): zwei Finger, Mausrad oder die Knöpfe
  let zoom = { z: 1, x: 0, y: 0 };
  const zoomSetzen = () => {
    if (zoom.z <= 1.01) zoom = { z: 1, x: 0, y: 0 };
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = zoom.z === 1 ? '' : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`;
  };
  const zoomUm = (z, [mx, my], von = zoom, [ax, ay] = [mx, my]) => {
    const fr = flaeche.getBoundingClientRect();
    const lx = fr.left + canvas.offsetLeft;
    const ly = fr.top + canvas.offsetTop;
    const lokal = [(ax - lx - von.x) / von.z, (ay - ly - von.y) / von.z];
    const neu = Math.min(10, Math.max(1, z));
    zoom = { z: neu, x: mx - lx - neu * lokal[0], y: my - ly - neu * lokal[1] };
    zoomSetzen();
  };
  const mitte = () => {
    const fr = flaeche.getBoundingClientRect();
    return [fr.left + fr.width / 2, fr.top + fr.height / 2];
  };
  view.querySelectorAll('[data-zoom]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.zoom === '0') { zoom = { z: 1, x: 0, y: 0 }; zoomSetzen(); return; }
      zoomUm(zoom.z * (b.dataset.zoom === '+' ? 1.6 : 1 / 1.6), mitte());
    };
  });
  if (plan) {
    flaeche.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomUm(zoom.z * Math.exp(-e.deltaY / 300), [e.clientX, e.clientY]);
    }, { passive: false });
  }

  const punkt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const breite = () => basis * (dick ? 2.2 : 1);

  const pinSetzen = (p, nr) => {
    formen.push({ typ: 'pin', farbe: PIN_FARBE, breite: basis, von: p, nr });
    neuZeichnen();
  };
  const fotoWaehlen = (p) => {
    if (!fotos?.length) { hinweis('Im Bericht sind noch keine Fotos. Erst Fotos aufnehmen, dann hier zuordnen.'); return; }
    const liste = fotoWahl.querySelector('.mk-fw-liste');
    liste.innerHTML = fotos.map((f) => `<button type="button" data-nr="${f.nr}"><img src="${f.url}" alt=""><span>Foto ${f.nr}</span></button>`).join('');
    fotoWahl.hidden = false;
    liste.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { fotoWahl.hidden = true; pinSetzen(p, Number(b.dataset.nr)); };
    });
  };
  fotoWahl.querySelector('.mk-fw-zu').onclick = () => { fotoWahl.hidden = true; };

  // Zwei Finger gleichzeitig: zoomen statt zeichnen
  const finger = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    finger.set(e.pointerId, [e.clientX, e.clientY]);
    if (plan && finger.size === 2) {
      aktuell = null;
      neuZeichnen();
      const [a, b] = [...finger.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], von: { ...zoom } };
      return;
    }
    if (finger.size > 1) return;
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
    canvas.setPointerCapture(e.pointerId);
    aktuell = werkzeug === 'stift' || werkzeug === 'flaeche'
      ? { typ: werkzeug, farbe, breite: breite(), punkte: [p] }
      : { typ: werkzeug, farbe, breite: breite(), von: p, bis: p };
    neuZeichnen();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (finger.has(e.pointerId)) finger.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && finger.size === 2) {
      const [a, b] = [...finger.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomUm(pinch.von.z * (d / pinch.d), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], pinch.von, pinch.m);
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
    if (pinch) {
      if (!finger.size) pinch = null;
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
      ? Math.hypot(aktuell.bis[0] - aktuell.von[0], aktuell.bis[1] - aktuell.von[1]) < basis * 2
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
  const dickBtn = view.querySelector('.mk-dicke');
  dickBtn.onclick = () => { dick = !dick; dickBtn.setAttribute('aria-pressed', dick); };
  view.querySelector('.mk-rueck').onclick = () => { formen.pop(); neuZeichnen(); };

  return new Promise((resolve) => {
    const schliessen = (ergebnis) => {
      window.removeEventListener('resize', einpassen);
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
      aktuell = null;
      neuZeichnen();
      canvas.toBlob((b) => schliessen(mitFormen ? { blob: b, formen, w: W, h: H } : b), 'image/jpeg', 0.88);
    };
  });
}

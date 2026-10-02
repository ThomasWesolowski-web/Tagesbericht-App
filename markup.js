// Foto markieren: mit dem Finger zeichnen, Pfeile, Kreise, Rechtecke und Text.
// openMarkup(blob) liefert das bearbeitete Bild als JPEG oder null bei „Abbrechen“.

const FARBEN = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#111111', '#ffffff'];
const WERKZEUGE = [
  { id: 'stift', label: 'Stift', svg: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'pfeil', label: 'Pfeil', svg: '<path d="M5 19L19 5M10 5h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'kreis', label: 'Kreis', svg: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'rechteck', label: 'Rechteck', svg: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'text', label: 'Text', svg: '<path d="M5 6h14M12 6v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
];
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

export async function openMarkup(blob) {
  const img = await ladeBild(blob);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const basis = Math.max(3, Math.round(Math.max(W, H) / 140));
  let werkzeug = 'stift';
  let farbe = FARBEN[0];
  let dick = false;
  const formen = [];
  let aktuell = null;
  let textPunkt = null;

  const view = document.createElement('div');
  view.className = 'mk-view';
  view.innerHTML = `
    <div class="mk-top">
      <button type="button" class="btn ghost mk-abbrechen">Abbrechen</button>
      <b>Foto markieren</b>
      <button type="button" class="btn primary mk-fertig">Fertig</button>
    </div>
    <div class="mk-flaeche"><canvas></canvas></div>
    <div class="mk-text" hidden>
      <input type="text" placeholder="Text eingeben" enterkeyhint="done">
      <button type="button" class="btn primary mk-text-ok">OK</button>
    </div>
    <div class="mk-leiste">
      <div class="mk-werkzeuge">${WERKZEUGE.map((w) => `<button type="button" class="mk-wz" data-wz="${w.id}" aria-pressed="${w.id === werkzeug}"><svg viewBox="0 0 24 24" aria-hidden="true">${w.svg}</svg><span>${w.label}</span></button>`).join('')}</div>
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

  const punkt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const breite = () => basis * (dick ? 2.2 : 1);

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = punkt(e);
    if (werkzeug === 'text') {
      textPunkt = p;
      textBox.hidden = false;
      textInput.value = '';
      textInput.focus();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    aktuell = werkzeug === 'stift'
      ? { typ: 'stift', farbe, breite: breite(), punkte: [p] }
      : { typ: werkzeug, farbe, breite: breite(), von: p, bis: p };
    neuZeichnen();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!aktuell) return;
    const p = punkt(e);
    if (aktuell.typ === 'stift') aktuell.punkte.push(p);
    else aktuell.bis = p;
    neuZeichnen();
  });
  const loslassen = () => {
    if (!aktuell) return;
    const klein = aktuell.von && Math.hypot(aktuell.bis[0] - aktuell.von[0], aktuell.bis[1] - aktuell.von[1]) < basis * 2;
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
      if (formen.length && !confirm('Markierungen verwerfen?')) return;
      schliessen(null);
    };
    view.querySelector('.mk-fertig').onclick = () => {
      if (!formen.length) { schliessen(null); return; }
      aktuell = null;
      neuZeichnen();
      canvas.toBlob((b) => schliessen(b), 'image/jpeg', 0.88);
    };
  });
}

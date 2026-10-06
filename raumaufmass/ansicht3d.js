// 3-D-Ansicht der Räume (ohne Bibliothek): Flächen aus alsFlaechen3d, Zentralprojektion auf ein
// Canvas, gezeichnet von hinten nach vorn. Wände zwischen Betrachter und Raum werden fast durchsichtig
// („Puppenhaus“), die flache Decke bleibt offen. Ein Finger dreht, zwei Finger oder Mausrad zoomen.

import { alsFlaechen3d } from './raumgeometrie.js';

const FARBE = {
  boden: [236, 230, 220],
  wand: [246, 246, 244],
  tuer: [176, 122, 74],
  fenster: [140, 196, 236],
  dachfenster: [120, 184, 232],
  schraege: [214, 160, 130],
  koerper: [160, 166, 174],
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Grundriss: y zeigt nach unten (wie am Bildschirm). Für die Ansicht y spiegeln, damit nichts seitenverkehrt ist.
const welt = ([x, y, z]) => [x, -y, z];

export function zeige3d(raeume, titel = '3-D-Ansicht') {
  const flaechen = alsFlaechen3d(raeume).map((f) => ({ ...f, w: f.pts.map(welt), n: f.innen ? [f.innen[0], -f.innen[1], 0] : null }));
  if (!flaechen.length) return;
  const alle = flaechen.flatMap((f) => f.w);
  const min = [0, 1, 2].map((k) => Math.min(...alle.map((p) => p[k])));
  const max = [0, 1, 2].map((k) => Math.max(...alle.map((p) => p[k])));
  const mitte = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, max[2] / 3];
  const groesse = Math.max(max[0] - min[0], max[1] - min[1], 3);
  const START = { dreh: -Math.PI / 4 - Math.PI / 2, neig: 0.75, abstand: groesse * 1.2 };
  let cam = { ...START };

  const el = document.createElement('div');
  el.className = 'ra-3d';
  el.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#eef1f4;';
  el.innerHTML = `
    <header style="display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 8px) 12px 8px;background:var(--bg);border-bottom:1px solid var(--line)">
      <button type="button" class="btn ghost" data-tun="zu">Zurück</button>
      <b style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titel.replace(/[&<>"]/g, '')}</b>
      <button type="button" class="btn ghost" data-tun="start">Ansicht</button>
    </header>
    <canvas style="flex:1;width:100%;min-height:0;touch-action:none;display:block"></canvas>
    <p style="margin:0;padding:8px 12px calc(env(safe-area-inset-bottom) + 8px);font-size:.85rem;color:var(--ink-2);background:var(--bg)">Ein Finger dreht, zwei Finger zoomen. Wände vorn sind durchsichtig.</p>`;
  document.body.appendChild(el);
  document.body.classList.add('no-scroll');
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  const zeichnen = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const auge = [
      mitte[0] + cam.abstand * Math.cos(cam.neig) * Math.cos(cam.dreh),
      mitte[1] + cam.abstand * Math.cos(cam.neig) * Math.sin(cam.dreh),
      mitte[2] + cam.abstand * Math.sin(cam.neig),
    ];
    const vor = norm(sub(mitte, auge));
    const rechts = norm(kreuz(vor, [0, 0, 1]));
    const oben = kreuz(rechts, vor);
    const brenn = Math.min(W, H) * 0.9;
    const proj = (p) => {
      const v = sub(p, auge);
      const z = Math.max(0.05, dot(v, vor));
      return [W / 2 + (dot(v, rechts) * brenn) / z, H / 2 - (dot(v, oben) * brenn) / z, z];
    };
    const licht = norm([0.4, 0.6, 1]);
    const liste = flaechen.map((f) => {
      const s = f.w.map(proj);
      const tiefe = s.reduce((m, q) => m + q[2], 0) / s.length;
      // Wand vor dem Raum (Betrachter steht außen): fast durchsichtig
      const mittel = f.w.reduce((m, q) => [m[0] + q[0] / f.w.length, m[1] + q[1] / f.w.length, m[2] + q[2] / f.w.length], [0, 0, 0]);
      const vorn = f.n && dot(f.n, sub(auge, mittel)) < 0;
      let n = f.n;
      if (!n) {
        const [a, b, c] = f.w;
        n = norm(kreuz(sub(b, a), sub(c, a)));
        if (dot(n, sub(auge, a)) < 0) n = [-n[0], -n[1], -n[2]];
      }
      const hell = 0.8 + 0.2 * Math.abs(dot(n, licht));
      return { f, s, tiefe, vorn, hell };
    });
    // Türen und Fenster direkt nach ihrer Wand zeichnen
    const wandTiefe = new Map(liste.filter((x) => x.f.art === 'wand').map((x) => [`${x.f.raum}|${x.f.wand}`, x.tiefe]));
    for (const x of liste) if (x.f.art === 'tuer' || x.f.art === 'fenster') x.tiefe = (wandTiefe.get(`${x.f.raum}|${x.f.wand}`) ?? x.tiefe) - 1e-6;
    // Dachfenster direkt nach ihrer Schräge
    const schraegeTiefe = new Map(liste.filter((x) => x.f.art === 'schraege').map((x) => [`${x.f.raum}|${x.f.wand}`, x.tiefe]));
    for (const x of liste) if (x.f.art === 'dachfenster') x.tiefe = (schraegeTiefe.get(`${x.f.raum}|${x.f.wand}`) ?? x.tiefe) - 1e-6;
    liste.sort((a, b) => b.tiefe - a.tiefe);
    for (const { f, s, vorn, hell } of liste) {
      const c = FARBE[f.art].map((x) => Math.round(x * hell));
      const alpha = vorn ? 0.12 : f.art === 'schraege' ? 0.55 : 1;
      ctx.beginPath();
      s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(40,46,54,${vorn ? 0.25 : 0.7})`;
      ctx.lineWidth = f.art === 'boden' ? 1.6 : 1;
      ctx.stroke();
    }
    // Raumnamen auf dem Boden
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1d232a';
    for (const f of flaechen.filter((x) => x.art === 'boden')) {
      const m = f.w.reduce((a, q) => [a[0] + q[0] / f.w.length, a[1] + q[1] / f.w.length, 0], [0, 0, 0]);
      const [x, y] = proj(m);
      ctx.fillText(f.raum, x, y);
    }
  };

  let bild = 0;
  const spaeter = () => { if (!bild) bild = requestAnimationFrame(() => { bild = 0; zeichnen(); }); };
  const zeiger = new Map();
  let geste = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    zeiger.set(e.pointerId, [e.clientX, e.clientY]);
    if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; geste = { ab: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, abstand: cam.abstand }; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!zeiger.has(e.pointerId)) return;
    const alt = zeiger.get(e.pointerId);
    zeiger.set(e.pointerId, [e.clientX, e.clientY]);
    if (zeiger.size >= 2 && geste) {
      const [a, b] = [...zeiger.values()];
      cam.abstand = Math.max(groesse * 0.3, Math.min(groesse * 6, geste.abstand * (geste.ab / (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1))));
    } else if (zeiger.size === 1) {
      cam.dreh -= (e.clientX - alt[0]) * 0.01;
      cam.neig = Math.max(0.08, Math.min(1.5, cam.neig + (e.clientY - alt[1]) * 0.01));
    }
    spaeter();
  });
  const ende = (e) => { zeiger.delete(e.pointerId); if (zeiger.size < 2) geste = null; };
  canvas.addEventListener('pointerup', ende);
  canvas.addEventListener('pointercancel', ende);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.abstand = Math.max(groesse * 0.3, Math.min(groesse * 6, cam.abstand * Math.exp(e.deltaY * 0.0015)));
    spaeter();
  }, { passive: false });
  const neu = () => spaeter();
  window.addEventListener('resize', neu);
  el.querySelector('[data-tun="start"]').onclick = () => { cam = { ...START }; spaeter(); };
  el.querySelector('[data-tun="zu"]').onclick = () => {
    window.removeEventListener('resize', neu);
    el.remove();
    document.body.classList.remove('no-scroll');
  };
  zeichnen();
}

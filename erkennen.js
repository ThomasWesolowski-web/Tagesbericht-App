// Bildauswertung für das Foto-Aufmaß, läuft ganz auf dem Handy (ohne Internet):
// Ecken-Magnet (Ecke rastet an der nächsten echten Ecke im Foto ein) und
// Öffnung erkennen (Antippen in ein Fenster, die gleichfarbige Fläche wird zum Rechteck).

// Verkleinerte Fassung des Fotos: Graustufen für Ecken, Farben für das Erkennen
export function bildAnalyse(img, maxSeite = 1600) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const f = Math.min(1, maxSeite / Math.max(W, H));
  const w = Math.max(1, Math.round(W * f));
  const h = Math.max(1, Math.round(H * f));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const rgb = ctx.getImageData(0, 0, w, h).data;
  const grau = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grau[i] = (0.299 * rgb[i * 4] + 0.587 * rgb[i * 4 + 1] + 0.114 * rgb[i * 4 + 2]) / 255;
  return { w, h, s: W / w, rgb, grau };
}

// Harris-Eckenmaß im Umkreis von p (Bildpunkte des Originals); liefert die stärkste Ecke
// in der Nähe oder null, wenn dort keine deutliche Ecke ist
export function eckeFangen(a, p, radius) {
  const { w, h, s, grau } = a;
  const cx = p[0] / s;
  const cy = p[1] / s;
  const r = Math.max(3, Math.round(radius / s));
  const x0 = Math.max(2, Math.floor(cx - r - 3));
  const x1 = Math.min(w - 3, Math.ceil(cx + r + 3));
  const y0 = Math.max(2, Math.floor(cy - r - 3));
  const y1 = Math.min(h - 3, Math.ceil(cy + r + 3));
  if (x1 <= x0 || y1 <= y0) return null;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const xx = new Float32Array(bw * bh);
  const yy = new Float32Array(bw * bh);
  const xy = new Float32Array(bw * bh);
  const g = (x, y) => grau[y * w + x];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Sobel
      const gx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x - 1, y) + g(x - 1, y + 1));
      const gy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x, y - 1) + g(x + 1, y - 1));
      const i = (y - y0) * bw + (x - x0);
      xx[i] = gx * gx;
      yy[i] = gy * gy;
      xy[i] = gx * gy;
    }
  }
  // Je Punkt: Kontrast tr und Eckenmaß q = det/tr² (gerade Kante ≈ 0, rechter Winkel ≈ 0,25),
  // beides über 3 × 3 summiert
  const Q = new Float32Array(bw * bh);
  const T = new Float32Array(bw * bh);
  const alleT = [];
  for (let y = y0 + 1; y <= y1 - 1; y++) {
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      let a1 = 0;
      let b1 = 0;
      let c1 = 0;
      for (let v = -1; v <= 1; v++) {
        for (let u = -1; u <= 1; u++) {
          const i = (y + v - y0) * bw + (x + u - x0);
          a1 += xx[i];
          b1 += yy[i];
          c1 += xy[i];
        }
      }
      const i = (y - y0) * bw + (x - x0);
      const tr = a1 + b1;
      T[i] = tr;
      Q[i] = tr > 1e-6 ? (a1 * b1 - c1 * c1) / (tr * tr) : 0;
      alleT.push(tr);
    }
  }
  // Rauschen des Fotos: mittlerer Kontrast in der Umgebung; eine Ecke muss deutlich darüber liegen
  alleT.sort((u, v) => u - v);
  const rauschen = alleT[Math.floor(alleT.length / 2)] || 0;
  const minT = Math.max(0.12, rauschen * 5);
  // Kandidaten: örtliche Höchstwerte von q mit genug Kontrast; genommen wird die nächste Ecke,
  // nicht die stärkste, damit ein schwacher Fensterrahmen nicht vom kräftigen Glas überstimmt wird
  // Stärke nur dort, wo Kontrast und Eckenform reichen (flache Stellen haben zufällig hohe q)
  const at = (x, y) => { const i = (y - y0) * bw + (x - x0); return T[i] >= minT && Q[i] >= 0.1 ? Q[i] * T[i] : 0; };
  let best = null;
  let bestD = Infinity;
  for (let y = y0 + 2; y <= y1 - 2; y++) {
    for (let x = x0 + 2; x <= x1 - 2; x++) {
      const q = at(x, y);
      if (!q) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > r || d >= bestD) continue;
      let max = true;
      for (let v = -1; v <= 1 && max; v++) for (let u = -1; u <= 1; u++) if ((u || v) && at(x + u, y + v) > q) { max = false; break; }
      if (max) { bestD = d; best = [x, y]; }
    }
  }
  // Feinlage: Schnittpunkt der Kanten (jeder Gradient steht senkrecht auf seiner Kante, die
  // Ecke ist der Punkt, auf den alle Kantenlinien zeigen), wenige Runden um den Kandidaten
  if (best) {
    let [px, py] = best;
    for (let runde = 0; runde < 4; runde++) {
      let a1 = 0;
      let b1 = 0;
      let c1 = 0;
      let rx = 0;
      let ry = 0;
      const mx = Math.round(px);
      const my = Math.round(py);
      for (let y = my - 4; y <= my + 4; y++) {
        for (let x = mx - 4; x <= mx + 4; x++) {
          if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
          const gx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x - 1, y) + g(x - 1, y + 1));
          const gy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x, y - 1) + g(x + 1, y - 1));
          a1 += gx * gx;
          b1 += gy * gy;
          c1 += gx * gy;
          rx += gx * gx * x + gx * gy * y;
          ry += gx * gy * x + gy * gy * y;
        }
      }
      const det = a1 * b1 - c1 * c1;
      if (Math.abs(det) < 1e-9) break;
      const nx = (b1 * rx - c1 * ry) / det;
      const ny = (a1 * ry - c1 * rx) / det;
      // nur kleine Korrekturen annehmen, sonst beim Kandidaten bleiben
      if (Math.hypot(nx - best[0], ny - best[1]) > 4) break;
      const fertig = Math.hypot(nx - px, ny - py) < 0.05;
      px = nx;
      py = ny;
      if (fertig) break;
    }
    best = [px, py];
  }
  if (!best) return null;
  return [(best[0] + 0.5) * s, (best[1] + 0.5) * s];
}

// Gleichfarbige Fläche um den angetippten Punkt suchen (z. B. Glas eines Fensters) und als
// Rechteck zurückgeben. Mit Maßstab wird das Rechteck in Metern gebildet, folgt also bei
// schrägen Fotos der Perspektive. Liefert { punkte } oder { fehler }.
export function oeffnungFinden(a, p, ms) {
  const { w, h, s, rgb } = a;
  const sx = Math.round(p[0] / s);
  const sy = Math.round(p[1] / s);
  if (sx < 1 || sy < 1 || sx >= w - 1 || sy >= h - 1) return { fehler: 'Bitte mitten in das Fenster tippen.' };
  // Startfarbe: Mittelwert 5 × 5
  let m = [0, 0, 0];
  let n = 0;
  for (let v = -2; v <= 2; v++) {
    for (let u = -2; u <= 2; u++) {
      const x = Math.min(w - 1, Math.max(0, sx + u));
      const y = Math.min(h - 1, Math.max(0, sy + v));
      const i = (y * w + x) * 4;
      m[0] += rgb[i]; m[1] += rgb[i + 1]; m[2] += rgb[i + 2]; n++;
    }
  }
  m = m.map((v) => v / n);
  const grenze = Math.floor(w * h * 0.3);
  const drin = new Uint8Array(w * h);
  const stapel = [sy * w + sx];
  drin[sy * w + sx] = 1;
  const liste = [];
  const abst = (i, j) => Math.hypot(rgb[i] - rgb[j], rgb[i + 1] - rgb[j + 1], rgb[i + 2] - rgb[j + 2]);
  while (stapel.length) {
    const k = stapel.pop();
    liste.push(k);
    if (liste.length > grenze) return { fehler: 'Keine klare Öffnung gefunden: die Fläche läuft in die Wand über. Bitte die Ecken von Hand ziehen.' };
    const x = k % w;
    const y = (k - x) / w;
    for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x2 = x + u;
      const y2 = y + v;
      if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h) continue;
      const k2 = y2 * w + x2;
      if (drin[k2]) continue;
      const i2 = k2 * 4;
      const zurMitte = Math.hypot(rgb[i2] - m[0], rgb[i2 + 1] - m[1], rgb[i2 + 2] - m[2]);
      if (zurMitte > 48 || abst(i2, k * 4) > 22) continue;
      drin[k2] = 1;
      stapel.push(k2);
    }
  }
  if (liste.length < 30) return { fehler: 'Fläche zu klein. Bitte mitten in das Fenster tippen.' };
  // Punkte der Fläche (bei großen Flächen nur jeder n-te) in Meter oder Bildpunkte
  const schritt = Math.max(1, Math.floor(liste.length / 6000));
  const xs = [];
  const ys = [];
  const mitMass = ms && !ms.fehler;
  for (let j = 0; j < liste.length; j += schritt) {
    const k = liste[j];
    const x = k % w;
    const q = [(x + 0.5) * s, ((k - x) / w + 0.5) * s];
    const r = mitMass ? ms.inM(q) : q;
    xs.push(r[0]);
    ys.push(r[1]);
  }
  const quantil = (arr, q) => { const t = [...arr].sort((u, v) => u - v); return t[Math.min(t.length - 1, Math.max(0, Math.round(q * (t.length - 1))))]; };
  // einzelne Ausreißer abschneiden, dann um einen knappen Pixel nach außen (die Randpixel
  // sind halb Fenster, halb Rahmen und fallen sonst weg)
  const rand = mitMass ? 0.8 * s / (ms.pxProM || 1) : 0.8 * s;
  const X0 = quantil(xs, 0.002) - rand;
  const X1 = quantil(xs, 0.998) + rand;
  const Y0 = quantil(ys, 0.002) - rand;
  const Y1 = quantil(ys, 0.998) + rand;
  if (mitMass) {
    // Meter: y zeigt nach oben → oben links ist (X0, Y1)
    return { punkte: [[X0, Y1], [X1, Y1], [X1, Y0], [X0, Y0]].map(ms.inPx) };
  }
  return { punkte: [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]] };
}

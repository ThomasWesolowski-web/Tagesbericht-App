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

// Alle Öffnungen (Fenster, Türen, Tore) innerhalb des Perspektiv-Rahmens suchen. Das Foto wird
// dafür entzerrt (wie von vorne fotografiert), die Wandfarbe geschätzt und alles, was sich deutlich
// davon abhebt, zu Flächen zusammengefasst. Übrig bleiben rechteckige Flächen in Fenster- oder
// Türgröße. Liefert [{ X0, Y0, X1, Y1, tuer, punkte }] (Meter, y nach oben; punkte im Foto, im
// Uhrzeigersinn ab links oben) oder { fehler }.
export function oeffnungenFinden(a, ms) {
  if (!ms || ms.fehler || !ms.rahmen) return { fehler: 'Zuerst den Rahmen um die ganze Wand legen und seine Maße eingeben.' };
  const { w, h, s, rgb } = a;
  const [B, HM] = ms.groesse;
  const res = Math.max(0.02, Math.max(B, HM) / 500); // Meter je Rasterpunkt
  const nx = Math.max(8, Math.round(B / res));
  const ny = Math.max(8, Math.round(HM / res));
  const rx = B / nx;
  const ry = HM / ny;
  const n = nx * ny;
  // 1. Entzerren: je Rasterpunkt die Farbe im Foto holen (Zeile 0 = oben)
  const F = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const ok = new Uint8Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = ms.inPx([(i + 0.5) * rx, HM - (j + 0.5) * ry]);
      if (!p) continue;
      const fx = p[0] / s - 0.5;
      const fy = p[1] / s - 0.5;
      if (!(fx >= 0 && fy >= 0 && fx < w - 1 && fy < h - 1)) continue;
      const x = Math.floor(fx);
      const y = Math.floor(fy);
      const u = fx - x;
      const v = fy - y;
      const k = j * nx + i;
      for (let c = 0; c < 3; c++) {
        const q = (yy, xx) => rgb[(yy * w + xx) * 4 + c];
        F[c][k] = (q(y, x) * (1 - u) + q(y, x + 1) * u) * (1 - v) + (q(y + 1, x) * (1 - u) + q(y + 1, x + 1) * u) * v;
      }
      ok[k] = 1;
    }
  }
  // leicht weichzeichnen (Putzstruktur)
  const weich = (src) => {
    const out = new Float32Array(n);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        let z = 0;
        for (let v = -1; v <= 1; v++) {
          for (let u = -1; u <= 1; u++) {
            const x = i + u;
            const y = j + v;
            if (x < 0 || y < 0 || x >= nx || y >= ny || !ok[y * nx + x]) continue;
            sum += src[y * nx + x];
            z++;
          }
        }
        out[j * nx + i] = z ? sum / z : 0;
      }
    }
    return out;
  };
  for (let c = 0; c < 3; c++) F[c] = weich(F[c]);
  // 2. Wandfarbe: Median in Feldern von etwa 2,5 m (die Wand ist dort in der Mehrheit),
  // dazwischen weich übergeblendet, damit Licht und Schatten auf der Wand nicht stören
  const median = (arr) => { if (!arr.length) return 0; arr.sort((x, y) => x - y); return arr[Math.floor(arr.length / 2)]; };
  const zellen = Math.max(1, Math.round(2.5 / rx));
  const zx = Math.ceil(nx / zellen);
  const zy = Math.ceil(ny / Math.max(1, Math.round(2.5 / ry)));
  const zh = Math.ceil(ny / zy);
  const zw = Math.ceil(nx / zx);
  const gesamt = [0, 1, 2].map((c) => median(Array.from(F[c]).filter((_, k) => ok[k])));
  const wand = [0, 1, 2].map(() => new Float32Array(zx * zy));
  for (let b = 0; b < zy; b++) {
    for (let a2 = 0; a2 < zx; a2++) {
      const werte = [[], [], []];
      for (let j = b * zh; j < Math.min(ny, (b + 1) * zh); j++) {
        for (let i = a2 * zw; i < Math.min(nx, (a2 + 1) * zw); i++) {
          const k = j * nx + i;
          if (ok[k]) for (let c = 0; c < 3; c++) werte[c].push(F[c][k]);
        }
      }
      for (let c = 0; c < 3; c++) wand[c][b * zx + a2] = werte[c].length > 20 ? median(werte[c]) : gesamt[c];
    }
  }
  const wandBei = (c, i, j) => {
    const gx = Math.min(zx - 1, Math.max(0, (i + 0.5) / zw - 0.5));
    const gy = Math.min(zy - 1, Math.max(0, (j + 0.5) / zh - 0.5));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(zx - 1, x0 + 1);
    const y1 = Math.min(zy - 1, y0 + 1);
    const u = gx - x0;
    const v = gy - y0;
    const W2 = wand[c];
    return (W2[y0 * zx + x0] * (1 - u) + W2[y0 * zx + x1] * u) * (1 - v) + (W2[y1 * zx + x0] * (1 - u) + W2[y1 * zx + x1] * u) * v;
  };
  // 3. Je Punkt: Helligkeit und Farbton im Vergleich zur Wand, dazu Kanten (Fensterrahmen,
  // Türblätter). Die Grenzen richten sich nach der Streuung auf der Wand selbst.
  const hell = new Float32Array(n);
  const ton = new Float32Array(n);
  const lum = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!ok[k]) continue;
      const w0 = wandBei(0, i, j);
      const w1 = wandBei(1, i, j);
      const w2 = wandBei(2, i, j);
      const L = (F[0][k] + F[1][k] + F[2][k]) / 3 + 1;
      const Lw = (w0 + w1 + w2) / 3 + 1;
      lum[k] = L;
      hell[k] = Math.abs(L - Lw) / Lw;
      ton[k] = Math.hypot(F[0][k] / L - w0 / Lw, F[1][k] / L - w1 / Lw, F[2][k] / L - w2 / Lw);
    }
  }
  const kante = new Float32Array(n);
  for (let j = 1; j < ny - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i;
      if (!ok[k - nx - 1] || !ok[k + nx + 1] || !ok[k - nx + 1] || !ok[k + nx - 1]) continue;
      const gx = lum[k - nx + 1] + 2 * lum[k + 1] + lum[k + nx + 1] - lum[k - nx - 1] - 2 * lum[k - 1] - lum[k + nx - 1];
      const gy = lum[k + nx - 1] + 2 * lum[k + nx] + lum[k + nx + 1] - lum[k - nx - 1] - 2 * lum[k - nx] - lum[k - nx + 1];
      kante[k] = Math.hypot(gx, gy) / (lum[k] + 20);
    }
  }
  const grenzeVon = (arr, mindest, faktor = 5) => {
    const werte = [];
    for (let k = 0; k < n; k++) if (ok[k]) werte.push(arr[k]);
    const med = median(werte.slice());
    const mad = median(werte.map((v) => Math.abs(v - med)));
    return Math.max(mindest, med + faktor * mad);
  };
  const gHell = grenzeVon(hell, 0.15);
  const gTon = grenzeVon(ton, 0.06, 3.5);
  const gKante = grenzeVon(kante, 0.35);
  let maske = new Uint8Array(n);
  const randM = Math.max(1, Math.round(0.1 / res));
  for (let j = randM; j < ny - randM; j++) {
    for (let i = randM; i < nx - randM; i++) {
      const k = j * nx + i;
      maske[k] = ok[k] && (hell[k] > gHell || ton[k] > gTon || kante[k] > gKante) ? 1 : 0;
    }
  }
  // 4. Aufräumen: dünne Dinge (Fallrohr, Kabel, Putzflecken) weg, Lücken im Rahmen schließen
  const schritt = (m, r, wachsen) => {
    // getrennt waagerecht und senkrecht (Quadrat als Werkzeug)
    const tmp = new Uint8Array(n);
    const out = new Uint8Array(n);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let v = wachsen ? 0 : 1;
        for (let u = -r; u <= r; u++) {
          const x = i + u;
          const q = x < 0 || x >= nx ? (wachsen ? 0 : 1) : m[j * nx + x];
          if (wachsen ? q : !q) { v = wachsen ? 1 : 0; break; }
        }
        tmp[j * nx + i] = v;
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let v = wachsen ? 0 : 1;
        for (let u = -r; u <= r; u++) {
          const y = j + u;
          const q = y < 0 || y >= ny ? (wachsen ? 0 : 1) : tmp[y * nx + i];
          if (wachsen ? q : !q) { v = wachsen ? 1 : 0; break; }
        }
        out[j * nx + i] = v;
      }
    }
    return out;
  };
  const r1 = Math.max(1, Math.round(0.08 / res));
  const r2 = Math.max(1, Math.round(0.06 / res));
  maske = schritt(schritt(maske, r2, true), r2, false); // schließen
  // Löcher füllen: was von außen nicht erreichbar ist, gehört zur Öffnung (Glas im Fensterrahmen)
  const aussen = new Uint8Array(n);
  const stapel = [];
  const rein = (k) => { if (!maske[k] && !aussen[k]) { aussen[k] = 1; stapel.push(k); } };
  for (let i = 0; i < nx; i++) { rein(i); rein((ny - 1) * nx + i); }
  for (let j = 0; j < ny; j++) { rein(j * nx); rein(j * nx + nx - 1); }
  while (stapel.length) {
    const k = stapel.pop();
    const i = k % nx;
    const j = (k - i) / nx;
    if (i > 0) rein(k - 1);
    if (i < nx - 1) rein(k + 1);
    if (j > 0) rein(k - nx);
    if (j < ny - 1) rein(k + nx);
  }
  for (let k = 0; k < n; k++) if (!aussen[k]) maske[k] = 1;
  maske = schritt(schritt(maske, r1, false), r1, true); // öffnen: Dünnes (Fallrohr, Kabel) fällt weg
  // 5. Zusammenhängende Flächen aufteilen und prüfen. Unten hängt oft etwas an (Treppe, Holz,
  // Pflanzen), deshalb wird jede Fläche nach ihrer Oberkante in Streifen geteilt: eine Öffnung hat
  // eine gerade Oberkante, und von dort reicht sie geschlossen nach unten.
  const marke = new Int32Array(n);
  const funde = [];
  let nr = 0;
  const tol = Math.max(2, Math.round(0.08 / ry));
  for (let start = 0; start < n; start++) {
    if (!maske[start] || marke[start]) continue;
    nr++;
    let i0 = nx;
    let i1 = -1;
    stapel.push(start);
    marke[start] = nr;
    while (stapel.length) {
      const k = stapel.pop();
      const i = k % nx;
      const j = (k - i) / nx;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (i > 0 && maske[k - 1] && !marke[k - 1]) { marke[k - 1] = nr; stapel.push(k - 1); }
      if (i < nx - 1 && maske[k + 1] && !marke[k + 1]) { marke[k + 1] = nr; stapel.push(k + 1); }
      if (j > 0 && maske[k - nx] && !marke[k - nx]) { marke[k - nx] = nr; stapel.push(k - nx); }
      if (j < ny - 1 && maske[k + nx] && !marke[k + nx]) { marke[k + nx] = nr; stapel.push(k + nx); }
    }
    const zaehle = (a0, a1, b0, b1) => {
      let z = 0;
      for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) if (marke[j * nx + i] === nr) z++;
      return z;
    };
    // Oberkante je Spalte
    const oben = [];
    for (let i = i0; i <= i1; i++) {
      let t = -1;
      for (let j = 0; j < ny; j++) if (marke[j * nx + i] === nr) { t = j; break; }
      oben.push(t);
    }
    // Streifen mit (fast) gleicher Oberkante
    const streifen = [];
    let akt = null;
    for (let i = i0; i <= i1; i++) {
      const t = oben[i - i0];
      const mitte = akt ? median(akt.t.slice()) : 0;
      if (t < 0 || !akt || Math.abs(t - mitte) > tol) {
        if (akt) streifen.push(akt);
        akt = t < 0 ? null : { a: i, b: i, t: [t] };
      } else {
        akt.b = i;
        akt.t.push(t);
      }
    }
    if (akt) streifen.push(akt);
    for (const st of streifen) {
      let a0 = st.a;
      let a1 = st.b;
      if ((a1 - a0 + 1) * rx < 0.35) continue;
      let b0 = median(st.t.slice());
      // nach unten, solange die Zeile überwiegend gefüllt ist
      let b1 = b0;
      while (b1 + 1 < ny && zaehle(a0, a1, b1 + 1, b1 + 1) >= 0.6 * (a1 - a0 + 1)) b1++;
      // Ränder abschneiden, die nur wenig Fläche haben
      for (let runde = 0; runde < 2; runde++) {
        const bw = a1 - a0 + 1;
        const bh = b1 - b0 + 1;
        while (a0 < a1 && zaehle(a0, a0, b0, b1) < 0.5 * bh) a0++;
        while (a1 > a0 && zaehle(a1, a1, b0, b1) < 0.5 * bh) a1--;
        while (b0 < b1 && zaehle(a0, a1, b0, b0) < 0.5 * bw) b0++;
        while (b1 > b0 && zaehle(a0, a1, b1, b1) < 0.5 * bw) b1--;
      }
      const bw = (a1 - a0 + 1) * rx;
      const bh = (b1 - b0 + 1) * ry;
      const fuell = zaehle(a0, a1, b0, b1) / ((a1 - a0 + 1) * (b1 - b0 + 1));
      const X0 = a0 * rx;
      const X1 = (a1 + 1) * rx;
      const Y1 = HM - b0 * ry;
      const Y0 = HM - (b1 + 1) * ry;
      if (bw < 0.35 || bh < 0.4 || bw > 5 || bh > 3.6 || bw * bh < 0.25) continue;
      if (bw / bh > 4 || bh / bw > 5) continue;
      if (fuell < 0.75) continue;
      // Was unten am Boden steht, ist nur dann eine Öffnung, wenn es Türhöhe hat
      const amBoden = Y0 < 0.3;
      if (amBoden && bh < 1.6) continue;
      if (Y1 > HM - 0.15 && bh < 0.8) continue; // Streifen unter dem Dach
      funde.push({ X0, Y0, X1, Y1, tuer: amBoden || (Y0 < 0.6 && bh >= 1.7) });
    }
  }
  // von links nach rechts, oben vor unten
  funde.sort((p, q) => (Math.abs(p.Y1 - q.Y1) > 1 ? q.Y1 - p.Y1 : p.X0 - q.X0));
  return funde.map((f) => ({ ...f, punkte: [[f.X0, f.Y1], [f.X1, f.Y1], [f.X1, f.Y0], [f.X0, f.Y0]].map(ms.inPx) }));
}

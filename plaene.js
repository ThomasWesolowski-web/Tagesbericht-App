// Pläne und Dokumente einer Baustelle. Die Datei liegt im Speicher „files“ mit
// reportId = „plan:<Baustellen-ID>“, die Liste dazu in site.plaene.
// Im Bericht wird ein Plan (bei PDFs eine Seite) als Bild markiert; das Ergebnis hängt als
// Datei mit planMarkierung = { planId, planName, seite, w, h, formen } am Bericht.

let pdfjs = null;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('./vendor/pdf.min.js');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', location.href).href;
  }
  return pdfjs;
}

// Größe des Plan-Bildes: so groß wie möglich, aber unter der Grenze, die Handys (iPhone)
// für ein Bild im Speicher erlauben. Beim Hineinzoomen wird ein PDF zusätzlich scharf
// nachgezeichnet (siehe planQuelle).
// iPhone-Safari hat für alle Bilder zusammen wenig Speicher; ist er voll, entstehen leere Bilder.
// Deshalb ein mittelgroßes Grundbild; die Schärfe beim Zoomen kommt bei PDFs aus kachel().
export const PLAN_MAX_FLAECHE = 8e6; // Bildpunkte
export const PLAN_MAX_KANTE = 4096;
const KACHEL_MAX = 5e6;
const groesse = (w, h) => Math.min(PLAN_MAX_KANTE / Math.max(w, h), Math.sqrt(PLAN_MAX_FLAECHE / (w * h)));

export const planReportId = (siteId) => `plan:${siteId}`;
// Datei (type) oder Eintrag in site.plaene (typ)
const typVon = (f) => f?.type || f?.typ || '';
export const istPdf = (f) => typVon(f) === 'application/pdf' || /\.pdf$/i.test(f?.name || '');
export const istBild = (f) => typVon(f).startsWith('image/') || /\.(png|jpe?g|webp|gif|heic)$/i.test(f?.name || '');
export const planTauglich = (f) => istPdf(f) || istBild(f);

export async function pdfSeiten(blob) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const n = pdf.numPages;
  pdf.destroy();
  return n;
}

// Alle Seiten eines PDFs als kleinere Bilder zum Durchblättern. bild(seite, breite) zeichnet eine
// Seite in der gewünschten Breite (Bildpunkte) und liefert sie als JPEG.
export async function pdfDokument(blob) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const bild = async (seite, breite) => {
    const page = await pdf.getPage(seite);
    const base = page.getViewport({ scale: 1 });
    // auch bei sehr langen Seiten unter der Speichergrenze bleiben
    const scale = Math.min(breite / base.width, Math.sqrt(KACHEL_MAX / (base.width * base.height)));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vp.width));
    c.height = Math.max(1, Math.round(vp.height));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const b = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.85));
    c.width = 0;
    c.height = 0;
    page.cleanup();
    return { blob: b, w: Math.round(vp.width), h: Math.round(vp.height) };
  };
  // Seitenverhältnis vorab, damit die Liste beim Nachladen nicht springt
  const format = async (seite) => {
    const v = (await pdf.getPage(seite)).getViewport({ scale: 1 });
    return v.height / v.width;
  };
  return { n: pdf.numPages, bild, format, schliessen: () => pdf.destroy() };
}

// Die Datei des Plans auf diesem Handy ist leer oder nicht lesbar (dann neu vom Repo holen).
export class PlanDefekt extends Error {
  constructor() {
    super('Die Datei ist auf diesem Handy beschädigt');
    this.name = 'PlanDefekt';
  }
}

// Bildart an den ersten Bytes erkennen (der gespeicherte Typ kann fehlen oder falsch sein)
function bildTyp(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  const ftyp = String.fromCharCode(...b.slice(4, 12));
  if (/^ftyp(heic|heix|mif1|msf1|hevc)/.test(ftyp)) return 'image/heic';
  return '';
}

// Bild eines Plans laden. Safari auf dem iPhone meldet bei img.decode() manchmal
// „Loading error.“, obwohl das Bild in Ordnung ist. Deshalb erst die Bytes frisch aus dem
// Speicher lesen, dann createImageBitmap, und als Letztes das Bild klassisch mit onload laden.
async function bildLaden(blob) {
  let daten;
  try {
    daten = blob?.size ? await blob.arrayBuffer() : null;
  } catch {
    daten = null;
  }
  if (!daten?.byteLength) throw new PlanDefekt();
  const typ = bildTyp(new Uint8Array(daten, 0, Math.min(12, daten.byteLength)));
  const frisch = new Blob([daten], { type: typ || blob.type || 'image/jpeg' });
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(frisch, { imageOrientation: 'from-image' });
      bmp.freigeben = () => bmp.close();
      bmp.quelle = frisch;
      return bmp;
    } catch {
      // weiter mit dem Bild-Element
    }
  }
  const url = URL.createObjectURL(frisch);
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Das Bild lässt sich nicht lesen'));
      img.src = url;
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw typ ? err : new PlanDefekt();
  }
  img.freigeben = () => URL.revokeObjectURL(url);
  img.quelle = frisch;
  return img;
}

// Plan (Bild oder PDF-Seite) als Bild mit fester Größe, damit Markierungen beim erneuten
// Öffnen wieder genau passen. Bei PDFs liefert kachel(x, y, w, h, k) einen scharf gezeichneten
// Ausschnitt (Angaben in Bildpunkten des Plan-Bildes, k = Bildschirmpunkte je Bildpunkt).
export async function planQuelle(file, seite = 1) {
  const canvas = document.createElement('canvas');
  if (istPdf(file)) {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.blob.arrayBuffer()) }).promise;
    const page = await pdf.getPage(Math.min(Math.max(1, seite), pdf.numPages));
    const base = page.getViewport({ scale: 1 });
    const scale = groesse(base.width, base.height);
    const vp = page.getViewport({ scale });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob?.size) throw new Error('zu wenig Speicher auf dem Handy');
    let laeuft = null;
    const kachel = async (x, y, w, h, k) => {
      // höchstens ein Ausschnitt gleichzeitig; ein neuer bricht den alten ab
      try { laeuft?.cancel(); } catch { /* schon fertig */ }
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
      if (c.width * c.height > KACHEL_MAX) return null;
      const v = page.getViewport({ scale: scale * k, offsetX: -x * k, offsetY: -y * k });
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, c.width, c.height);
      laeuft = page.render({ canvasContext: cx, viewport: v });
      try {
        await laeuft.promise;
      } catch {
        c.width = 0;
        c.height = 0;
        return null;
      }
      return c;
    };
    return { blob, w: Math.round(vp.width), h: Math.round(vp.height), kachel, schliessen: () => pdf.destroy() };
  }
  const bild = await bildLaden(file.blob);
  try {
    const bw = bild.naturalWidth || bild.width;
    const bh = bild.naturalHeight || bild.height;
    const s = Math.min(1, groesse(bw, bh));
    // Kleine Bilder (z. B. Fotos im Bericht) direkt nehmen: spart das Neu-Kodieren beim Blättern
    if (s >= 1 && /^image\/(jpeg|png|webp)$/.test(bild.quelle.type)) {
      return { blob: bild.quelle, w: bw, h: bh, kachel: null, schliessen: () => {} };
    }
    canvas.width = Math.round(bw * s);
    canvas.height = Math.round(bh * s);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
  } finally {
    bild.freigeben();
  }
  const w = canvas.width;
  const h = canvas.height;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob?.size) throw new Error('zu wenig Speicher auf dem Handy');
  return { blob, w, h, kachel: null, schliessen: () => {} };
}

// Formen an eine andere Bildgröße anpassen (falls der Plan anders gerendert wurde)
export function formenSkalieren(formen, von, nach) {
  if (!von?.w || (von.w === nach.w && von.h === nach.h)) return formen;
  const sx = nach.w / von.w;
  const sy = nach.h / von.h;
  const s = (sx + sy) / 2;
  const p = ([x, y]) => [x * sx, y * sy];
  return formen.map((f) => ({
    ...f,
    breite: f.breite * s,
    ...(f.punkte ? { punkte: f.punkte.map(p) } : {}),
    ...(f.von ? { von: p(f.von) } : {}),
    ...(f.bis ? { bis: p(f.bis) } : {}),
  }));
}

// Nummern der Fotos, die auf einem markierten Plan als Pin stehen
export const pinNummern = (pm) => [...new Set((pm?.formen || []).filter((f) => f.typ === 'pin').map((f) => f.nr))].sort((a, b) => a - b);

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
  const url = URL.createObjectURL(file.blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, groesse(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
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

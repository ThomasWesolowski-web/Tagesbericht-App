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

export const PLAN_PX = 2400; // lange Seite des Plan-Bildes in Bildpunkten

export const planReportId = (siteId) => `plan:${siteId}`;
export const istPdf = (f) => f?.type === 'application/pdf' || /\.pdf$/i.test(f?.name || '');
export const istBild = (f) => f?.type?.startsWith('image/');
export const planTauglich = (f) => istPdf(f) || istBild(f);

export async function pdfSeiten(blob) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const n = pdf.numPages;
  pdf.destroy();
  return n;
}

// Plan (Bild oder PDF-Seite) als JPEG mit fester Größe, damit Markierungen beim
// erneuten Öffnen wieder genau passen.
export async function planAlsBild(file, seite = 1) {
  const canvas = document.createElement('canvas');
  if (istPdf(file)) {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.blob.arrayBuffer()) }).promise;
    const page = await pdf.getPage(Math.min(Math.max(1, seite), pdf.numPages));
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: PLAN_PX / Math.max(base.width, base.height) });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pdf.destroy();
  } else {
    const url = URL.createObjectURL(file.blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const s = Math.min(1, PLAN_PX / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * s);
      canvas.height = Math.round(img.naturalHeight * s);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return { blob, w: canvas.width, h: canvas.height };
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

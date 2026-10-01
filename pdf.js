// PDF-Fassung eines Berichts zum Verschicken, mit eingebauten Fotos und Unterschrift.
// jsPDF wird erst beim ersten Bedarf geladen und liegt offline im Cache.

import {
  WETTER, ABRECHNUNG, artLabel, crewOf, sortCrew, kategorieOf, entryHours, hoursByKategorie,
  workedHours, maschinenStunden, formatHours, formatDate, weekday,
} from './report.js';
import { slug } from './media.js';
import { sortStunden, summe, kw, hatZeiten, stundenOf, typLabel, monatLabel, tage } from './stunden.js';

let loading;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf);
    s.onerror = () => { loading = null; reject(new Error('PDF-Modul konnte nicht geladen werden.')); };
    document.head.appendChild(s);
  });
  return loading;
}

export function stundenPdfName(name, ym) {
  return `Stundennachweis_${ym}_${slug(name) || 'mitarbeiter'}.pdf`;
}

export function pdfFileName(r) {
  return `${artLabel(r)}_${r.datum}_${slug(r.baustelle) || 'bericht'}.pdf`;
}

// Bild als JPEG mit Größe; dreht Handyfotos richtig und verkleinert große Bilder.
async function toJpeg(src, maxPx = 1400) {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ACCENT = [62, 150, 66]; // Grün aus dem Firmenlogo
const FIRMA = 'MT+ Füß & Wesolowski GbR · Steinbeisstr. 8 · 72510 Stetten';
const LOGO = 'icons/logo-mt.jpg'; // Pinselfläche ohne Schrift, MT+ wird scharf darübergesetzt
const LOGO_PX = { w: 364, h: 219 }; // Maße der Vorlage, auf die sich die Positionen beziehen
const FIRMEN_GRUEN = [38, 134, 48];
const INK = [28, 31, 36];
const MUTED = [104, 110, 120];
const LINE = [222, 218, 212];
const SOFT = [246, 243, 238];

// Briefkopf: Schrift als echte Schrift (scharf), nur die Pinselfläche ist ein Bild.
// Gibt die y-Position unter dem Briefkopf zurück.
async function briefkopf(doc, { W, M, font, color }) {
  const KH = 40; // Höhe des Briefkopfs in mm
  const top = 6;
  const k = KH / LOGO_PX.h; // mm pro Pixel der Vorlage
  const logo = await toJpeg(LOGO, 1600);
  const lx = W - M - LOGO_PX.w * k + 4;
  if (logo) doc.addImage(logo.data, 'JPEG', lx, top, LOGO_PX.w * k, KH);
  const pt = (px) => (px * k) / 0.3528; // Schriftgröße aus Pixelhöhe der Vorlage
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(pt(83.6));
  doc.text('MT', lx + 57 * k, top + 159 * k);
  doc.setFontSize(pt(65.6));
  doc.text('+', lx + 191.8 * k, top + 104 * k);

  font('bold', 15.5); color(FIRMEN_GRUEN);
  doc.text('Stuckateurmeisterbetrieb', M, top + 16);
  doc.text('Füß & Wesolowski GbR', M, top + 22.5);
  const leistungen = [['Sanierung', 'Nassputz'], ['Trockenbau', 'Wärmedämmung']];
  leistungen.forEach((row, i) => {
    row.forEach((t, j) => {
      const x = M + j * 30;
      const yy = top + 28.3 + i * 4.3;
      font('bold', 8.5); color(FIRMEN_GRUEN);
      doc.text('+', x, yy);
      font('normal', 8.5); color(MUTED);
      doc.text(t, x + 3.5, yy);
    });
  });
  font('normal', 7.5); color(INK);
  const adr = 'MT+ Füß & Wesolowski GbR + Steinbeisstr. 8 + 72510 Stetten';
  doc.text(adr, M, top + 38.2);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.15);
  doc.line(M, top + 39, M + doc.getTextWidth(adr), top + 39);
  const y = top + KH + 3;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2);
  return y;
}

export async function buildPdf(r, files, author) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 16; // Rand
  const CW = W - 2 * M;
  const BOTTOM = H - 18;
  let y = M;

  const color = (c) => doc.setTextColor(...c);
  const font = (style = 'normal', size = 10) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const newPage = () => { doc.addPage(); y = M; };
  const ensure = (h) => { if (y + h > BOTTOM) newPage(); };

  const isRapport = r.art === 'rapport';
  const title = artLabel(r);

  y = await briefkopf(doc, { W, M, font, color });
  y += 10;
  font('bold', 22); color(INK);
  doc.text(title, M, y);
  font('normal', 11); color(MUTED);
  doc.text(`${weekday(r.datum)}, ${formatDate(r.datum)}`, W - M, y, { align: 'right' });
  y += 9;
  font('bold', 14); color(INK);
  const siteLines = doc.splitTextToSize(r.baustelle || 'Ohne Baustelle', CW);
  doc.text(siteLines, M, y);
  y += siteLines.length * 6;
  if (r.adresse) { font('normal', 10.5); color(MUTED); doc.text(r.adresse, M, y); y += 5.5; }
  y += 3;

  // Eckdaten als Kästchen
  const wetter = (r.wetter || []).map((id) => WETTER.find((w) => w.id === id)?.label).filter(Boolean).join(', ');
  const facts = [
    ['Auftragsnummer', r.auftrag],
    ['Stunden gesamt', formatHours(workedHours(r))],
    ['Wetter', [wetter, r.temperatur ? `${r.temperatur} °C` : ''].filter(Boolean).join(', ')],
    isRapport ? ['Abrechnung', ABRECHNUNG.find((a) => a.id === (r.abrechnung || 'regie'))?.label] : null,
    ['Erstellt von', author],
  ].filter((f) => f && f[1] && String(f[1]).trim() && f[1] !== '–');
  if (facts.length) {
    const cols = Math.min(facts.length, 3);
    const cellW = CW / cols;
    const rows = Math.ceil(facts.length / cols);
    const cellH = 14;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(M, y, CW, rows * cellH, 2, 2, 'FD');
    facts.forEach(([k, v], i) => {
      const cx = M + (i % cols) * cellW + 4;
      const cy = y + Math.floor(i / cols) * cellH;
      font('normal', 8); color(MUTED);
      doc.text(k.toUpperCase(), cx, cy + 5);
      font('bold', 10.5); color(INK);
      doc.text(doc.splitTextToSize(String(v), cellW - 8)[0], cx, cy + 10.5);
    });
    y += rows * cellH + 8;
  }

  const heading = (text, extra = 0) => {
    ensure(14 + extra);
    font('bold', 12); color(ACCENT);
    doc.text(text, M, y);
    y += 2;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + CW, y);
    doc.setLineWidth(0.2);
    y += 6;
  };

  // Einfache Tabelle; cols: [{ label, w, align }]
  const table = (cols, rows, { boldLast = false } = {}) => {
    const rowH = 7;
    const head = () => {
      doc.setFillColor(...SOFT);
      doc.rect(M, y - 4.8, CW, rowH, 'F');
      font('bold', 8.5); color(MUTED);
      let x = M;
      for (const c of cols) {
        doc.text(c.label, c.align === 'right' ? x + c.w - 2 : x + 2, y, { align: c.align === 'right' ? 'right' : 'left' });
        x += c.w;
      }
      y += rowH;
    };
    head();
    rows.forEach((row, ri) => {
      if (y + rowH > BOTTOM) { newPage(); head(); }
      const last = boldLast && ri === rows.length - 1;
      font(last ? 'bold' : 'normal', 10); color(INK);
      let x = M;
      row.forEach((cell, ci) => {
        const c = cols[ci];
        const t = doc.splitTextToSize(String(cell ?? ''), c.w - 4)[0] || '';
        doc.text(t, c.align === 'right' ? x + c.w - 2 : x + 2, y, { align: c.align === 'right' ? 'right' : 'left' });
        x += c.w;
      });
      doc.setDrawColor(...LINE);
      doc.line(M, y + 2.2, M + CW, y + 2.2);
      y += rowH;
    });
    y += 4;
  };

  // Personal
  const crew = sortCrew([...crewOf(r)]);
  if (crew.length) {
    heading('Personal und Arbeitszeit', 20);
    table(
      [
        { label: 'Name', w: 58 }, { label: 'Kategorie', w: 34 }, { label: 'Beginn', w: 20 },
        { label: 'Ende', w: 20 }, { label: 'Pause', w: 20 }, { label: 'Stunden', w: CW - 152, align: 'right' },
      ],
      crew.map((e) => [e.name, kategorieOf(e), e.beginn || '–', e.ende || '–', `${e.pause || 0} min`, formatHours(entryHours(e))]),
    );
    const groups = hoursByKategorie(r);
    ensure(10 + groups.length * 7);
    table(
      [{ label: 'Stunden nach Kategorie', w: 92 }, { label: 'Personen', w: 30 }, { label: 'Stunden', w: CW - 122, align: 'right' }],
      [...groups.map((g) => [g.kategorie, g.personen, formatHours(g.stunden)]), ['Gesamt', crew.length, formatHours(workedHours(r))]],
      { boldLast: true },
    );
  }

  // Maschinen (Rapport)
  const maschinen = isRapport ? (r.maschinen || []).filter((m) => m.bezeichnung || m.stunden) : [];
  if (maschinen.length) {
    heading('Maschinen und Fahrzeuge', 20);
    table(
      [{ label: 'Maschine / Fahrzeug', w: CW - 40 }, { label: 'Stunden', w: 40, align: 'right' }],
      [
        ...maschinen.map((m) => [m.bezeichnung || '–', m.stunden ? formatHours(Number(String(m.stunden).replace(',', '.'))) : '–']),
        ['Gesamt', formatHours(maschinenStunden(r))],
      ],
      { boldLast: true },
    );
  }

  // Freitexte
  const textBlock = (label, text) => {
    if (!text || !text.trim()) return;
    heading(label, 6);
    font('normal', 10.5); color(INK);
    const lines = doc.splitTextToSize(text.trim(), CW);
    for (const line of lines) {
      ensure(5.2);
      doc.text(line, M, y);
      y += 5.2;
    }
    y += 4;
  };
  textBlock('Ausgeführte Arbeiten', r.taetigkeiten);
  textBlock('Material und Geräte', r.material);
  textBlock('Bemerkungen / Besondere Vorkommnisse', r.bemerkungen);

  // Unterschrift (Rapport)
  if (isRapport && r.unterschrift?.dataUrl) {
    const img = await toJpeg(r.unterschrift.dataUrl, 900);
    heading('Unterschrift Bauherr', 40);
    if (img) {
      const w = 70;
      const h = Math.min(30, (img.h / img.w) * w);
      doc.addImage(img.data, 'JPEG', M, y, w, h);
      y += h + 1;
    }
    doc.setDrawColor(...INK);
    doc.line(M, y, M + 80, y);
    y += 4.5;
    font('normal', 9); color(MUTED);
    const when = new Date(r.unterschrift.zeit).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    doc.text(`${r.unterschrift.name || 'Ohne Namen'} · ${when}`, M, y);
    y += 8;
  }

  // Fotos: zwei pro Zeile
  const images = files.filter((f) => f.type?.startsWith('image/'));
  const others = files.filter((f) => !f.type?.startsWith('image/'));
  if (images.length) {
    const gap = 6;
    const cellW = (CW - gap) / 2;
    const maxH = 75;
    heading(`Fotos (${images.length})`, maxH);
    for (let i = 0; i < images.length; i += 2) {
      const pair = (await Promise.all(images.slice(i, i + 2).map((f) => toJpeg(f.blob)))).map((img, k) => ({ img, f: images[i + k] }));
      const sizes = pair.map(({ img }) => {
        if (!img) return { w: cellW, h: 20 };
        const s = Math.min(cellW / img.w, maxH / img.h);
        return { w: img.w * s, h: img.h * s };
      });
      const rowH = Math.max(...sizes.map((s) => s.h)) + 7;
      ensure(rowH);
      pair.forEach(({ img, f }, k) => {
        const x = M + k * (cellW + gap);
        const s = sizes[k];
        if (img) {
          doc.addImage(img.data, 'JPEG', x + (cellW - s.w) / 2, y, s.w, s.h);
        } else {
          doc.setDrawColor(...LINE);
          doc.rect(x, y, cellW, s.h);
        }
        font('normal', 8); color(MUTED);
        doc.text(doc.splitTextToSize(f.name, cellW)[0], x + cellW / 2, y + s.h + 4, { align: 'center' });
      });
      y += rowH + 3;
    }
  }
  if (others.length) {
    heading('Weitere Anhänge', 8);
    font('normal', 10); color(INK);
    for (const f of others) {
      ensure(5.5);
      doc.text(`• ${f.name}`, M, y);
      y += 5.5;
    }
    y += 2;
  }

  // Fußzeile auf jeder Seite
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 13, W - M, H - 13);
    font('normal', 8); color(MUTED);
    doc.text(`${title} ${formatDate(r.datum)}${r.baustelle ? ` · ${r.baustelle}` : ''}`, M, H - 8.5);
    doc.text(`Seite ${p} von ${pages}`, W - M, H - 8.5, { align: 'right' });
    doc.text(FIRMA, W / 2, H - 4, { align: 'center' });
  }
  doc.setProperties({ title: `${title} ${formatDate(r.datum)} ${r.baustelle || ''}`.trim(), author: author || '' });
  return doc.output('blob');
}

// Monatlicher Stundennachweis eines Mitarbeiters.
export async function buildStundenPdf(name, ym, entries) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 16;
  const CW = W - 2 * M;
  const BOTTOM = H - 18;
  const color = (c) => doc.setTextColor(...c);
  const font = (style = 'normal', size = 10) => { doc.setFont('helvetica', style); doc.setFontSize(size); };

  let y = await briefkopf(doc, { W, M, font, color });
  y += 10;
  font('bold', 22); color(INK);
  doc.text('Stundennachweis', M, y);
  font('normal', 11); color(MUTED);
  doc.text(monatLabel(ym), W - M, y, { align: 'right' });
  y += 9;
  font('bold', 14); color(INK);
  doc.text(name || 'Mitarbeiter', M, y);
  y += 8;

  const cols = [
    { label: 'Datum', w: 26 }, { label: 'Art', w: 24 }, { label: 'Baustelle / Notiz', w: 60 },
    { label: 'Beginn', w: 16 }, { label: 'Ende', w: 16 }, { label: 'Pause', w: 16 }, { label: 'Stunden', w: 20, align: 'right' },
  ];
  const rowH = 6.6;
  const head = () => {
    doc.setFillColor(...SOFT);
    doc.rect(M, y - 4.6, CW, rowH, 'F');
    font('bold', 8.5); color(MUTED);
    let x = M;
    for (const c of cols) {
      doc.text(c.label, c.align === 'right' ? x + c.w - 2 : x + 2, y, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    }
    y += rowH;
  };
  const row = (cells, { bold = false, fill = null } = {}) => {
    if (y + rowH > BOTTOM) { doc.addPage(); y = M + 4; head(); }
    if (fill) { doc.setFillColor(...fill); doc.rect(M, y - 4.6, CW, rowH, 'F'); }
    font(bold ? 'bold' : 'normal', 9.5); color(INK);
    let x = M;
    cells.forEach((cell, i) => {
      const c = cols[i];
      const t = doc.splitTextToSize(String(cell ?? ''), c.w - 3)[0] || '';
      doc.text(t, c.align === 'right' ? x + c.w - 2 : x + 2, y, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
    doc.setDrawColor(...LINE);
    doc.line(M, y + 2, M + CW, y + 2);
    y += rowH;
  };

  const list = sortStunden(entries);
  head();
  if (!list.length) row(['', 'Keine Einträge']);
  let woche = null;
  let wocheH = 0;
  const wocheZeile = () => {
    if (woche != null) row(['', '', `Summe KW ${woche}`, '', '', '', formatHours(wocheH)], { bold: true, fill: [237, 245, 237] });
  };
  for (const e of list) {
    const w = kw(e.datum);
    if (woche != null && w !== woche) { wocheZeile(); wocheH = 0; }
    woche = w;
    const z = hatZeiten(e.typ);
    const h = stundenOf(e);
    wocheH += h || 0;
    row([
      `${weekday(e.datum).slice(0, 2)} ${formatDate(e.datum).slice(0, 6)}`,
      typLabel(e.typ),
      [e.baustelle, e.notiz].filter(Boolean).join(' · '),
      z ? e.beginn || '–' : '',
      z ? e.ende || '–' : '',
      z ? `${e.pause || 0} min` : '',
      z ? formatHours(h) : '',
    ]);
  }
  wocheZeile();

  // Summen
  const s = summe(list);
  const facts = [
    ['Arbeitsstunden', formatHours(s.stunden)],
    ['Arbeitstage', String(s.arbeitstage)],
    s.urlaub ? ['Urlaub', tage(s.urlaub)] : null,
    s.krank ? ['Krank', tage(s.krank)] : null,
    s.feiertag ? ['Feiertage', String(s.feiertag)] : null,
    s.schule ? ['Berufsschule', tage(s.schule)] : null,
  ].filter(Boolean);
  const perRow = Math.max(facts.length, 3) > 5 ? 3 : Math.max(facts.length, 3);
  const cellW = CW / perRow;
  const rows = Math.ceil(facts.length / perRow);
  if (y + rows * 14 + 40 > BOTTOM) { doc.addPage(); y = M + 4; }
  y += 4;
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...LINE);
  doc.roundedRect(M, y, CW, rows * 14, 2, 2, 'FD');
  facts.forEach(([k, v], i) => {
    const cx = M + (i % perRow) * cellW + 4;
    const cy = y + Math.floor(i / perRow) * 14;
    font('normal', 8); color(MUTED);
    doc.text(k.toUpperCase(), cx, cy + 5);
    font('bold', 12); color(i === 0 ? FIRMEN_GRUEN : INK);
    doc.text(v, cx, cy + 11);
  });
  y += rows * 14 + 22;

  // Unterschriften
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + 75, y);
  doc.line(W - M - 75, y, W - M, y);
  font('normal', 8.5); color(MUTED);
  doc.text('Datum, Unterschrift Mitarbeiter', M, y + 4.5);
  doc.text('Datum, Unterschrift Arbeitgeber', W - M - 75, y + 4.5);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 13, W - M, H - 13);
    font('normal', 8); color(MUTED);
    doc.text(`Stundennachweis ${monatLabel(ym)} · ${name}`, M, H - 8.5);
    doc.text(`Seite ${p} von ${pages}`, W - M, H - 8.5, { align: 'right' });
    doc.text(FIRMA, W / 2, H - 4, { align: 'center' });
  }
  doc.setProperties({ title: `Stundennachweis ${monatLabel(ym)} ${name}` });
  return doc.output('blob');
}

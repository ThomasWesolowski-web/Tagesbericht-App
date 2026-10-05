// Datenmodell eines Tagesberichts und die Markdown-Fassung fürs Repo.

import { raumJson, berechne as raumBerechne, fmt2 as raumZahl } from './raumgeometrie.js';

export const WETTER = [
  { id: 'sonnig', label: 'Sonnig', icon: '☀️' },
  { id: 'bewoelkt', label: 'Bewölkt', icon: '⛅' },
  { id: 'regen', label: 'Regen', icon: '🌧️' },
  { id: 'wind', label: 'Wind', icon: '💨' },
  { id: 'schnee', label: 'Schnee', icon: '❄️' },
  { id: 'frost', label: 'Frost', icon: '🥶' },
];

export const ARTEN = [
  { id: 'tagesbericht', label: 'Tagesbericht', hint: 'Täglicher Baustellenbericht' },
  { id: 'rapport', label: 'Rapport', hint: 'Arbeits- bzw. Regierapport' },
];

export const ABRECHNUNG = [
  { id: 'regie', label: 'Regie' },
  { id: 'pauschal', label: 'Pauschal' },
];

// Häufige Fahrzeuge und Maschinen als Schnellauswahl beim Rapport.
export const MASCHINEN_VORSCHLAEGE = ['LKW', 'Transporter'];

// Art der Arbeit (Mehrfachauswahl) plus Freitext
export const GEWERKE = ['Gerüstbau', 'Putz', 'Malerarbeiten', 'Trockenbau'];
export function gewerkeText(x) {
  return [...(x?.gewerke || []), (x?.gewerkFrei || '').trim()].filter(Boolean).join(', ');
}

export function maschinenStunden(r) {
  const h = (r.maschinen || []).map((m) => Number(String(m.stunden).replace(',', '.'))).filter((n) => n > 0);
  return h.length ? h.reduce((a, b) => a + b, 0) : null;
}

export function artLabel(r) {
  return r?.art === 'rapport' ? 'Rapport' : r?.art === 'aufmass' ? 'Aufmaß' : 'Tagesbericht';
}

// ---------- Aufmaß ----------
// Position: { pos, bezeichnung, anzahl, laenge, breite, einheit, abzug }
export const EINHEITEN = [
  { id: 'm2', label: 'm²' },
  { id: 'm', label: 'lfm' },
  { id: 'm3', label: 'm³' },
  { id: 'stk', label: 'Stk' },
];
export const einheitLabel = (id) => EINHEITEN.find((e) => e.id === id)?.label || 'm²';
export function zahl(v) {
  const n = Number(String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const leer = (v) => String(v ?? '').trim() === '';
const rund = (n) => Math.round(n * 1000) / 1000;

// Aufbau wie das Papier-Aufmaß: eine Position (Lfd. Nr., Bezeichnung, Einheit) mit mehreren Messzeilen
// (Stück, Länge, Breite, Höhe). Abzugszeilen werden von der Position abgezogen.
export function newZeile() {
  return { stueck: '', laenge: '', breite: '', hoehe: '', wert: '', abzug: false };
}
export function newPosition(nr = 1, einheit = 'm2') {
  return { pos: String(nr), bezeichnung: '', einheit, zeilen: [newZeile()] };
}
// Ältere Entwürfe hatten eine Zeile direkt in der Position.
export function normPosition(p) {
  if (Array.isArray(p.zeilen)) return p;
  const { anzahl, laenge, breite, abzug, menge, ...rest } = p;
  return { ...rest, einheit: rest.einheit || 'm2', zeilen: [{ ...newZeile(), stueck: anzahl === '1' ? '' : anzahl || '', laenge: laenge || '', breite: breite || '', abzug: !!abzug }] };
}
export function zeileLeer(z) {
  return leer(z.stueck) && leer(z.laenge) && leer(z.breite) && leer(z.hoehe) && leer(z.wert);
}
// Meßgehalt einer Zeile: Stück × alle ausgefüllten Maße. Ohne Maße zählt ein direkt eingetragener Wert,
// bei Stück-Positionen die Stückzahl.
export function zeileMenge(z, einheit) {
  const masse = [z.laenge, z.breite, z.hoehe].filter((v) => !leer(v)).map(zahl);
  const stueck = leer(z.stueck) ? 1 : zahl(z.stueck);
  if (masse.length) return rund(masse.reduce((a, b) => a * b, stueck));
  if (!leer(z.wert)) return rund(zahl(z.wert));
  if (einheit === 'stk' && !leer(z.stueck)) return rund(stueck);
  return 0;
}
export function positionLeer(p) {
  const q = normPosition(p);
  return leer(q.bezeichnung) && q.zeilen.every(zeileLeer);
}
export function positionSumme(p) {
  const q = normPosition(p);
  let mess = 0;
  let abzug = 0;
  for (const z of q.zeilen) {
    const m = zeileMenge(z, q.einheit);
    if (z.abzug) abzug += m; else mess += m;
  }
  return { mess: rund(mess), abzug: rund(abzug), netto: rund(mess - abzug) };
}
export const positionMenge = (p) => positionSumme(p).netto;
export function aufmassSummen(r) {
  const s = {};
  for (const p of r.positionen || []) {
    if (positionLeer(p)) continue;
    const e = p.einheit || 'm2';
    s[e] = rund((s[e] || 0) + positionMenge(p));
  }
  return EINHEITEN.filter((e) => s[e.id] !== undefined).map((e) => ({ einheit: e.id, label: e.label, menge: s[e.id] }));
}
export function formatMenge(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatMass(v) {
  return String(v ?? '').trim() === '' ? '' : zahl(v).toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

export function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Ein neuer Bericht startet leer, nur mit dem heutigen Datum.
export function newReport() {
  const now = Date.now();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    datum: today(),
    art: null, // 'tagesbericht' oder 'rapport', wird nach der Baustelle gewählt
    baustelleId: null,
    baustelle: '',
    adresse: '',
    auftrag: '',
    // Pro Person eine eigene Zeiterfassung: { personId, name, funktion, beginn, ende, pause }
    mitarbeiter: [],
    wetter: [],
    temperatur: '',
    gewerke: [],
    gewerkFrei: '',
    taetigkeiten: '',
    material: '',
    bemerkungen: '',
    // nur beim Rapport
    abrechnung: 'regie',
    maschinen: [], // { bezeichnung, stunden }
    // nur beim Aufmaß
    positionen: [],
    auftraggeber: '',
    arbeitsart: '',
    unterschrift: null, // { name, dataUrl, zeit }
    dirty: true,
    syncedAt: null,
    syncError: null,
    remoteDir: null,
    remoteFiles: [],
  };
}

export function newSite(fields = {}) {
  return {
    id: newId(),
    name: '',
    adresse: '',
    auftrag: '',
    kunde: '',
    notiz: '',
    archived: 0,
    createdAt: Date.now(),
    lastUsed: 0,
    ...fields,
  };
}

function minutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const KATEGORIEN = ['Meister', 'Facharbeiter', 'Helfer', 'Lehrling'];

export function newPerson(fields = {}) {
  return { id: newId(), name: '', kategorie: 'Facharbeiter', archived: 0, createdAt: Date.now(), ...fields };
}

// Kategorie einer Person oder eines Eintrags; ältere Einträge hatten nur ein freies Feld „Funktion“.
export function kategorieOf(x) {
  if (KATEGORIEN.includes(x?.kategorie)) return x.kategorie;
  const f = (x?.funktion || '').toLowerCase();
  if (!f) return x?.personId ? 'Facharbeiter' : 'Ohne Kategorie';
  if (/meister|polier|vorarbeiter|bauf(ü|ue)hrer|chef/.test(f)) return 'Meister';
  if (/lehrling|azubi|auszubild|lernend/.test(f)) return 'Lehrling';
  if (/helfer|hilfs/.test(f)) return 'Helfer';
  return 'Facharbeiter';
}

const ORDER = [...KATEGORIEN, 'Ohne Kategorie'];

export function sortCrew(crew) {
  return crew.sort((a, b) => ORDER.indexOf(kategorieOf(a)) - ORDER.indexOf(kategorieOf(b)));
}

// Stunden getrennt nach Kategorie, nur Kategorien mit Personen.
export function hoursByKategorie(r) {
  const out = [];
  for (const k of ORDER) {
    const entries = crewOf(r).filter((e) => kategorieOf(e) === k);
    if (!entries.length) continue;
    const hours = entries.map(entryHours).filter((h) => h != null);
    out.push({ kategorie: k, personen: entries.length, stunden: hours.length ? hours.reduce((a, b) => a + b, 0) : null });
  }
  return out;
}

// Stunden einer Person bzw. eines älteren Berichts aus Beginn, Ende und Pause (auch über Mitternacht).
export function entryHours(r) {
  const start = minutes(r.beginn);
  const end = minutes(r.ende);
  if (start == null || end == null) return null;
  let total = end - start;
  if (total < 0) total += 24 * 60;
  total -= Number(r.pause) || 0;
  return Math.max(0, total) / 60;
}

// Summe aller Personen; ältere Berichte haben noch eine einzige Arbeitszeit.
export function workedHours(r) {
  if (Array.isArray(r.mitarbeiter) && r.mitarbeiter.length) {
    const hours = r.mitarbeiter.map(entryHours).filter((h) => h != null);
    return hours.length ? hours.reduce((a, b) => a + b, 0) : null;
  }
  return entryHours(r);
}

// Ältere Berichte (ein Textfeld Personal, eine Arbeitszeit) in die neue Form bringen.
export function crewOf(r) {
  if (Array.isArray(r.mitarbeiter)) return r.mitarbeiter;
  if (r.personal || r.beginn || r.ende) {
    return [{ personId: null, name: r.personal || 'Personal', funktion: '', beginn: r.beginn || '', ende: r.ende || '', pause: r.pause ?? '' }];
  }
  return [];
}

export function formatHours(h) {
  if (h == null) return '–';
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole}:${String(mins).padStart(2, '0')} h` : `${whole} h`;
}

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function parseDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDate(iso) {
  const d = parseDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function weekday(iso) {
  return WOCHENTAGE[parseDate(iso).getDay()];
}

export function monthLabel(iso) {
  const d = parseDate(iso);
  return `${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

function block(title, text) {
  return text && text.trim() ? `\n## ${title}\n\n${text.trim()}\n` : '';
}

export function toMarkdown(r, files, author, options = {}) {
  const isRapport = r.art === 'rapport';
  const wetter = (r.wetter || [])
    .map((id) => WETTER.find((w) => w.id === id)?.label)
    .filter(Boolean)
    .join(', ');
  const rows = [
    ['Datum', `${weekday(r.datum)}, ${formatDate(r.datum)}`],
    ['Baustelle / Projekt', r.baustelle],
    ['Adresse', r.adresse],
    ['Auftragsnummer', r.auftrag],
    ['Art der Arbeit', gewerkeText(r)],
    ['Abrechnung', isRapport ? ABRECHNUNG.find((a) => a.id === (r.abrechnung || 'regie'))?.label : ''],
    ['Stunden gesamt', r.art === 'aufmass' ? '' : formatHours(workedHours(r))],
    ['Wetter', [wetter, r.temperatur ? `${r.temperatur} °C` : ''].filter(Boolean).join(', ')],
    ['Erstellt von', author],
  ].filter(([, v]) => v && String(v).trim());

  let md = `# ${artLabel(r)} ${formatDate(r.datum)}${r.baustelle ? ` – ${r.baustelle}` : ''}\n\n`;
  if (options.pdfLink) md += 'Zum Verschicken: [bericht.pdf](bericht.pdf)\n\n';
  md += '| | |\n|---|---|\n';
  md += rows.map(([k, v]) => `| **${k}** | ${String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`).join('\n') + '\n';
  const crew = crewOf(r);
  if (crew.length) {
    md += '\n## Personal und Arbeitszeit\n\n| Name | Kategorie | Beginn | Ende | Pause | Stunden |\n|---|---|---|---|---|---|\n';
    for (const e of sortCrew([...crew])) {
      md += `| ${e.name.replace(/\|/g, '\\|')} | ${kategorieOf(e)} | ${e.beginn || '–'} | ${e.ende || '–'} | ${e.pause || 0} min | ${formatHours(entryHours(e))} |\n`;
    }
    md += '\n### Stunden nach Kategorie\n\n| Kategorie | Personen | Stunden |\n|---|---|---|\n';
    for (const k of hoursByKategorie(r)) md += `| ${k.kategorie} | ${k.personen} | ${formatHours(k.stunden)} |\n`;
    md += `| **Gesamt** | **${crew.length}** | **${formatHours(workedHours(r))}** |\n`;
  }
  if (r.art === 'aufmass') md += aufmassMarkdown(r);
  md += block('Ausgeführte Arbeiten', r.taetigkeiten);
  const maschinen = isRapport ? (r.maschinen || []).filter((m) => m.bezeichnung || m.stunden) : [];
  if (maschinen.length) {
    md += '\n## Maschinen und Fahrzeuge\n\n| Maschine / Fahrzeug | Stunden |\n|---|---|\n';
    for (const m of maschinen) md += `| ${(m.bezeichnung || '–').replace(/\|/g, '\\|')} | ${m.stunden ? formatHours(Number(String(m.stunden).replace(',', '.'))) : '–'} |\n`;
    md += `| **Gesamt** | **${formatHours(maschinenStunden(r))}** |\n`;
  }
  md += block('Material und Geräte', r.material);
  md += block('Bemerkungen / Besondere Vorkommnisse', r.bemerkungen);
  if (isRapport && r.unterschrift?.dataUrl) {
    md += `\n## Unterschrift Bauherr\n\n${r.unterschrift.name || 'Ohne Namen'}, unterschrieben am ${new Date(r.unterschrift.zeit).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}\n\n![Unterschrift](unterschrift.png)\n`;
  }

  if (files.length) {
    const plaene = files.filter((f) => f.planMarkierung);
    if (plaene.length) {
      md += '\n## Pläne\n\n';
      for (const f of plaene) {
        const m = f.planMarkierung;
        const nr = [...new Set((m.formen || []).filter((x) => x.typ === 'pin').map((x) => x.nr))].sort((a, b) => a - b);
        md += `![${m.planName}](${encodeURI(f.remoteName)})\n\n_${m.planName}${m.seite > 1 ? `, Seite ${m.seite}` : ''}${nr.length ? ` · Fotos: ${nr.join(', ')}` : ''}_\n\n`;
      }
    }
    const grundrisse = files.filter((f) => f.raumAufmass);
    if (grundrisse.length) {
      md += '\n## Grundrisse\n\n';
      for (const f of grundrisse) md += `![${f.name}](${encodeURI(f.remoteName)})\n\n_${(f.text || f.name).replace(/\s*\n\s*/g, ' ')}_\n\n`;
    }
    const rest = files.filter((f) => !f.planMarkierung && !f.raumAufmass);
    if (rest.length) md += '\n## Fotos und Dokumente\n\n';
    for (const f of rest) {
      const link = encodeURI(f.remoteName);
      const unter = [f.fotoNr ? `Foto ${f.fotoNr}` : '', f.text ? f.text.replace(/\s*\n\s*/g, ' ') : ''].filter(Boolean).join(': ');
      md += f.type.startsWith('image/') ? `![${f.name}](${link})\n${unter ? `\n_${unter}_\n` : ''}\n` : `- [${f.name}](${link})\n`;
    }
  }
  return md;
}

function aufmassMarkdown(r) {
  const pos = (r.positionen || []).filter((p) => !positionLeer(p)).map(normPosition);
  if (!pos.length) return '';
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  let md = '\n## Aufmaß\n\n';
  if (r.auftraggeber) md += `**Auftraggeber:** ${esc(r.auftraggeber)}  \n`;
  if (r.arbeitsart) md += `**Art der Arbeit:** ${esc(r.arbeitsart)}  \n`;
  md += '\n| Lfd. Nr. | Bezeichnung | Stück | Länge | Breite | Höhe | Meßgehalt | Abzug | Netto |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const p of pos) {
    const zeilen = p.zeilen.filter((z) => !zeileLeer(z) || z.info);
    const sum = positionSumme(p);
    const eh = einheitLabel(p.einheit);
    (zeilen.length ? zeilen : [newZeile()]).forEach((z, i) => {
      const m = zeileMenge(z, p.einheit);
      const last = i === Math.max(zeilen.length, 1) - 1;
      md += `| ${i ? '' : esc(p.pos)} | ${[i ? '' : esc(p.bezeichnung), esc(z.text)].filter(Boolean).join(': ')} | ${formatMass(z.stueck)} | ${formatMass(z.laenge)} | ${formatMass(z.breite)} | ${formatMass(z.hoehe)} | ${!z.abzug && m ? formatMenge(m) : ''} | ${z.abzug && m ? formatMenge(m) : ''} | ${last ? `**${formatMenge(sum.netto)} ${eh}**` : ''} |\n`;
    });
  }
  for (const s of aufmassSummen(r)) md += `| | **Summe ${s.label}** | | | | | | | **${formatMenge(s.menge)} ${s.label}** |\n`;
  const raeume = (r.raeume || []).filter((x) => x.ecken?.length >= 3);
  if (raeume.length) {
    md += '\n### Räume (aus dem Grundriss berechnet)\n\n| Raum | Höhe | Boden | Decke | Umfang | Wand brutto | Türen | Fenster | Wand netto |\n|---|---|---|---|---|---|---|---|---|\n';
    for (const x of raeume) {
      const b = raumBerechne(x);
      md += `| ${esc(x.name)} | ${raumZahl(b.hoehe)} m | ${raumZahl(b.bodenflaeche)} m² | ${raumZahl(b.deckenflaeche)} m²${b.mitSchraege ? ' (waagerecht)' : ''} | ${raumZahl(b.umfang)} m | ${raumZahl(b.wandBrutto)} m² | ${raumZahl(b.tuerFlaeche)} m² | ${raumZahl(b.fensterFlaeche)} m² | ${raumZahl(b.wandNetto)} m² |\n`;
    }
    for (const x of raeume) {
      const b = raumBerechne(x);
      if (!b.mitSchraege) continue;
      md += `\nDachschrägen ${esc(x.name)}: ${b.schraegen.map((e) => `Wand ${e.wandName} ${raumZahl(e.flaeche)} m² (Kniestock ${raumZahl(e.kniestock)} m, ${raumZahl(e.winkel)}°)`).join(', ')}${b.dachfenster.length ? `, abzüglich Dachfenster ${raumZahl(b.dachfensterFlaeche)} m²` : ''}; netto ${raumZahl(b.dachNetto)} m².\n`;
    }
  }
  return md;
}

// Maschinenlesbare Fassung, damit Berichte später ausgewertet werden können.
export function toJson(r, files, author) {
  const { dirty, syncError, remoteFiles, deutsch, abrechnung, maschinen, unterschrift, positionen, ...data } = r;
  const aufmass = r.art === 'aufmass'
    ? {
        positionen: (positionen || []).filter((p) => !positionLeer(p)).map(normPosition)
          .map((p) => ({ ...p, einheit: p.einheit || 'm2', zeilen: p.zeilen.filter((z) => !zeileLeer(z)).map((z) => ({ ...z, menge: zeileMenge(z, p.einheit) })), ...positionSumme(p) })),
        summen: Object.fromEntries(aufmassSummen(r).map((s) => [s.label, s.menge])),
        ...(r.raeume?.length ? { raeume: r.raeume.map(raumJson) } : {}),
      }
    : {};
  const rapport = r.art === 'rapport'
    ? {
        abrechnung: abrechnung || 'regie',
        maschinen: (maschinen || []).filter((m) => m.bezeichnung || m.stunden)
          .map((m) => ({ bezeichnung: m.bezeichnung, stunden: Number(String(m.stunden).replace(',', '.')) || null })),
        maschinenStunden: maschinenStunden(r),
        unterschrift: unterschrift?.dataUrl ? { name: unterschrift.name, zeit: new Date(unterschrift.zeit).toISOString(), datei: 'unterschrift.png' } : null,
      }
    : {};
  if (r.art === 'aufmass') aufmass.unterschrift = unterschrift?.dataUrl ? { name: unterschrift.name, zeit: new Date(unterschrift.zeit).toISOString(), datei: 'unterschrift.png' } : null;
  return JSON.stringify(
    {
      ...data,
      art: r.art || 'tagesbericht',
      mitarbeiter: crewOf(r).map((e) => ({ ...e, kategorie: kategorieOf(e), stunden: entryHours(e) })),
      stundenNachKategorie: Object.fromEntries(hoursByKategorie(r).map((k) => [k.kategorie, k.stunden])),
      stunden: workedHours(r),
      ...rapport,
      ...aufmass,
      erstelltVon: author || undefined,
      anhaenge: files.map((f) => ({ name: f.name, datei: f.remoteName, typ: f.type, groesse: f.size, ...(f.text ? { text: f.text } : {}), ...(f.textOriginal ? { textOriginal: f.textOriginal } : {}), ...(f.fotoAufmass ? { fotoAufmass: f.fotoAufmass } : {}), ...(f.fotoNr ? { fotoNr: f.fotoNr } : {}), ...(f.planMarkierung ? { planMarkierung: f.planMarkierung } : {}), ...(f.raumAufmass ? { raumAufmass: f.raumAufmass } : {}) })),
    },
    null,
    2,
  ) + '\n';
}

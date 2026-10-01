// Datenmodell eines Tagesberichts und die Markdown-Fassung fürs Repo.

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

export function artLabel(r) {
  return r?.art === 'rapport' ? 'Rapport' : 'Tagesbericht';
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
    taetigkeiten: '',
    material: '',
    bemerkungen: '',
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

export function toMarkdown(r, files, author) {
  const wetter = (r.wetter || [])
    .map((id) => WETTER.find((w) => w.id === id)?.label)
    .filter(Boolean)
    .join(', ');
  const rows = [
    ['Datum', `${weekday(r.datum)}, ${formatDate(r.datum)}`],
    ['Baustelle / Projekt', r.baustelle],
    ['Adresse', r.adresse],
    ['Auftragsnummer', r.auftrag],
    ['Stunden gesamt', formatHours(workedHours(r))],
    ['Wetter', [wetter, r.temperatur ? `${r.temperatur} °C` : ''].filter(Boolean).join(', ')],
    ['Erstellt von', author],
  ].filter(([, v]) => v && String(v).trim());

  let md = `# ${artLabel(r)} ${formatDate(r.datum)}${r.baustelle ? ` – ${r.baustelle}` : ''}\n\n`;
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
  md += block('Ausgeführte Arbeiten', r.taetigkeiten);
  md += block('Material und Geräte', r.material);
  md += block('Bemerkungen / Besondere Vorkommnisse', r.bemerkungen);

  if (files.length) {
    md += '\n## Fotos und Dokumente\n\n';
    for (const f of files) {
      const link = encodeURI(f.remoteName);
      md += f.type.startsWith('image/') ? `![${f.name}](${link})\n\n` : `- [${f.name}](${link})\n`;
    }
  }
  return md;
}

// Maschinenlesbare Fassung, damit Berichte später ausgewertet werden können.
export function toJson(r, files, author) {
  const { dirty, syncError, remoteFiles, ...data } = r;
  return JSON.stringify(
    {
      ...data,
      art: r.art || 'tagesbericht',
      mitarbeiter: crewOf(r).map((e) => ({ ...e, kategorie: kategorieOf(e), stunden: entryHours(e) })),
      stundenNachKategorie: Object.fromEntries(hoursByKategorie(r).map((k) => [k.kategorie, k.stunden])),
      stunden: workedHours(r),
      erstelltVon: author || undefined,
      anhaenge: files.map((f) => ({ name: f.name, datei: f.remoteName, typ: f.type, groesse: f.size })),
    },
    null,
    2,
  ) + '\n';
}

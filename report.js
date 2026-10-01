// Datenmodell eines Tagesberichts und die Markdown-Fassung fürs Repo.

export const WETTER = [
  { id: 'sonnig', label: 'Sonnig', icon: '☀️' },
  { id: 'bewoelkt', label: 'Bewölkt', icon: '⛅' },
  { id: 'regen', label: 'Regen', icon: '🌧️' },
  { id: 'wind', label: 'Wind', icon: '💨' },
  { id: 'schnee', label: 'Schnee', icon: '❄️' },
  { id: 'frost', label: 'Frost', icon: '🥶' },
];

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
    baustelleId: null,
    baustelle: '',
    adresse: '',
    auftrag: '',
    personal: '',
    beginn: '',
    ende: '',
    pause: '',
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

// Arbeitsstunden aus Beginn, Ende und Pause (auch über Mitternacht).
export function workedHours(r) {
  const start = minutes(r.beginn);
  const end = minutes(r.ende);
  if (start == null || end == null) return null;
  let total = end - start;
  if (total < 0) total += 24 * 60;
  total -= Number(r.pause) || 0;
  return Math.max(0, total) / 60;
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
    ['Personal', r.personal],
    ['Arbeitszeit', r.beginn && r.ende ? `${r.beginn} – ${r.ende} Uhr, ${r.pause || 0} min Pause` : ''],
    ['Stunden', formatHours(workedHours(r))],
    ['Wetter', [wetter, r.temperatur ? `${r.temperatur} °C` : ''].filter(Boolean).join(', ')],
    ['Erstellt von', author],
  ].filter(([, v]) => v && String(v).trim());

  let md = `# Tagesbericht ${formatDate(r.datum)}${r.baustelle ? ` – ${r.baustelle}` : ''}\n\n`;
  md += '| | |\n|---|---|\n';
  md += rows.map(([k, v]) => `| **${k}** | ${String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`).join('\n') + '\n';
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
      stunden: workedHours(r),
      erstelltVon: author || undefined,
      anhaenge: files.map((f) => ({ name: f.name, datei: f.remoteName, typ: f.type, groesse: f.size })),
    },
    null,
    2,
  ) + '\n';
}

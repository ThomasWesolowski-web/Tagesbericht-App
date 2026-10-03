// Stundennachweis: tägliche Arbeitszeit pro Mitarbeiter.

import { newId, entryHours, formatHours, formatDate, weekday, today, gewerkeText } from './report.js';

export const TYPEN = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'urlaub', label: 'Urlaub' },
  { id: 'krank', label: 'Krank' },
  { id: 'feiertag', label: 'Feiertag' },
  { id: 'schule', label: 'Berufsschule' },
];

export function typLabel(id) {
  return TYPEN.find((t) => t.id === id)?.label || 'Arbeit';
}

// Arbeit und Berufsschule haben Zeiten, Urlaub/Krank/Feiertag zählen als Tage.
export function hatZeiten(typ) {
  return typ === 'arbeit' || typ === 'schule';
}

export function newStunde(fields = {}) {
  const now = Date.now();
  return {
    id: newId(),
    personId: null,
    name: '',
    datum: today(),
    typ: 'arbeit',
    beginn: '',
    ende: '',
    pause: '',
    baustelleId: null,
    baustelle: '',
    gewerke: [],
    gewerkFrei: '',
    notiz: '',
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

export function stundenOf(e) {
  return hatZeiten(e.typ) ? entryHours(e) : null;
}

export function monthOf(iso) {
  return (iso || '').slice(0, 7);
}

export function personKey(p) {
  return p.personId || `name:${(p.name || '').trim().toLowerCase()}`;
}

// ISO-Kalenderwoche
export function kw(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

export function summe(entries) {
  const s = { stunden: 0, arbeitstage: new Set(), urlaub: new Set(), krank: new Set(), feiertag: new Set(), schule: new Set() };
  for (const e of entries) {
    const h = stundenOf(e);
    if (h) s.stunden += h;
    if (e.typ === 'arbeit') s.arbeitstage.add(e.datum);
    else if (s[e.typ]) s[e.typ].add(e.datum);
  }
  return {
    stunden: s.stunden,
    arbeitstage: s.arbeitstage.size,
    urlaub: s.urlaub.size,
    krank: s.krank.size,
    feiertag: s.feiertag.size,
    schule: s.schule.size,
  };
}

export function tage(n) {
  return `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
}

export function sortStunden(entries) {
  return [...entries].sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginn || '').localeCompare(b.beginn || ''));
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function monatLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONATE[m - 1]} ${y}`;
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function stundenMarkdown(name, ym, entries) {
  const list = sortStunden(entries);
  const s = summe(list);
  let md = `# Stundennachweis ${monatLabel(ym)} – ${name}\n\n`;
  md += '| Datum | Art | Baustelle | Arbeit | Beginn | Ende | Pause | Stunden | Notiz |\n|---|---|---|---|---|---|---|---|---|\n';
  const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const e of list) {
    const z = hatZeiten(e.typ);
    md += `| ${weekday(e.datum).slice(0, 2)} ${formatDate(e.datum)} | ${typLabel(e.typ)} | ${cell(e.baustelle)} | ${cell(gewerkeText(e))} | ${z ? e.beginn || '–' : ''} | ${z ? e.ende || '–' : ''} | ${z ? `${e.pause || 0} min` : ''} | ${z ? formatHours(stundenOf(e)) : ''} | ${cell(e.notiz)} |\n`;
  }
  md += `\n**Arbeitsstunden:** ${formatHours(s.stunden)} · **Arbeitstage:** ${s.arbeitstage}`;
  if (s.urlaub) md += ` · **Urlaub:** ${tage(s.urlaub)}`;
  if (s.krank) md += ` · **Krank:** ${tage(s.krank)}`;
  if (s.feiertag) md += ` · **Feiertage:** ${s.feiertag}`;
  if (s.schule) md += ` · **Berufsschule:** ${tage(s.schule)}`;
  return `${md}\n`;
}

// geloescht: IDs gelöschter Einträge, damit andere Geräte sie nicht wieder hochladen.
export function stundenJson(name, ym, entries, geloescht = []) {
  const list = sortStunden(entries);
  return JSON.stringify({
    mitarbeiter: name,
    monat: ym,
    summe: summe(list),
    eintraege: list.map(({ dirty, fremd, ...e }) => ({ ...e, stunden: stundenOf(e) })),
    ...(geloescht.length ? { geloescht } : {}),
  }, null, 2) + '\n';
}

// Einträge desselben Mitarbeiters von mehreren Geräten zusammenführen:
// gleiche ID → der zuletzt geänderte gilt, gelöschte IDs fallen weg.
export function stundenZusammenfuehren(lokal, remote, geloescht) {
  const map = new Map();
  for (const e of [...remote, ...lokal]) {
    if (geloescht.has(e.id)) continue;
    const alt = map.get(e.id);
    if (!alt || (e.updatedAt || 0) >= (alt.updatedAt || 0)) map.set(e.id, e);
  }
  return [...map.values()];
}

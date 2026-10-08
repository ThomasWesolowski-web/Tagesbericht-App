// Urlaubskalender: Feiertage in Baden-Württemberg, Arbeitstage, Monatsraster mit Kalenderwochen
// und die Urlaubsanträge auf dem Gerät.
// Ein Antrag: { id, personId, name, von, bis, tage, notiz, status, grund, erstelltAm, updatedAt,
//               entschiedenVon, entschiedenAm, pfad }
// status: beantragt | genehmigt | abgelehnt
// Betriebsurlaub (vom Administrator für alle): betrieb: true, name 'Betriebsurlaub', gleich genehmigt

import { kw } from './stunden.js';
import { newId } from './report.js';

export const STATUS = {
  beantragt: 'Beantragt',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const datum = (s) => new Date(`${s}T12:00:00`);

export function plusTage(s, n) {
  const d = datum(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

// Ostersonntag (Gaußsche Osterformel in der Form von Meeus/Jones/Butcher)
function ostersonntag(j) {
  const a = j % 19;
  const b = Math.floor(j / 100);
  const c = j % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${j}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

// Gesetzliche Feiertage in Baden-Württemberg (Heiligabend und Silvester sind keine).
const feiertagCache = new Map();
export function feiertageBW(j) {
  if (feiertagCache.has(j)) return feiertagCache.get(j);
  const o = ostersonntag(j);
  const liste = [
    [`${j}-01-01`, 'Neujahr'],
    [`${j}-01-06`, 'Heilige Drei Könige'],
    [plusTage(o, -2), 'Karfreitag'],
    [plusTage(o, 1), 'Ostermontag'],
    [`${j}-05-01`, 'Tag der Arbeit'],
    [plusTage(o, 39), 'Christi Himmelfahrt'],
    [plusTage(o, 50), 'Pfingstmontag'],
    [plusTage(o, 60), 'Fronleichnam'],
    [`${j}-10-03`, 'Tag der Deutschen Einheit'],
    [`${j}-11-01`, 'Allerheiligen'],
    [`${j}-12-25`, '1. Weihnachtstag'],
    [`${j}-12-26`, '2. Weihnachtstag'],
  ];
  const map = new Map(liste.sort((a, b) => a[0].localeCompare(b[0])));
  feiertagCache.set(j, map);
  return map;
}

export function feiertag(s) {
  return feiertageBW(Number(s.slice(0, 4))).get(s) || '';
}

export function istWochenende(s) {
  const t = datum(s).getDay();
  return t === 0 || t === 6;
}

// Arbeitstage zwischen von und bis (beide eingeschlossen): Montag bis Freitag ohne Feiertage
export function arbeitstage(von, bis) {
  if (!von || !bis || bis < von) return 0;
  let n = 0;
  for (let s = von; s <= bis; s = plusTage(s, 1)) if (!istWochenende(s) && !feiertag(s)) n++;
  return n;
}

// Wochen eines Monats (Montag bis Sonntag) mit Kalenderwoche
export function monatsRaster(ym) {
  const erster = `${ym}-01`;
  const versatz = (datum(erster).getDay() + 6) % 7;
  let s = plusTage(erster, -versatz);
  const wochen = [];
  do {
    const tage = [];
    for (let i = 0; i < 7; i++) {
      tage.push({ iso: s, tag: Number(s.slice(8)), imMonat: s.startsWith(ym) });
      s = plusTage(s, 1);
    }
    wochen.push({ kw: kw(tage[0].iso), tage });
  } while (s.startsWith(ym));
  return wochen;
}

export function neuerAntrag(fields = {}) {
  const jetzt = Date.now();
  return {
    id: newId(),
    personId: null,
    name: '',
    von: '',
    bis: '',
    tage: 0,
    notiz: '',
    status: 'beantragt',
    grund: '',
    erstelltAm: jetzt,
    updatedAt: jetzt,
    entschiedenVon: '',
    entschiedenAm: null,
    ...fields,
  };
}

export const zeitraumText = (a) => {
  const f = (s) => `${s.slice(8)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
  return a.von === a.bis ? f(a.von) : `${f(a.von).slice(0, 6)} – ${f(a.bis)}`;
};

// ---------- Speicher auf dem Gerät ----------
// Anträge sind klein; sie liegen im localStorage. ausstehend merkt sich, was noch hochgeladen
// werden muss: id -> 'neu' | 'aendern' | 'loeschen'. gemeldet: Entscheidungen, die der
// Mitarbeiter schon gemeldet bekam, gesehen: im Kalender angeschaut (für den Punkt am Reiter). pfade: id -> Datei im Repo (auch für gelöschte Anträge).

const KEY = 'tagesberichte.urlaub';

export function urlaubLokal() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { antraege: d.antraege || [], ausstehend: d.ausstehend || {}, gemeldet: d.gemeldet || {}, gesehen: d.gesehen || {}, pfade: d.pfade || {}, stand: d.stand || 0 };
  } catch {
    return { antraege: [], ausstehend: {}, gemeldet: {}, gesehen: {}, pfade: {}, stand: 0 };
  }
}

export function urlaubLokalSpeichern(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // ohne Speicher: bleibt bis zum Neustart im Speicher der Seite
  }
  window.dispatchEvent(new Event('urlaub-geaendert'));
}

// Antrag auf dem Gerät ändern und zum Hochladen vormerken
export function antragMerken(a, art) {
  const d = urlaubLokal();
  if (art === 'loeschen') {
    d.antraege = d.antraege.filter((x) => x.id !== a.id);
    // nie hochgeladen: einfach vergessen
    if (d.ausstehend[a.id] === 'neu') delete d.ausstehend[a.id];
    else {
      d.ausstehend[a.id] = 'loeschen';
      if (a.pfad) d.pfade[a.id] = a.pfad;
    }
  } else {
    const i = d.antraege.findIndex((x) => x.id === a.id);
    if (i >= 0) d.antraege[i] = a; else d.antraege.push(a);
    if (d.ausstehend[a.id] !== 'neu') d.ausstehend[a.id] = art;
  }
  urlaubLokalSpeichern(d);
}

// Arbeitstage ohne die Tage, die schon Betriebsurlaub sind
export function arbeitstageOhneBetrieb(von, bis, antraege = urlaubLokal().antraege) {
  if (!von || !bis || bis < von) return 0;
  const betrieb = antraege.filter((a) => a.betrieb);
  let n = 0;
  for (let s = von; s <= bis; s = plusTage(s, 1)) {
    if (!istWochenende(s) && !feiertag(s) && !betrieb.some((b) => b.von <= s && s <= b.bis)) n++;
  }
  return n;
}

// Gehört der Antrag zu dieser Person? (gleiche Person oder gleiche Namensteile, wie bei den Stunden)
const teile = (n) => (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');
export function gehoertZu(a, person) {
  if (!person) return false;
  if (a.personId && person.personId) return a.personId === person.personId || teile(a.name) === teile(person.name);
  return teile(a.name) === teile(person.name);
}

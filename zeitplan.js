// Baustellen-Zeitplan (nur Administrator): Aufträge mit Abschnitten, Personal und Material,
// dazu die Rechnung für Plantafel und Wochen-Auslastung.
//
// Ein Auftrag: { id, art: 'baustelle' | 'geruest', baustelleId, baustelle, auftraggeber, flaeche, grundWochen,
//                notiz, abschnitte: [...], updatedAt, geloescht }
// Ein Abschnitt: { id, name, gewerk (GEWERKE oder ''), typ: 'arbeit' | 'warten' | 'auf' | 'ab', von, bis,
//                  leute: [{ personId, name, stunden }], material: [{ text, menge, einheit, kw }] }
// art 'geruest' = nur Gerüst für ein Fremdgewerk: Abschnitte Aufbau (typ auf) und Abbau (typ ab),
// die Standzeit dazwischen rechnet die App selbst.
// Daten: ISO-Text JJJJ-MM-TT. Gearbeitet wird Montag bis Freitag ohne Feiertage (Baden-Württemberg).

import { newId, GEWERKE } from './report.js';
import { kw } from './stunden.js';
import { plusTage, istWochenende, feiertag, urlaubLokal, gehoertZu } from './urlaub.js';

export const STUNDEN_TAG = 8;
export const GRUND_WOCHEN = 4;

// Kurze Namen und Farben der Gewerke im Zeitplan
export const GEWERK_INFO = {
  Putz: { kurz: 'Putz/Stuck', farbe: 'var(--zp-putz)' },
  Malerarbeiten: { kurz: 'Maler', farbe: 'var(--zp-maler)' },
  Trockenbau: { kurz: 'Trockenbau', farbe: 'var(--zp-trocken)' },
  Gerüstbau: { kurz: 'Gerüst', farbe: 'var(--zp-geruest)' },
  '': { kurz: 'Ohne Gewerk', farbe: 'var(--ink-3)' },
};
export const GEWERK_REIHE = ['Putz', 'Malerarbeiten', 'Trockenbau', 'Gerüstbau', ''];
export const gewerkVon = (p) => (GEWERKE.includes(p?.gewerk) ? p.gewerk : '');
export const gewerkKurz = (g) => (GEWERK_INFO[g] || GEWERK_INFO['']).kurz;
export const gewerkFarbe = (g) => (GEWERK_INFO[g] || GEWERK_INFO['']).farbe;

export const TAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const datum = (s) => new Date(`${s}T12:00:00`);
export const wochentag = (s) => (datum(s).getDay() + 6) % 7; // 0 = Montag
export const montagVon = (s) => plusTage(s, -wochentag(s));
export const kurzDatum = (s) => (s ? `${s.slice(8)}.${s.slice(5, 7)}.` : '');
export const istArbeitstag = (s) => !istWochenende(s) && !feiertag(s);
export const tageZwischen = (a, b) => Math.round((datum(b) - datum(a)) / 86400000);

// n-ter Arbeitstag ab start (start selbst zählt, wenn er ein Arbeitstag ist)
export function plusArbeitstage(start, n) {
  let s = start;
  while (!istArbeitstag(s)) s = plusTage(s, 1);
  for (let i = 1; i < n; i++) {
    s = plusTage(s, 1);
    while (!istArbeitstag(s)) s = plusTage(s, 1);
  }
  return s;
}
export const naechsterArbeitstag = (s) => plusArbeitstage(plusTage(s, 1), 1);

export function arbeitstageIn(von, bis) {
  let n = 0;
  for (let s = von; s && bis && s <= bis; s = plusTage(s, 1)) if (istArbeitstag(s)) n++;
  return n;
}

export function neuerAbschnitt(fields = {}) {
  return { id: newId(), name: '', gewerk: '', typ: 'arbeit', von: '', bis: '', leute: [], material: [], ...fields };
}

export function neuerAuftrag(fields = {}) {
  return {
    id: newId(),
    art: 'baustelle',
    baustelleId: null,
    baustelle: '',
    auftraggeber: '',
    flaeche: '',
    grundWochen: GRUND_WOCHEN,
    notiz: '',
    abschnitte: [],
    updatedAt: Date.now(),
    ...fields,
  };
}

// Vorlagen: [Name, Gewerk, Arbeitstage, Typ]
export const VORLAGEN = [
  { id: 'geruest', name: 'Nur Gerüst', art: 'geruest', abschnitte: [['Gerüst aufbauen', 'Gerüstbau', 2, 'auf'], ['Gerüst abbauen', 'Gerüstbau', 1, 'ab']] },
  { id: 'wdvs', name: 'Fassade WDVS', abschnitte: [
    ['Gerüst aufbauen', 'Gerüstbau', 2, 'auf'], ['Dämmung kleben/dübeln', 'Putz', 8, 'arbeit'], ['Armierung', 'Putz', 5, 'arbeit'],
    ['Trocknen', '', 5, 'warten'], ['Oberputz', 'Putz', 5, 'arbeit'], ['Fassadenanstrich', 'Malerarbeiten', 5, 'arbeit'], ['Gerüst abbauen', 'Gerüstbau', 2, 'ab']] },
  { id: 'fassade', name: 'Fassade Putz', abschnitte: [
    ['Gerüst aufbauen', 'Gerüstbau', 2, 'auf'], ['Unterputz', 'Putz', 5, 'arbeit'], ['Standzeit Unterputz', '', 10, 'warten'],
    ['Oberputz', 'Putz', 4, 'arbeit'], ['Fassadenanstrich', 'Malerarbeiten', 4, 'arbeit'], ['Gerüst abbauen', 'Gerüstbau', 2, 'ab']] },
  { id: 'innenputz', name: 'Innenputz', abschnitte: [['Innenputz', 'Putz', 5, 'arbeit'], ['Trocknen', '', 10, 'warten'], ['Malerarbeiten', 'Malerarbeiten', 5, 'arbeit']] },
  { id: 'trockenbau', name: 'Trockenbau', abschnitte: [['Ständerwände', 'Trockenbau', 10, 'arbeit'], ['Spachteln', 'Trockenbau', 5, 'arbeit'], ['Malerarbeiten', 'Malerarbeiten', 5, 'arbeit']] },
  { id: 'maler', name: 'Maler innen', abschnitte: [['Abdecken, Vorarbeiten', 'Malerarbeiten', 1, 'arbeit'], ['Anstrich', 'Malerarbeiten', 4, 'arbeit']] },
  { id: 'leer', name: 'Leer', abschnitte: [['Arbeiten', '', 5, 'arbeit']] },
];

// Abschnitte einer Vorlage ab einem Starttag hintereinander legen
export function abschnitteAusVorlage(vorlage, start) {
  let s = start;
  return vorlage.abschnitte.map(([name, gewerk, tage, typ]) => {
    // Abbau beim Nur-Gerüst-Auftrag: Standzeit von GRUND_WOCHEN Wochen dazwischen
    if (vorlage.art === 'geruest' && typ === 'ab') s = plusArbeitstage(plusTage(s, GRUND_WOCHEN * 7), 1);
    const von = plusArbeitstage(s, 1);
    const bis = plusArbeitstage(von, tage);
    s = naechsterArbeitstag(bis);
    return neuerAbschnitt({ name, gewerk, typ, von, bis });
  });
}

export const abschnitteSortiert = (a) => [...(a.abschnitte || [])].sort((x, y) => (x.von || '').localeCompare(y.von || ''));
export const auftragVon = (a) => abschnitteSortiert(a).reduce((m, x) => (x.von && (!m || x.von < m) ? x.von : m), '');
export const auftragBis = (a) => (a.abschnitte || []).reduce((m, x) => (x.bis && x.bis > m ? x.bis : m), '');
export const ohnePersonal = (ab) => ab.typ === 'warten';

// Wie lange steht das Gerüst? { von, bis, standVon, standBis, tage, wochen, grund, verlaengerung }
export function geruestInfo(a) {
  const auf = (a.abschnitte || []).filter((x) => x.typ === 'auf' && x.von && x.bis).sort((x, y) => x.von.localeCompare(y.von))[0];
  const ab = (a.abschnitte || []).filter((x) => x.typ === 'ab' && x.von && x.bis).sort((x, y) => y.bis.localeCompare(x.bis))[0];
  if (!auf || !ab || ab.von < auf.bis) return null;
  const standVon = plusTage(auf.bis, 1);
  const standBis = plusTage(ab.von, -1);
  const tage = Math.max(0, tageZwischen(standVon, standBis) + 1);
  const wochen = tage / 7;
  const grund = Number(a.grundWochen) > 0 ? Number(a.grundWochen) : GRUND_WOCHEN;
  return { von: auf.von, bis: ab.bis, standVon, standBis, tage, wochen, grund, verlaengerung: Math.max(0, Math.ceil(wochen - grund - 1e-9)) };
}

// Abschnitt (und auf Wunsch alle späteren) um n Kalendertage verschieben
export function verschieben(a, abschnittId, tage, folgende = true) {
  const liste = abschnitteSortiert(a);
  const i = liste.findIndex((x) => x.id === abschnittId);
  if (i < 0) return a;
  const betroffen = new Set((folgende ? liste.slice(i) : [liste[i]]).map((x) => x.id));
  return {
    ...a,
    abschnitte: a.abschnitte.map((x) => (betroffen.has(x.id) && x.von ? { ...x, von: plusTage(x.von, tage), bis: plusTage(x.bis, tage) } : x)),
    updatedAt: Date.now(),
  };
}

// ---------- Rechnung: wer ist wann wo, was ist frei ----------

// Personen, die im Zeitplan vorkommen (ohne Büro und Ausgeschiedene)
export const planPersonen = (people) => people.filter((p) => !p.archived && p.kategorie !== 'Büro');

function urlaubstage(person, antraege) {
  const tage = new Set();
  for (const u of antraege) {
    if (u.status !== 'genehmigt' || !u.von || !u.bis) continue;
    if (!u.betrieb && !gehoertZu(u, { personId: person.id, name: person.name })) continue;
    for (let s = u.von; s <= u.bis; s = plusTage(s, 1)) tage.add(s);
  }
  return tage;
}

// Rechnet für einen Zeitraum (start = Montag, wochen) alles, was die Ansichten brauchen.
// tag: Map iso -> Map personId -> [{ auftrag, abschnitt, stunden }]
export function planRechnen(auftraege, people, start, wochen, antraege = urlaubLokal().antraege) {
  const personen = planPersonen(people);
  const ende = plusTage(start, wochen * 7 - 1);
  const aktiv = auftraege.filter((a) => !a.geloescht && auftragVon(a) && auftragVon(a) <= ende && auftragBis(a) >= start);
  const tag = new Map();
  for (const a of aktiv) {
    for (const ab of a.abschnitte || []) {
      if (ohnePersonal(ab) || !ab.von || !ab.bis) continue;
      for (let s = ab.von < start ? start : ab.von; s <= ab.bis && s <= ende; s = plusTage(s, 1)) {
        if (!istArbeitstag(s)) continue;
        const m = tag.get(s) || new Map();
        for (const l of ab.leute || []) {
          const liste = m.get(l.personId) || [];
          liste.push({ auftrag: a, abschnitt: ab, stunden: Number(l.stunden) || STUNDEN_TAG });
          m.set(l.personId, liste);
        }
        tag.set(s, m);
      }
    }
  }
  const urlaub = new Map(personen.map((p) => [p.id, urlaubstage(p, antraege)]));
  const schule = (p, s) => p.kategorie === 'Lehrling' && p.schultag !== undefined && p.schultag !== '' && Number(p.schultag) === wochentag(s);

  // pro Person und Tag: geplant, verfügbar, Konflikt
  const personTag = (p, s) => {
    if (!istArbeitstag(s)) return { plan: 0, frei: 0, eintraege: [], konflikt: null, abwesend: '' };
    const inSchule = schule(p, s);
    // Am Berufsschultag ist der Lehrling nicht auf der Baustelle, auch wenn er im Abschnitt steht
    const eintraege = inSchule ? [] : tag.get(s)?.get(p.id) || [];
    const plan = eintraege.reduce((x, e) => x + e.stunden, 0);
    const imUrlaub = urlaub.get(p.id)?.has(s);
    const frei = imUrlaub || inSchule ? 0 : STUNDEN_TAG;
    let konflikt = null;
    if (plan > 0 && imUrlaub) konflikt = 'urlaub';
    else if (plan > STUNDEN_TAG) konflikt = 'doppelt';
    return { plan, frei, eintraege, konflikt, abwesend: imUrlaub ? 'urlaub' : inSchule ? 'schule' : '' };
  };

  const wochenListe = [];
  for (let w = 0; w < wochen; w++) {
    const mo = plusTage(start, w * 7);
    const tage = [0, 1, 2, 3, 4].map((i) => plusTage(mo, i));
    const proPerson = personen.map((p) => {
      const t = tage.map((s) => personTag(p, s));
      const auftraegeIds = new Set(t.flatMap((x) => x.eintraege.map((e) => e.auftrag.id)));
      return {
        person: p,
        plan: t.reduce((x, y) => x + y.plan, 0),
        frei: t.reduce((x, y) => x + y.frei, 0),
        urlaubTage: t.filter((x) => x.abwesend === 'urlaub').length,
        auftraege: [...auftraegeIds].map((id) => aktiv.find((a) => a.id === id)),
        konflikte: tage.map((s, i) => (t[i].konflikt ? { tag: s, art: t[i].konflikt } : null)).filter(Boolean),
      };
    });
    const nachGewerk = {};
    for (const x of proPerson) {
      const g = gewerkVon(x.person);
      nachGewerk[g] ||= { plan: 0, frei: 0, personen: 0 };
      nachGewerk[g].plan += x.plan;
      nachGewerk[g].frei += x.frei;
      nachGewerk[g].personen++;
    }
    const plan = proPerson.reduce((x, y) => x + y.plan, 0);
    const frei = proPerson.reduce((x, y) => x + y.frei, 0);
    const geruest = aktiv.map((a) => ({ a, g: geruestInfo(a) })).filter(({ g }) => g && g.von <= tage[4] && g.bis >= mo);
    const material = [];
    for (const a of aktiv) {
      for (const ab of a.abschnitte || []) {
        for (const m of ab.material || []) if (Number(m.kw) === kw(mo) && m.text) material.push({ auftrag: a, abschnitt: ab, ...m });
      }
    }
    wochenListe.push({
      montag: mo, kw: kw(mo), tage, proPerson, nachGewerk, plan, frei,
      prozent: frei ? Math.round((plan / frei) * 100) : (plan ? 999 : 0),
      geruest, geruestFlaeche: geruest.reduce((x, { a }) => x + (Number(String(a.flaeche).replace(',', '.')) || 0), 0),
      material,
    });
  }

  // Auslastung eines einzelnen Tages
  const tagAuslastung = (s) => {
    let plan = 0;
    let frei = 0;
    for (const p of personen) {
      const t = personTag(p, s);
      plan += t.plan;
      frei += t.frei;
    }
    return frei ? Math.round((plan / frei) * 100) : (plan ? 999 : 0);
  };

  return { personen, aktiv, wochen: wochenListe, personTag, tagAuslastung, ende };
}

// Konflikte eines Abschnitts (für die Warnung am Balken und in der Liste)
export function abschnittKonflikte(ab, rechnung) {
  if (ohnePersonal(ab) || !ab.von) return [];
  const out = new Map();
  for (const l of ab.leute || []) {
    const p = rechnung.personen.find((x) => x.id === l.personId);
    if (!p) continue;
    for (let s = ab.von; s <= ab.bis; s = plusTage(s, 1)) {
      if (s < rechnung.wochen[0]?.montag || s > rechnung.ende) continue;
      const k = rechnung.personTag(p, s).konflikt;
      if (k && !out.has(p.id)) out.set(p.id, { person: p, art: k, tag: s });
    }
  }
  return [...out.values()];
}

export const konfliktText = (k) => `${k.person.name} ${k.art === 'urlaub' ? 'hat Urlaub' : 'ist doppelt eingeplant'} (${kurzDatum(k.tag)})`;

// ---------- Speicher auf dem Gerät ----------
// Wie bei „Abgerechnet“: eine Liste im localStorage, pro Auftrag gewinnt die neuere Änderung.
// Gelöschte Aufträge bleiben als { geloescht: true } stehen, damit andere Admin-Handys sie auch löschen.

const KEY = 'tagesberichte.zeitplan';

export function zeitplanLokal() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { auftraege: d.auftraege || {}, ausstehend: Boolean(d.ausstehend) };
  } catch {
    return { auftraege: {}, ausstehend: false };
  }
}

export function zeitplanLokalSpeichern(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // ohne Speicher: bleibt bis zum Neustart im Speicher der Seite
  }
}

export const alleAuftraege = (d = zeitplanLokal()) => Object.values(d.auftraege).filter((a) => !a.geloescht);

export function auftragSpeichern(a) {
  const d = zeitplanLokal();
  d.auftraege[a.id] = { ...a, updatedAt: Date.now() };
  d.ausstehend = true;
  zeitplanLokalSpeichern(d);
}

export function auftragLoeschen(id) {
  const d = zeitplanLokal();
  if (!d.auftraege[id]) return;
  d.auftraege[id] = { id, geloescht: true, updatedAt: Date.now() };
  d.ausstehend = true;
  zeitplanLokalSpeichern(d);
}

export function zeitplanMischen(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, x] of Object.entries(b)) {
    if (!out[id] || (x.updatedAt || 0) > (out[id].updatedAt || 0)) out[id] = x;
  }
  return out;
}

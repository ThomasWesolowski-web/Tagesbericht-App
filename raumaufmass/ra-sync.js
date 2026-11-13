// Raumaufmaße und eigene Material-Systeme im Repo sichern (Rapporte-, Ordner raumaufmass/).
// Jedes Aufmaß ist eine eigene Datei raumaufmass/<baustelle>_<id>.json; so überschreiben sich
// Aufmaße verschiedener Handys nie gegenseitig. Die eigenen Systeme liegen gemeinsam in
// raumaufmass/systeme.json (pro System gewinnt die neuere Änderung).
//
// Schutz gegen Überschreiben: Hochgeladen wird immer mit dem zuletzt bekannten Stand der Datei (sha).
// Hat ein anderes Gerät die Datei inzwischen geändert und dieses Gerät ebenfalls, bleiben beide
// Fassungen erhalten: die aus dem Repo unter dem alten Namen, die eigene als Kopie.
// Gelöschte Aufmaße werden im Repo nur als gelöscht markiert, die Daten bleiben in der Datei.
//
// Wer was bekommt: der Administrator alle Aufmaße, Mitarbeiter nur ihre eigenen (erstelltVon).

import { repoClient, repoJson, contentsPath } from '../sync.js';
import { blobToBase64, slug } from '../media.js';
import {
  alleProjekte, projektLaden, projektRoh, projektEntfernen, alleSysteme, systemRoh, systemEntfernen,
  repoStand, repoStandSpeichern, geloeschteProjekte, geloeschteProjekteSpeichern, geloeschteSysteme,
  geloeschteSystemeSpeichern, nichtGesichert,
} from './ra-speicher.js';

const ORDNER = 'raumaufmass';
const SYSTEME_PFAD = `${ORDNER}/systeme.json`;
const KEY_GESEHEN = 'raumaufmass.gesehen';
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const norm = (s) => String(s || '').trim().toLowerCase();

function gesehen() {
  try { return JSON.parse(localStorage.getItem(KEY_GESEHEN)) || {}; } catch { return {}; }
}

async function schreiben(gh, settings, pfad, daten, message, sha) {
  const body = { message, content: await blobToBase64(new Blob([`${JSON.stringify(daten, null, 2)}\n`])), branch: settings.branch };
  if (sha) body.sha = sha;
  const res = await gh(contentsPath(pfad), { method: 'PUT', body });
  return res?.content?.sha;
}

async function ordnerListe(gh, settings) {
  try {
    const liste = await gh(`${contentsPath(ORDNER)}?ref=${encodeURIComponent(settings.branch)}&t=${Date.now()}`);
    return (Array.isArray(liste) ? liste : []).filter((f) => f.type === 'file' && f.name.endsWith('.json') && f.path !== SYSTEME_PFAD);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

const titel = (p) => p.baustelle?.name || p.name || 'Aufmaß';
const ohneMeta = ({ geloescht, gesichertAm, ...p }) => p;

// Gibt { hochgeladen, geholt, kopien, geloescht } zurück. Läuft schon ein Abgleich, wird auf ihn gewartet.
let laeuft = null;
export function raumaufmassAbgleichen(settings, optionen = {}) {
  if (!settings?.token) return Promise.resolve(null);
  if (!laeuft) laeuft = abgleichenIntern(settings, optionen).finally(() => { laeuft = null; });
  return laeuft;
}

async function abgleichenIntern(settings, { alle = false } = {}) {
  const gh = repoClient(settings);
  const autor = (settings.author || '').trim();
  const erg = { hochgeladen: 0, geholt: 0, kopien: 0, geloescht: 0 };
  const stand = repoStand();
  const seen = gesehen();

  // 1. Gelöschte Aufmaße im Repo als gelöscht markieren (Inhalt bleibt in der Datei)
  const weg = geloeschteProjekte();
  for (const [id, w] of Object.entries(weg)) {
    const remote = await repoJson(gh, settings, w.pfad);
    if (remote && !remote.data.geloescht) {
      try {
        await schreiben(gh, settings, w.pfad, { ...remote.data, geloescht: new Date(w.am).toISOString(), geloeschtVon: autor || undefined },
          `Raumaufmaß gelöscht – ${titel(remote.data)}`, remote.sha);
      } catch (err) {
        if (err.status !== 409 && err.status !== 422) throw err;
        continue; // gleichzeitig geändert: beim nächsten Abgleich noch einmal
      }
    }
    delete weg[id];
    delete stand[id];
    geloeschteProjekteSpeichern(weg);
    repoStandSpeichern(stand);
  }

  // 2. Stand aus dem Repo holen
  const dateien = await ordnerListe(gh, settings);
  const pfadZuId = new Map(Object.entries(stand).map(([id, m]) => [m.pfad, id]));
  for (const f of dateien) {
    const bekannt = pfadZuId.get(f.path);
    if (bekannt && stand[bekannt].sha === f.sha) continue; // unverändert
    if (!bekannt && seen[f.path] === f.sha) continue; // schon angesehen, nicht für dieses Gerät
    const remote = await repoJson(gh, settings, f.path);
    if (!remote?.data?.id) continue;
    seen[f.path] = f.sha;
    const r = remote.data;
    const lokal = await projektLaden(r.id);
    const meins = autor && norm(r.erstelltVon) === norm(autor);
    if (!lokal) {
      if (r.geloescht || weg[r.id] || (!alle && !meins)) continue;
      await projektRoh(ohneMeta(r));
      stand[r.id] = { pfad: f.path, sha: remote.sha, hochgeladen: r.geaendert || 0 };
      erg.geholt++;
      continue;
    }
    if (nichtGesichert(lokal, stand)) {
      // Auf beiden Seiten geändert: die eigene Fassung als Kopie behalten, die aus dem Repo übernehmen
      const kopie = { ...lokal, id: neueId(), name: `${lokal.name} (Fassung dieses Geräts)`, geaendert: Date.now() };
      delete kopie.erstelltVon;
      await projektRoh(kopie);
      erg.kopien++;
    }
    if (r.geloescht) {
      await projektEntfernen(r.id);
      delete stand[r.id];
      erg.geloescht++;
    } else {
      await projektRoh(ohneMeta(r));
      stand[r.id] = { pfad: f.path, sha: remote.sha, hochgeladen: r.geaendert || 0 };
      erg.geholt++;
    }
  }
  repoStandSpeichern(stand);
  try { localStorage.setItem(KEY_GESEHEN, JSON.stringify(seen)); } catch { /* ohne Speicher */ }

  // 3. Neue und geänderte Aufmaße hochladen
  const vorhanden = new Set(dateien.map((f) => f.path));
  for (const p of await alleProjekte()) {
    let m = stand[p.id];
    // Datei im Repo verschwunden (z. B. von Hand gelöscht): neu sichern
    if (m && !vorhanden.has(m.pfad)) m = { pfad: m.pfad };
    else if (!nichtGesichert(p, stand)) continue;
    let pfad = m?.pfad;
    if (!pfad) {
      const basis = `${ORDNER}/${slug(titel(p)) || 'aufmass'}_${p.id.slice(0, 8)}`;
      pfad = `${basis}.json`;
      for (let i = 2; vorhanden.has(pfad); i++) pfad = `${basis}-${i}.json`;
    }
    const daten = { ...p, erstelltVon: p.erstelltVon || autor || undefined };
    if (!p.erstelltVon && autor) await projektRoh({ ...p, erstelltVon: autor });
    try {
      const sha = await schreiben(gh, settings, pfad, { ...daten, gesichertAm: new Date().toISOString() },
        `Raumaufmaß ${m?.sha ? 'aktualisiert' : 'gesichert'} – ${titel(p)}`, m?.sha);
      stand[p.id] = { pfad, sha, hochgeladen: p.geaendert || 0 };
      vorhanden.add(pfad);
      repoStandSpeichern(stand);
      erg.hochgeladen++;
    } catch (err) {
      // 409/422: ein anderes Gerät hat die Datei eben geändert, beim nächsten Abgleich zusammenführen
      if (err.status !== 409 && err.status !== 422) throw err;
    }
  }

  // 4. Eigene Material-Systeme
  await systemeAbgleichen(gh, settings);
  return erg;
}

// Pro System gewinnt die neuere Änderung (geaendertAm); Löschungen gelten, wenn sie neuer sind.
export function systemeMischen(remote, lokal, remoteWeg, lokalWeg) {
  const weg = { ...remoteWeg };
  for (const [id, t] of Object.entries(lokalWeg)) weg[id] = Math.max(weg[id] || 0, t);
  const alle = new Map();
  for (const s of [...remote, ...lokal]) {
    const alt = alle.get(s.id);
    if (!alt || (s.geaendertAm || 0) > (alt.geaendertAm || 0)) alle.set(s.id, s);
  }
  const systeme = [...alle.values()].filter((s) => !(weg[s.id] >= (s.geaendertAm || 0)));
  return { systeme, geloescht: weg };
}

async function systemeAbgleichen(gh, settings) {
  for (let versuch = 0; versuch < 3; versuch++) {
    const remote = await repoJson(gh, settings, SYSTEME_PFAD);
    const lokal = await alleSysteme();
    const lokalWeg = geloeschteSysteme();
    const r = remote?.data || { systeme: [], geloescht: {} };
    const neu = systemeMischen(r.systeme || [], lokal, r.geloescht || {}, lokalWeg);
    // auf dem Gerät übernehmen
    const lokalById = new Map(lokal.map((s) => [s.id, s]));
    for (const s of neu.systeme) if ((lokalById.get(s.id)?.geaendertAm || -1) < (s.geaendertAm || 0)) await systemRoh(s);
    for (const s of lokal) if (!neu.systeme.some((x) => x.id === s.id)) await systemEntfernen(s.id);
    // ins Repo, wenn sich dort etwas ändert
    const schluessel = (d) => JSON.stringify([(d.systeme || []).map((s) => [s.id, s.geaendertAm || 0]).sort(), Object.entries(d.geloescht || {}).sort()]);
    if (remote && schluessel(r) === schluessel(neu)) { geloeschteSystemeSpeichern({}); return; }
    if (!remote && !neu.systeme.length && !Object.keys(neu.geloescht).length) return;
    try {
      await schreiben(gh, settings, SYSTEME_PFAD, { aktualisiert: new Date().toISOString(), ...neu }, 'Material-Systeme (Raumaufmaß) aktualisiert', remote?.sha);
      geloeschteSystemeSpeichern({});
      return;
    } catch (err) {
      if ((err.status !== 409 && err.status !== 422) || versuch === 2) throw err;
    }
  }
}

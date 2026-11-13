// Speicher der Raumaufmaß-App auf dem Gerät (IndexedDB „raumaufmass“).
// Wird von der Raumaufmaß-App (ra-app.js) und vom Abgleich mit dem Repo (ra-sync.js) benutzt;
// den Abgleich startet auch die Berichte-App, deshalb steht das Öffnen nur hier.

let offen = null;
export function dbOffen() {
  if (!offen) {
    offen = new Promise((resolve, reject) => {
      // Version 2: Store „systeme“ für eigene oder geänderte Material-Systeme
      const req = indexedDB.open('raumaufmass', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projekte')) db.createObjectStore('projekte', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('systeme')) db.createObjectStore('systeme', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return offen;
}

export async function tx(store, modus, fn) {
  const db = await dbOffen();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, modus);
    const erg = fn(t.objectStore(store));
    t.oncomplete = () => resolve(erg?.result);
    t.onabort = () => reject(t.error);
    t.onerror = () => reject(t.error);
  });
}

export const alleProjekte = () => tx('projekte', 'readonly', (s) => s.getAll());
export const projektLaden = (id) => tx('projekte', 'readonly', (s) => s.get(id));
// Bearbeiten in der App: „geaendert“ zeigt dem Abgleich, dass das Aufmaß neu hochgeladen werden muss.
export const projektSpeichern = (p) => tx('projekte', 'readwrite', (s) => s.put({ ...p, geaendert: Date.now() }));
// Vom Abgleich: so speichern, wie es ist (ohne „geaendert“ neu zu setzen).
export const projektRoh = (p) => tx('projekte', 'readwrite', (s) => s.put(p));
export const projektEntfernen = (id) => tx('projekte', 'readwrite', (s) => s.delete(id));

export async function projektLoeschen(id) {
  // schon im Repo gesichert: beim nächsten Abgleich dort als gelöscht markieren (Daten bleiben in der Datei)
  const m = repoStand()[id];
  if (m?.pfad) {
    const weg = geloeschteProjekte();
    weg[id] = { pfad: m.pfad, am: Date.now() };
    lsSchreiben(KEY_GELOESCHT, weg);
  }
  await projektEntfernen(id);
}

export const alleSysteme = () => tx('systeme', 'readonly', (s) => s.getAll());
export const systemRoh = (sys) => tx('systeme', 'readwrite', (s) => s.put(sys));
export const systemEntfernen = (id) => tx('systeme', 'readwrite', (s) => s.delete(id));

// ---------- Was zum Repo gehört (localStorage, damit der Editor es nicht überschreibt) ----------
// ra.repo: { <projekt-id>: { pfad, sha, hochgeladen } } – hochgeladen = „geaendert“ beim letzten Hochladen
const KEY_REPO = 'raumaufmass.repo';
const KEY_GELOESCHT = 'raumaufmass.geloescht';
const KEY_SYS_GELOESCHT = 'raumaufmass.systemeGeloescht';

function lsLesen(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function lsSchreiben(key, wert) {
  try { localStorage.setItem(key, JSON.stringify(wert)); } catch { /* ohne Speicher */ }
}
export const repoStand = () => lsLesen(KEY_REPO);
export const repoStandSpeichern = (m) => lsSchreiben(KEY_REPO, m);
export const geloeschteProjekte = () => lsLesen(KEY_GELOESCHT);
export const geloeschteProjekteSpeichern = (m) => lsSchreiben(KEY_GELOESCHT, m);
export const geloeschteSysteme = () => lsLesen(KEY_SYS_GELOESCHT);
export const geloeschteSystemeSpeichern = (m) => lsSchreiben(KEY_SYS_GELOESCHT, m);

export function systemGeloeschtMerken(id) {
  const weg = geloeschteSysteme();
  weg[id] = Date.now();
  lsSchreiben(KEY_SYS_GELOESCHT, weg);
}

// Noch nicht im Repo gesichert: nie hochgeladen oder seit dem letzten Hochladen geändert
export function nichtGesichert(p, stand = repoStand()) {
  const m = stand[p.id];
  return !m || (p.geaendert || 0) > (m.hochgeladen || 0);
}

// Lokaler Speicher auf dem Gerät (IndexedDB).
// "reports": ein Eintrag pro Tagesbericht, "files": Fotos und Dokumente als Blob.

const DB_NAME = 'tagesberichte';
const DB_VERSION = 4;

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('reports')) {
          db.createObjectStore('reports', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('files')) {
          const files = db.createObjectStore('files', { keyPath: 'id' });
          files.createIndex('reportId', 'reportId');
        }
        if (!db.objectStoreNames.contains('sites')) {
          db.createObjectStore('sites', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('stunden')) {
          db.createObjectStore('stunden', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Schreiben gilt erst als fertig, wenn die ganze Transaktion abgeschlossen ist. Safari meldet
// manche Fehler (z. B. Speicher voll, Foto nicht lesbar) nur an der Transaktion; ohne das
// würde das Speichern dann endlos warten.
async function schreiben(name, aktion) {
  const db = await open();
  const tx = db.transaction(name, 'readwrite');
  let ergebnis;
  const req = aktion(tx.objectStore(name));
  req.onsuccess = () => { ergebnis = req.result; };
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(ergebnis);
    tx.onerror = () => reject(tx.error || req.error || new Error('Speichern fehlgeschlagen'));
    tx.onabort = () => reject(tx.error || req.error || new Error('Speichern abgebrochen'));
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function allReports() {
  const list = await done((await store('reports')).getAll());
  return list.sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || b.createdAt - a.createdAt);
}

export async function getReport(id) {
  return done((await store('reports')).get(id));
}

export async function putReport(report) {
  return schreiben('reports', (s) => s.put(report));
}

export async function deleteReport(id) {
  const files = await filesFor(id);
  const db = await open();
  const tx = db.transaction(['reports', 'files'], 'readwrite');
  tx.objectStore('reports').delete(id);
  for (const f of files) tx.objectStore('files').delete(f.id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Löschen abgebrochen'));
  });
}

export async function filesFor(reportId) {
  const list = await done((await store('files')).index('reportId').getAll(reportId));
  return list.sort((a, b) => a.addedAt - b.addedAt);
}

export async function getFile(id) {
  return done((await store('files')).get(id));
}

export async function putFile(file) {
  try {
    return await schreiben('files', (s) => s.put(file));
  } catch (err) {
    // Ältere Fotos verweisen auf iPhones manchmal noch auf die Datei aus Kamera/Galerie;
    // dann einmal als eigene Kopie speichern.
    if (!(file.blob instanceof Blob)) throw err;
    const kopie = new Blob([await file.blob.arrayBuffer()], { type: file.blob.type || file.type || '' });
    return schreiben('files', (s) => s.put({ ...file, blob: kopie }));
  }
}

export async function deleteFile(id) {
  return schreiben('files', (s) => s.delete(id));
}

// Baustellen und Personal werden mit dem Repo abgeglichen (stammdaten/*.json).
// Gelöschte Einträge bleiben als Markierung { id, deleted: 1 } liegen, damit die
// Löschung auch auf den anderen Handys ankommt. „lastUsed“ bleibt nur auf dem Gerät.
const LOCAL_ONLY = ['lastUsed', 'updatedAt'];

function sameContent(a, b) {
  const strip = (x) => JSON.stringify(Object.keys(x || {}).filter((k) => !LOCAL_ONLY.includes(k)).sort().map((k) => [k, x[k]]));
  return strip(a) === strip(b);
}

function notifyChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stammdaten-changed'));
}

async function putShared(name, item) {
  const old = await done((await store(name)).get(item.id));
  const changed = !old || !sameContent(old, item);
  if (changed) item.updatedAt = Date.now();
  await done((await store(name, 'readwrite')).put(item));
  if (changed) notifyChange();
}

async function markDeleted(name, id) {
  await done((await store(name, 'readwrite')).put({ id, deleted: 1, updatedAt: Date.now() }));
  notifyChange();
}

// Rohdaten inkl. Löschmarkierungen, nur für den Abgleich.
export async function rawAll(name) {
  return done((await store(name)).getAll());
}

export async function putRaw(name, items) {
  const db = await open();
  const tx = db.transaction(name, 'readwrite');
  for (const item of items) tx.objectStore(name).put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Gespeicherte Baustellen, damit sie beim Bericht nur ausgewählt werden müssen.
export async function allSites() {
  const list = (await rawAll('sites')).filter((s) => !s.deleted);
  return list.sort((a, b) => (a.archived - b.archived) || (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name, 'de'));
}

export async function getSite(id) {
  const site = await done((await store('sites')).get(id));
  return site?.deleted ? undefined : site;
}

export async function putSite(site) {
  return putShared('sites', site);
}

export async function deleteSite(id) {
  return markDeleted('sites', id);
}

// Gespeichertes Personal, das im Bericht ausgewählt wird.
export async function allPeople() {
  const list = (await rawAll('people')).filter((p) => !p.deleted);
  return list.sort((a, b) => (a.archived - b.archived) || a.name.localeCompare(b.name, 'de'));
}

export async function putPerson(person) {
  return putShared('people', person);
}

export async function deletePerson(id) {
  return markDeleted('people', id);
}

// Stundennachweis. Geänderte Monate werden gemerkt und beim nächsten Sync hochgeladen.
const STUNDEN_DIRTY = 'tagesberichte.stundenDirty';

export async function allStunden() {
  return done((await store('stunden')).getAll());
}

export async function putStunde(e) {
  e.updatedAt = Date.now();
  await done((await store('stunden', 'readwrite')).put(e));
  markStundenDirty(e);
}

// Stand aus dem Repo übernehmen (von einem anderen Gerät geändert oder gelöscht),
// ohne ihn erneut als geändert zu merken.
export async function stundeVomRepo(e) {
  const { fremd, stunden, ...rest } = e;
  await done((await store('stunden', 'readwrite')).put(rest));
}

export async function stundeVomRepoEntfernen(id) {
  await done((await store('stunden', 'readwrite')).delete(id));
}

const STUNDEN_GELOESCHT = 'tagesberichte.stundenGeloescht';

export async function deleteStunde(e) {
  await done((await store('stunden', 'readwrite')).delete(e.id));
  // merken, damit der Eintrag beim Abgleich mit dem Repo nicht zurückkommt
  const ids = stundenGeloescht();
  ids.add(e.id);
  localStorage.setItem(STUNDEN_GELOESCHT, JSON.stringify([...ids]));
  markStundenDirty(e);
}

export function stundenGeloescht() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STUNDEN_GELOESCHT) || '[]'));
  } catch {
    return new Set();
  }
}

export function stundenDirty() {
  try {
    return JSON.parse(localStorage.getItem(STUNDEN_DIRTY) || '{}');
  } catch {
    return {};
  }
}

export function markStundenDirty(e) {
  const d = stundenDirty();
  const key = `${e.personId || `name:${(e.name || '').trim().toLowerCase()}`}|${e.datum.slice(0, 7)}`;
  d[key] = { personId: e.personId || null, name: e.name, monat: e.datum.slice(0, 7) };
  localStorage.setItem(STUNDEN_DIRTY, JSON.stringify(d));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stammdaten-changed'));
}

export function clearStundenDirty(key) {
  const d = stundenDirty();
  delete d[key];
  localStorage.setItem(STUNDEN_DIRTY, JSON.stringify(d));
}

// Einstellungen sind klein und liegen im localStorage.
const SETTINGS_KEY = 'tagesberichte.settings';

export function loadSettings() {
  const defaults = {
    owner: 'ThomasWesolowski-web',
    repo: 'Rapporte-',
    branch: 'main',
    folder: 'berichte',
    token: '',
    autoSync: true,
    author: '',
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

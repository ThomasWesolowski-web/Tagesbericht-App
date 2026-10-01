// Lokaler Speicher auf dem Gerät (IndexedDB).
// "reports": ein Eintrag pro Tagesbericht, "files": Fotos und Dokumente als Blob.

const DB_NAME = 'tagesberichte';
const DB_VERSION = 1;

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
  return done((await store('reports', 'readwrite')).put(report));
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
  return done((await store('files', 'readwrite')).put(file));
}

export async function deleteFile(id) {
  return done((await store('files', 'readwrite')).delete(id));
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

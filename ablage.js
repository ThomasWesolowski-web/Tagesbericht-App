// Ablage-Ordner am PC: Ordner einmal wählen, danach legt „Speichern“ jede Datei (PDF, Excel …)
// ohne Nachfrage dort ab, z. B. um sie von dort an ein Büroprogramm weiterzugeben.
// Geht nur mit Chrome/Edge am PC (File System Access API). Handys haben das nicht:
// dort bleibt es beim Teilen-Menü. Wird auch von der Raumaufmaß-App benutzt (../ablage.js).

const DB_NAME = 'tagesberichte-ablage';
const STORE = 'ordner';
const KEY = 'ablage';

export const ablageMoeglich = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

function dbOeffnen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(modus, fn) {
  const db = await dbOeffnen();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, modus);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

// Gemerkter Ordner (oder null)
export async function ablageOrdner() {
  if (!ablageMoeglich) return null;
  try { return (await tx('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}

// Ordner wählen lassen und merken. Gibt den Ordner zurück oder null (abgebrochen).
export async function ablageWaehlen() {
  if (!ablageMoeglich) return null;
  let ordner;
  try {
    ordner = await window.showDirectoryPicker({ id: 'tagesberichte-ablage', mode: 'readwrite', startIn: 'documents' });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
  await tx('readwrite', (s) => s.put(ordner, KEY));
  return ordner;
}

export async function ablageVergessen() {
  if (!ablageMoeglich) return;
  await tx('readwrite', (s) => s.delete(KEY));
}

// Schreibrecht prüfen; Chrome fragt nach einem Neustart einmal nach („Zugriff erlauben?“).
// Muss direkt nach einem Klick laufen.
async function schreibrecht(ordner) {
  const opt = { mode: 'readwrite' };
  if ((await ordner.queryPermission?.(opt)) === 'granted') return true;
  return (await ordner.requestPermission?.(opt)) === 'granted';
}

// Zeichen, die Windows in Dateinamen nicht erlaubt, ersetzen
export function sichererName(name) {
  return String(name || 'datei').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/[. ]+$/, '') || 'datei';
}

// Datei in den Ablage-Ordner schreiben. Gibt den Ordnernamen zurück; wirft bei Fehlern.
// Ist kein Ordner gewählt, wird zuerst gefragt. null = abgebrochen.
export async function inAblageSpeichern(blob, name) {
  let ordner = await ablageOrdner();
  if (!ordner) ordner = await ablageWaehlen();
  if (!ordner) return null;
  if (!(await schreibrecht(ordner))) {
    // Recht verweigert oder Ordner weg: neu wählen
    ordner = await ablageWaehlen();
    if (!ordner) return null;
  }
  const datei = await ordner.getFileHandle(sichererName(name), { create: true });
  const ziel = await datei.createWritable();
  await ziel.write(blob);
  await ziel.close();
  return ordner.name;
}

// Wie inAblageSpeichern, aber ohne Ordner-Zugriff als Download. Gibt einen Satz für die Meldung
// zurück, oder null, wenn abgebrochen wurde.
export async function speichernAmPc(blob, name) {
  if (ablageMoeglich) {
    try {
      const ordner = await inAblageSpeichern(blob, name);
      if (!ordner) return null;
      return `Gespeichert in „${ordner}“: ${sichererName(name)}`;
    } catch (e) {
      if (e.name === 'AbortError') return null;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'Datei liegt im Ordner „Downloads“.';
}

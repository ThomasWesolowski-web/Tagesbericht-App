// Automatische Übersetzung der Freitexte ins Deutsche (MyMemory, kostenlos, ohne Schlüssel).
// Wird beim Hochladen auf dem Handy des Mitarbeiters ausgeführt.

const API = 'https://api.mymemory.translated.net/get';
export const FREITEXTE = ['taetigkeiten', 'material', 'bemerkungen'];

// Der Dienst nimmt höchstens etwa 500 Zeichen pro Anfrage: nach Zeilen und Sätzen teilen.
function stuecke(text, max = 450) {
  const out = [];
  for (const zeile of text.split('\n')) {
    if (zeile.length <= max) { out.push(zeile); continue; }
    let rest = '';
    for (const satz of zeile.split(/(?<=[.!?])\s+/)) {
      if ((rest + ' ' + satz).trim().length > max && rest) { out.push(rest.trim()); rest = ''; }
      rest += ` ${satz}`;
    }
    if (rest.trim()) out.push(rest.trim());
  }
  return out;
}

async function eins(text, von) {
  if (!text.trim()) return text;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${API}?q=${encodeURIComponent(text)}&langpair=${von}|de`, { signal: ctrl.signal });
    const data = await res.json();
    if (!res.ok || Number(data.responseStatus) !== 200) throw new Error(data.responseDetails || `HTTP ${res.status}`);
    return data.responseData.translatedText;
  } finally {
    clearTimeout(timer);
  }
}

export async function insDeutsche(text, von) {
  const teile = stuecke(text || '');
  const fertig = [];
  for (const s of teile) fertig.push(await eins(s, von));
  return fertig.join('\n');
}

// Übersetzt die Freitexte eines Berichts. Bereits übersetzte, unveränderte Texte werden wiederverwendet.
export async function berichtInsDeutsche(r, von) {
  const alt = r.deutsch?.von === von ? r.deutsch : null;
  const ergebnis = { von, original: {}, text: {}, fehler: null };
  for (const f of FREITEXTE) {
    const t = (r[f] || '').trim();
    if (!t) continue;
    ergebnis.original[f] = t;
    if (alt?.original?.[f] === t && alt.text?.[f]) { ergebnis.text[f] = alt.text[f]; continue; }
    try {
      ergebnis.text[f] = await insDeutsche(t, von);
    } catch (err) {
      ergebnis.fehler = err.name === 'AbortError' ? 'Zeitüberschreitung' : err.message;
    }
  }
  return ergebnis;
}

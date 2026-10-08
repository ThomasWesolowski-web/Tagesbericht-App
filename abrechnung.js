// Merker „Abgerechnet“ für Rapporte (nur Administrator).
// Steht nicht im Bericht selbst, sondern in einer eigenen Liste, damit der Bericht des Mitarbeiters
// unverändert bleibt. Im Repo: abrechnung/abgerechnet.json, auf dem Gerät im localStorage.
// Ein Eintrag: berichtId -> { an, am, von, updatedAt }  (an: false = wieder als offen markiert)

const KEY = 'tagesberichte.abgerechnet';

export function abrechnungLokal() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { eintraege: d.eintraege || {}, ausstehend: Boolean(d.ausstehend) };
  } catch {
    return { eintraege: {}, ausstehend: false };
  }
}

export function abrechnungLokalSpeichern(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // ohne Speicher: bleibt bis zum Neustart im Speicher der Seite
  }
}

export function istAbgerechnet(id, d = abrechnungLokal()) {
  return Boolean(d.eintraege[id]?.an);
}

// Mehrere Berichte auf einmal als abgerechnet (an = true) oder offen markieren
export function abgerechnetSetzen(ids, an, von = '') {
  const d = abrechnungLokal();
  const jetzt = Date.now();
  for (const id of ids) {
    if (istAbgerechnet(id, d) === an) continue;
    d.eintraege[id] = { an, am: an ? jetzt : null, von, updatedAt: jetzt };
    d.ausstehend = true;
  }
  abrechnungLokalSpeichern(d);
}

// Zwei Stände zusammenführen: pro Bericht gewinnt die neuere Änderung
export function abrechnungMischen(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, e] of Object.entries(b)) {
    if (!out[id] || (e.updatedAt || 0) > (out[id].updatedAt || 0)) out[id] = e;
  }
  return out;
}

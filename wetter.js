// Wetter automatisch eintragen: Standort des Handys abfragen und das Wetter dazu bei Bright Sky
// holen (https://brightsky.dev, Daten des Deutschen Wetterdienstes, ohne Konto und ohne Schlüssel).
// Der Standort wird auf 2 Nachkommastellen (gut 1 km) gerundet, nur für die Abfrage benutzt und nicht
// im Bericht gespeichert. Gespeichert werden nur die Wetter-Knöpfe, die Temperatur und der Name der
// Wetterstation. Ohne Netz oder ohne Erlaubnis bleibt alles wie bisher von Hand.

const API = 'https://api.brightsky.dev';

// Fehler mit einer Art, damit die Oberfläche den passenden Hinweis zeigen kann
export class WetterFehler extends Error {
  constructor(art, msg) { super(msg || art); this.art = art; }
}

// Arten: 'offline', 'verboten', 'kein-standort', 'dienst', 'zukunft', 'kein-geraet'

function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function naechsterTag(datum) {
  const [y, m, d] = datum.split('-').map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return n.toISOString().slice(0, 10);
}

const runde = (x) => Math.round(x * 100) / 100;

export function standort() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new WetterFehler('kein-geraet')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: runde(pos.coords.latitude), lon: runde(pos.coords.longitude) }),
      (err) => reject(new WetterFehler(err.code === 1 ? 'verboten' : 'kein-standort', err.message)),
      // ungenau reicht und geht schneller; ein Standort der letzten 30 Minuten darf wiederverwendet werden
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function holeJson(url) {
  let res;
  try {
    const ctrl = new AbortController();
    const uhr = setTimeout(() => ctrl.abort(), 15000);
    res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(uhr);
  } catch (err) {
    throw new WetterFehler(navigator.onLine === false ? 'offline' : 'dienst', err.message);
  }
  if (!res.ok) throw new WetterFehler('dienst', `HTTP ${res.status}`);
  return res.json();
}

const zahl = (...werte) => {
  for (const v of werte) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
};

const REGEN = ['rain', 'thunderstorm', 'hail', 'sleet'];

// Aus Wetterdaten (ein aktueller Messwert oder die Stundenwerte der Arbeitszeit) die Knöpfe der App
// machen. Liefert { wetter: ['sonnig', …], temperatur: '4' } oder null, wenn nichts Brauchbares drin ist.
export function wetterAusDaten(werte, mittag = null) {
  const liste = (werte || []).filter((w) => w && typeof w === 'object');
  if (!liste.length) return null;
  const temps = liste.map((w) => zahl(w.temperature)).filter((t) => t != null);
  const wetter = new Set();

  const nass = liste.filter((w) => REGEN.includes(w.condition) || zahl(w.precipitation, w.precipitation_60, w.precipitation_30, w.precipitation_10) > 0.1);
  if (nass.length) wetter.add('regen');
  if (liste.some((w) => w.condition === 'snow' || w.icon === 'snow' || w.condition === 'sleet')) wetter.add('schnee');
  // nur Schnee, kein Regen: Regen-Knopf weg
  if (wetter.has('schnee') && !liste.some((w) => ['rain', 'thunderstorm', 'hail', 'sleet'].includes(w.condition))) wetter.delete('regen');

  // Wind ab Windstärke 5 (29 km/h) oder Böen ab 50 km/h
  const wind = Math.max(0, ...liste.map((w) => zahl(w.wind_speed, w.wind_speed_10, w.wind_speed_30, w.wind_speed_60) ?? 0));
  const boe = Math.max(0, ...liste.map((w) => zahl(w.wind_gust_speed, w.wind_gust_speed_10, w.wind_gust_speed_30, w.wind_gust_speed_60) ?? 0));
  if (wind >= 29 || boe >= 50 || liste.some((w) => w.icon === 'wind')) wetter.add('wind');

  if (temps.length && Math.min(...temps) <= 0) wetter.add('frost');

  // Sonnig oder bewölkt nach der Bewölkung, sonst nach dem Symbol
  if (!wetter.has('regen') && !wetter.has('schnee')) {
    const wolken = liste.map((w) => zahl(w.cloud_cover)).filter((c) => c != null);
    if (wolken.length) {
      wetter.add(wolken.reduce((s, c) => s + c, 0) / wolken.length < 50 ? 'sonnig' : 'bewoelkt');
    } else {
      const sonne = liste.filter((w) => /^clear/.test(w.icon || '')).length;
      wetter.add(sonne * 2 >= liste.length ? 'sonnig' : 'bewoelkt');
    }
  }

  // Temperatur: aktueller Wert bzw. der Wert um 12 Uhr, sonst der Durchschnitt
  let temp = null;
  if (liste.length === 1) temp = zahl(liste[0].temperature);
  else if (mittag) temp = zahl(liste.find((w) => String(w.timestamp || '').slice(11, 13) === mittag)?.temperature);
  if (temp == null && temps.length) temp = temps.reduce((s, t) => s + t, 0) / temps.length;

  const reihenfolge = ['sonnig', 'bewoelkt', 'regen', 'wind', 'schnee', 'frost'];
  return {
    wetter: reihenfolge.filter((id) => wetter.has(id)),
    temperatur: temp == null ? '' : String(Math.round(temp)),
  };
}

function stationName(daten, wert) {
  const quellen = daten.sources || [];
  const q = quellen.find((s) => s.id === wert?.source_id) || quellen[0];
  return q?.station_name || '';
}

// Wetter für den Bericht holen. Heute: aktueller Messwert. Früherer Tag: Stundenwerte 7 bis 16 Uhr.
export async function wetterHolen(datum = heute()) {
  if (datum > heute()) throw new WetterFehler('zukunft');
  if (navigator.onLine === false) throw new WetterFehler('offline');
  const { lat, lon } = await standort();
  const ort = `lat=${lat}&lon=${lon}&tz=Europe/Berlin`;
  if (datum === heute()) {
    const daten = await holeJson(`${API}/current_weather?${ort}`);
    const ergebnis = wetterAusDaten([daten.weather]);
    if (!ergebnis) throw new WetterFehler('dienst', 'keine Daten');
    return { ...ergebnis, station: stationName(daten, daten.weather) };
  }
  const daten = await holeJson(`${API}/weather?${ort}&date=${datum}&last_date=${naechsterTag(datum)}`);
  const arbeitszeit = (daten.weather || []).filter((w) => {
    const h = Number(String(w.timestamp || '').slice(11, 13));
    return String(w.timestamp || '').startsWith(datum) && h >= 7 && h <= 16;
  });
  const ergebnis = wetterAusDaten(arbeitszeit, '12');
  if (!ergebnis) throw new WetterFehler('dienst', 'keine Daten');
  return { ...ergebnis, station: stationName(daten, arbeitszeit[0]) };
}

// Mindmap aller Funktionen (Einstellungen › Mindmap der App), auf Deutsch wie das Handbuch.
// Bei neuen Funktionen hier den passenden Ast ergänzen.

const AESTE = [
  { n: 'Berichte', t: 'Tagesbericht & Rapport', z: [
    ['Baustelle zuerst wählen', 'Vorschläge beim Eintippen, auch aus früheren Berichten'],
    ['Art wählen', 'Tagesbericht oder Rapport'],
    ['Rapport', 'Regie oder Pauschal, Maschinen inkl. LKW/Transporter, Unterschrift Bauherr'],
    ['Personal mit Zeiten', 'Zeit pro Person, Warnung bei doppelt angelegter Person'],
    ['Zeitfelder', '5-Minuten-Schritte, vorbelegt 07:00–16:00'],
    ['Fotos & PDFs anhängen', 'Werden verkleinert, Fotos als Pins auf Plänen'],
    ['Material und Geräte', 'Freitext, daraus entsteht die Materialliste'],
    ['Speichern / Abbrechen', 'Kein Autosave, später bearbeiten oder löschen'],
    ['Abgerechnet-Schieber', 'Rapporte als abgerechnet markieren', 'Admin']] },
  { n: 'PDF', t: 'PDFs & Auswertungen', z: [
    ['Bericht als PDF', 'Mit Firmen-Briefkopf'],
    ['Erst Vorschau', 'Danach „Teilen oder speichern“'],
    ['Zusammenfassung-PDF', 'Mehrere Berichte auf einmal'],
    ['Materialliste', 'Aus Rapporten, Summen je Material, PDF und Excel'],
    ['Stundennachweis', 'Eine Seite pro Mitarbeiter und Monat'],
    ['Monats-PDF aller Mitarbeiter', 'Übersicht und je Person ein Nachweis', 'Admin']] },
  { n: 'Stunden', t: 'Stunden', z: [
    ['Stunden eintragen', 'Mit Pflichtfeldern'],
    ['Auf allen Geräten gleich', 'Abgleich nach letzter Änderung'],
    ['Büro-Personen', 'Eintrag „Büro“ ohne Gewerk'],
    ['Namen werden erkannt', 'Auch mit vertauschtem Vor- und Nachnamen'],
    ['Alle Stunden sehen', 'Mitarbeiter sehen nur die eigenen', 'Admin']] },
  { n: 'Aufmaß', t: 'Aufmaß', z: [
    ['Aufmaß-Reiter', 'Wie das Papierformular'],
    ['Foto-Aufmaß', 'Foto entzerren mit Rahmen, Raster, Fadenkreuz'],
    ['Formen zeichnen', 'Blauer Schiebepunkt, Kopie-Knopf'],
    ['Ecken-Magnet & Erkennen', 'Funktioniert offline'],
    ['Fenster-Regel', 'Öffnung B×H, Umlauf, 2× Laibung, 1× Sturz; Laibungen in lfm']] },
  { n: 'Baustellen', t: 'Baustellen & Pläne', z: [
    ['Baustellen anlegen', 'Darf jeder, löschen nur Admin'],
    ['Pläne anhängen', 'Bilder und PDFs an der Baustelle'],
    ['Pläne markieren', 'Zeichnen und Foto-Pins setzen'],
    ['Mehrseitige PDFs', 'Alle Seiten untereinander, Zwei-Finger-Zoom'],
    ['Excel / CSV', 'Als Tabelle in der App, sonst in anderer App öffnen'],
    ['Materialliste der Baustelle', 'Knopf direkt an der Baustelle']] },
  { n: 'Zeitplan', t: 'Baustellen-Zeitplan', adm: true, z: [
    ['Kalender', 'Balken nach Woche oder Tag (Mo–Fr)'],
    ['Abschnitte', 'Je mit Tagen, Personal und Material, X zum Entfernen'],
    ['Vorlagen', 'Nur Gerüst, Fassade WDVS, Innenputz, Trockenbau, Maler'],
    ['Auftrag „Nur Gerüst“', 'Fläche, Aufbau, Abbau, Standzeit'],
    ['+1 Woche', 'Verschiebt Folgeabschnitte mit'],
    ['Personal-Plantafel', 'Wer ist wann wo'],
    ['Auslastung', 'Je Woche und je Tag, je Gewerk, über 100 % rot'],
    ['Konflikte', 'Urlaub, mehr als 8 h am Tag']] },
  { n: 'Urlaub', t: 'Urlaub', z: [
    ['Urlaubskalender', 'Urlaub beantragen'],
    ['Genehmigen', 'Anträge annehmen', 'Admin'],
    ['Betriebsurlaub', 'Für alle eintragen', 'Admin']] },
  { n: 'Personal', t: 'Personal & Stammdaten', z: [
    ['Kategorien', 'Meister, Facharbeiter, Helfer, Lehrling, Büro'],
    ['Gewerk & Schultag', 'Für Zeitplan und Auslastung'],
    ['Anlegen', 'Darf jeder'],
    ['Löschen', 'Nur Admin', 'Admin']] },
  { n: 'Abgleich', t: 'Offline & Abgleich', z: [
    ['Läuft auf dem Handy', 'Installierbare Web-App, auch ohne Netz'],
    ['Abgleich ins Firmen-Archiv', 'Berichte, Stunden, Pläne werden gesichert'],
    ['Mitarbeiter-Zugang', 'Eigener Schlüssel, sieht nur eigene Berichte'],
    ['Admin holt alles', 'Alle Berichte aller Mitarbeiter', 'Admin'],
    ['Weiteres Gerät', 'Schlüssel anzeigen und kopieren', 'Admin']] },
  { n: 'Sprachen', t: 'Sprachen', z: [
    ['Fünf Sprachen', 'Deutsch, Polnisch, Rumänisch, Mazedonisch, Albanisch'],
    ['Automatisch übersetzt', 'Freitexte ins Deutsche, Original bleibt'],
    ['Fachwörterliste', 'Bau-Begriffe werden richtig übersetzt']] },
  { n: 'Hilfe', t: 'Hilfe & Einrichten', z: [
    ['Handbuch in der App', 'Unter Einstellungen'],
    ['Mindmap', 'Diese Übersicht, unter Einstellungen'],
    ['Anleitung für Mitarbeiter', 'Bild-PDF und Video zum Einrichten'],
    ['Admin-PIN', 'Schaltet Admin-Funktionen frei']] },
  { n: 'Raumaufmaß', t: 'Raumaufmaß (eigene App)', z: [
    ['Grundriss zeichnen', 'Wände mit Maßen, mehrere Räume anbauen'],
    ['Dachschrägen', 'Kniestock, Dachfenster'],
    ['Körper abziehen', 'Z. B. Schächte, Pfeiler'],
    ['Material-Planer', 'Knauf-Systeme inkl. W111–W116'],
    ['Nur auf dem Gerät', 'Kein Abgleich, eigenes PDF']] },
];

// Feste Astfarben, mit weißer Schrift in hell und dunkel lesbar
const FARBEN = ['#2f74ad', '#b0532c', '#23805f', '#8152a8', '#9a7414', '#b23b62',
  '#2c8790', '#647224', '#4a5fb0', '#9b4d2b', '#56606b', '#734889'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function karteSvg(offen, version) {
  const cx = 200, cy = 320, rx = 130, ry = 280, N = AESTE.length;
  let linien = '', knoten = '';
  AESTE.forEach((a, i) => {
    const w = -Math.PI / 2 + i * 2 * Math.PI / N;
    const x = cx + rx * Math.cos(w), y = cy + ry * Math.sin(w);
    const f = FARBEN[i];
    const mx = cx + (x - cx) * 0.5 + (y - cy) * 0.06, my = cy + (y - cy) * 0.5 - (x - cx) * 0.06;
    linien += `<path d="M${cx},${cy} Q${mx},${my} ${x},${y}" fill="none" stroke="${f}" stroke-width="${offen.has(i) ? 4 : 3}" stroke-linecap="round" opacity=".75"/>`;
    const bw = Math.max(80, a.n.length * 9 + 26), bh = 32, bx = x + bw / 2 - 4, by = y - bh / 2 - 2;
    knoten += `<g class="mm-ast${offen.has(i) ? ' aktiv' : ''}" data-ast="${i}" tabindex="0" role="button" aria-label="${esc(a.t)}">
      <rect x="${x - bw / 2}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="16" fill="${f}"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" fill="#fff" class="mm-name">${esc(a.n)}</text>
      <circle cx="${bx}" cy="${by}" r="10" fill="var(--surface)" stroke="${f}" stroke-width="1.5"/>
      <text x="${bx}" y="${by + 4}" text-anchor="middle" fill="${f}" class="mm-zahl">${a.z.length}</text></g>`;
  });
  return `<svg viewBox="0 0 400 640" role="img" aria-label="Mindmap der App-Funktionen">${linien}
    <circle cx="${cx}" cy="${cy}" r="66" fill="var(--accent)"/>
    <text x="${cx}" y="${cy - 5}" text-anchor="middle" fill="var(--accent-ink)" class="mm-mitte">Tagesberichte</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" fill="var(--accent-ink)" class="mm-version">App · ${esc(version)}</text>
    ${knoten}</svg>`;
}

function baumHtml(i) {
  const a = AESTE[i];
  return `<section class="mm-baum" id="mm-ast-${i}" style="--mm-farbe:${FARBEN[i]}">
    <div class="mm-kopf"><span class="mm-pill">${esc(a.t)}</span>${a.adm ? '<span class="mm-tag">Admin</span>' : ''}
      <span class="mm-nb">${a.z.length} Funktionen</span>
      <button class="mm-zu" type="button" data-zu="${i}" aria-label="Zuklappen">×</button></div>
    <ul class="mm-zweige">${a.z.map((z) => `<li><span class="mm-blatt"><b>${esc(z[0])}</b>${z[2] ? `<span class="mm-tag">${esc(z[2])}</span>` : ''}<small>${esc(z[1])}</small></span></li>`).join('')}</ul>
  </section>`;
}

// Zeichnet die Mindmap in das Element; Antippen eines Astes klappt seine Funktionen darunter auf.
export function mindmapZeigen(ziel, version) {
  const offen = new Set([0]);
  ziel.innerHTML = `<div class="mindmap" data-roh>
    <p class="hint">Ast antippen, um die Funktionen dahinter zu sehen. „Admin“ heißt: nur mit Admin-PIN.</p>
    <div class="mm-karte"></div>
    <div class="row mm-knoepfe"><button class="btn ghost" type="button" id="mm-alle">Alle aufklappen</button>
      <button class="btn ghost" type="button" id="mm-keine">Alle zuklappen</button></div>
    <div class="mm-baeume"></div></div>`;
  const karte = ziel.querySelector('.mm-karte'), baeume = ziel.querySelector('.mm-baeume');
  const zeichnen = () => {
    karte.innerHTML = karteSvg(offen, version);
    baeume.innerHTML = [...offen].sort((a, b) => a - b).map(baumHtml).join('');
  };
  const umschalten = (i, scrollen) => {
    if (offen.has(i)) offen.delete(i); else offen.add(i);
    zeichnen();
    if (scrollen && offen.has(i)) ziel.querySelector(`#mm-ast-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  karte.addEventListener('click', (e) => {
    const g = e.target.closest('[data-ast]');
    if (g) umschalten(Number(g.dataset.ast), true);
  });
  karte.addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-ast]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); umschalten(Number(g.dataset.ast), true); }
  });
  baeume.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zu]');
    if (b) umschalten(Number(b.dataset.zu), false);
  });
  ziel.querySelector('#mm-alle').onclick = () => { AESTE.forEach((_, i) => offen.add(i)); zeichnen(); };
  ziel.querySelector('#mm-keine').onclick = () => { offen.clear(); zeichnen(); };
  zeichnen();
}

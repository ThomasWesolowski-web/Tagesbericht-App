# Tagesbericht-App

Installierbare Web-App (PWA) für Tagesberichte, Rapporte, Stunden und Aufmaß der
MT+ Füß & Wesolowski GbR. Läuft offline auf dem Handy und gleicht per GitHub-Token mit dem
privaten Repo `ThomasWesolowski-web/Rapporte-` ab. Der Inhaber (Tomek) ist Handwerker, kein
Entwickler: Rückfragen und Erklärungen auf Deutsch und ohne Fachjargon.

## Aufbau

Reines HTML/CSS/JavaScript (ES-Module), kein Build, keine npm-Abhängigkeiten.
Veröffentlicht über GitHub Pages aus `main` (Root): https://thomaswesolowski-web.github.io/Tagesbericht-App/

| Datei | Inhalt |
|---|---|
| `index.html`, `app.css` | Grundgerüst und Aussehen |
| `app.js` | Oberfläche, alle Reiter und Dialoge, `APP_VERSION` |
| `report.js` | Datenmodell (Bericht, Rapport, Aufmaß) und Markdown-Fassung fürs Repo |
| `pdf.js` | PDFs (Bericht, Rapport, Aufmaß, Stundennachweis, Zusammenfassung) mit Briefkopf |
| `stunden.js` | Stundennachweis pro Mitarbeiter |
| `urlaub.js` | Urlaubskalender: Feiertage Baden-Württemberg, Arbeitstage, Anträge auf dem Gerät (Repo: `urlaub/`, eine Datei pro Antrag) |
| `sync.js` | Abgleich mit `Rapporte-` (Berichte, Stammdaten, Stunden, Urlaub, Admin) |
| `db.js` | Speicher auf dem Handy (IndexedDB, `DB_VERSION`) |
| `media.js` | Fotos verkleinern (1600 px), Anhänge vorbereiten |
| `markup.js` | Fotos markieren |
| `fotoaufmass.js` | Foto-Aufmaß (Rahmen/Homografie, Formen, VOB/C-Abzüge, Laibungen) |
| `raumgeometrie.js` | Raumaufmaß-Rechnung, nur noch zum Anzeigen alter Räume in Berichten und PDFs |
| `raumaufmass/` | Raumaufmaß als eigene App (vorübergehend): `ra-app.js` Liste/PDF, `raumaufmass.js` Editor, `raumgeometrie.js` Rechnung (mit Node testbar), `ansicht3d.js` 3-D-Ansicht (Canvas, ohne Bibliothek), eigener `sw.js` (`CACHE` raumaufmass-vN) |
| `i18n.js` | Oberflächen-Sprachen DE/PL/RO/MK/SQ |
| `translate.js` | Freitexte beim Hochladen ins Deutsche übersetzen (MyMemory) |
| `abrechnung.js` | Merker „Abgerechnet“ für Rapporte (nur Admin; Repo: `abrechnung/abgerechnet.json`) |
| `fachwoerter.js` | Fachwörterliste RO/PL/MK/SQ → Deutsch, vor dem Übersetzer angewandt |
| `handbuch.js`, `handbuch.md` | Handbuch in der App (Kopie des Claude Docs) |
| `sw.js` | Offline-Cache (`CACHE`, Liste `SHELL`) |
| `vendor/` | jsPDF und pdf.js, nicht von Hand ändern |

## Regeln

- **Jede Änderung ist eine neue Version.** Dafür den Skill `neue-version` abarbeiten
  (`APP_VERSION` in `app.js` und `CACHE` in `sw.js` hochzählen). Ohne neue Cache-Nummer zeigen die
  Handys weiter die alte App.
- **Neue Dateien**, die die App lädt, auch in `SHELL` in `sw.js` eintragen, sonst fehlen sie offline.
- **Raumaufmaß-App** (`raumaufmass/`): bei Änderungen dort `CACHE` in `raumaufmass/sw.js` hochzählen.
  `raumgeometrie.js` gibt es zweimal: die Kopie im Hauptordner zeigt nur alte Räume in Berichten an
  und bleibt auf dem Stand von 1.46.0; Neues (z. B. Körper, Wand an Wand) nur in `raumaufmass/`.
  Die Raumaufmaß-App ist nur Deutsch; ihre Version steht in `RA_VERSION` (`raumaufmass/ra-app.js`).
- **Neue Oberflächentexte** in `ROWS` in `i18n.js` in allen fünf Sprachen eintragen
  (Reihenfolge: Deutsch, Polnisch, Rumänisch, Mazedonisch, Albanisch). Der Code und alle PDFs und
  Berichte bleiben deutsch; Admin sieht die App immer auf Deutsch.
- **Gespeicherte Daten bleiben lesbar.** Felder in Berichten nicht umbenennen oder entfernen; alte
  Berichte im Repo und auf den Handys müssen weiter funktionieren. Änderungen an IndexedDB nur mit
  höherem `DB_VERSION` und Migration.
- **Dieses Repo ist öffentlich.** Keine echten Mitarbeiter- oder Kundennamen, keine Tokens, keine
  Berichte. Beispielname: Max Mustermann. Echte Daten liegen nur in `Rapporte-`.
- **Admin-Rechte:** Löschen von Baustellen/Personal und alle Stunden sehen nur mit Admin-PIN;
  Anlegen darf jeder. Mitarbeiter bekommen beim Abgleich nur ihre eigenen Berichte.
- Code, Kommentare und Commit-Nachrichten auf Deutsch, im Stil der vorhandenen Dateien.

## Lokal prüfen

```sh
for f in *.js; do node --check "$f"; done   # Syntax
python3 -m http.server 8000                 # dann http://localhost:8000 im Browser
node --test tests/*.test.mjs                # Raumaufmaß-Rechnung
node tests/raumaufmass.e2e.mjs              # Raumaufmaß-App im Browser (Server auf 8000 muss laufen)
```

---
name: neue-version
description: Checkliste für jede Änderung an der Tagesbericht-App, bevor sie veröffentlicht wird (Version und Offline-Cache hochzählen, prüfen, Handbuch nachziehen). Immer verwenden, wenn Code der App geändert wird.
---

# Neue App-Version veröffentlichen

Jede Änderung, die auf die Handys soll, ist eine neue Version. Diese Schritte der Reihe nach abarbeiten.

Betrifft die Änderung nur die Raumaufmaß-App (`raumaufmass/`), zählt nur deren eigene Nummer:
`RA_VERSION` in `raumaufmass/ra-app.js` und `CACHE` in `raumaufmass/sw.js`. `APP_VERSION` und `CACHE`
der Tagesbericht-App bleiben dann gleich.

## 1. Versionsnummern hochzählen

- `app.js`: `const APP_VERSION = 'X.Y.Z';`
  - neue Funktion → mittlere Zahl +1, letzte auf 0 (1.27.0 → 1.28.0)
  - nur Fehlerbehebung → letzte Zahl +1 (1.27.0 → 1.27.1)
- `sw.js`: `const CACHE = 'tagesberichte-vNN';` → NN um 1 erhöhen.
  Ohne das laden die installierten Apps die neuen Dateien nicht.
- Neue Datei angelegt, die die App lädt? Dann in `SHELL` in `sw.js` eintragen.

## 2. Prüfen

- Syntax aller Skripte: `for f in *.js; do node --check "$f" || exit 1; done`
- Neue Oberflächentexte stehen in `i18n.js` in allen fünf Sprachen.
- App lokal starten (`python3 -m http.server 8000`) und mit dem vorhandenen Chromium (Playwright)
  aufrufen: Startseite lädt ohne Fehler in der Konsole, der geänderte Bereich lässt sich bedienen,
  und ein betroffenes PDF wird erzeugt. Das Handy-Format (z. B. 390 × 844) verwenden.
- Alte Berichte (ohne die neuen Felder) öffnen sich weiter ohne Fehler.
- Keine echten Namen, Tokens oder Kundendaten im Diff (Repo ist öffentlich).

## 3. Handbuch nachziehen (vor dem Commit)

- Das Handbuch zur App (Claude Doc „Tagesberichte-App: Funktionen und Bedienung“) nachziehen:
  betroffenen Abschnitt, Versionsnummer im Überblick, neue Zeile im Änderungsverlauf.
- Die App zeigt eine Kopie davon (Einstellungen › Handbuch zur App): das Doc als Markdown
  exportieren, die Zeile „Stand … · @…“ entfernen und als `handbuch.md` speichern.
  Keine echten Mitarbeiter- oder Kundennamen hineinschreiben (Repo ist öffentlich).

## 4. Veröffentlichen

- `README.md` anpassen, wenn sich sichtbar etwas an den Funktionen geändert hat.
- Commit-Nachricht auf Deutsch, beginnend mit der Version, z. B.
  `1.28.0: Aufmaß-PDF mit Summen je Raum`.
- Nach dem Push auf `main` ist die Änderung über GitHub Pages nach kurzer Zeit online.

## 5. Danach

- Tomek in einem Satz sagen, was neu ist und dass die App beim nächsten Öffnen (ggf. zweimal
  öffnen) aktualisiert wird.

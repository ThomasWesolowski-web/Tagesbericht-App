# Tagesbericht-App

Web-App für Tagesberichte, die auf dem Handy läuft und auch ohne Netz funktioniert.
Berichte werden zuerst auf dem Handy gespeichert und danach in das private Repo
[`Rapporte-`](https://github.com/ThomasWesolowski-web/Rapporte-) in den Ordner `berichte/` hochgeladen.
Im Reiter **Stunden** trägt jeder Mitarbeiter seine täglichen Stunden ein (Arbeit, Urlaub, Krank, Feiertag, Berufsschule).
Pro Mitarbeiter und Monat landen `stunden/<JJJJ-MM>_<name>.md`, `.json` und `.pdf` im Repo.
Wer die App auf mehreren Geräten nutzt (z. B. Handy und PC), sieht und bearbeitet seine Stunden auf allen;
der Administrator kann die Stunden aller Mitarbeiter bearbeiten. Pro Eintrag gilt die neuere Änderung.
Unter **Stunden → Urlaub** gibt es einen Urlaubskalender (Kalenderwochen, Feiertage Baden-Württemberg).
Jeder beantragt dort seinen Urlaub, der Administrator genehmigt oder lehnt ab (genehmigte Arbeitstage
kommen als „Urlaub“ in den Stundennachweis); jeder Antrag liegt als
`urlaub/<JJJJ>_<name>_<id>.json` im Repo.

Baustellen und Personal werden mit `stammdaten/baustellen.json` und `stammdaten/personal.json`
im selben Repo abgeglichen, damit alle Handys dieselben Listen haben (pro Eintrag gewinnt die neuere Änderung).

In diesem Repo liegt nur der App-Code. Es enthält keine Berichte und keine Zugangsdaten.

## Was die App kann

- Bericht mit Datum, Baustelle, Auftragsnummer, Personal, Arbeitszeit (Stunden werden
  ausgerechnet), Wetter, ausgeführten Arbeiten, Material und Bemerkungen
- Fotos mit der Kamera aufnehmen oder Dateien (PDF, Lieferscheine …) anhängen;
  Fotos werden auf etwa 1600 Pixel verkleinert
- Alles wird sofort offline auf dem Handy gespeichert (IndexedDB) und kann jederzeit geändert werden
- Pläne und Dokumente an der Baustelle (PDF, Bilder), abgeglichen unter `stammdaten/plaene/`;
  im Bericht einen Plan (bei PDFs eine Seite) markieren: bearbeitete Flächen ausmalen, Stift,
  Pfeil, Text, Zoom mit zwei Fingern, und Fotos als nummerierte Pins an die Stelle setzen, an der
  sie entstanden sind (`plaene.js`, `markup.js`). Im PDF steht der Plan über die ganze Breite,
  die Fotos tragen dieselbe Nummer. Pläne werden mit bis zu 8 Megapixeln geladen, PDFs beim
  Hineinzoomen scharf nachgezeichnet; Hand zum Verschieben, Strichstärke Dünn/Mittel/Dick oder Regler;
  beim Pin direkt ein Foto aufnehmen oder vom Handy wählen (wird an den Bericht gehängt)
- Handbuch in der App unter *Einstellungen › Handbuch zur App* (`handbuch.md`, Kopie des Handbuchs, offline verfügbar)
- Upload als ein Commit pro Bericht, sobald Netz da ist
- Foto-Aufmaß im Reiter Aufmaß: Perspektiv-Rahmen (4 Ecken eines bekannten Rechtecks, Entzerrung per Homografie); Formen werden fertig abgesteckt und über die Eckpunkte angepasst, Zoom per Knöpfen oder zwei Fingern; Teil antippen wählt es aus, blauer Punkt verschiebt, Kopie dupliziert; Ecken-Magnet (Ecken rasten an Ecken im Foto ein) und Öffnung erkennen per Antippen, beides auf dem Handy ohne Internet (`erkennen.js`)
  oder bekannte Länge und Höhe im Foto markieren, daraus den Maßstab
  berechnen, Flächen, Öffnungen und Strecken antippen; Öffnungen nach VOB/C übermessen oder abziehen,
  Laibungen gesondert. Läuft komplett im Browser, Maße sind nur ungefähr (`fotoaufmass.js`)
- Raumaufmaß, vorübergehend als eigene App unter `raumaufmass/`
  (https://thomaswesolowski-web.github.io/Tagesbericht-App/raumaufmass/, Aufmaße nur auf dem Gerät,
  PDF zum Teilen; in der Berichte-App bleiben alte Räume nur sichtbar): Raum frei skizzieren (Finger, Stift, Maus), daraus gerade Wände
  (Douglas-Peucker, Ecken, Ausrichten 0/90/45°, Schließen); Maßstab über ein echtes Maß, weitere Maße
  mit Ausgleich und Widerspruchsprüfung; Wände/Ecken bearbeiten, Türen und Fenster, Raumhöhe;
  Boden, Decke, Wand netto und Umfang, Grundriss maßstäblich im PDF, Export SVG/DXF
  Kniestock und Dachschräge je Wand (Dachflächen als Ebenen: Satteldach, Walmdach, Giebelwände),
  Dachfenster, Decke waagerecht und Schrägflächen als eigene Positionen;
  Körper in der Fläche (Kamin, Säule) als Abzug; gemessene Wände bleiben beim Ziehen fest;
  mehrere Räume in einem Grundriss (Raum Wand an Wand anbauen, Räume verschieben und andocken), Grundriss gesamt
  im PDF; 3-D-Ansicht zum Drehen (`raumaufmass/ansicht3d.js`)
  (`raumaufmass/raumgeometrie.js` rechnet, `raumaufmass/raumaufmass.js` ist der Editor,
  `raumaufmass/ra-app.js` die Liste und das PDF; Tests in `tests/`)

## Einrichten

1. GitHub Pages einschalten: *Settings → Pages → Deploy from a branch → `main` / `(root)`*.
2. Die Adresse `https://thomaswesolowski-web.github.io/Tagesbericht-App/` auf dem Handy öffnen
   und „Zum Home-Bildschirm“ wählen.
3. Auf GitHub einen [Fine-grained Token](https://github.com/settings/personal-access-tokens/new)
   nur für `Rapporte-` mit *Contents: Read and write* anlegen und in der App unter
   *Einstellungen* eintragen. Der Token bleibt nur auf dem Handy.

## Lokal ausprobieren

```sh
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen.

# Tagesbericht-App

Web-App für Tagesberichte, die auf dem Handy läuft und auch ohne Netz funktioniert.
Berichte werden zuerst auf dem Handy gespeichert und danach in das private Repo
[`Rapporte-`](https://github.com/ThomasWesolowski-web/Rapporte-) in den Ordner `berichte/` hochgeladen.
Im Reiter **Stunden** trägt jeder Mitarbeiter seine täglichen Stunden ein (Arbeit, Urlaub, Krank, Feiertag, Berufsschule).
Pro Mitarbeiter und Monat landen `stunden/<JJJJ-MM>_<name>.md`, `.json` und `.pdf` im Repo.
Wer die App auf mehreren Geräten nutzt (z. B. Handy und PC), sieht und bearbeitet seine Stunden auf allen;
der Administrator kann die Stunden aller Mitarbeiter bearbeiten. Pro Eintrag gilt die neuere Änderung.

Baustellen und Personal werden mit `stammdaten/baustellen.json` und `stammdaten/personal.json`
im selben Repo abgeglichen, damit alle Handys dieselben Listen haben (pro Eintrag gewinnt die neuere Änderung).

In diesem Repo liegt nur der App-Code. Es enthält keine Berichte und keine Zugangsdaten.

## Was die App kann

- Bericht mit Datum, Baustelle, Auftragsnummer, Personal, Arbeitszeit (Stunden werden
  ausgerechnet), Wetter, ausgeführten Arbeiten, Material und Bemerkungen
- Fotos mit der Kamera aufnehmen oder Dateien (PDF, Lieferscheine …) anhängen;
  Fotos werden auf etwa 1600 Pixel verkleinert
- Alles wird sofort offline auf dem Handy gespeichert (IndexedDB) und kann jederzeit geändert werden
- Upload als ein Commit pro Bericht, sobald Netz da ist
- Foto-Aufmaß im Reiter Aufmaß: Perspektiv-Rahmen (4 Ecken eines bekannten Rechtecks, Entzerrung per Homografie); Formen werden fertig abgesteckt und über die Eckpunkte angepasst, Zoom per Knöpfen oder zwei Fingern; Teil antippen wählt es aus, blauer Punkt verschiebt, Kopie dupliziert
  oder bekannte Länge und Höhe im Foto markieren, daraus den Maßstab
  berechnen, Flächen, Öffnungen und Strecken antippen; Öffnungen nach VOB/C übermessen oder abziehen,
  Laibungen gesondert. Läuft komplett im Browser, Maße sind nur ungefähr (`fotoaufmass.js`)

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

# Tagesbericht-App

Web-App für Tagesberichte, die auf dem Handy läuft und auch ohne Netz funktioniert.
Berichte werden zuerst auf dem Handy gespeichert und danach in das private Repo
[`Rapporte-`](https://github.com/ThomasWesolowski-web/Rapporte-) in den Ordner `berichte/` hochgeladen.

In diesem Repo liegt nur der App-Code. Es enthält keine Berichte und keine Zugangsdaten.

## Was die App kann

- Bericht mit Datum, Baustelle, Auftragsnummer, Personal, Arbeitszeit (Stunden werden
  ausgerechnet), Wetter, ausgeführten Arbeiten, Material und Bemerkungen
- Fotos mit der Kamera aufnehmen oder Dateien (PDF, Lieferscheine …) anhängen;
  Fotos werden auf etwa 1600 Pixel verkleinert
- Alles wird sofort offline auf dem Handy gespeichert (IndexedDB) und kann jederzeit geändert werden
- Upload als ein Commit pro Bericht, sobald Netz da ist

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

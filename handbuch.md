# Tagesberichte-App: Funktionen und Bedienung

## Überblick

Die Tagesberichte-App ersetzt Zettel und Excel: Mitarbeiter schreiben Tagesberichte, Rapporte und Stunden direkt auf dem Handy, auch ohne Netz, und alles landet automatisch im privaten GitHub-Repo der Firma. Aktuelle Version: **1.44.0**.

| Was | Wo |
| --- | --- |
| App (zum Installieren) | [thomaswesolowski-web.github.io/Tagesbericht-App](https://thomaswesolowski-web.github.io/Tagesbericht-App/) |
| Gespeicherte Berichte, Stunden, Stammdaten | privates Repo ThomasWesolowski-web/Rapporte- |
| Anleitung Token anlegen (PDF) | [anleitung.pdf](https://thomaswesolowski-web.github.io/Tagesbericht-App/anleitung.pdf) |
| Bild-Anleitung Einrichten (Deutsch / Rumänisch) | [bildanleitung.pdf](https://thomaswesolowski-web.github.io/Tagesbericht-App/bildanleitung.pdf) · [bildanleitung-ro.pdf](https://thomaswesolowski-web.github.io/Tagesbericht-App/bildanleitung-ro.pdf) |
| Video Einrichten (Deutsch / Rumänisch) | [anleitung.mp4](https://thomaswesolowski-web.github.io/Tagesbericht-App/anleitung.mp4) · [anleitung-ro.mp4](https://thomaswesolowski-web.github.io/Tagesbericht-App/anleitung-ro.mp4) |

Unten in der App gibt es fünf Reiter: **Berichte**, **Baustellen**, **Stunden**, **Aufmaß** und **Einstellungen**.

Auf jeder Ebene außer der Startseite sitzt oben links ein kleiner Zurück-Pfeil (weiß im durchsichtigen Kreis). Er springt immer eine Ebene zurück, auch in Auswahlfenstern und in der PDF-Vorschau.

## Einrichten (einmal pro Handy)

Der Chef legt für jeden Mitarbeiter einen eigenen Token an (Anleitung im PDF oben) und gibt ihn weiter. Danach richtet der Mitarbeiter sein Handy so ein:

1. Link der App im Browser öffnen (iPhone: Safari).
2. iPhone: „Teilen“, dann „Zum Home-Bildschirm“, dann „Hinzufügen“. Android (Chrome): ⋮, dann „App installieren“.
3. App ab jetzt nur noch über das Symbol auf dem Home-Bildschirm öffnen.
4. Beim ersten Start die Sprache wählen: Deutsch, Polnisch, Rumänisch, Mazedonisch oder Albanisch.
5. Einstellungen: Vor- und Nachnamen eintragen. Er steht in jedem Bericht und ordnet Berichte und Stunden der Person zu.
6. Zugangs-Token einfügen. Die anderen GitHub-Felder sind schon richtig ausgefüllt.
7. „Verbindung testen“ tippen. Erscheint „Verbunden mit …“, ist alles fertig.

Ist der Token einmal eingetragen, sind die GitHub-Felder gesperrt, damit niemand aus Versehen etwas verstellt. Entsperren geht nur mit der Admin-PIN.

## Berichte und Rapporte schreiben

Im Reiter **Berichte** startet das Plus unten rechts einen neuen Bericht. Er beginnt leer und wird erst mit **Speichern** festgehalten; **Abbrechen** verwirft alles, auch neue Fotos und Markierungen.

1. **Baustelle wählen:** aus der Liste oder als Freitext („Nur in diesem Bericht“), z. B. für kleine Aufträge, die nicht in die Baustellen-Liste sollen.
2. **Art wählen:** Tagesbericht oder Rapport (Regie- oder Pauschalarbeit für den Bauherrn).
3. **Art der Arbeit:** Gerüstbau, Putz, Malerarbeiten, Trockenbau (mehrere möglich) plus Freitext.
4. **Personal:** Personen aus der Liste hinzufügen, jeweils mit Kategorie (Meister, Facharbeiter, Helfer, Lehrling), Beginn, Ende und Pause. Die Minuten von Beginn und Ende werden auf 5-Minuten-Schritte gerundet; die erste Person startet mit 7:00 bis 16:00, weitere Personen übernehmen die Zeiten der ersten.
5. **Ausgeführte Arbeiten, Material, Bemerkungen, Wetter** eintragen.
6. **Rapport zusätzlich:** Maschinen mit Stunden (Schnellauswahl LKW, Transporter) und Unterschrift des Bauherrn mit dem Finger. Beim Rapport sind Personal mit Zeiten und die ausgeführten Arbeiten Pflicht.
7. **Fotos und Dokumente:** „Kamera“ oder „Datei“. Fotos werden automatisch verkleinert, Dateien bis 25 MB.
8. **Speichern.** Mit Netz lädt die App den Bericht sofort hoch, sonst sobald wieder Netz da ist.

**Foto markieren:** Das orange Stift-Symbol auf dem Foto öffnet den Editor mit Stift, Pfeil, Kreis, Rechteck und Text, sechs Farben, Strichstärke (Dünn, Mittel, Dick oder per Schieber), Hand zum Verschieben, Zoomen mit zwei Fingern und Rückgängig. „Fertig“ übernimmt die Markierung. Nach dem Speichern ist sie fest im Foto.

**Text zum Bild:** „+ Text zum Bild“ unter dem Foto öffnet ein Textfeld. Der Text steht im PDF direkt unter dem Foto.

**Pläne markieren:** Hat die Baustelle Pläne, erscheint im Bericht der Abschnitt „Pläne“. „Im Plan markieren“, Plan wählen (bei mehrseitigen PDFs die Seite), dann zeichnen: „Fläche“ malt bearbeitete Flächen halb durchsichtig aus (mit dem Finger umfahren), dazu Stift, Pfeil, Kreis, Rechteck und Text. Mit zwei Fingern oder den Knöpfen + und − zoomen. Ein markierter Plan lässt sich später mit „Bearbeiten“ weiterzeichnen.

**Schärfe und Bedienung:** Pläne werden in hoher Auflösung geladen; bei PDF-Plänen wird der sichtbare Ausschnitt beim Hineinzoomen scharf nachgezeichnet, so bleibt auch kleine Schrift lesbar. Mit der **Hand** verschiebst du den Plan mit einem Finger, ohne zu zeichnen. Die **Strichstärke** wählst du mit Dünn, Mittel, Dick oder stufenlos mit dem Schieber; sie gilt so, wie sie auf dem Bildschirm aussieht, also werden Striche bei starkem Zoom entsprechend feiner. Auch an der Baustelle öffnet sich ein Plan in diesem zoombaren Betrachter.

**Fotos auf dem Plan:** Jedes Foto bekommt eine Nummer (Foto 1, Foto 2 …). Das Stecknadel-Symbol auf dem Foto öffnet den Plan; ein Tippen setzt dort einen orangen Pin mit der Nummer des Fotos. Alternativ im Plan das Werkzeug „Foto“ wählen und auf die Stelle tippen. Dann ein Foto aus dem Bericht aussuchen, mit „Foto aufnehmen“ direkt die Kamera öffnen oder mit „Vorhandenes Foto“ eines vom Handy wählen. Neue Fotos werden automatisch an den Bericht gehängt und bekommen die nächste Nummer. Im PDF steht der Plan über die ganze Seite mit der Liste der Fotos, die Fotos tragen dieselbe Nummer.

**PDF:** „Als PDF teilen“ im Bericht erstellt das PDF mit Firmenbriefkopf, Fotos und Unterschrift. Es öffnet sich erst als Vorschau, danach „Teilen oder speichern“ (WhatsApp, Mail, Dateien). In der Vorschau vergrößern und verkleinern die Knöpfe + und − oben rechts; vergrößert lässt sich das PDF auch seitlich schieben. Die App selbst lässt sich nicht zoomen oder seitlich verschieben, nur hoch und runter scrollen; zoomen geht nur bei Fotos, Plänen und PDFs in ihren Ansichten.

Gespeicherte Berichte lassen sich jederzeit wieder öffnen, ändern oder löschen (roter Knopf unten links).

## Aufmaß

Der Reiter **Aufmaß** ist aufgebaut wie das Papier-Aufmaß der Firma. „Neues Aufmaß“ unten rechts tippen, dann die Baustelle wählen. Oben stehen Datum, Baustelle, Auftragsnummer, Auftraggeber und Art der Arbeit.

1. **Position:** Lfd. Nr. (zählt automatisch weiter) und Bezeichnung, z. B. „Wand Nord“ oder „Fensterbank“.
2. **Einheit:** m², lfm, m³ oder Stk.
3. **Messzeilen:** pro Zeile Stück, Länge, Breite, Höhe. Die App rechnet den Meßgehalt selbst aus (Stück × alle eingetragenen Maße; leeres Stück zählt als 1). Ohne Maße kann der Meßgehalt direkt eingetippt werden, z. B. „aus vorherigem Aufmaß“. „+ Zeile“ fügt eine weitere Zeile an.
4. **Abzug:** „− Abzug“ an einer Zeile zieht sie ab (z. B. Fenster, Türen). Unter jeder Position steht das Netto-Ergebnis.
5. **Gesamt:** unten die Summen getrennt nach Einheit.
6. **Unterschrift:** Der Auftraggeber kann das Aufmaß mit dem Finger anerkennen.
7. **Fotos** und Markierungen wie beim Bericht.

Das PDF zeigt die Tabelle wie auf dem Formular (Lfd. Nr., Bezeichnung, Stück, Länge, Breite, Höhe, Meßgehalt, Abzug, Netto-Meßgehalt), die Summen und unten „Aufgestellt“ und „Anerkannt“. Im Repo liegt jedes Aufmaß unter berichte/ in einem Ordner mit der Endung \_aufmass. Aufmaße erscheinen nicht in der Berichtsliste, bei den Stunden und in der Zusammenfassung.

**Foto-Aufmaß:** Unter den Positionen „Foto-Aufmaß“ antippen und ein Foto aufnehmen oder auswählen. Am besten die Wand gerade von vorn fotografieren.

1. **Rahmen:** Beim Öffnen steckt die App gleich ein gelbes Rechteck ab. Seine 4 Ecken auf ein Rechteck auf der Wand ziehen, dessen Breite und Höhe bekannt sind (Fenster außen, Tür, ganze Wand), „Fertig“ tippen und Breite und Höhe in Metern eingeben. Die App entzerrt damit die Perspektive, auch schräg aufgenommene Fotos werden richtig gemessen; das Raster folgt dann der Wand. Alternativ **Länge** oder **Höhe**: eine Maßlinie erscheint, ihre Enden auf eine bekannte Strecke ziehen und das Maß eingeben (nur für Fotos gerade von vorn). Mit fertigem Rahmen braucht es keine Länge und Höhe; die beiden Knöpfe sind dann grau.
2. **Fläche** (grün): antippen, ein Rechteck erscheint mitten im sichtbaren Ausschnitt. Jede Ecke an die richtige Stelle ziehen. Für eine weitere Ecke (z. B. Giebel) den kleinen ⊕-Punkt auf einer Kante ziehen. „Fertig“, dann benennen (Wand, Decke, Fassade …).
3. **Öffnung** (Fenster, Tür): genauso. Optional Laibungstiefe in cm und „Laibung unten“ angeben.
4. **Strecke** (blau): eine Linie erscheint, Enden ziehen, ⊕ für Knickpunkte; ergibt laufende Meter (z. B. Sockel).
5. **Übernehmen:** die App legt daraus Aufmaßpositionen an.

Zoom und Verschieben: Die Knöpfe + und − rechts unten vergrößern und verkleinern, ⤢ zeigt wieder das ganze Foto; zwei Finger zoomen ebenfalls. Ein Finger auf freier Fotofläche verschiebt das vergrößerte Foto. Eine Ecke wandert beim Ziehen um dieselbe Strecke wie der Finger, liegt also nicht unter dem Finger verdeckt. Fertige Teile (auch Strecken) antippen, um sie auszuwählen: dann sind ihre Ecken wieder ziehbar, mit „Ecke weg“ fällt die gerade gewählte Ecke weg, „Name“ benennt um, „Löschen“ entfernt das ganze Teil, „Kopie“ setzt ein gleich großes Teil daneben (z. B. weitere gleiche Fenster; Name zählt weiter, Laibung wird übernommen). Unter dem gewählten Teil sitzt ein blauer Schiebepunkt mit Pfeilkreuz: daran ziehen verschiebt das ganze Teil, ohne die Ecken zu verändern; beim Verschieben bleibt ein Teil auch auf schrägen Fotos gleich groß. Fadenkreuz-Fenster: Beim Ziehen zeigt ein Fenster die Stelle stark vergrößert mit rotem Fadenkreuz; danach bleibt es für die Ecke (roter Ring) offen: Bild im Fenster ziehen oder Pfeile tippen, 3×/6×/12× ändert den Zoom, ✓ schließt. Raster: Der Knopf unten schaltet um zwischen Raster aus, Raster (Meter-Raster entlang der Referenzen) und Raster + Fangen (Ecken rasten auf den Rasterkreuzungen ein). „Liste“ zeigt alle Teile mit Maßen zum Umbenennen oder Löschen.

**Automatische Hilfe (auf dem Handy, ohne Internet):** **Magnet** (Knopf unten mit dem Hufeisen, Standard an): Wird eine Ecke losgelassen, rastet sie an der nächsten deutlichen Ecke im Foto ein (z. B. Fensterecke, Wandecke), sofern eine ganz in der Nähe ist. Liegen zwei Ecken dicht beieinander (Rahmen außen und Glas innen), nimmt der Magnet die nähere; dann vorher hineinzoomen. Ausschalten, wenn eine Ecke bewusst frei sitzen soll. **Erkennen** (bei Öffnung und Fläche, oben neben „Fertig“): danach mitten in das Fenster tippen; die App sucht die gleichfarbige Fläche drumherum und macht daraus ein Rechteck, mit Rahmen perspektivisch richtig. Bei einem Fenster ist das meist die Glasfläche, für das Maß außen die Ecken danach auf den Rahmen ziehen. Bei Schatten, Spiegelungen oder Gardinen klappt es nicht immer; dann meldet die App das und die Ecken werden von Hand gezogen.

**Abzüge nach VOB/C:** Öffnungen bis zur Grenze werden übermessen (orange gestrichelt), größere abgezogen (rot). Voreingestellt ist Malerarbeiten DIN 18363 mit 2,5 m²; wählbar sind auch Putz DIN 18350, WDVS DIN 18345, Trockenbau DIN 18340 (je 2,5 m²), Fliesen DIN 18352 (0,1 m²) und „Alle Öffnungen abziehen“. In der Fläche steht jede Öffnung mit Breite × Höhe: abgezogene als rote Abzugszeile, übermessene als Hinweiszeile. Laibungen kommen als eigene Position, immer in lfm, je Laibungstiefe eine Position (Öffnungen ohne Tiefe in „Laibungen (ohne Tiefe)“). Darin steht für jedes Fenster und jede Tür zuerst Breite × Höhe und der Umlauf, darunter 2 × Laibung (Höhe), 1 × Sturz (Breite) und bei „Laibung unten“ 1 × Brüstung. Was im Vertrag vereinbart ist, geht vor.

Gespeichert werden das verkleinerte Original-Foto und ein Foto mit allen Maßen; das Foto mit Maßen kommt ins PDF. Über den Stift auf der Karte lässt sich das Foto-Aufmaß später ändern, die Positionen werden dann neu übernommen. **Fotomaße sind nur ungefähr**; wichtige Maße am Bau nachmessen.

**Raumaufmaß (Grundriss zeichnen):** Unter den Positionen „Raum zeichnen“ antippen. Es öffnet sich ein Raster.

1. **Zeichnen:** den Raum grob mit dem Finger, Stift oder der Maus nachfahren, gern in einem Zug. Die App macht daraus gerade Wände; fast waagerechte und senkrechte Wände werden ausgerichtet, echte Schrägen bleiben schräg. Kommt das Ende nah an den Anfang, fragt die App „Raum schließen?“. Man kann auch in mehreren Zügen zeichnen: am blauen Punkt weiterzeichnen, dann „Schließen“.
2. **Maß:** eine Wand (oder ihre Maßzahl) antippen und die echte Länge eingeben, z. B. 5,42. Das erste Maß legt den Maßstab fest, vorher stehen die Längen mit „≈“. Jedes weitere Maß ändert nur diese Wand, die nächste Wand ohne Maß gleicht aus. Passen Maße nicht zusammen, fragt die App: Maß 1 verwenden, Maß 2 verwenden, Geometrie anpassen (eine Wand ohne Maß wird schräg) oder Maße überprüfen. Gemessene Maße stehen blau. Unter „Maße“ stehen alle Wände mit Länge und Maß.
3. **Auswahl:** Wand, Ecke, Tür oder Fenster antippen. Wände und Ecken lassen sich ziehen; eine Wand bekommt dort auch Länge, „Waagerecht“, „Senkrecht“, Winkel, „Ecke einfügen“ (so entsteht eine weitere Wand) und „Löschen“.
4. **Tür und Fenster:** auf eine Wand tippen. Tür: Breite (76, 88,5 oder 101 cm oder frei), Höhe, Anschlag links/rechts, öffnet nach innen/außen. Fenster: Breite, Höhe, Brüstung. Standard Tür 88,5 × 201 cm, Fenster 120 × 120 cm mit 90 cm Brüstung.
5. **Einstellungen:** Raumname, Raumhöhe (Standard 2,50 m), Raster 10/20/50 cm oder 1 m, Türen und Fenster bei der Wandfläche alle abziehen (Standard) oder bis 2,5 m² übermessen, Toleranzen fürs Ausrichten, Grundriss als SVG oder DXF (CAD) teilen. Hier stehen auch alle Werte: Boden, Decke, Umfang, Wandfläche brutto, Tür- und Fensterflächen, Wandfläche netto.

**Kniestock und Dachschräge:** Mit „Auswahl“ die Wand antippen, an der das Dach herunterkommt, dann „Dachschräge“. Den Kniestock eingeben (Wandhöhe bis dort, wo die Schräge beginnt) und die Schräge auf eine von drei Arten: Neigung in Grad, Tiefe (waagerecht von der Wand bis dort, wo die Decke flach wird) oder Länge der Schräge selbst. Die Raumhöhe in den Einstellungen ist dann die Höhe der flachen Decke oder des Firsts. Schrägen an zwei gegenüberliegenden Wänden ergeben ein Satteldach, an allen Wänden ein Walmdach; die Giebelwände rechnet die App selbst aus. Im Grundriss ist die Schräge dunkler, die Knicklinie gestrichelt. Mit „Dachfenster einsetzen“ an derselben Wand kommt ein Dachfenster (Standard 78 × 118 cm) in die Schräge; Breite, Länge in der Schräge und Abstand vom Kniestock lassen sich ändern, die Fläche wird von der Schräge abgezogen. Mit Schräge werden die Positionen „Deckenfläche (waagerecht)“ und „Dachschräge“, die Wandfläche steht dann Wand für Wand (Kniestockwand Länge × Kniestock, Giebelwand mit ihrer Fläche). Liegt ein Fenster oder eine Tür zu hoch für die Schräge, warnt die App beim Übernehmen.

Zoomen mit zwei Fingern oder dem Mausrad, Verschieben mit zwei Fingern (am Computer: mit rechter Maustaste ziehen oder in „Auswahl“ auf leerer Fläche). „Alles zeigen“ holt den ganzen Raum ins Bild. Rückgängig und Wiederholen gehen für alle Schritte. „Übernehmen“ prüft vorher den Raum (geschlossen, keine sich kreuzenden Wände, Maßstab gesetzt, Türen und Fenster passen in ihre Wand). Danach stehen Bodenfläche, Deckenfläche, Wandfläche (Umfang × Höhe minus Türen und Fenster) und Umfang als Positionen im Aufmaß, und der Grundriss kommt maßstäblich (z. B. 1:50) mit allen Werten ins PDF. Über den Stift auf der Karte lässt sich der Raum später ändern.

## Stunden, Baustellen und Personal

**Stunden:** Jeder führt seinen eigenen Stundennachweis pro Monat. Ein neuer Eintrag startet mit dem heutigen Datum, Beginn 7:00 und Ende 16:00; Art, Baustelle und Art der Arbeit werden selbst gewählt. Beginn und Ende werden mit der Uhr des Handys gewählt; die Minuten werden auf 5-Minuten-Schritte gerundet. Gespeichert werden kann erst, wenn Arbeit, Urlaub, Krank, Feiertag oder Berufsschule gewählt ist; bei Arbeit zusätzlich Baustelle (auch Freitext) und Art der Arbeit, bei Arbeit und Berufsschule Beginn und Ende. Die Pause ist erst Pflicht, wenn zwischen Beginn und Ende mehr als 6 Stunden liegen; bis 6 Stunden darf sie leer bleiben und zählt als 0 Minuten. Der Monat wird als Stundennachweis-PDF geteilt und im Repo unter stunden/ gespeichert. Das PDF passt immer auf eine Seite (bei vielen Einträgen wird die Schrift kleiner) und hat keine Unterschriftszeilen und keine Fußzeile. Mitarbeiter sehen nur ihre eigenen Stunden, der Admin kann jeden Mitarbeiter auswählen. Wer auf mehreren Geräten angemeldet ist (z. B. Handy und PC), sieht und bearbeitet seine Stunden auf allen; der Admin kann die Stunden aller Mitarbeiter ändern und löschen. Ist ein Eintrag auf zwei Geräten verschieden, gilt die letzte Änderung; gelöschte Einträge kommen nicht zurück.

**Baustellen:** Liste aller Baustellen mit Adresse. Anlegen und ändern darf jeder; fertige Baustellen werden oben als abgeschlossen markiert und wandern nach unten. Löschen darf nur der Admin. Auf der Seite einer Baustelle stehen ihre Berichte, der Knopf für die Zusammenfassung und **Pläne und Dokumente**: PDF-Pläne, Bilder oder andere Dateien bis 25 MB anhängen (nachdem die Baustelle gespeichert ist). Sie kommen beim Abgleich auf alle Handys (im Repo unter stammdaten/plaene/). Anhängen darf jeder, entfernen nur der Admin.

**Personal:** In den Einstellungen unter „Personal verwalten“: Name und Kategorie (Meister, Facharbeiter, Helfer, Lehrling). Anlegen darf jeder, löschen nur der Admin.

Baustellen und Personal werden über das Repo auf allen Handys gleich gehalten. Bei gleichzeitigen Änderungen gewinnt die neuere.

## Abgleich, Zusammenfassung und Sprachen

**Abgleich:** Die Wolke oben rechts gleicht sofort ab; mit „Automatisch hochladen“ passiert das nach jeder Änderung von selbst. Hochgeladen werden Berichte (bericht.md, bericht.json, bericht.pdf, Fotos), Stunden und Stammdaten. Zurück aufs Handy kommen beim Admin alle Berichte aller Mitarbeiter (markiert „von Name“), bei Mitarbeitern nur die eigenen, z. B. nach einem Handywechsel. Noch nicht hochgeladene Änderungen auf dem Handy gehen immer vor.

**Zusammenfassung:** Das Dokument-Symbol oben in der Berichtsliste (oder der Knopf auf einer Baustelle) erstellt ein Sammel-PDF: Baustelle, Art (Tagesbericht, Rapport oder beide) und Zeitraum wählen. Es enthält eine Übersicht, Stunden nach Kategorie, Maschinenstunden, eine Materialliste und alle Berichte. Es zählt nur Berichte, die auf diesem Handy liegen; der Admin hat nach dem Abgleich alle.

**Sprachen:** Die Oberfläche gibt es auf Deutsch, Polnisch, Rumänisch, Mazedonisch und Albanisch (umstellbar in den Einstellungen). Freitexte wie Arbeiten, Material, Bemerkungen und Bildtexte werden beim Hochladen automatisch ins Deutsche übersetzt. Repo, PDF und Admin bekommen Deutsch, der Verfasser sieht weiter sein Original. Die Übersetzungen der Oberfläche sind noch nicht von Muttersprachlern geprüft.

**Ansicht:** In den Einstellungen unter Allgemein wählst du „Automatisch“ (wie das Handy oder der Computer eingestellt ist), „Hell“ oder „Dunkel“. Die Wahl gilt nur für dieses Gerät und gilt sofort, auch in der Desktop-Version im Browser.

## Administrator

Der Admin wird mit einer PIN angemeldet (Einstellungen, „Als Administrator anmelden“); beim allerersten Mal legt er die PIN fest. Nur Admins dürfen:

- Baustellen und Personal löschen
- die Stunden aller Mitarbeiter sehen und bearbeiten
- alle Berichte aller Mitarbeiter aufs Handy holen
- die gesperrten GitHub-Felder entsperren

**Wer hat die App eingerichtet?** (Einstellungen, Bereich Administrator): Liste aller Handys mit Name, iPhone oder Android, Sprache, App-Version und ob die App installiert ist. Darunter stehen die Leute aus der Personal-Liste, die sich noch nicht gemeldet haben. Der Name muss zu mindestens 90 % übereinstimmen. Ein Handy erscheint, sobald dort der Token eingetragen ist und einmal abgeglichen wurde. Ein Zeitpunkt der letzten Nutzung wird bewusst nicht gespeichert.

**Admins vergeben:** In derselben Liste hat jedes Mitarbeiter-Handy einen Schalter „Administrator“. Ein- oder Ausschalten wirkt beim nächsten Abgleich auf dem Handy des Mitarbeiters. So freigegebene Admins können sich nicht selbst abmelden und keine weiteren Admins vergeben. Eine neue PIN lässt die Freigaben bestehen.

## Updates, Datenschutz und Grenzen

**Updates kommen von selbst:** Beim Öffnen lädt die App eine neue Version im Hintergrund und lädt sich neu, sobald niemand gerade einen Bericht bearbeitet. Die Version steht unten in den Einstellungen. Dort öffnet „Handbuch zur App“ dieses Handbuch direkt in der App, auch ohne Netz (immer auf Deutsch).

**Gut zu wissen:**

- Jeder Mitarbeiter-Token darf das ganze Repo Rapporte- lesen. Die Trennung „nur eigene Berichte“ gilt nur in der App, nicht für jemanden, der den Token außerhalb der App benutzt.
- Den Token nie in Chats oder Mails weitergeben. Er bleibt auf dem Handy.
- Daten liegen auf dem Handy und im privaten Repo, nicht auf fremden Servern; nur Freitexte anderer Sprachen gehen zum Übersetzen an den Dienst MyMemory.
- In PDFs werden Buchstaben, die die PDF-Schrift nicht kennt (z. B. Ū, polnisches ł, rumänisches ș), durch den normalen Buchstaben ersetzt (U, l, s). Im Repo und in der App bleibt der Text, wie er eingegeben wurde.
- Ohne Abgleich liegen Berichte nur auf dem Handy. Bei Verlust des Handys sind nicht hochgeladene Berichte weg.

## Änderungsverlauf

| Datum | Version | Änderung |
| --- | --- | --- |
| 05.10.2026 | 1.44.0 | Raumaufmaß: Kniestock und Dachschräge je Wand (Neigung, Tiefe oder Länge der Schräge), Satteldach und Walmdach, Giebelwände automatisch, Dachfenster; Positionen Decke waagerecht und Dachschräge, Wände einzeln |
| 05.10.2026 | 1.43.0 | Raumaufmaß: Raum frei skizzieren, die App erkennt gerade Wände; Maßstab über ein echtes Maß, Wände und Ecken bearbeiten, Türen und Fenster, Raumhöhe; Boden, Decke, Wände und Umfang als Positionen, Grundriss maßstäblich im PDF, Export SVG und DXF |
| 05.10.2026 | 1.42.0 | Foto-Aufmaß: Ecken-Magnet (Ecken rasten an Ecken im Foto ein) und Öffnung erkennen per Antippen, beides auf dem Handy ohne Internet |
| 04.10.2026 | 1.41.2 | Uhrzeit wieder mit der Uhr des Handys (Stunden- und Minuten-Rad); Minuten werden auf 5er-Schritte gerundet |
| 04.10.2026 | 1.41.1 | Uhrzeit-Felder sehen wieder aus wie vorher (ein Feld), Minuten weiter in 5er-Schritten |
| 04.10.2026 | 1.41.0 | Tagesbericht und Rapport: Personal-Zeiten in 5-Minuten-Schritten, erste Person mit 7:00 bis 16:00 vorbelegt |
| 04.10.2026 | 1.40.0 | Stunden: Beginn und Ende als Stunde und Minute in 5-Minuten-Schritten; neuer Eintrag mit 7:00 bis 16:00 vorbelegt |
| 04.10.2026 | 1.39.4 | Foto-Aufmaß: Rein- und Rauszoomen läuft flüssig (Foto wird erst nach dem Zoomen neu gezeichnet) |
| 04.10.2026 | 1.39.3 | iPhone: Leiste mit Abbrechen/Speichern bleibt unten fest, auch nach dem Schließen der Tastatur; solange die Tastatur offen ist, ist sie ausgeblendet |
| 04.10.2026 | 1.39.2 | iPhone: Seite bleibt mittig, nur noch hoch und runter scrollen; Datumsfeld nicht mehr zu breit |
| 04.10.2026 | 1.39.1 | Speichern hängt nicht mehr (Meldung statt Warten, doppeltes Tippen abgefangen); App nicht mehr zoombar oder seitlich schiebbar; PDF-Vorschau mit + und − |
| 04.10.2026 | 1.39.0 | Handbuch in der App (Einstellungen › Handbuch zur App) statt der Token-Anleitung |
| 04.10.2026 | 1.38.1 | iPhone: leere Fotos und Pläne verhindert (Fotos sofort sichern, weniger Bildspeicher); leere Anhänge zeigen „Leer, bitte löschen und neu aufnehmen“ |
| 04.10.2026 | 1.38.0 | Im Plan direkt Foto aufnehmen oder vom Handy wählen; Pläne als Bild (PNG/JPG) im Bericht wieder wählbar |
| 04.10.2026 | 1.37.0 | Pläne scharf beim Zoomen, Strichstärke Dünn/Mittel/Dick oder Schieber, Hand zum Verschieben |
| 03.10.2026 | 1.36.0 | Pläne an Baustellen, im Bericht markieren (Flächen, Zoom), Fotos als nummerierte Pins auf dem Plan |
| 03.10.2026 | 1.35.0 | Aufmaß: Laibungen immer in lfm, Öffnungen mit Breite × Höhe |
| 03.10.2026 | 1.34.0 | Ansicht hell, dunkel oder automatisch in den Einstellungen |
| 03.10.2026 | 1.33.0 | Foto-Aufmaß: langes Antippen zum Verschieben entfernt, verschoben wird nur am blauen Punkt |
| 03.10.2026 | 1.32.0 | Foto-Aufmaß: blauer Schiebepunkt unter dem gewählten Teil zum Verschieben |
| 03.10.2026 | 1.31.0 | Foto-Aufmaß: Teile kopieren (z. B. gleiche Fenster), Verschieben maßhaltig |
| 03.10.2026 | 1.30.1 | Pause erst ab mehr als 6 Stunden Pflicht |
| 03.10.2026 | 1.30.0 | Neuer Stunden-Eintrag startet leer; Art, Baustelle, Art der Arbeit, Beginn, Ende und Pause sind Pflicht |
| 03.10.2026 | 1.29.1 | PDFs: Sonderzeichen wie Ū, ł, ș werden ersetzt statt die Zeile zu zerschießen |
| 03.10.2026 | 1.29.0 | Stunden auf mehreren Geräten (Handy und PC) bearbeiten; Admin kann alle Stunden ändern |
| 03.10.2026 | 1.28.0 | Stundennachweis-PDF immer auf einer Seite, ohne Unterschrift und Fußzeile |
| 03.10.2026 | 1.27.0 | Aufmaß-PDF: je Fenster/Tür Umlauf, 2 × Laibung und 1 × Sturz; Abzugszeilen mit Namen |
| 03.10.2026 | 1.26.0 | Foto-Aufmaß: lange antippen wählt ein Teil zum Verschieben oder Löschen; Länge/Höhe grau, wenn der Rahmen fertig ist |
| 03.10.2026 | 1.25.0 | Foto-Aufmaß: Formen werden fertig abgesteckt und über die Eckpunkte angepasst; Zoom-Knöpfe, Verschieben mit einem Finger |
| 03.10.2026 | 1.24.0 | Foto-Aufmaß: Perspektiv-Rahmen entzerrt schräge Fotos, Zwei-Finger-Zoom |
| 02.10.2026 | 1.23.0 | Foto-Aufmaß: Raster über dem Foto (mit Fangen) und Fadenkreuz-Fenster zum exakten Setzen der Punkte |
| 02.10.2026 | 1.22.0 | Foto-Aufmaß: Referenzmaße im Foto, Flächen, Öffnungen und Strecken markieren, Abzüge nach VOB/C, Laibungen |
| 02.10.2026 | 1.21.0 | Neuer Reiter Aufmaß nach dem Papierformular: Positionen mit Messzeilen, Abzügen, Netto, Summen, Fotos und Unterschrift |
| 02.10.2026 | 1.20.0 | Zurück-Pfeil auf jeder Ebene |
| 02.10.2026 | 1.19.0 | Fotos markieren (Stift, Pfeil, Kreis, Rechteck, Text) und Text zum Bild |
| 02.10.2026 | 1.18.0 | Admin-Rechte vom Chef-Handy aus vergeben und entziehen |
| 02.10.2026 | 1.17.0 – 1.17.2 | Übersicht „Wer hat die App eingerichtet?“, ohne „zuletzt aktiv“, Namensvergleich 90 % |
| 02.10.2026 | 1.16.1 | Video- und PDF-Links öffnen sich wieder richtig; Video und Bild-Anleitung (Deutsch, Rumänisch) |
| 01.10.2026 | 1.16.0 | Baustelle als Freitext, Art der Arbeit (Gerüstbau, Putz, Malerarbeiten, Trockenbau) |
| 01.10.2026 | 1.15.x | GitHub-Felder gesperrt, automatische Updates, kleinere Löschknöpfe |
| 01.10.2026 | 1.14.0 | Mehrsprachig mit automatischer Übersetzung ins Deutsche |
| 01.10.2026 | 1.13.0 | PDF erst als Vorschau, dann teilen oder speichern |
| 01.10.2026 | 1.12.0 | Admin holt alle Berichte der Mitarbeiter aufs Handy |
| 01.10.2026 | 1.11.0 | Zusammenfassungs-PDF |
| 01.10.2026 | 1.10.0 | Admin-PIN, Stunden, Stammdaten im Repo |

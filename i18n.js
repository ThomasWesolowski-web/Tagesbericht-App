// Sprachen der Oberfläche. Der Code bleibt deutsch; angezeigte Texte werden beim Rendern
// übersetzt (Textknoten, Platzhalter, Hinweise, Rückfragen). Berichte und PDFs bleiben deutsch.

export const SPRACHEN = [
  { id: 'de', name: 'Deutsch', flagge: '🇩🇪', deutsch: 'Deutsch' },
  { id: 'pl', name: 'Polski', flagge: '🇵🇱', deutsch: 'Polnisch' },
  { id: 'ro', name: 'Română', flagge: '🇷🇴', deutsch: 'Rumänisch' },
  { id: 'mk', name: 'Македонски', flagge: '🇲🇰', deutsch: 'Mazedonisch' },
  { id: 'sq', name: 'Shqip', flagge: '🇦🇱', deutsch: 'Albanisch' },
];

const ORDER = ['pl', 'ro', 'mk', 'sq'];

// [Deutsch, Polnisch, Rumänisch, Mazedonisch, Albanisch]
const ROWS = [
  // Navigation und Liste
  ['Tagesberichte', 'Raporty dzienne', 'Rapoarte zilnice', 'Дневни извештаи', 'Raportet ditore'],
  ['Berichte', 'Raporty', 'Rapoarte', 'Извештаи', 'Raportet'],
  ['Baustellen', 'Budowy', 'Șantiere', 'Градилишта', 'Kantieret'],
  ['Stunden', 'Godziny', 'Ore', 'Часови', 'Orët'],
  ['Einstellungen', 'Ustawienia', 'Setări', 'Поставки', 'Cilësimet'],
  ['Fehler', 'Błąd', 'Eroare', 'Грешка', 'Gabim'],
  ['Nur lokal', 'Tylko lokalnie', 'Doar local', 'Само локално', 'Vetëm lokalisht'],
  ['Offen', 'Niewysłany', 'Netrimis', 'Неиспратено', 'Pa dërguar'],
  ['Hochgeladen', 'Wysłany', 'Trimis', 'Испратено', 'Dërguar'],
  ['Noch keine Berichte', 'Brak raportów', 'Încă nu există rapoarte', 'Сè уште нема извештаи', 'Ende nuk ka raporte'],
  ['Lege deinen ersten Tagesbericht an. Er wird sofort auf dem Handy gespeichert, auch ohne Netz.',
    'Utwórz swój pierwszy raport dzienny. Zostanie od razu zapisany w telefonie, także bez internetu.',
    'Creează primul tău raport zilnic. Se salvează imediat pe telefon, chiar și fără internet.',
    'Направи го твојот прв дневен извештај. Веднаш се зачувува на телефонот, дури и без интернет.',
    'Krijo raportin tënd të parë ditor. Ruhet menjëherë në telefon, edhe pa internet.'],
  ['Ersten Bericht anlegen', 'Utwórz pierwszy raport', 'Creează primul raport', 'Направи прв извештај', 'Krijo raportin e parë'],
  ['Stunden diese Woche', 'Godziny w tym tygodniu', 'Ore săptămâna aceasta', 'Часови оваа недела', 'Orë këtë javë'],
  ['Neuer Bericht', 'Nowy raport', 'Raport nou', 'Нов извештај', 'Raport i ri'],
  ['Nichts gefunden.', 'Nic nie znaleziono.', 'Nu s-a găsit nimic.', 'Ништо не е пронајдено.', 'Nuk u gjet asgjë.'],
  ['Tagesbericht', 'Raport dzienny', 'Raport zilnic', 'Дневен извештај', 'Raport ditor'],
  ['Rapport', 'Raport robót', 'Raport de lucru', 'Работен извештај', 'Raport pune'],
  ['Rapporte', 'Raporty robót', 'Rapoarte de lucru', 'Работни извештаи', 'Raporte pune'],
  ['Als App auf dem Home-Bildschirm funktioniert alles am besten, auch offline.',
    'Jako aplikacja na ekranie głównym wszystko działa najlepiej, także offline.',
    'Ca aplicație pe ecranul principal totul merge cel mai bine, și offline.',
    'Како апликација на почетниот екран сè работи најдобро, и без интернет.',
    'Si aplikacion në ekranin kryesor gjithçka punon më mirë, edhe pa internet.'],
  ['Tippe in Safari auf', 'W Safari dotknij', 'În Safari atinge', 'Во Safari допри', 'Në Safari prek'],
  ['Teilen', 'Udostępnij', 'Partajează', 'Сподели', 'Ndaj'],
  ['und dann', 'a potem', 'apoi', 'а потоа', 'pastaj'],
  ['„Zum Home-Bildschirm“', '„Do ekranu początkowego“', '„Adaugă pe ecranul principal“', '„Додај на почетен екран“', '„Shto në ekranin bazë“'],
  ['Öffne das Browser-Menü und wähle', 'Otwórz menu przeglądarki i wybierz', 'Deschide meniul browserului și alege', 'Отвори го менито на прелистувачот и избери', 'Hap menunë e shfletuesit dhe zgjidh'],
  ['„App installieren“', '„Zainstaluj aplikację“', '„Instalează aplicația“', '„Инсталирај апликација“', '„Instalo aplikacionin“'],
  ['oder', 'lub', 'sau', 'или', 'ose'],
  ['„Zum Startbildschirm hinzufügen“', '„Dodaj do ekranu głównego“', '„Adaugă pe ecranul de pornire“', '„Додај на почетен екран“', '„Shto në ekranin bazë“'],
  ['Jetzt installieren', 'Zainstaluj teraz', 'Instalează acum', 'Инсталирај сега', 'Instalo tani'],

  // Bericht
  ['Allgemein', 'Ogólne', 'General', 'Општо', 'Të përgjithshme'],
  ['Datum', 'Data', 'Data', 'Датум', 'Data'],
  ['Baustelle', 'Budowa', 'Șantier', 'Градилиште', 'Kantieri'],
  ['Auftragsnummer', 'Numer zlecenia', 'Număr comandă', 'Број на налог', 'Numri i porosisë'],
  ['Personal und Arbeitszeit', 'Pracownicy i czas pracy', 'Personal și timp de lucru', 'Персонал и работно време', 'Personeli dhe orari i punës'],
  ['Abrechnung', 'Rozliczenie', 'Decontare', 'Наплата', 'Faturimi'],
  ['Maschinen und Fahrzeuge', 'Maszyny i pojazdy', 'Utilaje și vehicule', 'Машини и возила', 'Makineri dhe automjete'],
  ['Wetter', 'Pogoda', 'Vreme', 'Време', 'Moti'],
  ['Temperatur (°C)', 'Temperatura (°C)', 'Temperatură (°C)', 'Температура (°C)', 'Temperatura (°C)'],
  ['Ausgeführte Arbeiten', 'Wykonane prace', 'Lucrări executate', 'Изведени работи', 'Punët e kryera'],
  ['Material und Geräte', 'Materiał i sprzęt', 'Material și echipamente', 'Материјал и опрема', 'Materiali dhe pajisjet'],
  ['Bemerkungen', 'Uwagi', 'Observații', 'Забелешки', 'Vërejtje'],
  ['Unterschrift Bauherr', 'Podpis inwestora', 'Semnătura beneficiarului', 'Потпис на инвеститорот', 'Nënshkrimi i investitorit'],
  ['Fotos und Dokumente', 'Zdjęcia i dokumenty', 'Fotografii și documente', 'Фотографии и документи', 'Foto dhe dokumente'],
  ['Fotos werden automatisch verkleinert. Dateien bis 25 MB.',
    'Zdjęcia są automatycznie zmniejszane. Pliki do 25 MB.',
    'Fotografiile sunt micșorate automat. Fișiere de până la 25 MB.',
    'Фотографиите автоматски се намалуваат. Датотеки до 25 MB.',
    'Fotot zvogëlohen automatikisht. Skedarë deri në 25 MB.'],
  ['Abbrechen', 'Anuluj', 'Anulează', 'Откажи', 'Anulo'],
  ['Speichern', 'Zapisz', 'Salvează', 'Зачувај', 'Ruaj'],
  ['Gesamt', 'Razem', 'Total', 'Вкупно', 'Gjithsej'],
  ['Ändern', 'Zmień', 'Schimbă', 'Промени', 'Ndrysho'],
  ['Baustelle auswählen', 'Wybierz budowę', 'Alege șantierul', 'Избери градилиште', 'Zgjidh kantierin'],
  ['oder neue Baustelle erstellen', 'lub utwórz nową budowę', 'sau creează un șantier nou', 'или направи ново градилиште', 'ose krijo kantier të ri'],
  ['Was möchtest du erstellen?', 'Co chcesz utworzyć?', 'Ce vrei să creezi?', 'Што сакаш да направиш?', 'Çfarë dëshiron të krijosh?'],
  ['Maschine / Fahrzeug', 'Maszyna / pojazd', 'Utilaj / vehicul', 'Машина / возило', 'Makinë / automjet'],
  ['Neu signieren', 'Podpisz ponownie', 'Semnează din nou', 'Потпиши повторно', 'Nënshkruaj përsëri'],
  ['Entfernen', 'Usuń', 'Elimină', 'Отстрани', 'Hiq'],
  ['Der Bauherr bestätigt den Rapport mit dem Finger.', 'Inwestor potwierdza raport palcem.', 'Beneficiarul confirmă raportul cu degetul.', 'Инвеститорот го потврдува извештајот со прст.', 'Investitori e konfirmon raportin me gisht.'],
  ['Unterschreiben lassen', 'Poproś o podpis', 'Cere semnătura', 'Побарај потпис', 'Merr nënshkrimin'],
  ['Hier unterschreiben', 'Podpisz tutaj', 'Semnează aici', 'Потпиши тука', 'Nënshkruaj këtu'],
  ['Beginn', 'Początek', 'Început', 'Почеток', 'Fillimi'],
  ['Ende', 'Koniec', 'Sfârșit', 'Крај', 'Mbarimi'],
  ['Pause', 'Przerwa', 'Pauză', 'Пауза', 'Pushim'],
  ['Min.', 'min', 'min', 'мин', 'min'],
  ['Zeiten der ersten Person für alle übernehmen', 'Przenieś godziny pierwszej osoby na wszystkich', 'Preia orele primei persoane pentru toți', 'Примени ги времињата на првата личност за сите', 'Përdor oraret e personit të parë për të gjithë'],
  ['Noch kein Personal ausgewählt.', 'Nie wybrano jeszcze pracowników.', 'Nu ai ales încă personal.', 'Сè уште нема избран персонал.', 'Ende nuk është zgjedhur personel.'],
  ['Nur auf dem Handy', 'Tylko w telefonie', 'Doar pe telefon', 'Само на телефонот', 'Vetëm në telefon'],
  ['Wird hochgeladen …', 'Wysyłanie …', 'Se trimite …', 'Се испраќа …', 'Po dërgohet …'],
  ['Upload-Fehler', 'Błąd wysyłania', 'Eroare la trimitere', 'Грешка при испраќање', 'Gabim gjatë dërgimit'],
  ['Noch nicht hochgeladen', 'Jeszcze nie wysłano', 'Încă netrimis', 'Сè уште не е испратено', 'Ende i padërguar'],
  ['Personal hinzufügen', 'Dodaj pracowników', 'Adaugă personal', 'Додај персонал', 'Shto personel'],
  ['Andere Maschine', 'Inna maszyna', 'Alt utilaj', 'Друга машина', 'Makinë tjetër'],
  ['Kamera', 'Aparat', 'Cameră', 'Камера', 'Kamera'],
  ['Datei', 'Plik', 'Fișier', 'Датотека', 'Skedar'],
  ['Als PDF teilen', 'Udostępnij jako PDF', 'Trimite ca PDF', 'Сподели како PDF', 'Ndaj si PDF'],
  ['Bericht löschen', 'Usuń raport', 'Șterge raportul', 'Избриши извештај', 'Fshi raportin'],
  ['Neuer Bericht mit diesen Angaben', 'Nowy raport z tymi danymi', 'Raport nou cu aceste date', 'Нов извештај со овие податоци', 'Raport i ri me këto të dhëna'],
  ['Jetzt hochladen', 'Wyślij teraz', 'Trimite acum', 'Испрати сега', 'Dërgo tani'],
  ['Was wurde heute gemacht?', 'Co dziś zrobiono?', 'Ce s-a făcut azi?', 'Што е направено денес?', 'Çfarë u bë sot?'],
  ['Verbrauchtes Material, eingesetzte Maschinen …', 'Zużyty materiał, użyte maszyny …', 'Material consumat, utilaje folosite …', 'Потрошен материјал, користени машини …', 'Materiali i përdorur, makineritë …'],
  ['Behinderungen, Mängel, Absprachen, besondere Vorkommnisse …', 'Utrudnienia, usterki, ustalenia, zdarzenia …', 'Impedimente, defecte, înțelegeri, evenimente …', 'Пречки, недостатоци, договори, настани …', 'Pengesa, defekte, marrëveshje, ngjarje …'],
  ['z. B. Bagger', 'np. koparka', 'ex. excavator', 'на пр. багер', 'p.sh. eskavator'],
  ['Maschine entfernen', 'Usuń maszynę', 'Elimină utilajul', 'Отстрани машина', 'Hiq makinën'],
  ['Regie', 'Godzinowo', 'În regie', 'Режиски', 'Në regji'],
  ['Pauschal', 'Ryczałt', 'Forfetar', 'Паушално', 'Paushall'],
  ['Sonnig', 'Słonecznie', 'Însorit', 'Сончево', 'Me diell'],
  ['Bewölkt', 'Pochmurno', 'Înnorat', 'Облачно', 'Vranët'],
  ['Regen', 'Deszcz', 'Ploaie', 'Дожд', 'Shi'],
  ['Wind', 'Wiatr', 'Vânt', 'Ветер', 'Erë'],
  ['Schnee', 'Śnieg', 'Zăpadă', 'Снег', 'Borë'],
  ['Frost', 'Mróz', 'Îngheț', 'Мраз', 'Ngricë'],
  ['Meister', 'Mistrz', 'Maistru', 'Мајстор', 'Mjeshtër'],
  ['Facharbeiter', 'Fachowiec', 'Muncitor calificat', 'Квалификуван работник', 'Punëtor i kualifikuar'],
  ['Helfer', 'Pomocnik', 'Ajutor', 'Помошник', 'Ndihmës'],
  ['Lehrling', 'Uczeń', 'Ucenic', 'Ученик', 'Nxënës'],

  // Baustellen und Personal
  ['Noch keine Baustellen', 'Brak budów', 'Încă nu există șantiere', 'Сè уште нема градилишта', 'Ende nuk ka kantiere'],
  ['Lege deine Baustellen einmal an. Beim Bericht wählst du sie dann nur noch aus.', 'Dodaj swoje budowy raz. W raporcie tylko je wybierasz.', 'Adaugă șantierele o singură dată. În raport doar le alegi.', 'Внеси ги градилиштата еднаш. Во извештајот само ги избираш.', 'Shto kantieret një herë. Në raport vetëm i zgjedh.'],
  ['Aktiv', 'Aktywne', 'Active', 'Активни', 'Aktive'],
  ['Abgeschlossen', 'Zakończone', 'Finalizate', 'Завршени', 'Të përfunduara'],
  ['Name der Baustelle *', 'Nazwa budowy *', 'Numele șantierului *', 'Име на градилиштето *', 'Emri i kantierit *'],
  ['Adresse', 'Adres', 'Adresă', 'Адреса', 'Adresa'],
  ['Kunde / Bauherr', 'Klient / inwestor', 'Client / beneficiar', 'Клиент / инвеститор', 'Klienti / investitori'],
  ['Notizen', 'Notatki', 'Notițe', 'Белешки', 'Shënime'],
  ['Wird bei neuen Berichten nicht mehr angeboten', 'Nie będzie proponowana w nowych raportach', 'Nu mai apare la rapoarte noi', 'Нема да се нуди во нови извештаи', 'Nuk ofrohet më në raporte të reja'],
  ['Baustelle löschen', 'Usuń budowę', 'Șterge șantierul', 'Избриши градилиште', 'Fshi kantierin'],
  ['Löschen darf nur der Administrator. Fertige Baustellen kannst du oben als abgeschlossen markieren.',
    'Usuwać może tylko administrator. Gotowe budowy możesz oznaczyć u góry jako zakończone.',
    'Doar administratorul poate șterge. Șantierele terminate le poți marca sus ca finalizate.',
    'Само администраторот може да брише. Завршените градилишта можеш горе да ги означиш како завршени.',
    'Vetëm administratori mund të fshijë. Kantieret e mbaruara mund t’i shënosh lart si të përfunduara.'],
  ['Noch keine Baustellen gespeichert.', 'Nie zapisano jeszcze budów.', 'Încă nu ai salvat șantiere.', 'Сè уште нема зачувани градилишта.', 'Ende nuk ka kantiere të ruajtura.'],
  ['Neue Baustelle', 'Nowa budowa', 'Șantier nou', 'Ново градилиште', 'Kantier i ri'],
  ['Neue Baustelle erstellen', 'Utwórz nową budowę', 'Creează șantier nou', 'Направи ново градилиште', 'Krijo kantier të ri'],
  ['Baustelle suchen …', 'Szukaj budowy …', 'Caută șantier …', 'Барај градилиште …', 'Kërko kantierin …'],
  ['z. B. MFH Seestrasse', 'np. dom wielorodzinny Seestrasse', 'ex. bloc Seestrasse', 'на пр. зграда Seestrasse', 'p.sh. pallati Seestrasse'],
  ['Strasse, Ort', 'Ulica, miejscowość', 'Stradă, localitate', 'Улица, место', 'Rruga, vendi'],
  ['Ansprechpartner, Zugang, Besonderheiten …', 'Osoba kontaktowa, dojazd, szczegóły …', 'Persoană de contact, acces, detalii …', 'Контакт, пристап, посебности …', 'Kontakti, hyrja, veçoritë …'],
  ['Name *', 'Imię i nazwisko *', 'Nume *', 'Име *', 'Emri *'],
  ['Name', 'Imię i nazwisko', 'Nume', 'Име', 'Emri'],
  ['Kategorie', 'Kategoria', 'Categorie', 'Категорија', 'Kategoria'],
  ['Vor- und Nachname', 'Imię i nazwisko', 'Prenume și nume', 'Име и презиме', 'Emri dhe mbiemri'],
  ['Löschen', 'Usuń', 'Șterge', 'Избриши', 'Fshi'],
  ['Übernehmen', 'Zastosuj', 'Preia', 'Примени', 'Merr'],
  ['Personal auswählen', 'Wybierz pracowników', 'Alege personalul', 'Избери персонал', 'Zgjidh personelin'],
  ['Neue Person', 'Nowa osoba', 'Persoană nouă', 'Нова личност', 'Person i ri'],
  ['Neue Person anlegen', 'Dodaj nową osobę', 'Adaugă persoană nouă', 'Додај нова личност', 'Shto person të ri'],
  ['Personal', 'Pracownicy', 'Personal', 'Персонал', 'Personeli'],
  ['Noch kein Personal', 'Brak pracowników', 'Încă nu există personal', 'Сè уште нема персонал', 'Ende nuk ka personel'],
  ['Lege deine Leute einmal an. Im Bericht wählst du sie dann nur noch aus.', 'Dodaj swoich ludzi raz. W raporcie tylko ich wybierasz.', 'Adaugă oamenii o singură dată. În raport doar îi alegi.', 'Внеси ги твоите луѓе еднаш. Во извештајот само ги избираш.', 'Shto njerëzit e tu një herë. Në raport vetëm i zgjedh.'],
  ['Ausgeschieden', 'Nie pracuje', 'Plecat', 'Заминат', 'Larguar'],
  ['Wird im Bericht nicht mehr angeboten', 'Nie będzie proponowany w raporcie', 'Nu mai apare în raport', 'Нема да се нуди во извештајот', 'Nuk ofrohet më në raport'],
  ['Person löschen', 'Usuń osobę', 'Șterge persoana', 'Избриши личност', 'Fshi personin'],

  // Zusammenfassung und PDF
  ['Zusammenfassung als PDF', 'Podsumowanie jako PDF', 'Rezumat ca PDF', 'Резиме како PDF', 'Përmbledhje si PDF'],
  ['Alle Baustellen', 'Wszystkie budowy', 'Toate șantierele', 'Сите градилишта', 'Të gjitha kantieret'],
  ['Art', 'Rodzaj', 'Tip', 'Вид', 'Lloji'],
  ['Alle', 'Wszystkie', 'Toate', 'Сите', 'Të gjitha'],
  ['Zeitraum', 'Okres', 'Perioadă', 'Период', 'Periudha'],
  ['Gesamter Zeitraum', 'Cały okres', 'Toată perioada', 'Цел период', 'E gjithë periudha'],
  ['Dieser Monat', 'Ten miesiąc', 'Luna aceasta', 'Овој месец', 'Ky muaj'],
  ['Letzter Monat', 'Poprzedni miesiąc', 'Luna trecută', 'Минатиот месец', 'Muaji i kaluar'],
  ['Von', 'Od', 'De la', 'Од', 'Nga'],
  ['Bis', 'Do', 'Până la', 'До', 'Deri'],
  ['Enthält die Berichte, die auf diesem Handy gespeichert sind.', 'Zawiera raporty zapisane w tym telefonie.', 'Conține rapoartele salvate pe acest telefon.', 'Ги содржи извештаите зачувани на овој телефон.', 'Përmban raportet e ruajtura në këtë telefon.'],
  ['Keine Berichte in dieser Auswahl.', 'Brak raportów w tym wyborze.', 'Niciun raport în această selecție.', 'Нема извештаи во овој избор.', 'Asnjë raport në këtë përzgjedhje.'],
  ['PDF erstellen', 'Utwórz PDF', 'Creează PDF', 'Направи PDF', 'Krijo PDF'],
  ['PDF wird geladen …', 'Ładowanie PDF …', 'Se încarcă PDF …', 'Се вчитува PDF …', 'Po ngarkohet PDF …'],
  ['Teilen oder speichern', 'Udostępnij lub zapisz', 'Trimite sau salvează', 'Сподели или зачувај', 'Ndaj ose ruaj'],
  ['PDF ist fertig', 'PDF jest gotowy', 'PDF-ul este gata', 'PDF е готов', 'PDF është gati'],
  ['Ansehen', 'Pokaż', 'Vezi', 'Погледни', 'Shiko'],

  // Stunden
  ['Stundennachweis', 'Ewidencja godzin', 'Pontaj', 'Евиденција на часови', 'Evidenca e orëve'],
  ['Hier trägst du jeden Tag deine Arbeitsstunden ein. Wähle zuerst, für wen die Stunden gelten.',
    'Tutaj codziennie wpisujesz swoje godziny pracy. Najpierw wybierz, kogo dotyczą.',
    'Aici îți treci zilnic orele de lucru. Alege mai întâi pentru cine sunt orele.',
    'Тука секој ден ги внесуваш твоите работни часови. Прво избери за кого се часовите.',
    'Këtu shënon çdo ditë orët e tua të punës. Zgjidh fillimisht për kë janë orët.'],
  ['Stundennachweis für', 'Ewidencja godzin dla', 'Pontaj pentru', 'Евиденција на часови за', 'Evidenca e orëve për'],
  ['Arbeitstage', 'Dni pracy', 'Zile lucrate', 'Работни денови', 'Ditë pune'],
  ['Urlaub / Krank', 'Urlop / choroba', 'Concediu / boală', 'Одмор / боледување', 'Pushim / sëmurë'],
  ['Für diesen Monat ist noch nichts eingetragen.', 'W tym miesiącu nic jeszcze nie wpisano.', 'Pentru luna aceasta nu ai trecut încă nimic.', 'За овој месец сè уште нема ништо внесено.', 'Për këtë muaj ende nuk është shënuar asgjë.'],
  ['Stunden eintragen', 'Wpisz godziny', 'Trece orele', 'Внеси часови', 'Shëno orët'],
  ['Für wen sind die Stunden?', 'Dla kogo są godziny?', 'Pentru cine sunt orele?', 'За кого се часовите?', 'Për kë janë orët?'],
  ['Name eingeben', 'Wpisz imię', 'Introdu numele', 'Внеси име', 'Shkruaj emrin'],
  ['Arbeitszeit', 'Czas pracy', 'Timp de lucru', 'Работно време', 'Orari i punës'],
  ['Notiz', 'Notatka', 'Notă', 'Белешка', 'Shënim'],
  ['Baustelle wählen', 'Wybierz budowę', 'Alege șantierul', 'Избери градилиште', 'Zgjidh kantierin'],
  ['optional', 'opcjonalnie', 'opțional', 'опционално', 'opsionale'],
  ['optional, z. B. Fahrzeit, Überstunden', 'opcjonalnie, np. dojazd, nadgodziny', 'opțional, ex. drum, ore suplimentare', 'опционално, на пр. патување, прекувремено', 'opsionale, p.sh. udhëtimi, orë shtesë'],
  ['Mitarbeiter wählen', 'Wybierz pracownika', 'Alege angajatul', 'Избери вработен', 'Zgjidh punonjësin'],
  ['Monat als PDF teilen', 'Udostępnij miesiąc jako PDF', 'Trimite luna ca PDF', 'Сподели го месецот како PDF', 'Ndaj muajin si PDF'],
  ['Eintrag löschen', 'Usuń wpis', 'Șterge înregistrarea', 'Избриши внес', 'Fshi regjistrimin'],
  ['Vorheriger Monat', 'Poprzedni miesiąc', 'Luna anterioară', 'Претходен месец', 'Muaji i mëparshëm'],
  ['Nächster Monat', 'Następny miesiąc', 'Luna următoare', 'Следен месец', 'Muaji tjetër'],
  ['Arbeit', 'Praca', 'Lucru', 'Работа', 'Punë'],
  ['Urlaub', 'Urlop', 'Concediu', 'Одмор', 'Pushim'],
  ['Krank', 'Choroba', 'Boală', 'Боледување', 'Sëmurë'],
  ['Feiertag', 'Święto', 'Sărbătoare', 'Празник', 'Festë'],
  ['Berufsschule', 'Szkoła zawodowa', 'Școală profesională', 'Стручно училиште', 'Shkollë profesionale'],
  ['Ohne Baustelle', 'Bez budowy', 'Fără șantier', 'Без градилиште', 'Pa kantier'],

  // Einstellungen (was Mitarbeiter brauchen)
  ['Sprache', 'Język', 'Limbă', 'Јазик', 'Gjuha'],
  ['Personal verwalten', 'Zarządzaj pracownikami', 'Gestionează personalul', 'Управувај со персонал', 'Menaxho personelin'],
  ['Leute anlegen, die im Bericht ausgewählt werden', 'Dodaj osoby do wyboru w raporcie', 'Adaugă persoanele care se aleg în raport', 'Додај луѓе што се избираат во извештајот', 'Shto njerëzit që zgjidhen në raport'],
  ['Dein Name (steht im Bericht)', 'Twoje imię (widoczne w raporcie)', 'Numele tău (apare în raport)', 'Твоето име (стои во извештајот)', 'Emri yt (shfaqet në raport)'],
  ['Automatisch hochladen', 'Wysyłaj automatycznie', 'Trimite automat', 'Испраќај автоматски', 'Dërgo automatikisht'],
  ['Sobald Netz da ist, nach jeder Änderung', 'Po każdej zmianie, gdy jest internet', 'După fiecare modificare, când există internet', 'По секоја промена, кога има интернет', 'Pas çdo ndryshimi, kur ka internet'],
  ['Eingerichtet', 'Skonfigurowano', 'Configurat', 'Поставено', 'I konfiguruar'],
  ['Aus', 'Wył.', 'Oprit', 'Исклучено', 'Fikur'],
  ['Verbindung testen', 'Sprawdź połączenie', 'Testează conexiunea', 'Тестирај врска', 'Testo lidhjen'],
  ['Administrator', 'Administrator', 'Administrator', 'Администратор', 'Administratori'],
  ['Als Administrator anmelden', 'Zaloguj jako administrator', 'Autentificare ca administrator', 'Најави се како администратор', 'Hyr si administrator'],
  ['Abmelden', 'Wyloguj', 'Deconectare', 'Одјави се', 'Dil'],
  ['Speicher auf dem Handy', 'Pamięć w telefonie', 'Memorie pe telefon', 'Меморија на телефонот', 'Hapësira në telefon'],
  ['Wird berechnet …', 'Obliczanie …', 'Se calculează …', 'Се пресметува …', 'Po llogaritet …'],
  ['Vor automatischem Löschen geschützt', 'Chronione przed automatycznym usunięciem', 'Protejat împotriva ștergerii automate', 'Заштитено од автоматско бришење', 'I mbrojtur nga fshirja automatike'],
  ['Installiere die App auf dem Home-Bildschirm und richte den Sync ein, damit nichts verloren geht.',
    'Zainstaluj aplikację na ekranie głównym i skonfiguruj synchronizację, aby nic nie zginęło.',
    'Instalează aplicația pe ecranul principal și configurează sincronizarea, ca să nu se piardă nimic.',
    'Инсталирај ја апликацијата на почетниот екран и постави синхронизација за ништо да не се изгуби.',
    'Instalo aplikacionin në ekranin kryesor dhe konfiguro sinkronizimin që të mos humbasë asgjë.'],
  ['Deine Berichte liegen bisher nur auf diesem Handy.', 'Twoje raporty są na razie tylko w tym telefonie.', 'Rapoartele tale sunt deocamdată doar pe acest telefon.', 'Твоите извештаи засега се само на овој телефон.', 'Raportet e tua janë deri tani vetëm në këtë telefon.'],
  ['Sync einrichten', 'Skonfiguruj synchronizację', 'Configurează sincronizarea', 'Постави синхронизација', 'Konfiguro sinkronizimin'],
  [', damit sie auch im Repo gesichert werden.', ', aby były też zapisane w repozytorium.', ', ca să fie salvate și în repo.', ', за да се зачуваат и во репото.', ', që të ruhen edhe në repo.'],

  ['Als App auf dem Home-Bildschirm funktioniert alles am besten, auch offline. Tippe in Safari auf',
    'Jako aplikacja na ekranie głównym wszystko działa najlepiej, także offline. W Safari dotknij',
    'Ca aplicație pe ecranul principal totul merge cel mai bine, și offline. În Safari atinge',
    'Како апликација на почетниот екран сè работи најдобро, и без интернет. Во Safari допри',
    'Si aplikacion në ekranin kryesor gjithçka punon më mirë, edhe pa internet. Në Safari prek'],
  ['Änderungen speichern', 'Zapisz zmiany', 'Salvează modificările', 'Зачувај промени', 'Ruaj ndryshimet'],
  ['Baustelle speichern', 'Zapisz budowę', 'Salvează șantierul', 'Зачувај градилиште', 'Ruaj kantierin'],
  ['Ja', 'Tak', 'Da', 'Да', 'Po'],
  ['Nein', 'Nie', 'Nu', 'Не', 'Jo'],
  ['Sync aus', 'Synchronizacja wył.', 'Sincronizare oprită', 'Синхронизација исклучена', 'Sinkronizimi fikur'],
  ['nicht hochgeladen', 'niewysłane', 'netrimise', 'неиспратени', 'të padërguara'],
  ['Belegt von verfügbar', 'Zajęte z dostępnych', 'Ocupat din disponibil', 'Зафатено од достапно', 'E zënë nga e lirë'],
  ['Baustellen und Personal löschen und die Stunden aller Mitarbeiter sehen darf nur der Administrator.',
    'Usuwać budowy i pracowników oraz widzieć godziny wszystkich może tylko administrator.',
    'Doar administratorul poate șterge șantiere și personal și poate vedea orele tuturor.',
    'Само администраторот може да брише градилишта и персонал и да ги гледа часовите на сите.',
    'Vetëm administratori mund të fshijë kantiere dhe personel dhe të shohë orët e të gjithëve.'],

  ['Gesperrt, zum Ändern entsperren', 'Zablokowane – odblokuj, aby zmienić', 'Blocat – deblochează pentru a modifica', 'Заклучено – отклучи за промена', 'E kyçur – zhbllokoje për ta ndryshuar'],
  ['Fertig, wieder sperren', 'Gotowe, zablokuj ponownie', 'Gata, blochează din nou', 'Готово, заклучи повторно', 'Gati, kyçe përsëri'],
  ['Sync-Einstellungen entsperren', 'Odblokuj ustawienia synchronizacji', 'Deblochează setările de sincronizare', 'Отклучи поставки за синхронизација', 'Zhblloko cilësimet e sinkronizimit'],
  ['Nur mit der Administrator-PIN. Falsche Angaben können das Hochladen stoppen.', 'Tylko z PIN-em administratora. Błędne dane mogą zatrzymać wysyłanie.', 'Doar cu PIN-ul administratorului. Datele greșite pot opri trimiterea.', 'Само со PIN на администраторот. Погрешни податоци може да го запрат испраќањето.', 'Vetëm me PIN-in e administratorit. Të dhëna të gabuara mund ta ndalojnë dërgimin.'],
  ['Entsperren', 'Odblokuj', 'Deblochează', 'Отклучи', 'Zhblloko'],
  ['PIN', 'PIN', 'PIN', 'PIN', 'PIN'],

  ['Gerüstbau', 'Rusztowania', 'Schele', 'Скелиња', 'Skela'],
  ['Putz', 'Tynk', 'Tencuială', 'Малтер', 'Suva'],
  ['Malerarbeiten', 'Malowanie', 'Zugrăveli', 'Молерски работи', 'Lyerje'],
  ['Trockenbau', 'Sucha zabudowa', 'Gips-carton', 'Сува градба', 'Gips-karton'],
  ['Art der Arbeit', 'Rodzaj pracy', 'Tipul lucrării', 'Вид на работа', 'Lloji i punës'],
  ['Andere Arbeit (Freitext)', 'Inna praca (dowolny tekst)', 'Altă lucrare (text liber)', 'Друга работа (слободен текст)', 'Punë tjetër (tekst i lirë)'],
  ['Nur hier eintragen, ohne zu speichern', 'Wpisz tylko tutaj, bez zapisywania', 'Scrie doar aici, fără salvare', 'Внеси само тука, без зачувување', 'Shkruaj vetëm këtu, pa ruajtur'],
  ['Für kleine Baustellen: erscheint nur hier, nicht in der Baustellen-Liste.', 'Dla małych budów: pojawia się tylko tutaj, nie na liście budów.', 'Pentru șantiere mici: apare doar aici, nu în lista de șantiere.', 'За мали градилишта: се појавува само тука, не во листата.', 'Për kantiere të vogla: shfaqet vetëm këtu, jo në listën e kantiereve.'],
  ['z. B. Kleine Reparatur Müller', 'np. mała naprawa Müller', 'ex. reparație mică Müller', 'на пр. мала поправка Müller', 'p.sh. riparim i vogël Müller'],
  ['Nur in diesem Bericht', 'Tylko w tym raporcie', 'Doar în acest raport', 'Само во овој извештај', 'Vetëm në këtë raport'],
  ['Eintrag bearbeiten', 'Edytuj wpis', 'Editează înregistrarea', 'Уреди внес', 'Ndrysho regjistrimin'],

  // Allgemeine Knöpfe und Hinweise
  ['Baustelle, Arbeiten, Personal …', 'Budowa, prace, pracownicy …', 'Șantier, lucrări, personal …', 'Градилиште, работи, персонал …', 'Kantieri, punët, personeli …'],
  ['Hinweis schließen', 'Zamknij wskazówkę', 'Închide nota', 'Затвори напомена', 'Mbyll njoftimin'],
  ['Zurück', 'Wstecz', 'Înapoi', 'Назад', 'Prapa'],
  ['Mehr', 'Więcej', 'Mai mult', 'Повеќе', 'Më shumë'],
  ['Schließen', 'Zamknij', 'Închide', 'Затвори', 'Mbyll'],

  // Meldungen
  ['Bericht nicht gefunden.', 'Nie znaleziono raportu.', 'Raportul nu a fost găsit.', 'Извештајот не е пронајден.', 'Raporti nuk u gjet.'],
  ['Bitte zuerst eine Baustelle auswählen.', 'Najpierw wybierz budowę.', 'Alege mai întâi un șantier.', 'Прво избери градилиште.', 'Zgjidh fillimisht një kantier.'],
  ['Aufmaß', 'Obmiar', 'Măsurători', 'Мерење', 'Matjet'],
  ['Neues Aufmaß', 'Nowy obmiar', 'Măsurătoare nouă', 'Ново мерење', 'Matje e re'],
  ['Aufmaß gespeichert.', 'Obmiar zapisany.', 'Măsurătoare salvată.', 'Мерењето е зачувано.', 'Matja u ruajt.'],
  ['Aufmaß löschen', 'Usuń obmiar', 'Ștergeți măsurătoarea', 'Избриши мерење', 'Fshi matjen'],
  ['Position hinzufügen', 'Dodaj pozycję', 'Adăugați poziție', 'Додај позиција', 'Shto pozicion'],
  ['Position entfernen?', 'Usunąć pozycję?', 'Ștergeți poziția?', 'Да се отстрани позицијата?', 'Të hiqet pozicioni?'],
  ['Pos.', 'Poz.', 'Poz.', 'Поз.', 'Poz.'],
  ['Bezeichnung', 'Opis', 'Denumire', 'Опис', 'Përshkrimi'],
  ['Anzahl', 'Ilość', 'Număr', 'Број', 'Sasia'],
  ['Stk', 'szt.', 'buc.', 'парч.', 'copë'],
  ['− Abzug', '− Odliczenie', '− Scădere', '− Одбивање', '− Zbritje'],
  ['Noch kein Aufmaß', 'Brak obmiarów', 'Nicio măsurătoare încă', 'Сè уште нема мерење', 'Ende asnjë matje'],
  ['Stück', 'Sztuk', 'Bucăți', 'Парчиња', 'Copë'],
  ['Länge', 'Długość', 'Lungime', 'Должина', 'Gjatësia'],
  ['Breite', 'Szerokość', 'Lățime', 'Ширина', 'Gjerësia'],
  ['Höhe', 'Wysokość', 'Înălțime', 'Висина', 'Lartësia'],
  ['Auftraggeber', 'Zleceniodawca', 'Beneficiar', 'Нарачател', 'Porositësi'],
  ['Netto', 'Netto', 'Net', 'Нето', 'Neto'],
  ['Zeile', 'Wiersz', 'Rând', 'Ред', 'Rresht'],
  ['Meßgehalt', 'Wynik pomiaru', 'Rezultat', 'Резултат', 'Rezultati'],
  ['Lfd. Nr.', 'Lp.', 'Nr.', 'Бр.', 'Nr.'],
  ['z. B. Wand Nord, Fensterbank', 'np. ściana północna, parapet', 'ex. perete nord, glaf', 'на пр. северен ѕид, прозорска клупа', 'p.sh. muri verior, parvazi'],
  ['z. B. Putz außen', 'np. tynk zewnętrzny', 'ex. tencuială exterioară', 'на пр. надворешен малтер', 'p.sh. suva e jashtme'],
  ['Anerkannt (Unterschrift Auftraggeber)', 'Zatwierdzono (podpis zleceniodawcy)', 'Aprobat (semnătura beneficiarului)', 'Признаено (потпис на нарачателот)', 'Pranuar (nënshkrimi i porositësit)'],
  ['Der Auftraggeber erkennt das Aufmaß mit dem Finger an.', 'Zleceniodawca zatwierdza obmiar palcem.', 'Beneficiarul aprobă măsurătoarea cu degetul.', 'Нарачателот го признава мерењето со прст.', 'Porositësi e pranon matjen me gisht.'],
  ['Ansicht', 'Wygląd', 'Aspect', 'Изглед', 'Pamja'],
  ['Automatisch', 'Automatycznie', 'Automat', 'Автоматски', 'Automatike'],
  ['Hell', 'Jasny', 'Luminos', 'Светло', 'E çelët'],
  ['Dunkel', 'Ciemny', 'Întunecat', 'Темно', 'E errët'],
  ['Pläne und Dokumente', 'Plany i dokumenty', 'Planuri și documente', 'Планови и документи', 'Planet dhe dokumentet'],
  ['Plan oder Dokument anhängen', 'Dołącz plan lub dokument', 'Atașați plan sau document', 'Прикачи план или документ', 'Bashkëngjit plan ose dokument'],
  ['PDF-Pläne und Bilder lassen sich später im Tagesbericht markieren. Dateien bis 25 MB.', 'Plany PDF i zdjęcia można później oznaczać w raporcie dziennym. Pliki do 25 MB.', 'Planurile PDF și imaginile pot fi marcate ulterior în raportul zilnic. Fișiere până la 25 MB.', 'PDF плановите и сликите подоцна може да се означат во дневниот извештај. Датотеки до 25 MB.', 'Planet PDF dhe fotot mund të shënohen më vonë në raportin ditor. Skedarë deri në 25 MB.'],
  ['Pläne kannst du anhängen, sobald die Baustelle gespeichert ist.', 'Plany możesz dołączyć po zapisaniu budowy.', 'Puteți atașa planuri după ce șantierul este salvat.', 'Плановите може да ги прикачиш откако градилиштето ќе се зачува.', 'Planet mund t’i bashkëngjitësh pasi të ruhet kantieri.'],
  ['Noch keine Pläne angehängt.', 'Brak dołączonych planów.', 'Încă nu sunt planuri atașate.', 'Сè уште нема прикачени планови.', 'Ende nuk ka plane të bashkëngjitura.'],
  ['Pläne', 'Plany', 'Planuri', 'Планови', 'Planet'],
  ['Bearbeitete Flächen im Plan einzeichnen und Fotos als Pin an die Stelle setzen, an der sie entstanden sind.', 'Zaznacz na planie wykonane powierzchnie i umieść zdjęcia jako pinezki w miejscu, gdzie zostały zrobione.', 'Marcați pe plan suprafețele lucrate și puneți fotografiile ca pin în locul unde au fost făcute.', 'Означи ги обработените површини на планот и стави ги фотографиите како игла на местото каде што се направени.', 'Shëno në plan sipërfaqet e punuara dhe vendos fotot si gjilpërë në vendin ku janë bërë.'],
  ['Im Plan markieren', 'Oznacz na planie', 'Marcați pe plan', 'Означи на планот', 'Shëno në plan'],
  ['Welcher Plan?', 'Który plan?', 'Care plan?', 'Кој план?', 'Cili plan?'],
  ['Keine Fotos zugeordnet', 'Brak przypisanych zdjęć', 'Nicio fotografie atribuită', 'Нема доделени фотографии', 'Asnjë foto e caktuar'],
  ['Fläche', 'Powierzchnia', 'Suprafață', 'Површина', 'Sipërfaqe'],
  ['Tippe auf die Stelle im Plan, dann Foto aufnehmen oder auswählen.', 'Dotknij miejsca na planie, potem zrób lub wybierz zdjęcie.', 'Atingeți locul pe plan, apoi faceți sau alegeți o fotografie.', 'Допри го местото на планот, па фотографирај или избери фотографија.', 'Prek vendin në plan, pastaj bëj ose zgjidh një foto.'],
  ['Foto aufnehmen', 'Zrób zdjęcie', 'Faceți o fotografie', 'Фотографирај', 'Bëj foto'],
  ['Vorhandenes Foto', 'Istniejące zdjęcie', 'Fotografie existentă', 'Постоечка фотографија', 'Foto ekzistuese'],
  ['Foto wird angehängt …', 'Zdjęcie jest dołączane …', 'Fotografia se atașează …', 'Фотографијата се прикачува …', 'Fotoja po bashkëngjitet …'],
  ['Welches Foto ist hier entstanden?', 'Które zdjęcie zostało tu zrobione?', 'Ce fotografie a fost făcută aici?', 'Која фотографија е направена тука?', 'Cila foto është bërë këtu?'],
  ['Auf dem Plan zeigen', 'Pokaż na planie', 'Arătați pe plan', 'Покажи на планот', 'Shfaq në plan'],
  ['Plan angehängt.', 'Plan dołączony.', 'Plan atașat.', 'Планот е прикачен.', 'Plani u bashkëngjit.'],
  ['Der Plan ist auf diesem Handy noch nicht da. Bitte abgleichen.', 'Planu jeszcze nie ma na tym telefonie. Proszę zsynchronizować.', 'Planul nu este încă pe acest telefon. Vă rugăm sincronizați.', 'Планот сè уште го нема на овој телефон. Ве молиме синхронизирајте.', 'Plani nuk është ende në këtë telefon. Ju lutem sinkronizoni.'],
  ['Tippe auf die Stelle, an der ein Foto entstanden ist.', 'Dotknij miejsca, w którym zrobiono zdjęcie.', 'Atingeți locul unde a fost făcută o fotografie.', 'Допри го местото каде е направена фотографија.', 'Prek vendin ku është bërë një foto.'],
  ['Bearbeitete Fläche mit dem Finger umfahren. Zwei Finger zoomen.', 'Obrysuj palcem wykonaną powierzchnię. Dwa palce powiększają.', 'Încercuiți cu degetul suprafața lucrată. Cu două degete măriți.', 'Заокружи ја обработената површина со прст. Со два прста зумираш.', 'Rrethoje me gisht sipërfaqen e punuar. Me dy gishta zmadhon.'],
  ['Im Bericht sind noch keine Fotos. Erst Fotos aufnehmen, dann hier zuordnen.', 'W raporcie nie ma jeszcze zdjęć. Najpierw zrób zdjęcia, potem przypisz je tutaj.', 'În raport nu sunt încă fotografii. Faceți mai întâi fotografii, apoi atribuiți-le aici.', 'Во извештајот сè уште нема фотографии. Прво фотографирај, па додели ги тука.', 'Në raport nuk ka ende foto. Bëj fillimisht foto, pastaj caktoji këtu.'],
  ['Plan wird geladen …', 'Wczytywanie planu …', 'Se încarcă planul …', 'Планот се вчитува …', 'Plani po ngarkohet …'],
  ['Ganzer Plan', 'Cały plan', 'Planul întreg', 'Цел план', 'I gjithë plani'],
  ['Plan entfernen', 'Usuń plan', 'Ștergeți planul', 'Отстрани план', 'Hiq planin'],
  ['Hand', 'Ręka', 'Mână', 'Рака', 'Dora'],
  ['Dünn', 'Cienka', 'Subțire', 'Тенка', 'E hollë'],
  ['Mittel', 'Średnia', 'Mediu', 'Средна', 'Mesatare'],
  ['Strichstärke', 'Grubość linii', 'Grosimea liniei', 'Дебелина на линија', 'Trashësia e vijës'],
  ['Ganz zeigen', 'Pokaż całość', 'Arătați tot', 'Покажи цело', 'Shfaq të gjithë'],
  ['Mit einem Finger verschieben, mit zwei Fingern zoomen.', 'Przesuwaj jednym palcem, powiększaj dwoma.', 'Mutați cu un deget, măriți cu două degete.', 'Помести со еден прст, зумирај со два прста.', 'Lëviz me një gisht, zmadho me dy gishta.'],
  ['Bericht gespeichert.', 'Raport zapisany.', 'Raport salvat.', 'Извештајот е зачуван.', 'Raporti u ruajt.'],
  ['Unterschrift entfernen?', 'Usunąć podpis?', 'Ștergi semnătura?', 'Да се отстрани потписот?', 'Të hiqet nënshkrimi?'],
  ['PDF wird erstellt …', 'Tworzenie PDF …', 'Se creează PDF …', 'Се прави PDF …', 'Po krijohet PDF …'],
  ['Teilen hat nicht geklappt.', 'Udostępnianie nie powiodło się.', 'Trimiterea nu a reușit.', 'Споделувањето не успеа.', 'Ndarja nuk u krye.'],
  ['Bericht gelöscht.', 'Raport usunięty.', 'Raport șters.', 'Извештајот е избришан.', 'Raporti u fshi.'],
  ['Bitte einen Namen für die Baustelle eingeben.', 'Wpisz nazwę budowy.', 'Introdu un nume pentru șantier.', 'Внеси име за градилиштето.', 'Shkruaj një emër për kantierin.'],
  ['Bitte zuerst unterschreiben.', 'Najpierw się podpisz.', 'Semnează mai întâi.', 'Прво потпиши.', 'Nënshkruaj fillimisht.'],
  ['Bitte einen Namen eingeben.', 'Wpisz imię.', 'Introdu un nume.', 'Внеси име.', 'Shkruaj një emër.'],
  ['Es gibt noch keine Berichte.', 'Nie ma jeszcze raportów.', 'Încă nu există rapoarte.', 'Сè уште нема извештаи.', 'Ende nuk ka raporte.'],
  ['Falsche PIN.', 'Błędny PIN.', 'PIN greșit.', 'Погрешен PIN.', 'PIN i gabuar.'],
  ['Du siehst nur deine eigenen Stunden. Wechseln kann nur der Administrator.', 'Widzisz tylko swoje godziny. Zmienić może tylko administrator.', 'Vezi doar orele tale. Doar administratorul poate schimba.', 'Ги гледаш само твоите часови. Само администраторот може да промени.', 'Shikon vetëm orët e tua. Vetëm administratori mund të ndryshojë.'],
  ['Diesen Eintrag kann nur der Mitarbeiter auf seinem Handy ändern.', 'Ten wpis może zmienić tylko pracownik na swoim telefonie.', 'Această înregistrare o poate schimba doar angajatul pe telefonul lui.', 'Овој внес може да го промени само вработениот на својот телефон.', 'Këtë regjistrim mund ta ndryshojë vetëm punonjësi në telefonin e tij.'],
  ['Bitte einen Namen eingeben oder eine Person antippen.', 'Wpisz imię lub wybierz osobę.', 'Introdu un nume sau atinge o persoană.', 'Внеси име или допри личност.', 'Shkruaj një emër ose prek një person.'],
  ['Bitte ein Datum wählen.', 'Wybierz datę.', 'Alege o dată.', 'Избери датум.', 'Zgjidh një datë.'],
  ['Bitte Arbeit, Urlaub, Krank, Feiertag oder Berufsschule wählen.', 'Wybierz: praca, urlop, choroba, święto lub szkoła zawodowa.', 'Alege: muncă, concediu, boală, sărbătoare sau școală profesională.', 'Избери: работа, одмор, боледување, празник или стручно училиште.', 'Zgjidh: punë, pushim, sëmundje, festë ose shkollë profesionale.'],
  ['Bitte eine Baustelle wählen.', 'Wybierz budowę.', 'Alege un șantier.', 'Избери градилиште.', 'Zgjidh një kantier.'],
  ['Bitte die Art der Arbeit eintragen.', 'Wpisz rodzaj pracy.', 'Trece tipul de lucrare.', 'Внеси вид на работа.', 'Shëno llojin e punës.'],
  ['Mehr als 6 Stunden: Bitte die Pause eintragen.', 'Ponad 6 godzin: wpisz przerwę.', 'Peste 6 ore: trece pauza.', 'Повеќе од 6 часа: внеси пауза.', 'Më shumë se 6 orë: shëno pushimin.'],
  ['Pflicht', 'wymagane', 'obligatoriu', 'задолжително', 'e detyrueshme'],
  ['Bitte Beginn und Ende eintragen.', 'Wpisz początek i koniec.', 'Trece începutul și sfârșitul.', 'Внеси почеток и крај.', 'Shëno fillimin dhe mbarimin.'],
  ['Gespeichert.', 'Zapisano.', 'Salvat.', 'Зачувано.', 'U ruajt.'],
  ['Eintrag löschen?', 'Usunąć wpis?', 'Ștergi înregistrarea?', 'Да се избрише внесот?', 'Të fshihet regjistrimi?'],
  ['Kein Netz. Der Bericht wird hochgeladen, sobald du wieder online bist.', 'Brak internetu. Raport zostanie wysłany, gdy znów będziesz online.', 'Nu ai internet. Raportul se trimite când ești din nou online.', 'Нема интернет. Извештајот ќе се испрати кога пак ќе бидеш онлајн.', 'Nuk ka internet. Raporti dërgohet sapo të jesh sërish online.'],
  ['Alles ist bereits hochgeladen.', 'Wszystko jest już wysłane.', 'Totul este deja trimis.', 'Сè е веќе испратено.', 'Gjithçka është dërguar.'],
  ['Bericht hochgeladen.', 'Raport wysłany.', 'Raport trimis.', 'Извештајот е испратен.', 'Raporti u dërgua.'],
  ['Änderungen am Bericht verwerfen?', 'Odrzucić zmiany w raporcie?', 'Renunți la modificările raportului?', 'Да се отфрлат промените во извештајот?', 'Të hidhen poshtë ndryshimet e raportit?'],
  ['Abgemeldet.', 'Wylogowano.', 'Deconectat.', 'Одјавен.', 'Dole.'],
  ['Rapport: Bitte zuerst Personal mit Beginn und Ende eintragen.', 'Raport robót: najpierw dodaj pracowników z początkiem i końcem.', 'Raport de lucru: adaugă mai întâi personalul cu început și sfârșit.', 'Работен извештај: прво внеси персонал со почеток и крај.', 'Raport pune: shto fillimisht personelin me fillim dhe mbarim.'],
  ['Rapport: Bitte eintragen, welche Arbeiten ausgeführt wurden.', 'Raport robót: wpisz, jakie prace wykonano.', 'Raport de lucru: trece ce lucrări s-au executat.', 'Работен извештај: внеси кои работи се изведени.', 'Raport pune: shëno cilat punë u kryen.'],
  ['Rapport: Bitte zuerst vom Bauherrn unterschreiben lassen.', 'Raport robót: najpierw poproś inwestora o podpis.', 'Raport de lucru: cere mai întâi semnătura beneficiarului.', 'Работен извештај: прво побарај потпис од инвеститорот.', 'Raport pune: merr fillimisht nënshkrimin e investitorit.'],
  ['Foto markieren', 'Oznacz zdjęcie', 'Marchează fotografia', 'Означи фотографија', 'Shëno foton'],
  ['Fertig', 'Gotowe', 'Gata', 'Готово', 'Gati'],
  ['Stift', 'Pisak', 'Creion', 'Пенкало', 'Laps'],
  ['Pfeil', 'Strzałka', 'Săgeată', 'Стрелка', 'Shigjetë'],
  ['Kreis', 'Koło', 'Cerc', 'Круг', 'Rreth'],
  ['Rechteck', 'Prostokąt', 'Dreptunghi', 'Правоаголник', 'Drejtkëndësh'],
  ['Text', 'Tekst', 'Text', 'Текст', 'Tekst'],
  ['Dick', 'Gruby', 'Gros', 'Дебело', 'Trashë'],
  ['Rückgängig', 'Cofnij', 'Anulează ultima', 'Врати', 'Zhbëj'],
  ['Text eingeben', 'Wpisz tekst', 'Scrie textul', 'Внеси текст', 'Shkruaj tekstin'],
  ['Markierungen verwerfen?', 'Odrzucić oznaczenia?', 'Renunți la marcaje?', 'Да се отфрлат ознаките?', 'Të hidhen poshtë shënimet?'],
  ['+ Text zum Bild', '+ Tekst do zdjęcia', '+ Text la imagine', '+ Текст кон сликата', '+ Tekst për foton'],
  ['Text zum Bild', 'Tekst do zdjęcia', 'Text la imagine', 'Текст кон сликата', 'Tekst për foton'],
  ['Beschreibung', 'Opis', 'Descriere', 'Опис', 'Përshkrim'],
  ['z. B. Riss an der Fassade, Nordseite', 'np. pęknięcie na elewacji, strona północna', 'de ex. fisură în fațadă, latura de nord', 'на пр. пукнатина на фасадата, северна страна', 'p.sh. çarje në fasadë, ana veriore'],
  ['Dieses Foto kann nicht bearbeitet werden.', 'Tego zdjęcia nie można edytować.', 'Această fotografie nu poate fi editată.', 'Оваа фотографија не може да се уреди.', 'Kjo foto nuk mund të përpunohet.'],
];

const WOCHENTAGE = {
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  pl: ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'],
  ro: ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'],
  mk: ['понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота', 'недела'],
  sq: ['e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë', 'e diel'],
};
const KURZ = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  pl: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'],
  ro: ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'],
  mk: ['Пн', 'Вт', 'Ср', 'Че', 'Пе', 'Са', 'Не'],
  sq: ['Hë', 'Ma', 'Më', 'En', 'Pr', 'Sh', 'Di'],
};
const MONATE = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'],
  ro: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
  mk: ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'],
  sq: ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'],
};
// Wörter für Mengenangaben: [Einzahl, Mehrzahl]
const WORT = {
  bericht: { pl: ['raport', 'raporty'], ro: ['raport', 'rapoarte'], mk: ['извештај', 'извештаи'], sq: ['raport', 'raporte'] },
  geladen: { pl: 'pobrano z repozytorium', ro: 'descărcat(e) din repo', mk: 'преземени од репото', sq: 'u shkarkuan nga repo' },
  hochgeladen: { pl: 'wysłano', ro: 'trimis(e)', mk: 'испратени', sq: 'u dërguan' },
  berichteIm: { pl: 'Raporty', ro: 'Rapoarte', mk: 'Извештаи', sq: 'Raporte' },
  summe: { pl: 'Razem', ro: 'Total', mk: 'Вкупно', sq: 'Gjithsej' },
  zb: { pl: 'np.', ro: 'ex.', mk: 'на пр.', sq: 'p.sh.' },
  pause: { pl: 'min przerwy', ro: 'min pauză', mk: 'мин пауза', sq: 'min pushim' },
  uebernommen: { pl: 'Godziny przejęte z raportu', ro: 'Ore preluate din raport', mk: 'Времињата се преземени од извештајот', sq: 'Oraret u morën nga raporti' },
  entfernen: { pl: 'usuń', ro: 'elimină', mk: 'отстрани', sq: 'hiq' },
  kw: { pl: 'Tydz.', ro: 'Săpt.', mk: 'Нед.', sq: 'Java' },
  von: { pl: 'od', ro: 'de la', mk: 'од', sq: 'nga' },
};

let lang = 'de';
let dict = null;

export function sprache() {
  return lang;
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function monat(m) {
  const i = MONATE.de.indexOf(m);
  return i < 0 ? m : cap(MONATE[lang][i]);
}

// Texte mit Zahlen oder Namen darin
function muster(s) {
  let m;
  if ((m = /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) (\d{4})$/.exec(s))) return `${monat(m[1])} ${m[2]}`;
  if ((m = /^Berichte im (\S+)$/.exec(s))) return `${WORT.berichteIm[lang]} · ${monat(m[1])}`;
  if ((m = /^Summe (.+)$/.exec(s))) return `${WORT.summe[lang]} ${m[1]}`;
  if ((m = /^z\. B\. (.+)$/.exec(s))) return `${WORT.zb[lang]} ${m[1]}`;
  if ((m = /^(.*) min Pause$/.exec(s))) return `${m[1]} ${WORT.pause[lang]}`;
  if ((m = /^Zeiten aus dem Bericht (?:(„.*“) )?übernommen\.$/.exec(s))) return `${WORT.uebernommen[lang]}${m[1] ? ` ${m[1]}` : ''}.`;
  if ((m = /^(.+) entfernen$/.exec(s))) return `${m[1]} – ${WORT.entfernen[lang]}`;
  if ((m = /^(\d+) (Bericht|Berichte) · (.+)$/.exec(s))) return `${m[1]} ${WORT.bericht[lang][m[1] === '1' ? 0 : 1]} · ${m[3]}`;
  // Symbol davor (z. B. beim Wetter)
  if ((m = /^([^\p{L}\d„]+)(\p{L}.*)$/u.exec(s)) && dict.has(m[2])) return `${m[1]}${dict.get(m[2])}`;
  if ((m = /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)(,? .*)?$/.exec(s))) return cap(WOCHENTAGE[lang][WOCHENTAGE.de.indexOf(m[1])]) + (m[2] || '');
  if ((m = /^(\d+) (Bericht|Berichte)$/.exec(s))) return `${m[1]} ${WORT.bericht[lang][m[1] === '1' ? 0 : 1]}`;
  if ((m = /^(\d+) (?:Bericht|Berichte) vom Repo geladen\.$/.exec(s))) return `${m[1]} ${WORT.bericht[lang][m[1] === '1' ? 0 : 1]} – ${WORT.geladen[lang]}.`;
  if ((m = /^(\d+) Berichte hochgeladen\.$/.exec(s))) return `${m[1]} ${WORT.bericht[lang][1]} – ${WORT.hochgeladen[lang]}.`;
  if ((m = /^KW (\d+)$/.exec(s))) return `${WORT.kw[lang]} ${m[1]}`;
  if ((m = /^von (.+)$/.exec(s))) return `${WORT.von[lang]} ${m[1]}`;
  return null;
}

export function t(s) {
  if (lang === 'de' || typeof s !== 'string') return s;
  const key = s.replace(/\s+/g, ' ').trim();
  if (!key) return s;
  const hit = dict.get(key) ?? muster(key);
  if (hit == null) return s;
  // Leerzeichen am Rand erhalten
  return s.slice(0, s.indexOf(key[0])) + hit + (/\s$/.test(s) ? ' ' : '');
}

const ATTRS = ['placeholder', 'aria-label', 'title'];

function uebersetze(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    const p = root.parentElement;
    if (!p || p.closest('[data-roh], textarea, script, style')) return;
    const neu = t(root.nodeValue);
    if (neu !== root.nodeValue) root.nodeValue = neu;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const els = [root, ...root.querySelectorAll('*')];
  for (const el of els) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) {
        const neu = t(v);
        if (neu !== v) el.setAttribute(a, neu);
      }
    }
  }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(uebersetze);
}

let observer = null;

export function startI18n(id) {
  lang = SPRACHEN.some((s) => s.id === id) ? id : 'de';
  document.documentElement.lang = lang;
  observer?.disconnect();
  if (lang === 'de') return;
  const i = ORDER.indexOf(lang) + 1;
  dict = new Map(ROWS.map((r) => [r[0], r[i]]));
  // Kurzformen der Wochentage in den Karten
  KURZ.de.forEach((k, j) => dict.set(k, KURZ[lang][j]));
  uebersetze(document.body);
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') uebersetze(m.target);
      else m.addedNodes.forEach(uebersetze);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  // Rückfragen (confirm) ebenfalls übersetzen
  const orig = window.confirm.bind(window);
  window.confirm = (msg) => orig(t(msg));
}

// Fachwörterliste für die Übersetzung der Freitexte ins Deutsche.
// Der kostenlose Übersetzer kennt viele Baustellenwörter nicht (z. B. rumänisch „glet“ = Spachtelmasse)
// und übersetzt kurze Notizen ohne Satzzeichen Wort für Wort. Darum:
//  - Besteht eine Zeile nur aus Wörtern dieser Liste (plus Zahlen und Satzzeichen), wird sie direkt
//    aus der Liste übersetzt, ohne Übersetzer.
//  - Sonst werden die bekannten Fachwörter vorab ins Deutsche gesetzt und der Rest geht wie bisher an
//    den Übersetzer.
//
// Aufbau einer Zeile:  fremd | andere Schreibweise = Deutsch
//   „!“ am Ende: Tätigkeit (wird in der Übersetzung mit Komma abgetrennt)
//   „~“ am Anfang: Füllwort (zählt nicht als Fachwort), „-“ als Deutsch: Wort weglassen
// Groß-/Kleinschreibung und Akzente (ă, ș, ł, ë, ќ …) spielen beim Vergleich keine Rolle.

const LISTEN = {
  ro: `
lipit banda | lipit banda adeziva | lipit banda de hartie | lipire banda | banda lipita | pus banda = Klebeband geklebt !
izolat podea | izolat podeaua | izolat pardoseala | acoperit podea | acoperit podeaua | protejat podea | protejat podeaua = Boden abgedeckt !
izolat geamuri | izolat geamurile | izolat ferestre | acoperit geamuri | acoperit geamurile | acoperit ferestre | protejat geamuri = Fenster abgedeckt !
acoperit cu folie | izolat cu folie = mit Folie abgedeckt !
izolat | acoperit | protejat = abgedeckt !
tras glet | glet tras | dat glet | dat cu glet | gletuit | gletuire | gletuiala = gespachtelt !
tras tinci | tras tencuiala | dat tencuiala | tencuit | tencuire = verputzt !
slefuit | slefuire | slefuit glet | slefuit gletul = geschliffen !
grunduit | grunduire | dat grund | dat cu grund | amorsat = grundiert !
vopsit | vopsire | zugravit | zugraveala | dat lavabil | dat cu lavabil | dat vopsea | dat cu vopsea = gestrichen !
chituit | chituire | chituit rosturi | chituit rosturile = Fugen verspachtelt !
siliconat | dat silicon | tras silicon = Silikonfugen gezogen !
montat rigips | montat gips carton | montat placi | montat placi rigips | pus rigips | pus placi = Gipskarton montiert !
montat profile | pus profile = Profile montiert !
montat coltare | pus coltare = Eckprofile gesetzt !
montat schela | ridicat schela = Gerüst aufgebaut !
demontat schela | dat jos schela = Gerüst abgebaut !
lipit polistiren | pus polistiren = Styropor geklebt !
dibluit | pus dibluri = gedübelt !
pus plasa | dat plasa | armat cu plasa | armare cu plasa | inglobat plasa = Armierungsgewebe eingebettet !
facut curat | curatat | curatenie = gereinigt !
desfacut | demontat = abgebaut !
montat = montiert !
glet | gletul = Spachtelmasse
tinci | tencuiala = Putz
grund | grundul | amorsa = Grundierung
lavabil | lavabila | vopsea | vopseaua = Farbe
silicon = Silikon
chit = Spachtelmasse
rosturi | rost = Fugen
rigips | gips carton | gipscarton = Gipskarton
placa | placi = Platten
profil | profile = Profile
coltar | coltare = Eckprofile
schela | schelele = Gerüst
polistiren = Styropor
vata minerala | vata = Mineralwolle
diblu | dibluri = Dübel
adeziv | adezivul = Kleber
plasa | plasa de armare = Armierungsgewebe
folie | folia = Folie
banda | banda adeziva | banda de hartie | scotch = Klebeband
benzi | benzile = Klebebänder
sac | sacul = Sack
saci | sacii = Säcke
galeata = Eimer
galeti = Eimer
rola | role = Rollen
buc | bucata | bucati = Stück
perete | peretele = Wand
pereti | peretii = Wände
tavan | tavanul = Decke
tavane | tavanele = Decken
podea | podeaua | pardoseala = Boden
camera | camere = Raum
dormitor = Schlafzimmer
sufragerie = Wohnzimmer
baie | baia = Bad
bucatarie = Küche
hol | holul = Flur
scara | scari = Treppe
fatada | fatada = Fassade
usa | usi | usile = Türen
geam | geamuri | geamurile | fereastra | ferestre = Fenster
glaf | glafuri = Fensterbänke
etaj = Etage
parter = Erdgeschoss
mansarda = Dachgeschoss
pivnita | subsol = Keller
~ si = und
~ cu = mit
~ pe = an
~ in = in
~ la = an
~ din = aus
~ pentru = für
~ de | am | a | s | o | un | una | au = -
`,
  pl: `
oklejanie | oklejanie tasma | oklejone | okleilem | okleilismy | klejenie tasmy = Klebeband geklebt !
zabezpieczenie podlogi | zabezpieczenie podlog | zabezpieczylem podloge | zabezpieczona podloga | folia na podloge = Boden abgedeckt !
zabezpieczenie okien | zabezpieczenie okna | zabezpieczone okna = Fenster abgedeckt !
zabezpieczenie | zabezpieczone = abgedeckt !
szpachlowanie | szpachlowalem | szpachlowalismy | szpachlowane | gladzenie | robienie gladzi = gespachtelt !
tynkowanie | tynkowalem | otynkowane = verputzt !
szlifowanie | szlifowalem | szlifowane = geschliffen !
gruntowanie | gruntowalem | zagruntowane | gruntowane = grundiert !
malowanie | malowalem | malowalismy | pomalowane | malowane = gestrichen !
malowanie scian = Wände gestrichen !
malowanie sufitu | malowanie sufitow = Decke gestrichen !
silikonowanie = Silikonfugen gezogen !
fugowanie = Fugen verspachtelt !
montaz plyt | montaz plyt gk | montaz regipsu | montaz karton gips = Gipskarton montiert !
montaz profili = Profile montiert !
montaz naroznikow = Eckprofile gesetzt !
montaz rusztowania | stawianie rusztowania = Gerüst aufgebaut !
demontaz rusztowania | rozbieranie rusztowania = Gerüst abgebaut !
klejenie styropianu = Styropor geklebt !
kolkowanie = gedübelt !
siatkowanie | zatapianie siatki | klejenie siatki = Armierungsgewebe eingebettet !
sprzatanie | sprzatalem = gereinigt !
montaz = montiert !
demontaz = abgebaut !
masa szpachlowa | gips szpachlowy | gladz | gladzi | gladzie = Spachtelmasse
tynk = Putz
grunt = Grundierung
farba | farby = Farbe
silikon = Silikon
fuga | fugi = Fugen
plyta | plyty | plyty gk | plyty g k | karton gips | regips | rigips = Gipskarton
profil | profile = Profile
naroznik | narozniki = Eckprofile
rusztowanie = Gerüst
styropian = Styropor
welna mineralna | welna = Mineralwolle
kolek | kolki = Dübel
klej = Kleber
siatka = Armierungsgewebe
folia = Folie
tasma | tasma malarska | tasmy = Klebeband
worek = Sack
worki | workow = Säcke
wiadro | wiadra = Eimer
rolka | rolki = Rollen
szt | sztuk | sztuki = Stück
sciana = Wand
sciany | scian = Wände
sufit | sufitu = Decke
sufity = Decken
podloga | podlogi | podloge = Boden
pokoj | pokoje = Raum
sypialnia = Schlafzimmer
salon = Wohnzimmer
lazienka | lazience = Bad
kuchnia = Küche
korytarz = Flur
schody = Treppe
elewacja = Fassade
drzwi = Türen
okno | okna = Fenster
parapet | parapety = Fensterbänke
pietro = Etage
parter = Erdgeschoss
poddasze = Dachgeschoss
piwnica = Keller
~ i | oraz = und
~ z | ze = mit
~ na = an
~ w | we = in
~ do = für
~ dla = für
~ sie = -
`,
  mk: `
лепење селотејп | лепење лента | лепење трака | лепење на селотејп = Klebeband geklebt !
заштита под | заштита на под | покривање под | покривање на под = Boden abgedeckt !
заштита прозори | заштита на прозори | покривање прозори = Fenster abgedeckt !
покривање | заштита = abgedeckt !
шпаклување | шпакловање | шпахтлање | шпакла ѕидови = gespachtelt !
малтерисување = verputzt !
брусење | шмирглање = geschliffen !
грундирање | основа ѕидови = grundiert !
бојадисување | бојосување | фарбање | молерај | молерисување = gestrichen !
силиконирање = Silikonfugen gezogen !
монтажа гипс картон | монтажа гипсокартон | монтажа регипс | монтажа плочи = Gipskarton montiert !
монтажа профили = Profile montiert !
монтажа скеле | поставување скеле = Gerüst aufgebaut !
демонтажа скеле = Gerüst abgebaut !
лепење стиропор = Styropor geklebt !
типлување = gedübelt !
мрежа лепење | лепење мрежа = Armierungsgewebe eingebettet !
чистење = gereinigt !
монтажа = montiert !
демонтажа = abgebaut !
шпакла = Spachtelmasse
малтер = Putz
грунд | подлога = Grundierung
боја | бои = Farbe
силикон = Silikon
фуга | фуги = Fugen
гипс картон | гипсокартон | регипс = Gipskarton
плоча | плочи = Platten
профил | профили = Profile
скеле = Gerüst
стиропор = Styropor
минерална волна | волна = Mineralwolle
типла | типли = Dübel
лепак = Kleber
мрежа = Armierungsgewebe
најлон | фолија = Folie
селотејп | лента | трака = Klebeband
вреќа = Sack
вреќи = Säcke
кофа | кофи = Eimer
ролна | ролни = Rollen
парче | парчиња = Stück
ѕид = Wand
ѕидови = Wände
таван = Decke
тавани = Decken
соба | соби = Raum
спална = Schlafzimmer
дневна = Wohnzimmer
бања | купатило = Bad
кујна = Küche
ходник = Flur
скали = Treppe
фасада = Fassade
врата = Türen
прозор | прозори = Fenster
кат = Etage
приземје = Erdgeschoss
поткровје = Dachgeschoss
подрум = Keller
~ и = und
~ со = mit
~ на = an
~ во = in
~ за = für
~ од = aus
~ се = -
`,
  sq: `
ngjitje shiriti | ngjitur shirit | vendosur shirit = Klebeband geklebt !
mbulim dyshemeje | mbuluar dyshemene | mbrojtje dyshemeje = Boden abgedeckt !
mbulim dritaresh | mbuluar dritaret = Fenster abgedeckt !
mbulim | mbuluar = abgedeckt !
stukim | stukuar | stukim muresh = gespachtelt !
suvatim | suvatuar = verputzt !
lemim | lemuar | zmerilim = geschliffen !
astarim | astaruar = grundiert !
lyerje | lyer | ngjyrosje | ngjyrosur = gestrichen !
silikonim = Silikonfugen gezogen !
montim rigipsi | montim gips karton | montim pllakash = Gipskarton montiert !
montim profilesh = Profile montiert !
montim skele | montim skeles = Gerüst aufgebaut !
cmontim skele | cmontim skeles = Gerüst abgebaut !
ngjitje stiropori = Styropor geklebt !
vendosje tiplash = gedübelt !
rrjete e ngjitur | ngjitje rrjete = Armierungsgewebe eingebettet !
pastrim | pastruar = gereinigt !
montim = montiert !
cmontim = abgebaut !
stuko = Spachtelmasse
suva | llac = Putz
astar | grund = Grundierung
boje | ngjyre = Farbe
silikon = Silikon
fuga = Fugen
rigips | gips karton | gipskarton = Gipskarton
pllake | pllaka = Platten
profil | profile = Profile
skele = Gerüst
stiropor | polisterol = Styropor
lesh xhami | lesh guri = Mineralwolle
tipla | tipel = Dübel
ngjites = Kleber
rrjete = Armierungsgewebe
najlon | folie = Folie
shirit | shiriti = Klebeband
thes = Sack
thase = Säcke
kove = Eimer
rrotull | rrotulla = Rollen
cope = Stück
mur | muri = Wand
mure | muret = Wände
tavan | tavani = Decke
dysheme | dyshemeja | dyshemene = Boden
dhome | dhoma = Raum
dhome gjumi = Schlafzimmer
sallon = Wohnzimmer
banjo = Bad
kuzhine | kuzhina = Küche
korridor = Flur
shkalle | shkallet = Treppe
fasade | fasada = Fassade
dere | dyer = Türen
dritare | dritaret = Fenster
kat = Etage
perdhes = Erdgeschoss
papafingo = Dachgeschoss
bodrum = Keller
~ dhe = und
~ me = mit
~ ne = in
~ per = für
~ nga = aus
~ te | e | i = -
`,
};

// Kleinbuchstaben, ohne Akzente (ł zerfällt nicht von selbst)
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

// Zahlen samt Einheit, Wörter, alles andere (Leerzeichen, Satzzeichen)
const TOKEN = /\d+(?:[.,]\d+)?(?:\s?(?:m²|m³|m2|m3|qm|lfm|cm|mm|kg|m|l|h)(?![\p{L}\d]))?|\p{L}+|[^\p{L}\d]+/gu;
const woerter = (s) => (norm(s).match(/\p{L}+/gu) || []);

const cache = new Map();
function liste(von) {
  if (cache.has(von)) return cache.get(von);
  const text = LISTEN[von];
  if (!text) return null;
  const eintraege = new Map();
  let laengste = 1;
  for (let zeile of text.split('\n')) {
    zeile = zeile.trim();
    if (!zeile || !zeile.includes('=')) continue;
    const fuell = zeile.startsWith('~');
    if (fuell) zeile = zeile.slice(1);
    let [links, rechts] = zeile.split('=');
    rechts = rechts.trim();
    const tat = rechts.endsWith('!');
    if (tat) rechts = rechts.slice(0, -1).trim();
    for (const v of links.split('|')) {
      const w = woerter(v);
      if (!w.length) continue;
      laengste = Math.max(laengste, w.length);
      eintraege.set(w.join(' '), { de: rechts === '-' ? '' : rechts, art: fuell ? 'fuell' : tat ? 'tat' : 'wort' });
    }
  }
  const l = { eintraege, laengste };
  cache.set(von, l);
  return l;
}

// Zerlegt eine Zeile und sucht die längsten bekannten Wortgruppen.
function zerlegen(zeile, l) {
  const tokens = zeile.match(TOKEN) || [];
  const teile = [];
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i];
    if (/^\d/.test(t)) { teile.push({ art: 'zahl', text: t }); i++; continue; }
    if (!/\p{L}/u.test(t)) { teile.push({ art: 'zwischen', text: t }); i++; continue; }
    // längste Wortgruppe ab hier (Wörter durch Leerzeichen oder Bindestrich getrennt)
    let treffer = null;
    const w = [];
    let j = i;
    while (j < tokens.length && w.length < l.laengste) {
      if (!/^\p{L}+$/u.test(tokens[j])) break;
      w.push(norm(tokens[j]));
      const e = l.eintraege.get(w.join(' '));
      if (e) treffer = { e, bis: j };
      j++;
      if (j < tokens.length && /^[\s-]+$/.test(tokens[j]) && j + 1 < tokens.length && /^\p{L}+$/u.test(tokens[j + 1])) j++;
      else break;
    }
    if (treffer) {
      teile.push({ art: treffer.e.art, text: treffer.e.de, original: tokens.slice(i, treffer.bis + 1).join('') });
      i = treffer.bis + 1;
    } else {
      teile.push({ art: 'unbekannt', text: t });
      i++;
    }
  }
  return teile;
}

// Übersetzt eine Zeile mit der Liste.
// ganz: true, wenn jede Stelle bekannt war; text ist dann fertiges Deutsch.
// Sonst ist text die Zeile mit den bekannten Fachwörtern auf Deutsch, für den Übersetzer.
export function mitFachwoertern(zeile, von) {
  const l = liste(von);
  if (!l || !zeile.trim()) return { ganz: false, text: zeile };
  const teile = zerlegen(zeile, l);
  const fach = teile.some((t) => t.art === 'wort' || t.art === 'tat');
  const ganz = fach && !teile.some((t) => t.art === 'unbekannt');
  if (!ganz) {
    const text = teile.map((t) => (t.art === 'wort' || t.art === 'tat' ? t.text : (t.original ?? t.text))).join('');
    return { ganz: false, text, fach };
  }
  let out = '';
  let vorher = null; // Art des letzten Stücks seit dem letzten Satzzeichen
  teile.forEach((t, i) => {
    if (t.art === 'zwischen') {
      const z = t.text.trim();
      if (z && z !== '-') { out = out.trimEnd() + z + ' '; vorher = null; }
      else if (out && !/\s$/.test(out)) out += ' ';
      return;
    }
    if (!t.text) return;
    if (vorher) {
      // Komma zwischen Tätigkeiten und vor einer Mengenangabe („1 Sack …, 2 Klebebänder“)
      const naechstes = teile.slice(i + 1).find((x) => x.art !== 'zwischen' || x.text.trim());
      const menge = t.art === 'zahl' && vorher !== 'zahl' && (naechstes?.art === 'wort');
      const komma = t.art !== 'fuell' && vorher !== 'fuell' && (t.art === 'tat' || menge);
      out = out.trimEnd() + (komma ? ', ' : ' ');
    }
    out += t.text;
    vorher = t.art;
  });
  out = out.trim();
  return { ganz: true, text: out.charAt(0).toUpperCase() + out.slice(1) };
}

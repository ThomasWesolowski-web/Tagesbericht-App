// Materialliste aus Rapporten: liest das Freitextfeld „Material und Geräte“
// („20 kg Kalkglätte, 3 m² GKB“) und fasst gleiche Materialien mit Summe und Einheit zusammen.
// Ohne Netz, ohne KI: Zahlen, Einheiten und eine kleine Liste bekannter Materialien.

export const GRUPPEN = ['Trockenbau', 'Putz und Spachtel', 'Mörtel und Kleber', 'Dämmung', 'Profile und Gewebe', 'Befestigung', 'Abdichtung', 'Maler und Hilfsstoffe', 'Entsorgung', 'Sonstiges'];

const ZAHLWORTE = {
  ein: 1, eine: 1, einen: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7,
  acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, zwanzig: 20, dreißig: 30, fünfzig: 50, hundert: 100, halbe: 0.5, halben: 0.5,
};

// Einheiten: Schreibweise im Text → [Einheit, Faktor, Maß (true) oder Zählung (false)]
const EINHEITEN = [
  [/^(kg|kilo|kilos|kilogramm)$/i, 'kg', 1, true],
  [/^(g|gramm)$/i, 'kg', 0.001, true],
  [/^(t|tonnen?)$/i, 't', 1, true],
  [/^(l|liter|ltr)$/i, 'l', 1, true],
  [/^ml$/i, 'l', 0.001, true],
  [/^(m²|m2|qm|quadratmeter)$/i, 'm²', 1, true],
  [/^(m³|m3|cbm|kubik|kubikmeter)$/i, 'm³', 1, true],
  [/^(m|lfm|meter|lfd\.?m)$/i, 'm', 1, true],
  [/^(stück|stk\.?|st\.?)$/i, 'Stück', 1, false],
  [/^(dosen?)$/i, 'Dosen', 1, false],
  [/^(rollen?)$/i, 'Rollen', 1, false],
  [/^(sack|säcke|saecke)$/i, 'Sack', 1, false],
  [/^(eimer)$/i, 'Eimer', 1, false],
  [/^(platten?)$/i, 'Platten', 1, false],
  [/^(kartuschen?)$/i, 'Kartuschen', 1, false],
  [/^(pakete?|packungen?|pkg\.?)$/i, 'Pakete', 1, false],
  [/^(tuben?)$/i, 'Tuben', 1, false],
  [/^(beutel)$/i, 'Beutel', 1, false],
  [/^(flaschen?)$/i, 'Flaschen', 1, false],
  [/^(stangen?)$/i, 'Stangen', 1, false],
];
// Abmessungen gehören zum Namen (EPS 120 mm), nicht zur Menge
const ABMESSUNG = /^(mm|cm)$/i;

// Bekannte Materialien: Suchmuster → Name und Gruppe. Die erste passende Zeile gewinnt, darum
// stehen genaue Begriffe vor allgemeinen („Gewebeeckwinkel“ vor „Eckwinkel“, „Fliesenkleber“ vor „Kleber“).
// Begriffe nach Herstellerkatalogen (Knauf, Protektor), WDVS-Leitfaden (KEIM) und Putz-Lexika.
const BEKANNT = [
  // Entsorgung
  [/gipsabfall|gipsschutt/i, 'Gipsabfall (Entsorgung)', 'Entsorgung'],
  [/dämmstoffabfall|daemmstoffabfall|styroporabfall|kmf-?abfall/i, 'Dämmstoffabfall (Entsorgung)', 'Entsorgung'],
  [/altholz/i, 'Altholz (Entsorgung)', 'Entsorgung'],
  [/container|mulde|big-?\s?bag/i, 'Container / Big Bag (Entsorgung)', 'Entsorgung'],
  [/schutt|abbruch|entsorg|müll|muell|abfall/i, 'Bauschutt (Entsorgung)', 'Entsorgung'],

  // Profile und Gewebe (vor Platten und Putzen, weil Namen wie „Gewebeeckwinkel“ oder „Putzprofil“ beides enthalten)
  [/gewebe-?\s*(eck)?winkel|gewebeeck|eckwinkel\s*mit\s*gewebe/i, 'Gewebeeckwinkel', 'Profile und Gewebe'],
  [/alu\w*\s*-?\s*(eck)?winkel|aluminium\w*winkel|alu-?eck/i, 'Alu-Eckwinkel', 'Profile und Gewebe'],
  [/kantenschutzstreifen|eckenschutzstreifen|papier-?kantenschutz/i, 'Kantenschutzstreifen', 'Profile und Gewebe'],
  [/kantenschutz|eckschutz|eckschiene|eckwinkel|eckprofil/i, 'Eckschutzschienen', 'Profile und Gewebe'],
  [/sockelprofil|sockelschiene|sockelabschluss/i, 'Sockelprofile', 'Profile und Gewebe'],
  [/anputz|apu-?leiste|fensteranschluss/i, 'Anputzleisten', 'Profile und Gewebe'],
  [/tropfkante|tropfprofil|tropfnase/i, 'Tropfkantenprofile', 'Profile und Gewebe'],
  [/dehnfuge|bewegungsfuge|dilatation/i, 'Dehnfugenprofile', 'Profile und Gewebe'],
  [/abschlussprofil|abschlussschiene|putzabschluss|putzprofil|putzleiste|putzschiene|einputzprofil/i, 'Putzabschlussprofile', 'Profile und Gewebe'],
  [/laibungsprofil|leibungsprofil/i, 'Laibungsprofile', 'Profile und Gewebe'],
  [/putzträger|putztraeger|streckmetall|ziegeldraht|rabitz|schilfrohr|putzlatte/i, 'Putzträger', 'Profile und Gewebe'],
  [/\b(cw|uw|ua|cd|ud)\s*-?\s*profil|\b(cw|uw|ua|cd|ud)\s*\d{2,3}\b|ständerprofil|staenderprofil|wandprofil|deckenprofil|aussteifungsprofil|anschlussprofil/i, 'Trockenbauprofile', 'Profile und Gewebe'],
  [/hutprofil|hut-?deckenprofil|federschiene|rostwinkel|wandwinkel/i, 'Hut- und Winkelprofile', 'Profile und Gewebe'],
  [/fugendeckstreifen|fugenstreifen|bewehrungsstreifen|fugenband|glasfaser-?\s*gewebeband|trennwandband|trennstreifen|dämmstreifen|daemmstreifen/i, 'Fugen- und Trennstreifen', 'Profile und Gewebe'],
  [/gewebe(?!band)|armierungsnetz|glasfaser-?gitter|gittermatte/i, 'Armierungsgewebe', 'Profile und Gewebe'],

  // Abdichtung (vor Klebeband und Folie)
  [/dichtband|fugendichtband|dichtecke|dichtmanschette|kompriband|fensterband/i, 'Dichtband', 'Abdichtung'],
  [/dichtschlämme|dichtschlaemme|flüssigabdichtung|fluessigabdichtung|flüssigfolie|fluessigfolie|verbundabdichtung|bitumen|kmb\b/i, 'Abdichtung (Schlämme / flüssig)', 'Abdichtung'],
  [/dampfbremse|dampfsperre|dampfbrems|luftdicht/i, 'Dampfbremse', 'Abdichtung'],

  // Trockenbau
  [/fermacell|gipsfaser/i, 'Gipsfaserplatten (Fermacell)', 'Trockenbau'],
  [/wedi|bauplatte\s*xps|hartschaum-?bauplatte/i, 'Wedi-Platten', 'Trockenbau'],
  [/aquapanel|zementplatte|zementgebunden|zementbauplatte/i, 'Zementbauplatten (Aquapanel)', 'Trockenbau'],
  [/lehmbauplatte|lehmplatte/i, 'Lehmbauplatten', 'Trockenbau'],
  [/akustikplatte|lochplatte|schlitzplatte|cleaneo/i, 'Akustikplatten', 'Trockenbau'],
  [/mineralfaserplatte|rasterdecke|deckenplatte|odenwald/i, 'Mineralfaser-Deckenplatten', 'Trockenbau'],
  [/brandschutzplatte|silikatplatte|fireboard|promat/i, 'Brandschutzplatten', 'Trockenbau'],
  [/osb/i, 'OSB-Platten', 'Trockenbau'],
  [/spanplatte|holzwerkstoff|mdf|sperrholz/i, 'Holzwerkstoffplatten', 'Trockenbau'],
  [/\bgkfi\b|\bgm-?fh?1?\b|feuchtraum-?\s*feuerschutz/i, 'Gipskartonplatten GKFI', 'Trockenbau'],
  [/\bgkbi\b|imprägniert|impraegniert|\bh2\b|grüne\s*platte|gruene\s*platte/i, 'Gipskartonplatten GKBI', 'Trockenbau'],
  [/\bgkf\b|feuerschutzplatte|\bdf\b-?platte/i, 'Gipskartonplatten GKF', 'Trockenbau'],
  [/\bgkb\b|gipskarton|rigips|gipsplatte|\bgk-?platte|trockenputz/i, 'Gipskartonplatten GKB', 'Trockenbau'],
  [/revisionsklappe|revisionsöffnung|revisionsoeffnung/i, 'Revisionsklappen', 'Trockenbau'],

  // Putz und Spachtel (genaue Putze vor allgemeinen)
  [/fugenfüller|fugenfueller|fugenspachtel|uniflott|fugenfüll/i, 'Fugenfüller', 'Putz und Spachtel'],
  [/kalkglätte|kalkglaette|kalkspachtel|marmorputz|tadelakt|stucco|stuckmarmor/i, 'Kalkglätte', 'Putz und Spachtel'],
  [/haftputz|\bhp\s*100\b|rotband|haftputzgips/i, 'Haftputz HP 100', 'Putz und Spachtel'],
  [/\bmp\s*75\b|maschinenputz|gipsputz|gips-?kalk-?putz|gipskalkputz/i, 'Gipsputz (Maschinenputz)', 'Putz und Spachtel'],
  [/sanierputz|wtA-?putz|salzspeicher/i, 'Sanierputz', 'Putz und Spachtel'],
  [/wärmedämmputz|waermedaemmputz|dämmputz|daemmputz|perlite-?putz/i, 'Wärmedämmputz', 'Putz und Spachtel'],
  [/lehmputz|lehm-?edelputz|lehmfeinputz|lehmoberputz/i, 'Lehmputz', 'Putz und Spachtel'],
  [/kalk-?\s*zement|kalkzement/i, 'Kalkzement-Leichtputz', 'Putz und Spachtel'],
  [/zementputz|sockelputz/i, 'Zementputz', 'Putz und Spachtel'],
  [/kalkputz|naturkalkputz|kalkfeinputz|kalk-?grundputz/i, 'Kalkputz', 'Putz und Spachtel'],
  [/armierung\w*\s*spachtel|armierungsmörtel|armierungsmoertel|klebe-?\s*und\s*armier|spachtelmörtel|spachtelmoertel/i, 'Armierungsspachtel', 'Putz und Spachtel'],
  [/streichputz|rollputz/i, 'Streichputz', 'Putz und Spachtel'],
  [/silikonharzputz|siliconharzputz/i, 'Silikonharzputz', 'Putz und Spachtel'],
  [/silikatputz/i, 'Silikatputz', 'Putz und Spachtel'],
  [/kunstharzputz|dispersionsputz|buntsteinputz|mosaikputz/i, 'Kunstharzputz', 'Putz und Spachtel'],
  [/oberputz|edelputz|scheibenputz|reibeputz|kratzputz|rauputz|strukturputz|filzputz|dekorputz|modellierputz/i, 'Oberputz', 'Putz und Spachtel'],
  [/grundputz|unterputz|leichtputz|fertigputz|innenputz|außenputz|aussenputz/i, 'Grundputz', 'Putz und Spachtel'],
  [/flächenspachtel|flaechenspachtel|feinspachtel|spachtelmasse|fertigspachtel|füllspachtel|fuellspachtel|reparaturspachtel|finish|q[234]-?spachtel|(?<!fließ|fliess)spachtel/i, 'Spachtelmasse', 'Putz und Spachtel'],
  [/ansetzgips|ansetzbinder|perlfix/i, 'Ansetzgips', 'Putz und Spachtel'],
  [/stuckgips|modellgips|alabaster|\bgips\b/i, 'Gips (Stuckgips)', 'Putz und Spachtel'],

  // Mörtel und Kleber
  [/fliesenkleber|flexkleber|flexmörtel|flexmoertel|dünnbettmörtel|duennbettmoertel/i, 'Fliesenkleber', 'Mörtel und Kleber'],
  [/fugenmörtel|fugenmoertel|fugmasse|fliesenfug/i, 'Fugenmörtel (Fliesen)', 'Mörtel und Kleber'],
  [/klebemörtel|klebemoertel|dämmplattenkleber|daemmplattenkleber|wdvs-?kleber|klebeschaum/i, 'Klebemörtel (WDVS)', 'Mörtel und Kleber'],
  [/kleber/i, 'Kleber', 'Mörtel und Kleber'],
  [/estrich|ausgleichsmasse|nivelliermasse|bodenausgleich|fließspachtel|fliessspachtel/i, 'Estrich / Ausgleichsmasse', 'Mörtel und Kleber'],
  [/mauermörtel|mauermoertel|mörtel|moertel|reparaturmörtel/i, 'Mörtel', 'Mörtel und Kleber'],
  [/beton(?!kontakt)/i, 'Beton', 'Mörtel und Kleber'],
  [/zement/i, 'Zement', 'Mörtel und Kleber'],
  [/\bsand\b|quarzsand|estrichsand/i, 'Sand', 'Mörtel und Kleber'],

  // Dämmung
  [/dämmstoffdübel|daemmstoffduebel|tellerdübel|tellerduebel|schraubdübel|schraubduebel|wdvs-?dübel|dübelteller/i, 'Dämmstoffdübel', 'Dämmung'],
  [/\beps\b|styropor|polystyrol/i, 'EPS-Dämmplatten', 'Dämmung'],
  [/\bxps\b|perimeter/i, 'XPS-Dämmplatten', 'Dämmung'],
  [/holzfaser|steico|pavatex|gutex/i, 'Holzfaser-Dämmplatten', 'Dämmung'],
  [/\bpir\b|\bpur\b-?\s*(dämm|platte)|polyurethan/i, 'PIR/PUR-Dämmplatten', 'Dämmung'],
  [/mineraldämmplatte|mineraldaemmplatte|multipor|calciumsilikat|kalziumsilikat|klimaplatte|innendämm|innendaemm/i, 'Mineraldämmplatten (Innendämmung)', 'Dämmung'],
  [/lamelle|mineralwolle|steinwolle|glaswolle|klemmfilz|dämmfilz|daemmfilz|\bmw\b|rockwool|isover/i, 'Mineralwolle', 'Dämmung'],
  [/trittschall|randdämmstreifen|randdaemmstreifen/i, 'Trittschall- und Randdämmung', 'Dämmung'],
  [/hanf|zellulose|flachs|schafwolle|kork/i, 'Naturdämmstoff', 'Dämmung'],
  [/pu[- ]?schaum|bauschaum|montageschaum|pistolenschaum|fensterschaum/i, 'PU-Schaum', 'Dämmung'],

  // Befestigung
  [/schnellbauschraube|trockenbauschraube|\bsn\s*\d|\btn\s*\d|blechschraube|bohrschraube|schraube/i, 'Schrauben', 'Befestigung'],
  [/direktabhänger|direktabhaenger|noniusabhänger|nonius|schnellspannabhänger|abhänger|abhaenger|abhängedraht|ösendraht|oesendraht|ankerhänger|ankerhaenger/i, 'Abhänger', 'Befestigung'],
  [/kreuzverbinder|längsverbinder|laengsverbinder|ankerwinkel|verbinder/i, 'Profilverbinder', 'Befestigung'],
  [/deckennagel|nageldübel|nagelduebel|schlagdübel|schlagduebel|hohlraumdübel|hohlraumduebel|klappdübel|klappduebel|dübel|duebel|nägel|naegel|nagel/i, 'Dübel und Nägel', 'Befestigung'],
  [/klammer|tacker/i, 'Klammern', 'Befestigung'],

  // Maler und Hilfsstoffe
  [/tiefgrund|tiefengrund|grundierung|sperrgrund|isoliergrund|haftgrund/i, 'Grundierung', 'Maler und Hilfsstoffe'],
  [/putzgrund|quarzgrund|aufbrennsperre|kornputzgrund/i, 'Putzgrund', 'Maler und Hilfsstoffe'],
  [/haftbrücke|haftbruecke|betonkontakt|haftemulsion|vorspritz|spritzbewurf/i, 'Haftbrücke', 'Maler und Hilfsstoffe'],
  [/kalkfarbe|sumpfkalk/i, 'Kalkfarbe', 'Maler und Hilfsstoffe'],
  [/silikatfarbe|dispersionssilikat/i, 'Silikatfarbe', 'Maler und Hilfsstoffe'],
  [/fassadenfarbe|siliconharzfarbe|silikonharzfarbe/i, 'Fassadenfarbe', 'Maler und Hilfsstoffe'],
  [/farbe|dispersion|anstrich|lasur|lack/i, 'Farbe', 'Maler und Hilfsstoffe'],
  [/acryl|silikon|dichtstoff|fugenmasse/i, 'Acryl / Silikon', 'Maler und Hilfsstoffe'],
  [/tapetenentferner|tapetenlöser|tapetenloeser|ablöser|abloeser/i, 'Tapetenentferner', 'Maler und Hilfsstoffe'],
  [/tapete|raufaser|malervlies|glasvlies|renoviervlies/i, 'Tapete / Malervlies', 'Maler und Hilfsstoffe'],
  [/kleister/i, 'Kleister', 'Maler und Hilfsstoffe'],
  [/vlies/i, 'Abdeckvlies', 'Maler und Hilfsstoffe'],
  [/abdeckpapier|abdeckpappe|schutzpappe|malerpappe/i, 'Abdeckpappe', 'Maler und Hilfsstoffe'],
  [/folie|abdeckplane|\bplane\b/i, 'Abdeckfolie', 'Maler und Hilfsstoffe'],
  [/goldband|kreppband|klebeband|malerband|putzerband|abklebeband|tesa|gewebeband/i, 'Klebeband', 'Maler und Hilfsstoffe'],
  [/schleifpapier|schleifgitter|schleifscheibe|schleifmittel/i, 'Schleifmittel', 'Maler und Hilfsstoffe'],
];

const ZAHL = /^\d+(?:[.,]\d+)?$/;
const zahl = (t) => {
  const w = t.toLowerCase();
  if (ZAHL.test(t)) return Number(t.replace(',', '.'));
  return Object.hasOwn(ZAHLWORTE, w) ? ZAHLWORTE[w] : null;
};
const einheit = (t) => {
  const e = EINHEITEN.find(([re]) => re.test(t));
  return e ? { einheit: e[1], faktor: e[2], mass: e[3] } : null;
};
const runden = (x) => Math.round(x * 1000) / 1000;

// „10m2“ → „10 m2“, „2,5m“ → „2,5 m“, „5x2,5m“ → „5 x 2,5 m“
function woerter(text) {
  return text
    .replace(/(\d)([a-zA-Zäöüß²³])/g, '$1 $2')
    .replace(/(\d)\s*[x×*]\s*(\d)/g, '$1 x $2')
    .replace(/[()]/g, ' ')
    .split(/\s+/).filter(Boolean);
}

// Ein Stück Text wie „Vier Platten gkb 10m2 inklusive Verschnitt“ zerlegen.
// Liefert { mengen: [{ menge, einheit, mass, von, bis }], tokens }
function mengenFinden(text) {
  const tokens = woerter(text);
  const mengen = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = zahl(tokens[i].replace(/[.,:;]$/, ''));
    if (n == null) continue;
    let j = i + 1;
    let faktor = n;
    // „5 à 2,5 m“, „5 x 2,5 m“, „5 Stück à 2,5 m“
    const st = tokens[j] && einheit(tokens[j]);
    if (st && !st.mass && /^(à|a|á|x|je)$/i.test(tokens[j + 1] || '') && tokens[j + 2] && zahl(tokens[j + 2]) != null) j += 1;
    if (/^(à|a|á|x|je)$/i.test(tokens[j] || '') && tokens[j + 1] && zahl(tokens[j + 1]) != null) {
      faktor = n * zahl(tokens[j + 1]);
      j += 2;
    }
    const roh = (tokens[j] || '').replace(/[.,:;]$/, '');
    if (ABMESSUNG.test(roh)) { i = j; continue; }
    const e = einheit(roh);
    if (e) {
      mengen.push({ menge: runden(faktor * e.faktor), einheit: e.einheit, mass: e.mass, von: i, bis: j });
      i = j;
    } else if (ZAHL.test(tokens[i]) && faktor === n) {
      // Zahl ohne Einheit („3 Eckschienen“) zählt als Stück, außer sie steht hinter dem Namen („HP 100“)
      if (i === 0) mengen.push({ menge: n, einheit: 'Stück', mass: false, von: i, bis: i, ohneEinheit: true });
    }
  }
  return { mengen, tokens };
}

const VERSCHNITT = /\b(inkl\.?|inklusive|incl\.?|mit)\s+verschnitt\b/i;
const CIRCA = /\b(ca\.?|circa|zirka|etwa|ungefähr|ungefaehr)(?=\s|$)/gi;

// Teilt einen Eintrag in einzelne Materialien. Komma trennt, aber nicht in Dezimalzahlen;
// ein Stück ohne Menge gehört zum Nachbarn („20 kg Kalkzement, leicht Putz“, „EPS 120 mm, ca. 11 m²“).
export function zerlegen(text) {
  const stuecke = [];
  for (const zeile of String(text || '').split(/\n+|;|\s+\+\s+/)) {
    const teile = zeile.split(/,(?!\d)/).map((s) => s.trim().replace(/[.]+$/, '').trim()).filter(Boolean);
    let offen = null; // Stück ohne Menge, das auf das nächste wartet
    const zeilenStuecke = [];
    for (const t of teile) {
      const hatMenge = mengenFinden(t).mengen.length > 0;
      if (/^\d+(?:[.,]\d+)?$/.test(t) && zeilenStuecke.length) {
        zeilenStuecke[zeilenStuecke.length - 1] += ` ${t}`; // „50 Kilo HP, 100“
      } else if (hatMenge) {
        zeilenStuecke.push(offen ? `${offen}, ${t}` : t);
        offen = null;
      } else if (zeilenStuecke.length && !offen) {
        zeilenStuecke[zeilenStuecke.length - 1] += `, ${t}`;
      } else {
        offen = offen ? `${offen}, ${t}` : t;
      }
    }
    if (offen) zeilenStuecke.push(offen);
    stuecke.push(...zeilenStuecke);
  }
  return stuecke;
}

function bekannt(text) {
  const b = BEKANNT.find(([re]) => re.test(text));
  if (!b) return null;
  let name = b[1];
  if (b[2] === 'Dämmung' && /platten/i.test(name)) {
    const dicke = text.match(/(\d+)\s*mm/i);
    if (dicke) name += ` ${dicke[1]} mm`;
  }
  return { name, gruppe: b[2] };
}

const FUELLWORTE = /^(à|a|á|x|je|und|mit|von|vom|der|die|das|den|dem|des|zum|zur|für|fuer|stück|stk\.?)$/i;

// Ein Material aus einem Stück Text: { original, name, gruppe, menge, einheit, hinweis }
// menge ist null, wenn keine Menge erkennbar ist.
export function materialLesen(stueck) {
  const original = stueck.trim();
  const ohneVerschnitt = original.replace(VERSCHNITT, ' ');
  const ohneCirca = ohneVerschnitt.replace(CIRCA, ' ');
  const { mengen, tokens } = mengenFinden(ohneCirca);
  const hinweise = [];
  if (CIRCA.test(original)) hinweise.push('ca.');
  CIRCA.lastIndex = 0;
  if (VERSCHNITT.test(original)) hinweise.push('inkl. Verschnitt');
  // Maß (kg, m², m …) geht vor Zählung (Platten, Dosen); weitere Mengen kommen in den Hinweis
  const haupt = mengen.find((m) => m.mass) || mengen[0] || null;
  for (const m of mengen) if (m !== haupt) hinweise.push(mengeText(m.menge, m.einheit));
  const raus = new Set();
  for (const m of mengen) for (let k = m.von; k <= m.bis; k++) raus.add(k);
  for (let k = 0; k < tokens.length; k++) {
    if (/^(à|a|á|x|je)$/i.test(tokens[k]) && (raus.has(k - 1) || raus.has(k + 1))) raus.add(k);
  }
  let rest = tokens.filter((_, k) => !raus.has(k)).join(' ')
    .replace(/\s+,/g, ',').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').replace(/\s{2,}/g, ' ');
  rest = rest.split(' ').filter((w, k, a) => !(FUELLWORTE.test(w) && (k === 0 || k === a.length - 1))).join(' ');
  const b = bekannt(rest || original);
  const name = b ? b.name : grossAnfang(rest || original);
  return {
    original,
    name,
    gruppe: b ? b.gruppe : 'Sonstiges',
    menge: haupt ? haupt.menge : null,
    einheit: haupt ? haupt.einheit : '',
    hinweis: hinweise.join(', '),
    bekannt: !!b,
  };
}

const grossAnfang = (s) => (s ? s[0].toLocaleUpperCase('de') + s.slice(1) : s);

const EINZAHL = { Dosen: 'Dose', Rollen: 'Rolle', Platten: 'Platte', Kartuschen: 'Kartusche', Pakete: 'Paket', Tuben: 'Tube', Flaschen: 'Flasche', Stangen: 'Stange' };
// „1 Rolle“, „3 Rollen“
export const einheitText = (menge, e) => (menge === 1 && EINZAHL[e] ? EINZAHL[e] : e);
export const mengeText = (menge, e) => `${zahlText(menge)} ${einheitText(menge, e)}`.trim();

export function zahlText(x) {
  if (x == null) return '';
  return Number(x).toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

// Alle Rapporte → { eintraege, summen, ohneMenge }
// eintraege: je Datum und Material; summen: gleiche Materialien (Name + Einheit) addiert.
export function materialListe(rapporte) {
  const eintraege = [];
  const ohneMenge = [];
  const sortiert = [...rapporte].sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
  for (const r of sortiert) {
    for (const stueck of zerlegen(r.material)) {
      const m = { ...materialLesen(stueck), datum: r.datum, berichtId: r.id, baustelle: r.baustelle || '' };
      (m.menge == null ? ohneMenge : eintraege).push(m);
    }
  }
  const map = new Map();
  for (const e of eintraege) {
    const key = `${e.name.toLowerCase()}|${e.einheit}`;
    if (!map.has(key)) map.set(key, { name: e.name, gruppe: e.gruppe, einheit: e.einheit, menge: 0, daten: [], hinweise: [] });
    const s = map.get(key);
    s.menge = runden(s.menge + e.menge);
    s.daten.push({ datum: e.datum, menge: e.menge });
    s.hinweise.push(e.hinweis.split(', ').filter((h) => h && !/^\d/.test(h)));
  }
  // Hinweis („ca.“, „inkl. Verschnitt“) bei der Summe nur, wenn er für alle Einträge gilt
  const summen = [...map.values()]
    .map(({ hinweise, ...s }) => ({ ...s, hinweis: hinweise[0].filter((h) => hinweise.every((l) => l.includes(h))).join(', ') }))
    .sort((a, b) => GRUPPEN.indexOf(a.gruppe) - GRUPPEN.indexOf(b.gruppe) || a.name.localeCompare(b.name, 'de'));
  return { eintraege, summen, ohneMenge };
}

// ---------- Excel ----------
// Kleine .xlsx-Datei ohne Bibliothek: drei Blätter (Zusammenfassung, Je Datum, Ohne Menge).

const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const spalte = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const datumText = (iso) => (iso ? iso.split('-').reverse().join('.') : '');

// rows: Arrays aus Zahlen/Texten; { fett: true } als erstes Element macht die Zeile fett
function blatt(breiten, rows) {
  const zeilen = rows.map((row, ri) => {
    const fett = row[0]?.fett;
    const zellen = (fett ? row.slice(1) : row).map((v, ci) => {
      const ref = `${spalte(ci)}${ri + 1}`;
      const s = fett ? ' s="1"' : '';
      if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
      if (v == null || v === '') return '';
      return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${zellen}</row>`;
  }).join('');
  const cols = breiten.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${zeilen}</sheetData></worksheet>`;
}

export function materialXlsx(liste, titel) {
  const { summen, eintraege, ohneMenge } = liste;
  const F = { fett: true };
  const blaetter = [
    ['Zusammenfassung', blatt([22, 34, 10, 9, 60, 24], [
      [F, `Materialliste – ${titel}`], [],
      [F, 'Gruppe', 'Material', 'Menge', 'Einheit', 'Datum (Menge)', 'Hinweis'],
      ...summen.map((s) => [s.gruppe, s.name, s.menge, einheitText(s.menge, s.einheit),
        s.daten.map((d) => `${datumText(d.datum).slice(0, 6)} (${zahlText(d.menge)})`).join(', '), s.hinweis]),
    ])],
    ['Je Datum', blatt([12, 44, 22, 30, 9, 9, 26], [
      [F, 'Datum', 'Eintrag im Rapport', 'Gruppe', 'Material', 'Menge', 'Einheit', 'Hinweis'],
      ...eintraege.map((e) => [datumText(e.datum), e.original, e.gruppe, e.name, e.menge, einheitText(e.menge, e.einheit), e.hinweis]),
    ])],
    ['Ohne Menge', blatt([12, 90], [
      [F, 'Datum', 'Eintrag im Rapport'],
      ...ohneMenge.map((e) => [datumText(e.datum), e.original]),
    ])],
  ];
  const dateien = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${blaetter.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${blaetter.map(([n], i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${blaetter.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${blaetter.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  blaetter.forEach(([, inhalt], i) => { dateien[`xl/worksheets/sheet${i + 1}.xml`] = inhalt; });
  return zipOhneKompression(dateien);
}

let CRC_TABELLE;
function crc32(bytes) {
  CRC_TABELLE ||= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABELLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ZIP im Modus „gespeichert“ (ohne Packen); reicht für Excel und bleibt klein im Code.
function zipOhneKompression(dateien) {
  const enc = new TextEncoder();
  const teile = [];
  const zentral = [];
  let pos = 0;
  for (const [name, text] of Object.entries(dateien)) {
    const n = enc.encode(name);
    const d = enc.encode(text);
    const crc = crc32(d);
    const lokal = new DataView(new ArrayBuffer(30));
    lokal.setUint32(0, 0x04034b50, true);
    lokal.setUint16(4, 20, true);
    lokal.setUint16(6, 0x0800, true); // Namen in UTF-8
    lokal.setUint32(14, crc, true);
    lokal.setUint32(18, d.length, true);
    lokal.setUint32(22, d.length, true);
    lokal.setUint16(26, n.length, true);
    teile.push(new Uint8Array(lokal.buffer), n, d);
    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true);
    z.setUint16(4, 20, true);
    z.setUint16(6, 20, true);
    z.setUint16(8, 0x0800, true);
    z.setUint32(16, crc, true);
    z.setUint32(20, d.length, true);
    z.setUint32(24, d.length, true);
    z.setUint16(28, n.length, true);
    z.setUint32(42, pos, true);
    zentral.push(new Uint8Array(z.buffer), n);
    pos += 30 + n.length + d.length;
  }
  const zGroesse = zentral.reduce((s, t) => s + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(8, zentral.length / 2, true);
  ende.setUint16(10, zentral.length / 2, true);
  ende.setUint32(12, zGroesse, true);
  ende.setUint32(16, pos, true);
  const alle = [...teile, ...zentral, new Uint8Array(ende.buffer)];
  const out = new Uint8Array(alle.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of alle) { out.set(t, o); o += t.length; }
  return out;
}

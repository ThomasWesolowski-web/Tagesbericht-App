// Mitgelieferte Systeme für den Material-Planer nach Knauf-Unterlagen (Technische Blätter,
// Detailblätter). Mengen je m² Fläche ohne Verschnitt; Verschnitt steht am System.
// „Richtwert“ = aus Knauf-Achsabständen gerechnet, keine Knauf-Tabelle gefunden.
// Gebinde von Profilen und Schrauben sind übliche Handelsgrößen.

export const KNAUF_STAND = 'Okt. 2026';

const TIEFENGRUND = { name: 'Knauf Tiefengrund', menge: 0.1, einheit: 'l', gebinde: { name: 'Kanister', inhalt: 15, einheit: 'l' } };
const BETOKONTAKT = { name: 'Knauf Betokontakt', menge: 0.225, einheit: 'kg', gebinde: { name: 'Eimer', inhalt: 20, einheit: 'kg' } };
const PLATTE = { name: 'Gipskartonplatte GKB 12,5 mm', menge: 1, einheit: 'm²', gebinde: { name: 'Platte', inhalt: 2.5, einheit: 'm²' } };
const SCHRAUBE_25 = (menge) => ({ name: 'Schnellbauschraube TN 3,5×25', menge, einheit: 'Stk', gebinde: { name: 'Paket', inhalt: 1000, einheit: 'Stk' } });
const UNIFLOTT = (menge) => ({ name: 'Knauf Uniflott', menge, einheit: 'kg', gebinde: { name: 'Sack', inhalt: 25, einheit: 'kg' } });
const CD = (menge) => ({ name: 'CD-Profil 60/27', menge, einheit: 'm', gebinde: { name: 'Stange', inhalt: 4, einheit: 'm' } });
const UD = (menge) => ({ name: 'UD-Profil 28/27', menge, einheit: 'm', gebinde: { name: 'Stange', inhalt: 3, einheit: 'm' } });
const DICKE = (wert, name = 'Putzdicke') => [{ key: 'dicke', name, einheit: 'mm', wert }];

export const KNAUF_SYSTEME = [
  {
    id: 'knauf-mp75', name: 'MP 75 Maschinenputz, geglättet', bereiche: ['wand', 'decke'], hersteller: 'Knauf', verschnitt: 5,
    beschreibung: 'Gipsmaschinenputz einlagig auf Mauerwerk, gefilzt und geglättet. Mindestens 8 mm, Regeldicke 10 mm, auf Betondecken höchstens 15 mm. Saugenden Untergrund vorher mit Tiefengrund vorbehandeln.',
    quelle: 'Knauf Technisches Blatt P111.de MP 75 (08/2019): ca. 10 kg/m² je 10 mm; Tiefengrund K451.de (02/2019): 70–100 ml/m²',
    parameter: DICKE(10),
    aufbau: [{ name: 'Mauerwerk', dicke: 175, art: 'massiv' }, { name: 'Tiefengrund', dicke: 0, art: 'grund' }, { name: 'MP 75', dicke: 10, art: 'putz' }],
    positionen: [TIEFENGRUND, { name: 'Knauf MP 75', menge: 10, einheit: 'kg', jeParameter: 'dicke', bezug: 10, gebinde: { name: 'Sack', inhalt: 30, einheit: 'kg' } }],
  },
  {
    id: 'knauf-mp75-beton', name: 'MP 75 auf Beton (mit Betokontakt)', bereiche: ['wand', 'decke'], hersteller: 'Knauf', verschnitt: 5,
    beschreibung: 'Glatter Beton: zuerst Betokontakt (mindestens 12 Stunden trocknen lassen), dann MP 75. Auf Betondecken höchstens 15 mm.',
    quelle: 'Knauf Technisches Blatt K454.de Betokontakt (10/2021): ca. 225 g/m²; P111.de MP 75 (08/2019): ca. 10 kg/m² je 10 mm',
    parameter: DICKE(10),
    aufbau: [{ name: 'Beton', dicke: 180, art: 'massiv' }, { name: 'Betokontakt', dicke: 0, art: 'grund' }, { name: 'MP 75', dicke: 10, art: 'putz' }],
    positionen: [BETOKONTAKT, { name: 'Knauf MP 75', menge: 10, einheit: 'kg', jeParameter: 'dicke', bezug: 10, gebinde: { name: 'Sack', inhalt: 30, einheit: 'kg' } }],
  },
  {
    id: 'knauf-rotband', name: 'Rotband Haftputzgips (Handputz)', bereiche: ['wand', 'decke'], hersteller: 'Knauf', verschnitt: 5,
    beschreibung: 'Handputz einlagig, mindestens 5 mm, Regeldicke 10 mm; auf Betondecken höchstens 15 mm.',
    quelle: 'Knauf Produktinformation Rotband (10/2018): ca. 0,8 kg/m² je mm',
    parameter: DICKE(10),
    aufbau: [{ name: 'Mauerwerk', dicke: 175, art: 'massiv' }, { name: 'Tiefengrund', dicke: 0, art: 'grund' }, { name: 'Rotband', dicke: 10, art: 'putz' }],
    positionen: [TIEFENGRUND, { name: 'Knauf Rotband', menge: 8, einheit: 'kg', jeParameter: 'dicke', bezug: 10, gebinde: { name: 'Sack', inhalt: 30, einheit: 'kg' } }],
  },
  {
    id: 'knauf-spachtel-q3', name: 'Flächenspachtel Q3 (Fill & Finish Light)', bereiche: ['wand', 'decke', 'schraege'], hersteller: 'Knauf', verschnitt: 5,
    beschreibung: 'Vollflächig spachteln auf Gipsplatten oder Putz, Schichtdicke etwa 1 mm. Vorher grundieren.',
    quelle: 'Knauf Technisches Blatt K495.de Fill & Finish Light (10/2015): ca. 1,1 kg/m² je mm; Q3-Dicke Richtwert',
    parameter: DICKE(1, 'Spachteldicke'),
    aufbau: [{ name: 'Gipsplatte oder Putz', dicke: 12.5, art: 'platte' }, { name: 'Tiefengrund', dicke: 0, art: 'grund' }, { name: 'Fill & Finish Light', dicke: 1, art: 'spachtel' }],
    positionen: [TIEFENGRUND, { name: 'Knauf Fill & Finish Light', menge: 1.1, einheit: 'kg', jeParameter: 'dicke', bezug: 1, gebinde: { name: 'Eimer', inhalt: 20, einheit: 'kg' } }],
  },
  {
    id: 'knauf-w61t', name: 'W61T Trockenputz (Platte mit Perlfix)', bereiche: ['wand'], hersteller: 'Knauf', verschnitt: 10,
    beschreibung: 'Gipsplatten 12,5 mm mit Perlfix-Batzen (alle 25–35 cm) auf die Wand angesetzt, Fugen mit Uniflott. Bei mehr als 20 mm Unebenheit zuerst Plattenstreifen setzen.',
    quelle: 'Knauf Produktinformation Perlfix (03/2015): ca. 5 kg/m²; Uniflott K4604_DSP.de (03/2025); Grundierung je nach Untergrund',
    parameter: [],
    aufbau: [{ name: 'Mauerwerk', dicke: 175, art: 'massiv' }, { name: 'Perlfix', dicke: 10, art: 'putz' }, { name: 'GKB 12,5 mm', dicke: 12.5, art: 'platte' }],
    positionen: [TIEFENGRUND, { name: 'Knauf Perlfix', menge: 5, einheit: 'kg', gebinde: { name: 'Sack', inhalt: 30, einheit: 'kg' } }, PLATTE, UNIFLOTT(0.25)],
  },
  {
    id: 'knauf-w623', name: 'W623 Vorsatzschale CD 60/27, direkt befestigt', bereiche: ['wand'], hersteller: 'Knauf', verschnitt: 10,
    beschreibung: 'UD 28/27 an Boden und Decke, CD 60/27 senkrecht alle 62,5 cm, Direktabhänger alle 1,50 m, 1× GKB 12,5 mm. Hohlraum für Dämmung oder Leitungen.',
    quelle: 'Knauf W61.ch Vorsatzschalen (04/2024), Achsabstände; Mengen Richtwerte (keine Knauf-Tabelle), Uniflott nach K4604_DSP.de (03/2025)',
    parameter: [],
    aufbau: [{ name: 'Mauerwerk', dicke: 175, art: 'massiv' }, { name: 'CD 60/27 + Direktabhänger', dicke: 27, art: 'profil' }, { name: 'GKB 12,5 mm', dicke: 12.5, art: 'platte' }],
    positionen: [
      CD(2.0), UD(0.8), { name: 'Dichtungsband', menge: 0.8, einheit: 'm', gebinde: { name: 'Rolle', inhalt: 30, einheit: 'm' } },
      { name: 'Direktabhänger', menge: 1.1, einheit: 'Stk' }, { name: 'Dübel', menge: 1.9, einheit: 'Stk' },
      { name: 'Blechschraube LN 3,5×11', menge: 2.2, einheit: 'Stk' }, PLATTE, SCHRAUBE_25(15), UNIFLOTT(0.25),
    ],
  },
  {
    id: 'knauf-d112', name: 'D112 Decke abgehängt, CD-Unterkonstruktion', bereiche: ['decke'], hersteller: 'Knauf', verschnitt: 10,
    beschreibung: 'Grundprofil CD 60/27 alle 1,00 m, Tragprofil CD 60/27 alle 50 cm mit Kreuzverbindern, Nonius- oder Schnellabhänger alle 95 cm, UD 28/27 am Rand, 1× GKB 12,5 mm quer verlegt.',
    quelle: 'Knauf Detailblatt D11.de (11/2015), Achsabstände; Mengen Richtwerte, UD/Schrauben wie D61, Uniflott nach K4604_DSP.de (03/2025)',
    parameter: [],
    aufbau: [{ name: 'Rohdecke', dicke: 180, art: 'massiv' }, { name: 'Abhänger (Hohlraum)', dicke: 60, art: 'luft' }, { name: 'CD 60/27 Grund- und Tragprofil', dicke: 54, art: 'profil' }, { name: 'GKB 12,5 mm', dicke: 12.5, art: 'platte' }],
    positionen: [
      { name: 'Abhänger (Nonius / Schnellabhänger)', menge: 1.1, einheit: 'Stk' }, { name: 'Deckennagel', menge: 1.8, einheit: 'Stk' },
      CD(3.2), { name: 'Kreuzverbinder', menge: 2.0, einheit: 'Stk' }, { name: 'Längsverbinder', menge: 0.6, einheit: 'Stk' }, UD(0.4),
      PLATTE, SCHRAUBE_25(17), UNIFLOTT(0.3), { name: 'Trenn-Fix 65', menge: 0.4, einheit: 'm', gebinde: { name: 'Rolle', inhalt: 50, einheit: 'm' } },
    ],
  },
  {
    id: 'knauf-d612', name: 'D612 Dachschräge unter Sparren (CD + Direktabhänger)', bereiche: ['schraege', 'decke'], hersteller: 'Knauf', verschnitt: 10,
    beschreibung: 'Dämmung zwischen den Sparren, Dampfbremse nach Bedarf, Direktabhänger an den Sparren, CD 60/27 alle 50 cm, 1× GKB 12,5 mm. Dämmung und Dampfbremse sind nicht mitgerechnet.',
    quelle: 'Knauf Detailblatt D61 Dachgeschoss-Bekleidungen (ältere Ausgabe, Materialbedarf 10×10 m); Achsabstände D61.de (06/2016)',
    parameter: [],
    aufbau: [{ name: 'Sparren mit Dämmung', dicke: 160, art: 'holz' }, { name: 'Dampfbremse', dicke: 0, art: 'luft' }, { name: 'CD 60/27 + Direktabhänger', dicke: 27, art: 'profil' }, { name: 'GKB 12,5 mm', dicke: 12.5, art: 'platte' }],
    positionen: [
      { name: 'Direktabhänger', menge: 1.9, einheit: 'Stk' }, { name: 'Blechschraube LN 3,5×9', menge: 3.8, einheit: 'Stk' }, { name: 'Holzschraube FN 5,1×35', menge: 1.9, einheit: 'Stk' },
      CD(2.1), UD(0.4), { name: 'Deckennagel', menge: 0.7, einheit: 'Stk' }, PLATTE, SCHRAUBE_25(17), UNIFLOTT(0.3),
      { name: 'Trenn-Fix 65', menge: 0.4, einheit: 'm', gebinde: { name: 'Rolle', inhalt: 50, einheit: 'm' } },
    ],
  },
];

// Bedenkenanmeldung nach § 4 Abs. 3 VOB/B: Vorlagen für typische Anlässe im Stuckateur-,
// Putz-, Trockenbau- und Malerbetrieb und der Brieftext fürs PDF. Ohne Abhängigkeiten,
// damit es mit Node getestet werden kann (tests/bedenken.test.mjs).
// Der Text ist eine Vorlage, keine Rechtsberatung. Das Schreiben ist immer deutsch.

// Wogegen sich die Bedenken richten (die drei Fälle aus § 4 Abs. 3 VOB/B)
export const GEGEN = [
  { id: 'ausfuehrung', label: 'Vorgesehene Art der Ausführung', brief: 'die vorgesehene Art der Ausführung (einschließlich der Sicherung gegen Unfallgefahren)' },
  { id: 'stoffe', label: 'Stoffe oder Bauteile vom Auftraggeber', brief: 'die Güte der von Ihnen gelieferten oder vorgeschriebenen Stoffe oder Bauteile' },
  { id: 'vorleistung', label: 'Leistung eines anderen Unternehmers', brief: 'die Leistungen anderer Unternehmer (Vorleistung)' },
];

// Typische Anlässe. Antippen übernimmt die Texte in Sachverhalt, Folgen und Vorschlag.
export const ANLAESSE = [
  {
    id: 'feuchte', label: 'Untergrund zu feucht', gegen: ['vorleistung'],
    sachverhalt: 'Der Untergrund (Mauerwerk, Beton bzw. Estrich) weist eine zu hohe Restfeuchte auf und ist für die Aufnahme unserer Leistung derzeit nicht ausreichend trocken.',
    folgen: 'Ablösungen, Risse, Ausblühungen, Verfärbungen und Schimmelbildung; die vereinbarten Eigenschaften von Putz bzw. Beschichtung werden nicht erreicht.',
    vorschlag: 'Ausreichende Trocknungszeit bzw. technische Trocknung und Feuchtemessung vor Beginn unserer Arbeiten.',
  },
  {
    id: 'tragfaehig', label: 'Untergrund nicht tragfähig', gegen: ['vorleistung'],
    sachverhalt: 'Der Untergrund ist nicht ausreichend tragfähig (z. B. sandend, mürbe, verschmutzt, lose Altbeschichtungen oder Reste von Trennmitteln).',
    folgen: 'Haftungsverlust, Ablösen und Abplatzen von Putz, Spachtelung bzw. Beschichtung.',
    vorschlag: 'Vorbehandlung des Untergrunds (lose Teile entfernen, reinigen, festigen bzw. grundieren) als zusätzliche Leistung beauftragen oder durch den Vorunternehmer herstellen lassen.',
  },
  {
    id: 'toleranzen', label: 'Maßtoleranzen überschritten', gegen: ['vorleistung'],
    sachverhalt: 'Die Vorleistung überschreitet die zulässigen Maß- und Ebenheitstoleranzen nach DIN 18202 (z. B. Wände bzw. Decken nicht lot- oder fluchtgerecht, unebene Flächen).',
    folgen: 'Die geforderte Ebenheit bzw. Oberflächenqualität ist mit der vorgesehenen Schichtdicke nicht erreichbar; Mehrstärken führen zu Rissen, längeren Trocknungszeiten und Mehrkosten.',
    vorschlag: 'Nacharbeit durch den Vorunternehmer oder Ausgleich in Mehrstärke als zusätzliche Leistung nach Ihrer Anordnung.',
  },
  {
    id: 'witterung', label: 'Witterung / Temperatur außen', gegen: ['ausfuehrung'],
    sachverhalt: 'Die Witterung ist für die vorgesehenen Arbeiten derzeit ungeeignet (Luft- bzw. Untergrundtemperatur unter +5 °C, Frost, Schlagregen oder starke Sonneneinstrahlung).',
    folgen: 'Frostschäden, unzureichende Erhärtung und Haftung, Risse, Verfärbungen und Abmehlen von Putz bzw. Beschichtung.',
    vorschlag: 'Verschiebung der Arbeiten bis zu geeigneter Witterung oder Schutzmaßnahmen (Einhausung, Beheizung) als zusätzliche Leistung.',
  },
  {
    id: 'raumklima', label: 'Raumklima innen ungeeignet', gegen: ['ausfuehrung'],
    sachverhalt: 'Im Gebäude herrschen für Putz-, Spachtel- bzw. Trockenbauarbeiten ungeeignete Bedingungen (zu niedrige Raumtemperatur, zu hohe Luftfeuchtigkeit, fehlende Beheizung oder Lüftung, offene Fenster- bzw. Türöffnungen).',
    folgen: 'Verlängerte Trocknung, Verformung von Gipsplatten, Fugenrisse, Schimmelbildung sowie Mängel bei Haftung und Festigkeit.',
    vorschlag: 'Für ausreichende Beheizung und Lüftung sowie eine geschlossene Gebäudehülle sorgen; die Arbeiten erst danach fortsetzen.',
  },
  {
    id: 'anschluesse', label: 'Anschlüsse anderer Gewerke fehlen', gegen: ['vorleistung'],
    sachverhalt: 'Für unsere Leistung erforderliche Vorleistungen bzw. Anschlüsse anderer Gewerke fehlen oder sind mangelhaft (z. B. Fensterbänke, Fensteranschlüsse und Abdichtungen, Dachanschlüsse, Elektro- oder Sanitärinstallation).',
    folgen: 'Unsere Leistung kann nicht fachgerecht an- und abgeschlossen werden; spätere Anschlussarbeiten führen zu Beschädigungen, Undichtigkeiten und Rissen.',
    vorschlag: 'Fertigstellung der fehlenden Vorleistungen vor Beginn bzw. Fortsetzung unserer Arbeiten.',
  },
  {
    id: 'material', label: 'Material vom Auftraggeber ungeeignet', gegen: ['stoffe'],
    sachverhalt: 'Die von Ihnen gelieferten bzw. vorgeschriebenen Stoffe oder Bauteile sind für den vorgesehenen Zweck nach unserer Einschätzung nicht geeignet bzw. mangelhaft.',
    folgen: 'Mängel an der fertigen Leistung sowie Verlust der Herstellergewährleistung bzw. der Systemzulassung.',
    vorschlag: 'Verwendung geeigneter, zugelassener Stoffe nach Angaben des Herstellers.',
  },
  {
    id: 'system', label: 'Vorgesehenes System ungeeignet', gegen: ['ausfuehrung'],
    sachverhalt: 'Die vorgesehene Art der Ausführung bzw. das vorgeschriebene System (z. B. Putzart auf diesem Untergrund, Gipsputz in Feuchträumen) entspricht nach unserer Auffassung nicht den anerkannten Regeln der Technik bzw. den Herstellerangaben.',
    folgen: 'Mängel wie Risse, Ablösungen und Feuchteschäden; die vereinbarte Beschaffenheit wird nicht erreicht.',
    vorschlag: 'Änderung der Ausführung in ein für Untergrund und Nutzung geeignetes System.',
  },
  {
    id: 'fugen', label: 'Bewegungsfugen fehlen', gegen: ['ausfuehrung'],
    sachverhalt: 'An Bauteilübergängen, Materialwechseln bzw. Gebäudetrennfugen sind keine Bewegungsfugen oder Trennungen vorgesehen.',
    folgen: 'Rissbildung im Putz bzw. in den Trockenbauflächen an den Übergängen.',
    vorschlag: 'Festlegung und Ausbildung von Bewegungsfugen bzw. Trennschnitten sowie Armierung an den Übergängen.',
  },
  {
    id: 'brandschutz', label: 'Brand- oder Schallschutz unklar', gegen: ['ausfuehrung'],
    sachverhalt: 'Für die vorgesehene Trockenbaukonstruktion liegen keine ausreichenden Angaben bzw. Nachweise zu den Anforderungen an Brand- oder Schallschutz vor, oder die vorgesehene Ausführung erfüllt diese Anforderungen nach unserer Einschätzung nicht.',
    folgen: 'Die Konstruktion erfüllt die Anforderungen nicht und kann so nicht abgenommen werden.',
    vorschlag: 'Vorlage der Anforderungen bzw. Festlegung einer geprüften Konstruktion (Systemnachweis) vor der Ausführung.',
  },
  {
    id: 'planung', label: 'Planung fehlt oder widersprüchlich', gegen: ['ausfuehrung'],
    sachverhalt: 'Für die Ausführung erforderliche Pläne, Details oder Angaben fehlen bzw. sind widersprüchlich.',
    folgen: 'Fehlerhafte Ausführung, Nacharbeiten und Verzögerungen.',
    vorschlag: 'Übergabe vollständiger und eindeutiger Ausführungsunterlagen bzw. schriftliche Klärung der offenen Punkte.',
  },
  {
    id: 'geruest', label: 'Gerüst ungeeignet oder unsicher', gegen: ['vorleistung', 'ausfuehrung'],
    sachverhalt: 'Das bauseits bzw. von einem anderen Unternehmer gestellte Gerüst ist für unsere Arbeiten ungeeignet oder entspricht nicht den Anforderungen an die Arbeitssicherheit (z. B. fehlender Seitenschutz, zu großer Wandabstand, fehlende Verankerung).',
    folgen: 'Gefahr für Leib und Leben; die Arbeiten können nicht sicher und fachgerecht ausgeführt werden.',
    vorschlag: 'Umbau bzw. Ergänzung des Gerüsts durch den Gerüstersteller und Freigabe vor Beginn unserer Arbeiten.',
  },
];

export const ANREDE = 'Sehr geehrte Damen und Herren,';

function datumDe(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

// Vorgeschlagene Antwortfrist: 5 Kalendertage nach dem Datum des Schreibens
export function fristVorschlag(iso, tage = 5) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + tage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Text eines Anlasses in ein Feld übernehmen bzw. wieder herausnehmen
export function textDazu(feld, text) {
  const alt = (feld || '').trim();
  if (!text || alt.includes(text)) return alt;
  return alt ? `${alt}\n${text}` : text;
}
export function textWeg(feld, text) {
  if (!text) return feld || '';
  return (feld || '').split('\n').filter((z) => z.trim() !== text).join('\n').trim();
}

// Was für eine vollständige Bedenkenanmeldung fehlt (null = alles da)
export function bedenkenFehlt(r) {
  if (!(r.auftraggeber || '').trim()) return { text: 'Bitte den Auftraggeber (Empfänger) eintragen.', sel: '#bd-ag' };
  if (!(r.bdGegen || []).length) return { text: 'Bitte wählen, wogegen sich die Bedenken richten.', sel: '#bd-gegen' };
  if (!(r.bdSachverhalt || '').trim()) return { text: 'Bitte den festgestellten Sachverhalt beschreiben.', sel: '#bd-sachverhalt' };
  return null;
}

// Brieftext für PDF und Markdown. fotos = Anzahl der Fotos in der Anlage.
export function bedenkenBrief(r, { fotos = 0 } = {}) {
  const gegen = GEGEN.filter((g) => (r.bdGegen || []).includes(g.id)).map((g) =>
    (g.id === 'vorleistung' && (r.bdVorleister || '').trim() ? `die Leistungen anderer Unternehmer (Vorleistung durch ${r.bdVorleister.trim()})` : g.brief));
  const leistung = (r.bdLeistung || '').trim();
  const frist = datumDe(r.bdFrist);
  const absaetze = [];
  absaetze.push({ text: `im Rahmen des uns erteilten Auftrags${leistung ? ` über ${leistung}` : ''} für das oben genannte Bauvorhaben haben wir die Ausführungsunterlagen, die örtlichen Gegebenheiten und die Vorleistungen geprüft. Dabei haben sich Bedenken ergeben, die wir Ihnen hiermit gemäß § 4 Abs. 3 VOB/B unverzüglich schriftlich mitteilen.` });
  if (gegen.length) absaetze.push({ titel: 'Unsere Bedenken richten sich gegen', liste: gegen });
  if ((r.bdSachverhalt || '').trim()) {
    absaetze.push({ titel: 'Festgestellter Sachverhalt', text: r.bdSachverhalt.trim() + (fotos ? `\nDer Zustand ist auf den beigefügten Fotos dokumentiert.` : '') });
  }
  if ((r.bdFolgen || '').trim()) absaetze.push({ titel: 'Mögliche Folgen bei unveränderter Ausführung', text: r.bdFolgen.trim() });
  if ((r.bdVorschlag || '').trim()) absaetze.push({ titel: 'Unser Vorschlag', text: r.bdVorschlag.trim() });
  absaetze.push({
    text: `Wir bitten Sie, unsere Bedenken zu prüfen und uns ${frist ? `bis spätestens ${frist}` : 'umgehend'} schriftlich mitzuteilen, wie weiter verfahren werden soll.${r.bdRuhen !== false ? ' Bis zu Ihrer Entscheidung stellen wir die von den Bedenken betroffenen Arbeiten zurück.' : ''}`,
  });
  absaetze.push({ text: 'Sollten Sie an der vorgesehenen Ausführung festhalten, bleiben Sie gemäß § 4 Abs. 3 VOB/B für Ihre Angaben, Anordnungen und Lieferungen verantwortlich. Für Mängel und Schäden, die auf die oben genannten Umstände zurückzuführen sind, übernehmen wir gemäß § 13 Abs. 3 VOB/B keine Haftung.' });
  if (r.bdBehinderung) {
    absaetze.push({ text: 'Soweit wir durch diese Umstände an der ordnungsgemäßen Ausführung unserer Leistung gehindert sind, zeigen wir hiermit zugleich eine Behinderung gemäß § 6 Abs. 1 VOB/B an. Die Ausführungsfristen verlängern sich entsprechend § 6 Abs. 2 VOB/B. Die Geltendmachung von Mehrkosten behalten wir uns vor.' });
  }
  absaetze.push({ text: 'Für Rückfragen und eine gemeinsame Besichtigung vor Ort stehen wir Ihnen gern zur Verfügung.' });
  return {
    betreff: 'Bedenkenanmeldung gemäß § 4 Abs. 3 VOB/B',
    anrede: (r.bdAnrede || '').trim() || ANREDE,
    absaetze,
    gruss: 'Mit freundlichen Grüßen',
    anlagen: fotos ? `Anlage: ${fotos} ${fotos === 1 ? 'Foto' : 'Fotos'}` : '',
  };
}

// Markdown-Fassung des Briefs fürs Repo
export function bedenkenMarkdown(r, { fotos = 0 } = {}) {
  const b = bedenkenBrief(r, { fotos });
  let md = `\n## ${b.betreff}\n\n`;
  if (r.auftraggeber) md += `**An:** ${[r.auftraggeber, r.bdAnschrift].filter((x) => (x || '').trim()).join(', ').replace(/\n+/g, ', ')}  \n`;
  if (r.bdFrist) md += `**Antwort erbeten bis:** ${datumDe(r.bdFrist)}  \n`;
  md += `\n${b.anrede}\n\n`;
  for (const a of b.absaetze) {
    if (a.titel) md += `**${a.titel}:**\n\n`;
    if (a.liste) md += a.liste.map((x) => `- ${x}`).join('\n') + '\n\n';
    if (a.text) md += `${a.text}\n\n`;
  }
  md += `${b.gruss}\n\n${r.bdUnterzeichner || ''}\n`;
  if (b.anlagen) md += `\n_${b.anlagen}_\n`;
  return md;
}

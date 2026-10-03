// Handbuch zur App: handbuch.md (Kopie des Handbuchs, wird mit jeder Version nachgezogen)
// als Seite anzeigen. Kleiner Markdown-Leser für Überschriften, Listen, Tabellen, fett, kursiv,
// Code und Links; mehr braucht das Handbuch nicht.

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function zeile(t) {
  let s = esc(t.replace(/\\([_*\\[\]()#|-])/g, '$1'));
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

const zellen = (z) => z.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function markdownZuHtml(md) {
  const zeilen = md.replace(/\r/g, '').split('\n');
  const aus = [];
  let i = 0;
  while (i < zeilen.length) {
    const z = zeilen[i];
    if (!z.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(z);
    if (h) {
      const n = Math.min(4, h[1].length + 1);
      aus.push(`<h${n}>${zeile(h[2])}</h${n}>`);
      i++;
      continue;
    }
    if (z.trim().startsWith('|')) {
      const block = [];
      while (i < zeilen.length && zeilen[i].trim().startsWith('|')) block.push(zeilen[i++]);
      const kopf = zellen(block[0]);
      const rumpf = block.slice(/^\s*\|\s*:?-{3,}/.test(block[1] || '') ? 2 : 1).map(zellen);
      aus.push(`<div class="hb-tabelle"><table><thead><tr>${kopf.map((c) => `<th>${zeile(c)}</th>`).join('')}</tr></thead>
        <tbody>${rumpf.map((r) => `<tr>${r.map((c) => `<td>${zeile(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const liste = /^(\d+\.|[-*])\s+/;
    if (liste.test(z)) {
      const geordnet = /^\d+\./.test(z);
      const punkte = [];
      while (i < zeilen.length && liste.test(zeilen[i])) punkte.push(zeilen[i++].replace(liste, ''));
      const tag = geordnet ? 'ol' : 'ul';
      aus.push(`<${tag}>${punkte.map((p) => `<li>${zeile(p)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const absatz = [];
    while (i < zeilen.length && zeilen[i].trim() && !/^(#{1,4}\s|\||\d+\.\s|[-*]\s)/.test(zeilen[i].trim())) absatz.push(zeilen[i++]);
    aus.push(`<p>${zeile(absatz.join(' '))}</p>`);
  }
  return aus.join('\n');
}

export async function handbuchLaden() {
  const r = await fetch('handbuch.md');
  if (!r.ok) throw new Error(`Handbuch nicht gefunden (${r.status})`);
  return markdownZuHtml(await r.text());
}

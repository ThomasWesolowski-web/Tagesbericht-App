// Hochladen der Berichte in ein GitHub-Repo.
// Jeder Bericht wird als ein Commit geschrieben (Git-Data-API): bericht.md,
// bericht.json und alle Anhänge landen zusammen in berichte/<datum>_<baustelle>/.

import * as db from './db.js';
import { blobToBase64, safeFileName, slug } from './media.js';
import { buildPdf, buildStundenPdf } from './pdf.js';
import { stundenMarkdown, stundenJson, personKey, stundenZusammenfuehren } from './stunden.js';
import { toJson, toMarkdown, formatDate, artLabel } from './report.js';
import { berichtInsDeutsche, insDeutsche, FREITEXTE } from './translate.js';
import { SPRACHEN } from './i18n.js';
import { planReportId } from './plaene.js';
import { urlaubLokal, urlaubLokalSpeichern } from './urlaub.js';
import { abrechnungLokal, abrechnungLokalSpeichern, abrechnungMischen } from './abrechnung.js';

const FELDNAMEN = { taetigkeiten: 'Ausgeführte Arbeiten', material: 'Material und Geräte', bemerkungen: 'Bemerkungen' };

const API = 'https://api.github.com';

class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function client(settings) {
  const base = `${API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`;
  return async function gh(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(path.startsWith('http') ? path : base + path, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${settings.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new GitHubError(0, 'Keine Verbindung zu GitHub.');
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hints = {
        401: 'Der Token ist ungültig oder abgelaufen.',
        403: 'Der Token darf dieses Repo nicht beschreiben (Recht „Contents: Read and write“ fehlt?).',
        404: 'Repo oder Branch nicht gefunden, oder der Token hat keinen Zugriff darauf.',
      };
      throw new GitHubError(res.status, hints[res.status] || data.message || `GitHub-Fehler ${res.status}`);
    }
    return data;
  };
}

export function isConfigured(settings) {
  return Boolean(settings.token && settings.owner && settings.repo && settings.branch);
}

export async function testConnection(settings) {
  const gh = client(settings);
  let repo;
  try {
    repo = await gh('');
  } catch (err) {
    if (err.status === 404) {
      throw new GitHubError(404, `Der Token sieht das Repo „${settings.owner}/${settings.repo}“ nicht. Prüfe die Schreibweise und ob beim Token unter „Repository access“ genau dieses Repo ausgewählt ist.`);
    }
    throw err;
  }
  if (!repo.permissions?.push) {
    throw new GitHubError(403, 'Der Token sieht das Repo, darf aber nicht schreiben. Beim Token unter „Permissions → Contents“ „Read and write“ wählen.');
  }
  try {
    await gh(`/branches/${encodeURIComponent(settings.branch)}`);
  } catch (err) {
    if (err.status === 404) throw new GitHubError(404, `Den Branch „${settings.branch}“ gibt es im Repo nicht.`);
    if (err.status === 403) throw new GitHubError(403, 'Dem Token fehlt das Recht „Contents: Read and write“.');
    throw err;
  }
  return { name: repo.full_name, private: repo.private };
}

// Schreibt Dateien (oder Löschungen) über die Contents-API, eine Datei nach der anderen.
// Das ist langsamer als ein einzelner Commit, funktioniert aber zuverlässig mit
// fein granularen Tokens.
function contentsPath(path) {
  return `/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function remoteShas(gh, settings, dir) {
  try {
    const list = await gh(`${contentsPath(dir)}?ref=${encodeURIComponent(settings.branch)}`);
    return new Map((Array.isArray(list) ? list : []).map((f) => [f.path, f.sha]));
  } catch (err) {
    if (err.status === 404) return new Map();
    throw err;
  }
}

// Aktueller Stand einer einzelnen Datei (die Ordnerliste von GitHub kann kurz veraltet sein).
async function freshSha(gh, settings, path) {
  try {
    const res = await gh(`${contentsPath(path)}?ref=${encodeURIComponent(settings.branch)}&t=${Date.now()}`);
    return res?.sha || null;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function commit(gh, settings, entries, message) {
  const dirs = [...new Set(entries.map((e) => e.path.slice(0, e.path.lastIndexOf('/'))))];
  const shas = new Map();
  for (const dir of dirs) for (const [k, v] of await remoteShas(gh, settings, dir)) shas.set(k, v);

  const run = async (e) => {
    if (e.delete) {
      const sha = shas.get(e.path);
      if (!sha) return;
      await gh(contentsPath(e.path), { method: 'DELETE', body: { message, sha, branch: settings.branch } });
      shas.delete(e.path);
    } else {
      const content = await blobToBase64(e.blob || new Blob([e.text], { type: 'text/plain;charset=utf-8' }));
      const body = { message, content, branch: settings.branch };
      if (shas.has(e.path)) body.sha = shas.get(e.path);
      const res = await gh(contentsPath(e.path), { method: 'PUT', body });
      shas.set(e.path, res?.content?.sha);
    }
  };

  for (const e of entries) {
    const step = e.delete ? `${e.path} löschen` : `${e.path} hochladen`;
    try {
      // Beim Löschen ohne bekannten Stand lieber einzeln nachsehen, ob die Datei existiert.
      if (e.delete && !shas.has(e.path)) {
        const sha = await freshSha(gh, settings, e.path);
        if (sha) shas.set(e.path, sha);
      }
      try {
        await run(e);
      } catch (err) {
        // 409/422: Stand der Datei war veraltet. Aktuellen Stand holen und einmal neu versuchen.
        if (err.status !== 409 && err.status !== 422) throw err;
        const sha = await freshSha(gh, settings, e.path);
        if (sha) shas.set(e.path, sha);
        else shas.delete(e.path);
        if (e.delete && !sha) continue;
        await run(e);
      }
    } catch (err) {
      err.message = `${err.message} (${step}, HTTP ${err.status})`;
      throw err;
    }
  }
}

async function pathExists(gh, settings, path) {
  try {
    await gh(`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(settings.branch)}`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

function folderPrefix(settings) {
  const f = (settings.folder || '').replace(/^\/+|\/+$/g, '');
  return f ? `${f}/` : '';
}

async function chooseRemoteDir(gh, settings, report) {
  const base = `${report.datum}_${slug(report.baustelle) || 'bericht'}${report.art === 'rapport' ? '_rapport' : report.art === 'aufmass' ? '_aufmass' : ''}`;
  let dir = base;
  for (let i = 2; await pathExists(gh, settings, folderPrefix(settings) + dir); i++) dir = `${base}-${i}`;
  return dir;
}

export async function syncReport(settings, reportId) {
  const gh = client(settings);
  const report = await db.getReport(reportId);
  if (!report) return;
  const snapshot = report.updatedAt;
  const files = await db.filesFor(reportId);
  // Berichte anderer behalten ihren Verfasser, auch wenn der Administrator sie ändert.
  const author = report.erstelltVon || settings.author;

  // Jeder Anhang bekommt einmal einen festen Dateinamen im Repo.
  const taken = new Set(['bericht.md', 'bericht.json', 'bericht.pdf', 'unterschrift.png', ...files.map((f) => f.remoteName).filter(Boolean)]);
  for (const f of files) {
    if (!f.remoteName) {
      f.remoteName = safeFileName(f.name, taken);
      await db.putFile(f);
    }
  }

  if (!report.remoteDir) report.remoteDir = await chooseRemoteDir(gh, settings, report);
  const dir = folderPrefix(settings) + report.remoteDir;

  // In einer anderen Sprache geschrieben: Freitexte für Repo und PDF ins Deutsche übersetzen.
  const sprache = report.sprache || settings.lang || 'de';
  let deutsch = null;
  let fuerRepo = report;
  if (sprache !== 'de') {
    deutsch = await berichtInsDeutsche(report, sprache);
    fuerRepo = { ...report, ...deutsch.text };
  }

  // Bildtexte ebenfalls übersetzen; das Original bleibt in textOriginal.
  let dateienFuerRepo = files;
  if (sprache !== 'de' && files.some((f) => f.text)) {
    dateienFuerRepo = await Promise.all(files.map(async (f) => {
      if (!f.text) return f;
      try {
        return { ...f, text: await insDeutsche(f.text, sprache), textOriginal: f.text };
      } catch {
        return f;
      }
    }));
  }

  // Fertiges PDF zum Weiterschicken; fällt es aus, wird der Rest trotzdem hochgeladen.
  let pdf = null;
  try {
    pdf = await buildPdf(fuerRepo, dateienFuerRepo, author);
  } catch {
    // ohne PDF weiter
  }
  let md = toMarkdown(fuerRepo, dateienFuerRepo, author, { pdfLink: Boolean(pdf) });
  let json = toJson(fuerRepo, dateienFuerRepo, author);
  if (deutsch) {
    const name = SPRACHEN.find((l) => l.id === sprache)?.deutsch || sprache;
    md += `\n## Original (${name})\n\n${deutsch.fehler ? `_Automatische Übersetzung unvollständig: ${deutsch.fehler}_\n\n` : '_Die Texte oben wurden automatisch übersetzt._\n\n'}`;
    for (const f of FREITEXTE) if (deutsch.original[f]) md += `### ${FELDNAMEN[f]}\n\n${deutsch.original[f]}\n\n`;
    const j = JSON.parse(json);
    j.sprache = sprache;
    j.original = deutsch.original;
    j.uebersetzung = { automatisch: true, fehler: deutsch.fehler || undefined };
    json = `${JSON.stringify(j, null, 2)}\n`;
  }
  const entries = [
    { path: `${dir}/bericht.md`, text: md },
    { path: `${dir}/bericht.json`, text: json },
  ];
  for (const f of files) {
    const path = `${dir}/${f.remoteName}`;
    if (f.uploadedPath !== path) entries.push({ path, blob: f.blob, file: f });
  }
  if (pdf) entries.push({ path: `${dir}/bericht.pdf`, blob: pdf });
  const wanted = new Set([...(pdf ? [`${dir}/bericht.pdf`] : []), `${dir}/bericht.md`, `${dir}/bericht.json`, ...files.map((f) => `${dir}/${f.remoteName}`)]);
  if ((report.art === 'rapport' || report.art === 'aufmass') && report.unterschrift?.dataUrl) {
    const blob = await (await fetch(report.unterschrift.dataUrl)).blob();
    entries.push({ path: `${dir}/unterschrift.png`, blob });
    wanted.add(`${dir}/unterschrift.png`);
  }
  for (const old of report.remoteFiles || []) {
    if (!wanted.has(old)) entries.push({ path: old, delete: true });
  }

  const title = `${artLabel(report)} ${formatDate(report.datum)}${report.baustelle ? ` – ${report.baustelle}` : ''}`;
  await commit(gh, settings, entries, report.syncedAt ? `${title} (aktualisiert)` : title);

  for (const e of entries) {
    if (e.file) {
      e.file.uploadedPath = e.path;
      await db.putFile(e.file);
    }
  }
  // Wurde während des Uploads weitergeschrieben, bleibt der Bericht als offen markiert.
  const latest = (await db.getReport(reportId)) || report;
  latest.remoteDir = report.remoteDir;
  latest.remoteFiles = [...wanted];
  if (deutsch) {
    latest.sprache = sprache;
    latest.deutsch = deutsch;
  }
  latest.syncedAt = Date.now();
  latest.syncError = null;
  latest.dirty = latest.updatedAt !== snapshot;
  await db.putReport(latest);
}

export async function deleteRemote(settings, report) {
  if (!report.remoteFiles?.length) return;
  const gh = client(settings);
  const entries = report.remoteFiles.map((path) => ({ path, delete: true }));
  await commit(gh, settings, entries, `${artLabel(report)} ${formatDate(report.datum)} gelöscht`);
}

// ---------- Baustellen und Personal ----------
// Liegen im Repo unter stammdaten/, damit alle Handys dieselben Listen haben.
// Pro Eintrag gewinnt die neuere Änderung (updatedAt).

const STAMMDATEN = [
  { store: 'sites', path: 'stammdaten/baustellen.json', title: 'Baustellen' },
  { store: 'people', path: 'stammdaten/personal.json', title: 'Personal' },
];

function decodeBase64Utf8(b64) {
  const bin = atob((b64 || '').replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const stamp = (x) => x.updatedAt || x.createdAt || 0;
const shared = (x) => {
  const { lastUsed, ...rest } = x;
  return rest;
};

async function syncList(gh, settings, def) {
  let remote = [];
  let sha;
  try {
    const res = await gh(`${contentsPath(def.path)}?ref=${encodeURIComponent(settings.branch)}`);
    sha = res.sha;
    remote = JSON.parse(decodeBase64Utf8(res.content)).eintraege || [];
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  const local = await db.rawAll(def.store);
  const localById = new Map(local.map((x) => [x.id, x]));
  const remoteById = new Map(remote.map((x) => [x.id, x]));

  const toLocal = [];
  let remoteChanged = false;
  for (const r of remote) {
    const l = localById.get(r.id);
    if (!l || stamp(r) > stamp(l)) toLocal.push(l?.lastUsed ? { ...r, lastUsed: l.lastUsed } : r);
  }
  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r || stamp(l) > stamp(r)) remoteChanged = true;
  }
  if (toLocal.length) await db.putRaw(def.store, toLocal);

  if (remoteChanged) {
    const merged = new Map(remote.map((x) => [x.id, x]));
    for (const l of local) {
      const r = merged.get(l.id);
      if (!r || stamp(l) > stamp(r)) merged.set(l.id, shared(l));
    }
    const text = JSON.stringify({ aktualisiert: new Date().toISOString(), eintraege: [...merged.values()] }, null, 2) + '\n';
    const body = { message: `${def.title} aktualisiert`, content: await blobToBase64(new Blob([text])), branch: settings.branch };
    if (sha) body.sha = sha;
    await gh(contentsPath(def.path), { method: 'PUT', body });
  }
  return toLocal.length > 0;
}

// Gibt true zurück, wenn sich auf dem Handy etwas geändert hat.
export async function syncStammdaten(settings) {
  const gh = client(settings);
  let changed = false;
  for (const def of STAMMDATEN) {
    try {
      changed = (await syncList(gh, settings, def)) || changed;
    } catch (err) {
      // Hat ein anderes Handy gleichzeitig geschrieben (409/422), einmal neu abgleichen.
      if (err.status !== 409 && err.status !== 422) throw err;
      changed = (await syncList(gh, settings, def)) || changed;
    }
  }
  return changed;
}

// ---------- Pläne der Baustellen ----------
// Liegen im Repo unter stammdaten/plaene/<baustelle>_<id>/, die Liste dazu in
// baustellen.json (site.plaene mit pfad). Fehlende Pläne holt sich jedes Handy beim Abgleich.

const PLAN_LOESCHEN_KEY = 'tagesberichte.planLoeschen';

async function plaeneHochladen(gh, settings) {
  let weg = [];
  try { weg = JSON.parse(localStorage.getItem(PLAN_LOESCHEN_KEY) || '[]'); } catch { weg = []; }
  if (weg.length) {
    await commit(gh, settings, weg.map((path) => ({ path, delete: true })), 'Plan entfernt');
    localStorage.removeItem(PLAN_LOESCHEN_KEY);
  }
  for (const site of await db.allSites()) {
    let geaendert = false;
    for (const p of site.plaene || []) {
      if (p.pfad) continue;
      const f = await db.getFile(p.id);
      if (!f) continue;
      const path = `stammdaten/plaene/${slug(site.name) || 'baustelle'}_${site.id.slice(0, 8)}/${p.id.slice(0, 8)}_${safeFileName(p.name, new Set())}`;
      await commit(gh, settings, [{ path, blob: f.blob }], `Plan „${p.name}“ für ${site.name}`);
      p.pfad = path;
      await db.putFile({ ...f, hochgeladen: path });
      geaendert = true;
    }
    if (geaendert) await db.putSite(site);
  }
}

async function plaeneLaden(gh, settings) {
  let neu = 0;
  for (const site of await db.allSites()) {
    const plaene = site.plaene || [];
    const lokal = await db.filesFor(planReportId(site.id));
    // Lokale Pläne, die nicht mehr in der Liste stehen: hochgeladene sind woanders gelöscht
    // worden, nie hochgeladene gingen beim Zusammenführen verloren und kommen wieder dazu.
    let zurueck = false;
    for (const f of lokal) {
      if (plaene.some((p) => p.id === f.id)) continue;
      if (f.hochgeladen) await db.deleteFile(f.id);
      else {
        plaene.push({ id: f.id, name: f.name, typ: f.type, groesse: f.size, pfad: null, addedAt: f.addedAt });
        zurueck = true;
      }
    }
    if (zurueck) { site.plaene = plaene; await db.putSite(site); }
    for (const p of plaene) {
      if (!p.pfad || lokal.some((f) => f.id === p.id)) continue;
      const dir = p.pfad.slice(0, p.pfad.lastIndexOf('/'));
      const sha = (await remoteShas(gh, settings, dir)).get(p.pfad);
      if (!sha) continue;
      const blob = await blobAt(gh, sha, p.typ);
      await db.putFile({ id: p.id, reportId: planReportId(site.id), name: p.name, type: p.typ || blob.type, size: blob.size, blob, addedAt: p.addedAt || Date.now(), hochgeladen: p.pfad });
      neu++;
    }
  }
  return neu;
}

// ---------- Administrator und Stunden anderer Mitarbeiter ----------

async function getJson(gh, settings, path) {
  try {
    const res = await gh(`${contentsPath(path)}?ref=${encodeURIComponent(settings.branch)}`);
    return { data: JSON.parse(decodeBase64Utf8(res.content)), sha: res.sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

const ADMIN_PATH = 'stammdaten/admin.json';

export async function loadAdminConfig(settings) {
  return (await getJson(client(settings), settings, ADMIN_PATH))?.data || null;
}

export async function saveAdminConfig(settings, cfg) {
  const gh = client(settings);
  const old = await getJson(gh, settings, ADMIN_PATH);
  const text = `${JSON.stringify(cfg, null, 2)}\n`;
  const body = { message: 'Administrator-PIN festgelegt', content: await blobToBase64(new Blob([text])), branch: settings.branch };
  if (old) body.sha = old.sha;
  await gh(contentsPath(ADMIN_PATH), { method: 'PUT', body });
}

// Admin-Freigabe pro Gerät (Liste admins in stammdaten/admin.json).
export async function setzeAdminFreigabe(settings, geraetId, an) {
  const gh = client(settings);
  for (let versuch = 0; versuch < 2; versuch++) {
    const alt = await getJson(gh, settings, ADMIN_PATH);
    if (!alt) throw new GitHubError(404, 'Es ist noch keine Administrator-PIN eingerichtet.');
    const admins = new Set(alt.data.admins || []);
    if (an) admins.add(geraetId); else admins.delete(geraetId);
    const cfg = { ...alt.data, admins: [...admins] };
    const body = { message: an ? 'Administrator freigegeben' : 'Administrator entzogen',
      content: await blobToBase64(new Blob([`${JSON.stringify(cfg, null, 2)}\n`])), branch: settings.branch, sha: alt.sha };
    try {
      await gh(contentsPath(ADMIN_PATH), { method: 'PUT', body });
      return cfg;
    } catch (err) {
      if ((err.status !== 409 && err.status !== 422) || versuch) throw err;
    }
  }
}

// Hochgeladener Stundennachweis eines Mitarbeiters für einen Monat
// (für den Administrator und für dieselbe Person auf einem anderen Gerät).
// Gefunden wird jede Monatsdatei mit denselben Namensteilen, egal in welcher Reihenfolge und
// ob mit oder ohne Sonderzeichen (z. B. „Nachname Vorname“ oder ș statt s).
export async function loadStundenRemote(settings, ym, name) {
  const gh = client(settings);
  const eigen = `stunden/${ym}_${slug(name) || 'mitarbeiter'}.json`;
  let pfade = [eigen];
  try {
    const liste = await gh(`${contentsPath('stunden')}?ref=${encodeURIComponent(settings.branch)}`);
    const gesucht = namensTeile(slug(name));
    const passend = (Array.isArray(liste) ? liste : [])
      .filter((f) => f.type === 'file' && f.name.startsWith(`${ym}_`) && f.name.endsWith('.json')
        && namensTeile(f.name.slice(ym.length + 1, -5)) === gesucht)
      .map((f) => f.path);
    if (passend.length) pfade = passend;
  } catch (err) {
    if (err.status === 404) return { eintraege: [], geloescht: [] };
  }
  const daten = await Promise.all(pfade.map((p) => getJson(gh, settings, p)));
  const eintraege = new Map();
  const geloescht = new Set();
  for (const res of daten) {
    for (const e of res?.data?.eintraege || []) {
      const alt = eintraege.get(e.id);
      if (!alt || (e.updatedAt || 0) > (alt.updatedAt || 0)) eintraege.set(e.id, e);
    }
    for (const id of res?.data?.geloescht || []) geloescht.add(id);
  }
  return { eintraege: [...eintraege.values()], geloescht: [...geloescht] };
}

function namensTeile(s) {
  return s.split('-').filter(Boolean).sort().join('-');
}

// ---------- Abgerechnete Rapporte (nur Administrator) ----------
// Eine Liste für alle Admin-Handys: abrechnung/abgerechnet.json { berichte: { id: { an, am, von, updatedAt } } }

const ABRECHNUNG_PATH = 'abrechnung/abgerechnet.json';

export async function abrechnungAbgleichen(settings) {
  const gh = client(settings);
  for (let versuch = 0; versuch < 3; versuch++) {
    const lokal = abrechnungLokal();
    const remote = await getJson(gh, settings, ABRECHNUNG_PATH);
    const gemischt = abrechnungMischen(remote?.data?.berichte || {}, lokal.eintraege);
    const geaendert = Object.entries(gemischt).some(([id, e]) => (remote?.data?.berichte?.[id]?.updatedAt || 0) !== (e.updatedAt || 0));
    if (lokal.ausstehend && geaendert) {
      const text = `${JSON.stringify({ berichte: gemischt }, null, 2)}\n`;
      const body = { message: 'Abgerechnete Rapporte', content: await blobToBase64(new Blob([text])), branch: settings.branch };
      if (remote) body.sha = remote.sha;
      try {
        await gh(contentsPath(ABRECHNUNG_PATH), { method: 'PUT', body });
      } catch (err) {
        // Ein anderes Admin-Handy hat gleichzeitig geschrieben: neu lesen und noch einmal
        if ((err.status === 409 || err.status === 422) && versuch < 2) continue;
        throw err;
      }
    }
    // Was während des Abgleichs auf dem Handy neu gesetzt wurde, bleibt zum Hochladen vorgemerkt.
    const jetzt = abrechnungLokal();
    const nochOffen = Object.entries(jetzt.eintraege).some(([id, e]) => (e.updatedAt || 0) > (gemischt[id]?.updatedAt || 0));
    abrechnungLokalSpeichern({ eintraege: abrechnungMischen(gemischt, jetzt.eintraege), ausstehend: nochOffen });
    return true;
  }
  return false;
}

// ---------- Geräte: wer hat die App eingerichtet? ----------
// Jedes Handy legt stammdaten/geraete/<name>_<id>.json an und schreibt die Datei
// nur neu, wenn sich Name, Version, Sprache oder Installation ändern.
// Bewusst ohne Zeitpunkt der letzten Nutzung.

const GERAETE_DIR = 'stammdaten/geraete';

export async function meldeGeraet(settings, info, { sofort = false } = {}) {
  if (!isConfigured(settings) || !info.geraetId) return false;
  const name = (settings.author || '').trim();
  const merk = `${name}|${info.version}|${info.sprache}|${info.installiert}|${info.admin}`;
  let zuletzt = {};
  try { zuletzt = JSON.parse(localStorage.getItem('tagesberichte.gemeldet') || '{}'); } catch { /* leer */ }
  if (!sofort && zuletzt.merk === merk) return false;
  const gh = client(settings);
  const path = `${GERAETE_DIR}/${slug(name) || 'ohne-name'}_${info.geraetId.slice(0, 8)}.json`;
  const alt = await getJson(gh, settings, path);
  // Hat das Handy vorher unter anderem Namen gemeldet, die alte Datei entfernen.
  if (zuletzt.path && zuletzt.path !== path) {
    const vorher = await getJson(gh, settings, zuletzt.path).catch(() => null);
    if (vorher) await gh(contentsPath(zuletzt.path), { method: 'DELETE', body: { message: 'Gerät umbenannt', sha: vorher.sha, branch: settings.branch } }).catch(() => {});
  }
  const data = { name, geraet: info.geraetId, version: info.version, sprache: info.sprache, installiert: info.installiert,
    plattform: info.plattform, admin: info.admin };
  const body = { message: `Gerät gemeldet: ${name || 'ohne Name'}`, content: await blobToBase64(new Blob([`${JSON.stringify(data, null, 2)}\n`])), branch: settings.branch };
  if (alt) body.sha = alt.sha;
  if (!alt || JSON.stringify(alt.data) !== JSON.stringify(data)) await gh(contentsPath(path), { method: 'PUT', body });
  localStorage.setItem('tagesberichte.gemeldet', JSON.stringify({ merk, path }));
  return true;
}

export async function ladeGeraete(settings) {
  const gh = client(settings);
  let liste;
  try {
    liste = await gh(`${contentsPath(GERAETE_DIR)}?ref=${encodeURIComponent(settings.branch)}`);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
  const dateien = (Array.isArray(liste) ? liste : []).filter((f) => f.type === 'file' && f.name.endsWith('.json'));
  const daten = await Promise.all(dateien.map((f) => getJson(gh, settings, f.path).then((r) => r?.data).catch(() => null)));
  return daten.filter(Boolean);
}

// ---------- Stundennachweis ----------
// Pro Mitarbeiter und Monat: stunden/<JJJJ-MM>_<name>.md, .json und .pdf

export async function syncStunden(settings) {
  const dirty = db.stundenDirty();
  const keys = Object.keys(dirty);
  if (!keys.length) return 0;
  const gh = client(settings);
  const all = await db.allStunden();
  let n = 0;
  for (const key of keys) {
    const { name, monat } = dirty[key];
    const local = all.filter((e) => personKey(e) === key.split('|')[0] && e.datum.startsWith(monat));
    const who = local[0]?.name || name || 'Mitarbeiter';
    const base = `stunden/${monat}_${slug(who) || 'mitarbeiter'}`;
    // Was schon im Repo steht (z. B. von einem anderen Gerät), bleibt erhalten.
    // Bei gleichem Eintrag gilt die neuere Änderung, gelöschte Einträge bleiben weg.
    const remoteData = (await getJson(gh, settings, `${base}.json`))?.data || {};
    const remoteEintraege = (remoteData.eintraege || []).map(({ stunden, ...e }) => e);
    const lokalGeloescht = db.stundenGeloescht();
    const bekannt = new Set([...remoteEintraege, ...local].map((e) => e.id));
    const geloescht = new Set([...(remoteData.geloescht || []), ...[...lokalGeloescht].filter((id) => bekannt.has(id))]);
    const entries = stundenZusammenfuehren(local, remoteEintraege, geloescht);
    // Neuere Stände von anderen Geräten auch auf diesem Gerät übernehmen.
    const lokalById = new Map(local.map((e) => [e.id, e]));
    for (const e of entries) {
      const l = lokalById.get(e.id);
      if (l && l !== e) await db.stundeVomRepo(e);
    }
    for (const l of local) if (geloescht.has(l.id)) await db.stundeVomRepoEntfernen(l.id);
    const files = [
      { path: `${base}.md`, text: stundenMarkdown(who, monat, entries) },
      { path: `${base}.json`, text: stundenJson(who, monat, entries, [...geloescht]) },
    ];
    try {
      files.push({ path: `${base}.pdf`, blob: await buildStundenPdf(who, monat, entries) });
    } catch {
      // ohne PDF weiter
    }
    await commit(gh, settings, files, `Stundennachweis ${monat} – ${who}`);
    db.clearStundenDirty(key);
    n++;
  }
  return n;
}

// ---------- Urlaub ----------
// Pro Antrag eine Datei urlaub/<JJJJ>_<name>_<id>.json. So überschreiben sich Anträge
// verschiedener Mitarbeiter nie gegenseitig. Mitarbeiter laden nur ihre eigenen Anträge,
// der Administrator alle.

const urlaubPfad = (a) => a.pfad || `urlaub/${a.von.slice(0, 4)}_${slug(a.name) || 'mitarbeiter'}_${a.id.slice(0, 8)}.json`;

async function urlaubHochladen(gh, settings, a) {
  const pfad = urlaubPfad(a);
  const { pfad: _p, ...daten } = a;
  const body = { message: `Urlaub ${a.status} – ${a.name} ${a.von} bis ${a.bis}`,
    content: await blobToBase64(new Blob([`${JSON.stringify(daten, null, 2)}\n`])), branch: settings.branch };
  const sha = await freshSha(gh, settings, pfad);
  if (sha) body.sha = sha;
  await gh(contentsPath(pfad), { method: 'PUT', body });
  return pfad;
}

// Lädt Ausstehendes hoch und holt dann den Stand aus dem Repo.
// Gibt { antraege, neuEntschieden } zurück; neuEntschieden: eigene Anträge, die seit dem
// letzten Abgleich genehmigt oder abgelehnt wurden.
export async function urlaubAbgleichen(settings, { alle = false, name = '' } = {}) {
  const gh = client(settings);
  let d = urlaubLokal();
  const hinweise = [];
  // 1. Ausstehendes hochladen
  for (const [id, art] of Object.entries(d.ausstehend)) {
    const lokal = d.antraege.find((a) => a.id === id);
    if (art === 'loeschen') {
      const pfad = d.pfade?.[id];
      if (pfad) {
        const remote = await getJson(gh, settings, pfad);
        // Zurückziehen nur, solange der Antrag noch nicht entschieden ist (oder durch den Admin)
        if (remote && (alle || remote.data.status === 'beantragt')) {
          await gh(contentsPath(pfad), { method: 'DELETE', body: { message: `Urlaubsantrag gelöscht – ${remote.data.name}`, sha: remote.sha, branch: settings.branch } });
        } else if (remote) {
          hinweise.push(`Der Urlaub ${remote.data.von} bis ${remote.data.bis} war schon entschieden und bleibt.`);
        }
      }
    } else if (lokal) {
      if (art === 'aendern' && lokal.pfad && !(await freshSha(gh, settings, lokal.pfad))) {
        // inzwischen zurückgezogen: nichts neu anlegen
        hinweise.push(`Der Antrag von ${lokal.name} wurde inzwischen zurückgezogen.`);
      } else {
        lokal.pfad = await urlaubHochladen(gh, settings, lokal);
      }
    }
    d = urlaubLokal();
    delete d.ausstehend[id];
    const i = d.antraege.findIndex((a) => a.id === id);
    if (i >= 0 && lokal?.pfad) d.antraege[i].pfad = lokal.pfad;
    urlaubLokalSpeichern(d);
  }
  // 2. Stand aus dem Repo holen
  let liste = [];
  try {
    liste = await gh(`${contentsPath('urlaub')}?ref=${encodeURIComponent(settings.branch)}&t=${Date.now()}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  const gesucht = namensTeile(slug(name));
  const dateien = (Array.isArray(liste) ? liste : []).filter((f) => f.type === 'file' && f.name.endsWith('.json')
    && (alle || namensTeile(f.name.replace(/^\d{4}_/, '').replace(/_[^_]+\.json$/, '')) === gesucht));
  const remote = (await Promise.all(dateien.map(async (f) => {
    const r = await getJson(gh, settings, f.path);
    return r ? { ...r.data, pfad: f.path } : null;
  }))).filter(Boolean);
  // 3. Zusammenführen: was noch auf das Hochladen wartet, bleibt wie auf dem Gerät
  d = urlaubLokal();
  const warten = new Set(Object.keys(d.ausstehend));
  const ergebnis = new Map(remote.filter((a) => !warten.has(a.id)).map((a) => [a.id, a]));
  for (const a of d.antraege) if (warten.has(a.id) && d.ausstehend[a.id] !== 'loeschen') ergebnis.set(a.id, a);
  // Beim allerersten Abgleich auf diesem Gerät nichts melden, nur merken
  const neuEntschieden = [];
  for (const a of ergebnis.values()) {
    if (a.status !== 'beantragt' && d.gemeldet[a.id] !== a.status && namensTeile(slug(a.name)) === gesucht) {
      if (d.stand) neuEntschieden.push(a);
      d.gemeldet[a.id] = a.status;
    }
  }
  d.antraege = [...ergebnis.values()].sort((a, b) => a.von.localeCompare(b.von));
  d.pfade = Object.fromEntries(d.antraege.filter((a) => a.pfad).map((a) => [a.id, a.pfad]));
  d.stand = Date.now();
  urlaubLokalSpeichern(d);
  return { antraege: d.antraege, neuEntschieden, hinweise };
}

// ---------- Berichte anderer Handys herunterladen ----------
// Holt neue und geänderte Berichte aus dem Repo auf dieses Handy (für den Administrator
// alle, sonst nur die eigenen, z. B. nach Handywechsel). Lokale, noch nicht hochgeladene
// Änderungen gehen immer vor.

const GELADEN_KEY = 'tagesberichte.geladen';

// Merkt sich pro bericht.json den zuletzt gesehenen Stand; bei Wechsel Admin/Mitarbeiter neu prüfen.
function geladen(modus) {
  try {
    const g = JSON.parse(localStorage.getItem(GELADEN_KEY)) || {};
    return g.modus === modus ? g.pfade || {} : {};
  } catch {
    return {};
  }
}

async function blobAt(gh, sha, type) {
  const res = await gh(`/git/blobs/${sha}`);
  const bin = atob((res.content || '').replace(/\s/g, ''));
  return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: type || 'application/octet-stream' });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function fromJson(data, dir, paths, { original = false } = {}) {
  const { stundenNachKategorie, stunden, maschinenStunden, anhaenge, unterschrift, original: orig, uebersetzung, summen, ...r } = data;
  // Übersetzte Berichte: der Administrator bekommt den deutschen Text, der Verfasser sein Original.
  if (orig && original) Object.assign(r, orig);
  else if (orig) r.sprache = 'de';
  return {
    ...r,
    mitarbeiter: (data.mitarbeiter || []).map(({ stunden: h, ...e }) => e),
    maschinen: data.maschinen || [],
    positionen: (data.positionen || []).map(({ mess, abzug, netto, ...p }) => ({ ...p, zeilen: (p.zeilen || []).map(({ menge, ...z }) => z) })),
    abrechnung: data.abrechnung || 'regie',
    unterschrift: null,
    remoteDir: dir,
    remoteFiles: paths,
    dirty: false,
    syncError: null,
    syncedAt: Date.now(),
  };
}

export async function pullReports(settings, { alle = false } = {}) {
  const gh = client(settings);
  const prefix = folderPrefix(settings);
  const tree = await gh(`/git/trees/${encodeURIComponent(settings.branch)}?recursive=1`);
  const blobs = new Map((tree.tree || []).filter((t) => t.type === 'blob' && t.path.startsWith(prefix)).map((t) => [t.path, t.sha]));
  const modus = alle ? 'alle' : `eigene:${(settings.author || '').trim().toLowerCase()}`;
  const seen = geladen(modus);
  const local = new Map((await db.allReports()).map((r) => [r.id, r]));
  const author = (settings.author || '').trim().toLowerCase();
  let neu = 0;
  let geaendert = 0;
  let entfernt = 0;
  const jsonPaths = [...blobs.keys()].filter((p) => /^[^/]+\/bericht\.json$/.test(p.slice(prefix.length)));

  for (const path of jsonPaths) {
    const sha = blobs.get(path);
    if (seen[path] === sha) continue;
    const dir = path.slice(prefix.length, -'/bericht.json'.length);
    let data;
    try {
      data = JSON.parse(await (await blobAt(gh, sha, 'application/json')).text());
    } catch {
      continue;
    }
    if (!data?.id) continue;
    const mine = local.get(data.id);
    const vonMir = author && (data.erstelltVon || '').trim().toLowerCase() === author;
    seen[path] = sha;
    if (!mine && !alle && !vonMir) continue;
    // Eigene offene Änderungen gehen vor; doppelte Ordner desselben Berichts ignorieren.
    if (mine && (mine.dirty || (mine.remoteDir && mine.remoteDir !== dir) || (mine.updatedAt || 0) >= (data.updatedAt || 0))) continue;

    const paths = [...blobs.keys()].filter((p) => p.startsWith(`${prefix}${dir}/`));
    const report = fromJson(data, dir, paths, { original: vonMir && !alle });
    report.fremd = mine ? mine.fremd || false : !vonMir;
    const sigPath = `${prefix}${dir}/unterschrift.png`;
    if (data.unterschrift && blobs.has(sigPath)) {
      try {
        report.unterschrift = {
          name: data.unterschrift.name || '',
          zeit: Date.parse(data.unterschrift.zeit) || Date.now(),
          dataUrl: await blobToDataUrl(await blobAt(gh, blobs.get(sigPath), 'image/png')),
        };
      } catch {
        // ohne Unterschrift weiter
      }
    }
    // Anhänge: vorhandene behalten, fehlende laden, entfernte löschen
    const files = mine ? await db.filesFor(data.id) : [];
    const wanted = new Set();
    for (const a of data.anhaenge || []) {
      const p = `${prefix}${dir}/${a.datei}`;
      wanted.add(a.datei);
      // Bildtext: der Verfasser bekommt sein Original, alle anderen die deutsche Fassung.
      const text = (vonMir && !alle && a.textOriginal) || a.text || '';
      const da = files.find((f) => f.remoteName === a.datei);
      if (da) {
        if ((da.text || '') !== text || (a.fotoNr && da.fotoNr !== a.fotoNr)) await db.putFile({ ...da, text, ...(a.fotoNr ? { fotoNr: a.fotoNr } : {}) });
        continue;
      }
      if (!blobs.has(p)) continue;
      const blob = await blobAt(gh, blobs.get(p), a.typ);
      await db.putFile({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        reportId: data.id, name: a.name || a.datei, type: a.typ || blob.type, size: blob.size, blob,
        remoteName: a.datei, uploadedPath: p, addedAt: Date.now(), text, ...(a.fotoAufmass ? { fotoAufmass: a.fotoAufmass } : {}),
        ...(a.fotoNr ? { fotoNr: a.fotoNr } : {}), ...(a.planMarkierung ? { planMarkierung: a.planMarkierung } : {}),
        ...(a.raumAufmass ? { raumAufmass: a.raumAufmass } : {}),
      });
    }
    for (const f of files) if (!wanted.has(f.remoteName)) await db.deleteFile(f.id);
    // Während des Ladens bearbeitet? Dann nicht überschreiben.
    const now = await db.getReport(data.id);
    if (now && (now.dirty || (now.updatedAt || 0) >= (data.updatedAt || 0)) && mine) continue;
    await db.putReport(report);
    if (mine) geaendert++;
    else neu++;
  }

  // Im Repo gelöschte Berichte anderer verschwinden auch hier (eigene bleiben immer).
  const vorhanden = new Set(jsonPaths.map((p) => p.slice(prefix.length, -'/bericht.json'.length)));
  for (const r of local.values()) {
    if (r.fremd && !r.dirty && r.remoteDir && !vorhanden.has(r.remoteDir) && !tree.truncated) {
      await db.deleteReport(r.id);
      entfernt++;
    }
  }
  for (const p of Object.keys(seen)) if (!blobs.has(p)) delete seen[p];
  localStorage.setItem(GELADEN_KEY, JSON.stringify({ modus, pfade: seen }));
  return { neu, geaendert, entfernt };
}

let running = null;

// Lädt alle offenen Berichte hoch. Gibt { ok, failed } zurück.
export function syncAll(settings, onProgress, { alle = false } = {}) {
  if (running) return running;
  running = (async () => {
    let ok = 0;
    let failed = 0;
    let stammdatenChanged = false;
    let stammdatenError = null;
    try {
      await plaeneHochladen(client(settings), settings);
    } catch (err) {
      stammdatenError = `Pläne: ${err.message}`;
    }
    try {
      stammdatenChanged = await syncStammdaten(settings);
    } catch (err) {
      stammdatenError = err.message;
    }
    try {
      if ((await plaeneLaden(client(settings), settings)) > 0) stammdatenChanged = true;
    } catch (err) {
      stammdatenError ||= `Pläne: ${err.message}`;
    }
    let stundenError = null;
    try {
      await syncStunden(settings);
    } catch (err) {
      stundenError = err.message;
    }
    let urlaub = null;
    let urlaubError = null;
    try {
      urlaub = await urlaubAbgleichen(settings, { alle, name: settings.stundenPerson?.name || '' });
    } catch (err) {
      urlaubError = err.message;
    }
    let abrechnungError = null;
    if (alle) {
      try {
        await abrechnungAbgleichen(settings);
      } catch (err) {
        abrechnungError = err.message;
      }
    }
    const pending = (await db.allReports()).filter((r) => r.dirty);
    for (const r of pending) {
      onProgress?.({ report: r, ok, failed, total: pending.length });
      try {
        await syncReport(settings, r.id);
        ok++;
      } catch (err) {
        failed++;
        const fresh = await db.getReport(r.id);
        if (fresh) {
          fresh.syncError = err.message;
          await db.putReport(fresh);
        }
        if (err.status === 0 || err.status === 401) break;
      }
    }
    let geladen = null;
    let ladeFehler = null;
    try {
      geladen = await pullReports(settings, { alle });
    } catch (err) {
      ladeFehler = err.message;
    }
    return { ok, failed, total: pending.length, stammdatenChanged, stammdatenError, stundenError, urlaub, urlaubError, abrechnungError, geladen, ladeFehler };
  })().finally(() => {
    running = null;
  });
  return running;
}

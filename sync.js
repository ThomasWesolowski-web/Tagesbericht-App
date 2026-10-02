// Hochladen der Berichte in ein GitHub-Repo.
// Jeder Bericht wird als ein Commit geschrieben (Git-Data-API): bericht.md,
// bericht.json und alle Anhänge landen zusammen in berichte/<datum>_<baustelle>/.

import * as db from './db.js';
import { blobToBase64, safeFileName, slug } from './media.js';
import { buildPdf, buildStundenPdf } from './pdf.js';
import { stundenMarkdown, stundenJson, personKey } from './stunden.js';
import { toJson, toMarkdown, formatDate, artLabel } from './report.js';
import { berichtInsDeutsche, insDeutsche, FREITEXTE } from './translate.js';
import { SPRACHEN } from './i18n.js';

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

// Hochgeladener Stundennachweis eines Mitarbeiters für einen Monat (für den Administrator).
export async function loadStundenRemote(settings, ym, name) {
  const res = await getJson(client(settings), settings, `stunden/${ym}_${slug(name) || 'mitarbeiter'}.json`);
  return res?.data?.eintraege || [];
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
    // Was schon im Repo steht (z. B. von einem anderen Handy), bleibt erhalten.
    const geloescht = db.stundenGeloescht();
    const ids = new Set(local.map((e) => e.id));
    const remote = ((await getJson(gh, settings, `${base}.json`))?.data?.eintraege || [])
      .filter((e) => !ids.has(e.id) && !geloescht.has(e.id))
      .map(({ stunden, ...e }) => e);
    const entries = [...local, ...remote];
    const files = [
      { path: `${base}.md`, text: stundenMarkdown(who, monat, entries) },
      { path: `${base}.json`, text: stundenJson(who, monat, entries) },
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
        if ((da.text || '') !== text) await db.putFile({ ...da, text });
        continue;
      }
      if (!blobs.has(p)) continue;
      const blob = await blobAt(gh, blobs.get(p), a.typ);
      await db.putFile({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        reportId: data.id, name: a.name || a.datei, type: a.typ || blob.type, size: blob.size, blob,
        remoteName: a.datei, uploadedPath: p, addedAt: Date.now(), text,
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
      stammdatenChanged = await syncStammdaten(settings);
    } catch (err) {
      stammdatenError = err.message;
    }
    let stundenError = null;
    try {
      await syncStunden(settings);
    } catch (err) {
      stundenError = err.message;
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
    return { ok, failed, total: pending.length, stammdatenChanged, stammdatenError, stundenError, geladen, ladeFehler };
  })().finally(() => {
    running = null;
  });
  return running;
}

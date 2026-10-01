// Hochladen der Berichte in ein GitHub-Repo.
// Jeder Bericht wird als ein Commit geschrieben (Git-Data-API): bericht.md,
// bericht.json und alle Anhänge landen zusammen in berichte/<datum>_<baustelle>/.

import * as db from './db.js';
import { blobToBase64, safeFileName, slug } from './media.js';
import { toJson, toMarkdown, formatDate } from './report.js';

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
  const repo = await gh('');
  if (!repo.permissions?.push) {
    throw new GitHubError(403, 'Der Token kann das Repo lesen, aber nicht schreiben.');
  }
  await gh(`/git/ref/heads/${encodeURIComponent(settings.branch)}`);
  return { name: repo.full_name, private: repo.private };
}

// Schreibt mehrere Dateien (oder Löschungen mit content === null) als einen Commit.
async function commit(gh, settings, entries, message) {
  const tree = [];
  for (const e of entries) {
    if (e.delete) {
      tree.push({ path: e.path, mode: '100644', type: 'blob', sha: null });
    } else {
      const blob = e.text != null
        ? await gh('/git/blobs', { method: 'POST', body: { content: e.text, encoding: 'utf-8' } })
        : await gh('/git/blobs', { method: 'POST', body: { content: await blobToBase64(e.blob), encoding: 'base64' } });
      tree.push({ path: e.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
  }

  // Falls inzwischen jemand anders committet hat, einmal neu aufsetzen.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh(`/git/ref/heads/${encodeURIComponent(settings.branch)}`);
    const parent = await gh(`/git/commits/${ref.object.sha}`);
    const newTree = await gh('/git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree } });
    const newCommit = await gh('/git/commits', {
      method: 'POST',
      body: { message, tree: newTree.sha, parents: [ref.object.sha] },
    });
    try {
      await gh(`/git/refs/heads/${encodeURIComponent(settings.branch)}`, {
        method: 'PATCH',
        body: { sha: newCommit.sha },
      });
      return newCommit.sha;
    } catch (err) {
      if (err.status !== 422 || attempt === 2) throw err;
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
  const base = `${report.datum}_${slug(report.baustelle) || 'bericht'}`;
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

  // Jeder Anhang bekommt einmal einen festen Dateinamen im Repo.
  const taken = new Set(['bericht.md', 'bericht.json', ...files.map((f) => f.remoteName).filter(Boolean)]);
  for (const f of files) {
    if (!f.remoteName) {
      f.remoteName = safeFileName(f.name, taken);
      await db.putFile(f);
    }
  }

  if (!report.remoteDir) report.remoteDir = await chooseRemoteDir(gh, settings, report);
  const dir = folderPrefix(settings) + report.remoteDir;

  const entries = [
    { path: `${dir}/bericht.md`, text: toMarkdown(report, files, settings.author) },
    { path: `${dir}/bericht.json`, text: toJson(report, files, settings.author) },
  ];
  for (const f of files) {
    const path = `${dir}/${f.remoteName}`;
    if (f.uploadedPath !== path) entries.push({ path, blob: f.blob, file: f });
  }
  const wanted = new Set([`${dir}/bericht.md`, `${dir}/bericht.json`, ...files.map((f) => `${dir}/${f.remoteName}`)]);
  for (const old of report.remoteFiles || []) {
    if (!wanted.has(old)) entries.push({ path: old, delete: true });
  }

  const title = `Tagesbericht ${formatDate(report.datum)}${report.baustelle ? ` – ${report.baustelle}` : ''}`;
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
  latest.syncedAt = Date.now();
  latest.syncError = null;
  latest.dirty = latest.updatedAt !== snapshot;
  await db.putReport(latest);
}

export async function deleteRemote(settings, report) {
  if (!report.remoteFiles?.length) return;
  const gh = client(settings);
  const entries = report.remoteFiles.map((path) => ({ path, delete: true }));
  await commit(gh, settings, entries, `Tagesbericht ${formatDate(report.datum)} gelöscht`);
}

let running = null;

// Lädt alle offenen Berichte hoch. Gibt { ok, failed } zurück.
export function syncAll(settings, onProgress) {
  if (running) return running;
  running = (async () => {
    let ok = 0;
    let failed = 0;
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
    return { ok, failed, total: pending.length };
  })().finally(() => {
    running = null;
  });
  return running;
}

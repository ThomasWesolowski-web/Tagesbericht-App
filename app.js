import * as db from './db.js';
import { prepareFile, formatBytes, MAX_FILE_BYTES } from './media.js';
import {
  WETTER, newReport, workedHours, formatHours, formatDate, weekday, monthLabel, parseDate, toMarkdown,
} from './report.js';
import { isConfigured, syncAll, syncReport, testConnection, deleteRemote } from './sync.js';

const APP_VERSION = '1.0.0';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');
const appbar = $('#appbar');

let settings = db.loadSettings();
let objectUrls = [];
let drafts = new Map(); // neue Berichte, die erst beim ersten Tippen gespeichert werden
let syncing = false;
let installPrompt = null;

// ---------- Hilfsfunktionen ----------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function objectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

function releaseUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
}

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function timeLabel(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `heute ${hm}` : `${d.toLocaleDateString('de-DE')} ${hm}`;
}

const ICON = {
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 15V10m0 0-2.2 2.2M12 10l2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

function syncPill(r) {
  if (r.syncError && r.dirty) return '<span class="pill error">Fehler</span>';
  if (!isConfigured(settings)) return '<span class="pill local">Nur lokal</span>';
  if (r.dirty) return '<span class="pill pending">Offen</span>';
  return '<span class="pill ok">Hochgeladen</span>';
}

// ---------- Router ----------

async function route() {
  releaseUrls();
  closeMenu();
  document.body.classList.remove('editing');
  const hash = location.hash || '#/';
  $$('.tabbar a[data-tab]').forEach((a) => a.classList.toggle('active',
    (a.dataset.tab === 'list' && hash === '#/') || (a.dataset.tab === 'settings' && hash === '#/einstellungen')));

  if (hash === '#/neu') {
    const latest = (await db.allReports())[0];
    const r = newReport(latest);
    drafts.set(r.id, r);
    location.replace(`#/bericht/${r.id}`);
    return;
  }
  const m = /^#\/bericht\/(.+)$/.exec(hash);
  if (m) return renderEditor(decodeURIComponent(m[1]));
  if (hash === '#/einstellungen') return renderSettings();
  return renderList();
}

// ---------- Übersicht ----------

async function renderList() {
  const reports = await db.allReports();
  const pending = reports.filter((r) => r.dirty).length;
  const configured = isConfigured(settings);

  appbar.innerHTML = `
    <h1>Tagesberichte</h1>
    <button class="icon-btn ${syncing ? 'spin' : ''}" id="sync-btn" aria-label="Jetzt hochladen">
      ${configured ? ICON.sync : ICON.cloud}
      ${pending && configured ? `<span class="badge">${pending}</span>` : ''}
    </button>`;
  $('#sync-btn').onclick = () => (configured ? runSync(true) : (location.hash = '#/einstellungen'));

  // Kennzahlen: Stunden diese Woche, Berichte diesen Monat, offene Uploads
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const weekHours = reports
    .filter((r) => parseDate(r.datum) >= monday)
    .reduce((sum, r) => sum + (workedHours(r) || 0), 0);
  const monthCount = reports.filter((r) => {
    const d = parseDate(r.datum);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const files = await Promise.all(reports.map((r) => db.filesFor(r.id)));
  const fileCount = new Map(reports.map((r, i) => [r.id, files[i].length]));

  let html = installBanner();
  if (!configured && reports.length) {
    html += `<div class="banner">${ICON.info}<div>Deine Berichte liegen bisher nur auf diesem Handy. <a href="#/einstellungen">Sync einrichten</a>, damit sie auch im Repo gesichert werden.</div></div>`;
  }

  if (!reports.length) {
    view.innerHTML = html + `
      <div class="empty">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="28" y="16" width="64" height="88" rx="10" fill="var(--surface)" stroke="var(--line)" stroke-width="3"/>
          <rect x="40" y="34" width="40" height="6" rx="3" fill="var(--accent)"/>
          <rect x="40" y="50" width="34" height="5" rx="2.5" fill="var(--line)"/>
          <rect x="40" y="62" width="40" height="5" rx="2.5" fill="var(--line)"/>
          <rect x="40" y="74" width="26" height="5" rx="2.5" fill="var(--line)"/>
          <circle cx="88" cy="88" r="16" fill="var(--accent)"/>
          <path d="M88 80v16M80 88h16" stroke="var(--accent-ink)" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
        <h2>Noch keine Berichte</h2>
        <p>Lege deinen ersten Tagesbericht an. Er wird sofort auf dem Handy gespeichert, auch ohne Netz.</p>
        <a class="btn primary" href="#/neu">Ersten Bericht anlegen</a>
      </div>`;
    bindInstall();
    return;
  }

  html += `
    <div class="stats">
      <div class="stat"><b>${formatHours(weekHours).replace(' h', '')}</b><span>Stunden diese Woche</span></div>
      <div class="stat"><b>${monthCount}</b><span>Berichte im ${monthLabel(new Date().toISOString().slice(0, 10)).split(' ')[0]}</span></div>
      <div class="stat ${pending && configured ? 'attention' : ''}"><b>${configured ? pending : '–'}</b><span>${configured ? 'nicht hochgeladen' : 'Sync aus'}</span></div>
    </div>
    <label class="search">${ICON.search}<input id="search" type="search" placeholder="Baustelle, Arbeiten, Personal …" autocomplete="off"></label>
    <div id="list"></div>`;
  view.innerHTML = html;
  bindInstall();

  const listEl = $('#list');
  const draw = (q) => {
    const needle = q.trim().toLowerCase();
    const shown = needle
      ? reports.filter((r) => [r.baustelle, r.auftrag, r.taetigkeiten, r.material, r.bemerkungen, r.personal, formatDate(r.datum)]
        .join(' ').toLowerCase().includes(needle))
      : reports;
    if (!shown.length) {
      listEl.innerHTML = '<p class="empty">Nichts gefunden.</p>';
      return;
    }
    let out = '';
    let month = '';
    for (const r of shown) {
      const label = monthLabel(r.datum);
      if (label !== month) {
        if (month) out += '</div>';
        const monthHours = shown.filter((x) => monthLabel(x.datum) === label).reduce((s, x) => s + (workedHours(x) || 0), 0);
        out += `<div class="month"><span>${label}</span><span>${formatHours(monthHours)}</span></div><div class="card-list">`;
        month = label;
      }
      const d = parseDate(r.datum);
      const n = fileCount.get(r.id);
      const preview = (r.taetigkeiten || r.bemerkungen || '').split('\n')[0];
      out += `
        <a class="rcard" href="#/bericht/${encodeURIComponent(r.id)}">
          <div class="date"><b>${d.getDate()}</b><span>${weekday(r.datum).slice(0, 2)}</span></div>
          <div class="body">
            <div class="title ${r.baustelle ? '' : 'muted'}">${esc(r.baustelle || 'Ohne Baustelle')}</div>
            ${preview ? `<div class="preview">${esc(preview)}</div>` : ''}
            <div class="meta">${syncPill(r)}${n ? `<span>${ICON.clip} ${n}</span>` : ''}</div>
          </div>
          <div class="hours">${formatHours(workedHours(r))}</div>
        </a>`;
    }
    listEl.innerHTML = out + '</div>';
  };
  draw('');
  $('#search').addEventListener('input', (e) => draw(e.target.value));
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function installBanner() {
  if (isStandalone() || localStorage.getItem('tagesberichte.installHidden')) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const how = installPrompt
    ? '<button class="btn soft" id="install-btn" style="margin-top:8px;min-height:38px;padding:8px 14px">Jetzt installieren</button>'
    : ios
      ? 'Tippe in Safari auf <b>Teilen</b> und dann <b>„Zum Home-Bildschirm“</b>.'
      : 'Öffne das Browser-Menü und wähle <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b>.';
  return `<div class="banner" id="install-banner">${ICON.info}<div style="flex:1">Als App auf dem Home-Bildschirm funktioniert alles am besten, auch offline. ${how}</div>
    <button class="icon-btn" id="install-hide" aria-label="Hinweis schließen" style="width:32px;height:32px;margin:-6px -6px 0 0">${ICON.x}</button></div>`;
}

function bindInstall() {
  const hide = $('#install-hide');
  if (hide) hide.onclick = () => { localStorage.setItem('tagesberichte.installHidden', '1'); $('#install-banner').remove(); };
  const btn = $('#install-btn');
  if (btn) btn.onclick = async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('#install-banner')?.remove(); };
}

// ---------- Bericht bearbeiten ----------

async function renderEditor(id) {
  let report = drafts.get(id) || (await db.getReport(id));
  if (!report) {
    toast('Bericht nicht gefunden.');
    location.replace('#/');
    return;
  }
  const isDraft = drafts.has(id);
  document.body.classList.add('editing');

  appbar.innerHTML = `
    <button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button>
    <h1 class="small">${isDraft ? 'Neuer Bericht' : 'Bericht'}<span class="sub" id="head-date">${weekday(report.datum)}, ${formatDate(report.datum)}</span></h1>
    <button class="icon-btn" id="menu-btn" aria-label="Mehr">${ICON.more}</button>`;
  $('#back').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));

  const wetterChips = WETTER.map((w) =>
    `<button type="button" class="chip" data-wetter="${w.id}" aria-pressed="${report.wetter.includes(w.id)}">${w.icon} ${w.label}</button>`).join('');

  view.innerHTML = `
    <form id="form" autocomplete="off" onsubmit="return false">
      <section class="section">
        <h2>Allgemein</h2>
        <label class="field"><span>Datum</span><input type="date" data-field="datum" value="${esc(report.datum)}" required></label>
        <label class="field"><span>Baustelle / Projekt</span><input type="text" data-field="baustelle" value="${esc(report.baustelle)}" placeholder="z. B. Musterstraße 12, Zürich" list="baustellen" enterkeyhint="next"></label>
        <datalist id="baustellen"></datalist>
        <div class="row">
          <label class="field"><span>Auftragsnummer</span><input type="text" data-field="auftrag" value="${esc(report.auftrag)}" placeholder="optional"></label>
          <label class="field"><span>Personal</span><input type="text" data-field="personal" value="${esc(report.personal)}" placeholder="Wer war dabei?"></label>
        </div>
      </section>

      <section class="section">
        <h2>Arbeitszeit</h2>
        <div class="row three">
          <label class="field"><span>Beginn</span><input type="time" data-field="beginn" value="${esc(report.beginn)}"></label>
          <label class="field"><span>Ende</span><input type="time" data-field="ende" value="${esc(report.ende)}"></label>
          <label class="field"><span>Pause (min)</span><input type="number" inputmode="numeric" min="0" step="5" data-field="pause" value="${esc(report.pause)}"></label>
        </div>
        <div class="hours-total"><span>Arbeitsstunden</span><b id="hours">${formatHours(workedHours(report))}</b></div>
      </section>

      <section class="section">
        <h2>Wetter</h2>
        <div class="chips" id="wetter">${wetterChips}</div>
        <label class="field" style="margin-top:12px;max-width:160px"><span>Temperatur (°C)</span><input type="number" inputmode="decimal" data-field="temperatur" value="${esc(report.temperatur)}" placeholder="z. B. 14"></label>
      </section>

      <section class="section">
        <h2>Ausgeführte Arbeiten</h2>
        <label class="field"><textarea data-field="taetigkeiten" placeholder="Was wurde heute gemacht?" rows="4">${esc(report.taetigkeiten)}</textarea></label>
      </section>

      <section class="section">
        <h2>Material und Geräte</h2>
        <label class="field"><textarea data-field="material" placeholder="Verbrauchtes Material, eingesetzte Maschinen …" rows="3">${esc(report.material)}</textarea></label>
      </section>

      <section class="section">
        <h2>Bemerkungen</h2>
        <label class="field"><textarea data-field="bemerkungen" placeholder="Behinderungen, Mängel, Absprachen, besondere Vorkommnisse …" rows="3">${esc(report.bemerkungen)}</textarea></label>
      </section>

      <section class="section">
        <h2>Fotos und Dokumente <span class="h-right" id="file-sum"></span></h2>
        <div class="attach-actions">
          <label class="btn soft">${ICON.camera} Kamera
            <input class="file-input" type="file" accept="image/*" capture="environment" id="cam"></label>
          <label class="btn ghost">${ICON.clip} Datei
            <input class="file-input" type="file" multiple id="pick"></label>
        </div>
        <p class="hint">Fotos werden automatisch verkleinert. Dateien bis 25 MB.</p>
        <div class="thumbs" id="thumbs"></div>
      </section>
    </form>
    <div class="savebar"><div class="savebar-inner">
      <div class="state" id="save-state"></div>
      <button class="btn primary" id="upload-btn">${ICON.cloud} Hochladen</button>
    </div></div>`;

  // Vorschläge für die Baustelle aus früheren Berichten
  const sites = [...new Set((await db.allReports()).map((r) => r.baustelle).filter(Boolean))].slice(0, 30);
  $('#baustellen').innerHTML = sites.map((s) => `<option value="${esc(s)}">`).join('');

  let saveTimer;
  let saved = !isDraft;

  const persist = async () => {
    report.updatedAt = Date.now();
    report.dirty = true;
    await db.putReport(report);
    if (drafts.delete(report.id)) requestPersistentStorage();
    saved = true;
    updateState();
    scheduleAutoSync();
  };
  const changed = () => {
    $('#hours').textContent = formatHours(workedHours(report));
    $('#head-date').textContent = `${weekday(report.datum)}, ${formatDate(report.datum)}`;
    $('#save-state').innerHTML = '<b>Speichert …</b>';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 350);
  };

  $$('[data-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.field;
      report[key] = el.type === 'number' && key === 'pause' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
      if (el.tagName === 'TEXTAREA') autoGrow(el);
      changed();
    });
    if (el.tagName === 'TEXTAREA') autoGrow(el);
  });
  $$('#wetter .chip').forEach((chip) => {
    chip.onclick = () => {
      const w = chip.dataset.wetter;
      report.wetter = report.wetter.includes(w) ? report.wetter.filter((x) => x !== w) : [...report.wetter, w];
      chip.setAttribute('aria-pressed', report.wetter.includes(w));
      changed();
    };
  });

  const drawThumbs = async () => {
    const files = await db.filesFor(report.id);
    $('#file-sum').textContent = files.length ? `${files.length} · ${formatBytes(files.reduce((s, f) => s + f.size, 0))}` : '';
    $('#thumbs').innerHTML = files.map((f) => {
      const inner = f.type.startsWith('image/')
        ? `<img src="${objectUrl(f.blob)}" alt="${esc(f.name)}" loading="lazy">`
        : `<div class="doc">${ICON.doc}<span>${esc(f.name)}</span></div>`;
      return `<div class="thumb" data-id="${f.id}">
        <button type="button" class="open" aria-label="${esc(f.name)} öffnen">${inner}</button>
        <span class="size">${formatBytes(f.size)}</span>
        <button type="button" class="remove" aria-label="${esc(f.name)} entfernen">${ICON.x}</button></div>`;
    }).join('');
    $$('#thumbs .thumb').forEach((t) => {
      const file = files.find((f) => f.id === t.dataset.id);
      $('.open', t).onclick = () => openFile(file);
      $('.remove', t).onclick = async () => {
        if (!confirm(`„${file.name}“ aus dem Bericht entfernen?`)) return;
        await db.deleteFile(file.id);
        await persist();
        drawThumbs();
      };
    });
  };

  const addFiles = async (list) => {
    if (!list.length) return;
    $('#save-state').innerHTML = '<b>Anhänge werden gespeichert …</b>';
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        toast(`„${file.name}“ ist größer als 25 MB und wurde nicht hinzugefügt.`, 4000);
        continue;
      }
      const prepared = await prepareFile(file);
      await db.putFile({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        reportId: report.id,
        name: prepared.name,
        type: prepared.type,
        size: prepared.blob.size,
        blob: prepared.blob,
        addedAt: Date.now(),
      });
    }
    await persist();
    drawThumbs();
  };
  $('#cam').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  $('#pick').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };

  function updateState() {
    const el = $('#save-state');
    if (!el) return;
    const configured = isConfigured(settings);
    let line2;
    if (!configured) line2 = 'Sync ist nicht eingerichtet';
    else if (syncing) line2 = 'Wird hochgeladen …';
    else if (report.syncError && report.dirty) line2 = `<span class="err">${esc(report.syncError)}</span>`;
    else if (report.dirty) line2 = report.syncedAt ? 'Änderungen noch nicht hochgeladen' : 'Noch nicht hochgeladen';
    else line2 = `Hochgeladen ${timeLabel(report.syncedAt)}`;
    el.innerHTML = `<b>${saved ? 'Auf dem Handy gespeichert' : 'Noch leer'}</b>${line2}`;
    const btn = $('#upload-btn');
    btn.disabled = configured && (!saved || syncing || !report.dirty);
    btn.innerHTML = configured ? `${ICON.cloud} ${report.dirty || !saved ? 'Hochladen' : 'Aktuell'}` : `${ICON.cloud} Einrichten`;
  }
  editorHooks = {
    id: report.id,
    refresh: async () => {
      const fresh = await db.getReport(report.id);
      if (fresh) {
        report.dirty = fresh.dirty;
        report.syncedAt = fresh.syncedAt;
        report.syncError = fresh.syncError;
        report.remoteDir = fresh.remoteDir;
        report.remoteFiles = fresh.remoteFiles;
        if (fresh.updatedAt !== report.updatedAt) report.dirty = true;
      }
      updateState();
    },
  };

  $('#upload-btn').onclick = async () => {
    if (!isConfigured(settings)) {
      location.hash = '#/einstellungen';
      return;
    }
    clearTimeout(saveTimer);
    await persist();
    await runSync(true);
  };

  $('#menu-btn').onclick = (e) => {
    e.stopPropagation();
    openMenu([
      { icon: ICON.share, label: 'Teilen', run: () => shareReport(report) },
      { icon: ICON.copy, label: 'Neuer Bericht mit diesen Angaben', run: () => duplicate(report) },
      { icon: ICON.trash, label: 'Bericht löschen', danger: true, run: () => removeReport(report, saved) },
    ]);
  };

  updateState();
  drawThumbs();
}

let editorHooks = null;

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight + 2, 96)}px`;
}

function openFile(file) {
  if (file.type.startsWith('image/')) {
    const lb = $('#lightbox');
    lb.innerHTML = `<img src="${objectUrl(file.blob)}" alt="${esc(file.name)}"><button class="icon-btn" aria-label="Schließen">${ICON.x}</button>`;
    lb.hidden = false;
    lb.onclick = () => { lb.hidden = true; lb.innerHTML = ''; };
    return;
  }
  const a = document.createElement('a');
  a.href = objectUrl(file.blob);
  a.download = file.name;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function shareReport(report) {
  const files = await db.filesFor(report.id);
  const text = toMarkdown(report, files.map((f) => ({ ...f, remoteName: f.name })), settings.author);
  const title = `Tagesbericht ${formatDate(report.datum)}`;
  const shareFiles = files.map((f) => new File([f.blob], f.name, { type: f.type }));
  try {
    if (navigator.canShare && shareFiles.length && navigator.canShare({ files: shareFiles })) {
      await navigator.share({ title, text, files: shareFiles });
    } else if (navigator.share) {
      await navigator.share({ title, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Bericht als Text kopiert.');
    }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Teilen hat nicht geklappt.');
  }
}

async function duplicate(report) {
  const copy = newReport(report);
  copy.taetigkeiten = report.taetigkeiten;
  copy.material = report.material;
  drafts.set(copy.id, copy);
  location.hash = `#/bericht/${copy.id}`;
}

async function removeReport(report, saved) {
  if (!saved) {
    drafts.delete(report.id);
    location.hash = '#/';
    return;
  }
  const remote = report.remoteFiles?.length && isConfigured(settings);
  const question = remote
    ? `Bericht vom ${formatDate(report.datum)} löschen? Er wird auf dem Handy und im Repo gelöscht.`
    : `Bericht vom ${formatDate(report.datum)} löschen?`;
  if (!confirm(question)) return;
  if (remote) {
    try {
      await deleteRemote(settings, report);
    } catch (err) {
      if (!confirm(`Im Repo konnte nicht gelöscht werden (${err.message}). Nur auf dem Handy löschen?`)) return;
    }
  }
  await db.deleteReport(report.id);
  toast('Bericht gelöscht.');
  location.hash = '#/';
}

function openMenu(items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.id = 'menu';
  menu.innerHTML = items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon} ${esc(it.label)}</button>`).join('');
  document.body.appendChild(menu);
  menu.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenu();
    items[Number(b.dataset.i)].run();
  };
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }));
}

function closeMenu() {
  $('#menu')?.remove();
}

// ---------- Einstellungen ----------

async function renderSettings() {
  appbar.innerHTML = '<h1>Einstellungen</h1>';
  const s = settings;
  view.innerHTML = `
    <section class="section">
      <h2>Allgemein</h2>
      <label class="field"><span>Dein Name (steht im Bericht)</span><input type="text" data-set="author" value="${esc(s.author)}" placeholder="z. B. Tomek"></label>
    </section>

    <section class="section">
      <h2>Sync ins GitHub-Repo <span class="h-right" id="conn-state">${isConfigured(s) ? '<span class="pill ok">Eingerichtet</span>' : '<span class="pill local">Aus</span>'}</span></h2>
      <div class="row">
        <label class="field"><span>Besitzer</span><input type="text" data-set="owner" value="${esc(s.owner)}" autocapitalize="off" spellcheck="false"></label>
        <label class="field"><span>Repo</span><input type="text" data-set="repo" value="${esc(s.repo)}" autocapitalize="off" spellcheck="false"></label>
      </div>
      <div class="row">
        <label class="field"><span>Branch</span><input type="text" data-set="branch" value="${esc(s.branch)}" autocapitalize="off" spellcheck="false"></label>
        <label class="field"><span>Ordner</span><input type="text" data-set="folder" value="${esc(s.folder)}" autocapitalize="off" spellcheck="false"></label>
      </div>
      <label class="field"><span>Zugangs-Token</span><input type="password" data-set="token" value="${esc(s.token)}" placeholder="github_pat_…" autocapitalize="off" spellcheck="false"></label>
      <div class="toggle" style="margin:4px 0 14px">
        <span><b>Automatisch hochladen</b><small>Sobald Netz da ist, nach jeder Änderung</small></span>
        <label class="switch"><input type="checkbox" data-set="autoSync" ${s.autoSync ? 'checked' : ''}><i></i></label>
      </div>
      <button class="btn ghost block" id="test-btn">Verbindung testen</button>
    </section>

    <section class="section">
      <h2>So bekommst du den Token</h2>
      <ol class="steps">
        <li>Auf GitHub <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener"><b>Fine-grained token</b> anlegen</a>.</li>
        <li>Bei <i>Repository access</i> nur <code>${esc(s.repo || 'Rapporte-')}</code> auswählen.</li>
        <li>Bei <i>Permissions → Contents</i> „Read and write“ wählen.</li>
        <li>Token kopieren und oben einfügen. Er bleibt nur auf diesem Handy.</li>
      </ol>
    </section>

    <section class="section">
      <h2>Speicher auf dem Handy</h2>
      <div id="storage">Wird berechnet …</div>
    </section>

    <p class="hint" style="text-align:center">Tagesberichte ${APP_VERSION}</p>`;

  $$('[data-set]').forEach((el) => {
    el.addEventListener('change', () => {
      const key = el.dataset.set;
      settings = { ...settings, [key]: el.type === 'checkbox' ? el.checked : el.value.trim() };
      db.saveSettings(settings);
      $('#conn-state').innerHTML = isConfigured(settings) ? '<span class="pill ok">Eingerichtet</span>' : '<span class="pill local">Aus</span>';
      if (key === 'token' || key === 'autoSync') scheduleAutoSync();
    });
  });

  $('#test-btn').onclick = async () => {
    document.activeElement?.blur();
    const btn = $('#test-btn');
    if (!isConfigured(settings)) {
      toast('Bitte zuerst den Token eintragen.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Teste …';
    try {
      const info = await testConnection(settings);
      $('#conn-state').innerHTML = '<span class="pill ok">Verbunden</span>';
      toast(`Verbunden mit ${info.name}${info.private ? ' (privat)' : ''}.`);
      scheduleAutoSync(500);
    } catch (err) {
      $('#conn-state').innerHTML = '<span class="pill error">Fehler</span>';
      toast(err.message, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Verbindung testen';
    }
  };

  const el = $('#storage');
  const reports = await db.allReports();
  const files = (await Promise.all(reports.map((r) => db.filesFor(r.id)))).flat();
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  let html = `<div class="kv"><span>Berichte</span><b>${reports.length}</b></div>
    <div class="kv"><span>Fotos und Dokumente</span><b>${files.length} · ${formatBytes(bytes)}</b></div>`;
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    if (est.quota) {
      const pct = Math.min(100, (est.usage / est.quota) * 100);
      html += `<div class="meter"><i style="width:${Math.max(pct, 1)}%"></i></div>
        <div class="kv"><span>Belegt von verfügbar</span><b>${formatBytes(est.usage)} / ${formatBytes(est.quota)}</b></div>`;
    }
  }
  if (navigator.storage?.persisted) {
    const persisted = await navigator.storage.persisted();
    html += `<div class="kv"><span>Vor automatischem Löschen geschützt</span><b>${persisted ? 'Ja' : 'Nein'}</b></div>`;
    if (!persisted) html += '<p class="hint">Installiere die App auf dem Home-Bildschirm und richte den Sync ein, damit nichts verloren geht.</p>';
  }
  el.innerHTML = html;
}

// ---------- Sync ----------

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // nicht überall verfügbar
  }
}

let autoTimer;
function scheduleAutoSync(delay = 4000) {
  clearTimeout(autoTimer);
  if (!settings.autoSync || !isConfigured(settings)) return;
  autoTimer = setTimeout(() => {
    if (navigator.onLine) runSync(false);
  }, delay);
}

async function runSync(manual) {
  if (syncing) return;
  if (!navigator.onLine) {
    if (manual) toast('Kein Netz. Der Bericht wird hochgeladen, sobald du wieder online bist.', 3500);
    return;
  }
  syncing = true;
  $('#sync-btn')?.classList.add('spin');
  editorHooks?.refresh();
  let result;
  try {
    result = await syncAll(settings);
  } finally {
    syncing = false;
  }
  if (manual || result.failed) {
    if (result.failed) toast(`${result.failed} Bericht(e) konnten nicht hochgeladen werden.`, 4000);
    else if (result.ok) toast(result.ok === 1 ? 'Bericht hochgeladen.' : `${result.ok} Berichte hochgeladen.`);
    else if (manual) toast('Alles ist bereits hochgeladen.');
  }
  // Ansicht aktualisieren, ohne das Formular neu aufzubauen
  if (/^#\/bericht\//.test(location.hash)) editorHooks?.refresh();
  else if ((location.hash || '#/') === '#/') renderList();
}

// ---------- Start ----------

window.addEventListener('hashchange', () => {
  editorHooks = null;
  route();
});
window.addEventListener('online', () => scheduleAutoSync(1000));
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if ((location.hash || '#/') === '#/') renderList();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#lightbox').hidden = true; closeMenu(); }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

route();
scheduleAutoSync(1500);


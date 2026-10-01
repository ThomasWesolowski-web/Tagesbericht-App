import * as db from './db.js';
import { prepareFile, formatBytes, MAX_FILE_BYTES } from './media.js';
import {
  WETTER, newReport, newSite, newPerson, crewOf, entryHours, KATEGORIEN, kategorieOf, sortCrew, hoursByKategorie, workedHours, formatHours, formatDate, weekday, monthLabel, parseDate, toMarkdown, ARTEN, artLabel,
} from './report.js';
import { isConfigured, syncAll, syncReport, testConnection, deleteRemote } from './sync.js';

const APP_VERSION = '1.5.0';

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
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9.8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.2c1.8.8 3 2.7 3 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
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
  $$('.sheet-backdrop').forEach((el) => el.remove());
  document.body.classList.remove('editing');
  const hash = location.hash || '#/';
  $$('.tabbar a[data-tab]').forEach((a) => a.classList.toggle('active',
    (a.dataset.tab === 'list' && hash === '#/')
    || (a.dataset.tab === 'sites' && hash.startsWith('#/baustelle'))
    || (a.dataset.tab === 'settings' && (hash === '#/einstellungen' || hash === '#/personal'))));

  if (hash === '#/neu') {
    const r = newReport();
    drafts.set(r.id, r);
    location.replace(`#/bericht/${r.id}`);
    return;
  }
  const m = /^#\/bericht\/(.+)$/.exec(hash);
  if (m) return renderEditor(decodeURIComponent(m[1]));
  const site = /^#\/baustelle\/(.+)$/.exec(hash);
  if (site) return renderSiteEditor(decodeURIComponent(site[1]));
  if (hash === '#/baustellen') return renderSites();
  if (hash === '#/personal') return renderPeople();
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
    <div id="list"></div>
    <a class="fab" href="#/neu">${ICON.plus}<span>Neuer Bericht</span></a>`;
  view.innerHTML = html;
  bindInstall();

  const listEl = $('#list');
  const draw = (q) => {
    const needle = q.trim().toLowerCase();
    const shown = needle
      ? reports.filter((r) => [r.baustelle, r.auftrag, r.taetigkeiten, r.material, r.bemerkungen, r.personal, ...(r.mitarbeiter || []).map((e) => e.name), formatDate(r.datum)]
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
            <div class="meta">${r.art === 'rapport' ? '<span class="pill art">Rapport</span>' : ''}${syncPill(r)}${n ? `<span>${ICON.clip} ${n}</span>` : ''}</div>
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
  const stored = drafts.get(id) || (await db.getReport(id));
  if (!stored) {
    toast('Bericht nicht gefunden.');
    location.replace('#/');
    return;
  }
  // Es wird an einer Kopie gearbeitet; gespeichert wird erst mit „Speichern“.
  const report = structuredClone(stored);
  report.mitarbeiter = structuredClone(crewOf(report));
  const isDraft = drafts.has(id);
  document.body.classList.add('editing');

  appbar.innerHTML = `
    <button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button>
    <h1 class="small"><span id="head-title">${isDraft ? 'Neuer Bericht' : artLabel(report)}</span><span class="sub" id="head-date">${weekday(report.datum)}, ${formatDate(report.datum)}</span></h1>
    <button class="icon-btn" id="menu-btn" aria-label="Mehr">${ICON.more}</button>`;
  const wetterChips = WETTER.map((w) =>
    `<button type="button" class="chip" data-wetter="${w.id}" aria-pressed="${report.wetter.includes(w.id)}">${w.icon} ${w.label}</button>`).join('');

  view.innerHTML = `
    <div class="sync-line" id="sync-state"></div>
    <form id="form" autocomplete="off" onsubmit="return false">
      <section class="section">
        <h2>Allgemein</h2>
        <div class="seg" id="art-seg" role="radiogroup" aria-label="Art">${ARTEN.map((a) =>
          `<button type="button" role="radio" data-art="${a.id}" aria-checked="${report.art === a.id}">${a.label}</button>`).join('')}</div>
        <label class="field"><span>Datum</span><input type="date" data-field="datum" value="${esc(report.datum)}" required></label>
        <div class="field"><span>Baustelle</span><button type="button" class="site-pick" id="site-pick"></button></div>
        <label class="field"><span>Auftragsnummer</span><input type="text" data-field="auftrag" value="${esc(report.auftrag)}" placeholder="optional"></label>
      </section>

      <section class="section">
        <h2>Personal und Arbeitszeit <span class="h-right" id="hours"></span></h2>
        <div id="crew" class="crew-list"></div>
        <div id="crew-sum" class="crew-sum"></div>
        <button type="button" class="btn soft block" id="add-crew">${ICON.plus} Personal hinzufügen</button>
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
    ${isDraft ? '' : `<button class="btn danger block" id="delete-btn">${ICON.trash} Bericht löschen</button>`}
    <div class="savebar"><div class="savebar-inner">
      <button class="btn ghost" id="cancel-btn">Abbrechen</button>
      <button class="btn primary" id="save-btn">Speichern</button>
    </div></div>`;

  let unsaved = false;
  const pendingAdds = new Set(); // neu angehängte Dateien, die bei „Abbrechen“ wieder weg müssen
  const pendingRemovals = new Set(); // entfernte Dateien, die erst beim Speichern gelöscht werden

  const drawSum = () => {
    const groups = hoursByKategorie(report);
    $('#crew-sum').innerHTML = groups.length ? `
      ${groups.map((g) => `<div class="kv"><span>${esc(g.kategorie)} <small>(${g.personen})</small></span><b>${formatHours(g.stunden)}</b></div>`).join('')}
      <div class="kv total"><span>Gesamt</span><b>${formatHours(workedHours(report))}</b></div>` : '';
  };
  const changed = () => {
    unsaved = true;
    drawSum();
    $('#hours').textContent = report.mitarbeiter.length ? `Summe ${formatHours(workedHours(report))}` : '';
    $$('#crew .crew').forEach((el) => {
      el.querySelector('.crew-hours').textContent = formatHours(entryHours(report.mitarbeiter[Number(el.dataset.i)]));
    });
    $('#head-date').textContent = `${weekday(report.datum)}, ${formatDate(report.datum)}`;
  };

  const leave = () => {
    editorHooks = null;
    location.hash = '#/';
  };
  const discard = async () => {
    for (const fid of pendingAdds) await db.deleteFile(fid);
    pendingAdds.clear();
    drafts.delete(report.id);
  };
  const save = async () => {
    if (!report.baustelleId && !report.baustelle) {
      toast('Bitte zuerst eine Baustelle auswählen.');
      chooseSite();
      return;
    }
    if (!report.art) report.art = 'tagesbericht';
    // Upload-Status aus der Datenbank übernehmen, falls inzwischen hochgeladen wurde
    const fresh = await db.getReport(report.id);
    if (fresh) for (const k of ['syncedAt', 'syncError', 'remoteDir', 'remoteFiles']) report[k] = fresh[k];
    for (const k of ['personal', 'beginn', 'ende', 'pause']) delete report[k];
    for (const fid of pendingRemovals) await db.deleteFile(fid);
    pendingRemovals.clear();
    pendingAdds.clear();
    report.updatedAt = Date.now();
    report.dirty = true;
    await db.putReport(report);
    if (drafts.delete(report.id)) requestPersistentStorage();
    unsaved = false;
    toast('Bericht gespeichert.');
    scheduleAutoSync(1500);
    leave();
  };
  const cancel = async () => {
    if (unsaved && !confirm(isDraft ? 'Neuen Bericht verwerfen?' : 'Änderungen verwerfen?')) return;
    await discard();
    leave();
  };
  $('#back').onclick = cancel;
  $('#cancel-btn').onclick = cancel;
  $('#save-btn').onclick = save;
  const delBtn = $('#delete-btn');
  if (delBtn) delBtn.onclick = () => removeReport(report, true);

  $$('[data-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.field;
      report[key] = el.type === 'number' && key === 'pause' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
      if (el.tagName === 'TEXTAREA') autoGrow(el);
      changed();
    });
    if (el.tagName === 'TEXTAREA') autoGrow(el);
  });
  const drawSite = () => {
    $('#site-pick').innerHTML = report.baustelle
      ? `${ICON.pin}<span><b>${esc(report.baustelle)}</b>${report.adresse ? `<small>${esc(report.adresse)}</small>` : ''}</span><em>Ändern</em>`
      : `${ICON.pin}<span><b class="muted">Baustelle auswählen</b><small>oder neue Baustelle erstellen</small></span>`;
  };
  const chooseSite = () => openSitePicker(report.baustelleId, async (site) => {
    report.baustelleId = site.id;
    report.baustelle = site.name;
    report.adresse = site.adresse || '';
    if (site.auftrag) {
      report.auftrag = site.auftrag;
      $('[data-field=auftrag]').value = site.auftrag;
    }
    site.lastUsed = Date.now();
    await db.putSite(site);
    drawSite();
    changed();
    if (!report.art) chooseArt();
  });
  $('#site-pick').onclick = chooseSite;
  drawSite();

  const setArt = (art) => {
    report.art = art;
    $$('#art-seg button').forEach((b) => b.setAttribute('aria-checked', b.dataset.art === art));
    $('#head-title').textContent = `${isDraft ? 'Neuer ' : ''}${artLabel(report)}`;
    changed();
  };
  $$('#art-seg button').forEach((b) => { b.onclick = () => setArt(b.dataset.art); });
  const chooseArt = () => {
    const { sheet, close } = openSheet(`
      <h2>Was möchtest du erstellen?</h2>
      <div class="art-choice">${ARTEN.map((a) => `<button type="button" class="pick" data-art="${a.id}">
        ${a.id === 'rapport' ? ICON.clock : ICON.doc}<span><b>${a.label}</b><small>${a.hint}</small></span></button>`).join('')}</div>`);
    $$('.pick', sheet).forEach((b) => { b.onclick = () => { close(); setArt(b.dataset.art); }; });
  };
  if (isDraft && !report.baustelleId) setTimeout(chooseSite, 150);

  const drawCrew = () => {
    const crew = report.mitarbeiter;
    $('#crew').innerHTML = crew.map((e, i) => `
      <div class="crew" data-i="${i}">
        <div class="crew-head">
          <div class="avatar">${esc((e.name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</div>
          <span><b>${esc(e.name)}</b><small>${esc(kategorieOf(e))}</small></span>
          <b class="crew-hours">${formatHours(entryHours(e))}</b>
          <button type="button" class="icon-btn crew-remove" aria-label="${esc(e.name)} entfernen">${ICON.x}</button>
        </div>
        <div class="row three">
          <label class="field"><span>Beginn</span><input type="time" data-k="beginn" value="${esc(e.beginn)}"></label>
          <label class="field"><span>Ende</span><input type="time" data-k="ende" value="${esc(e.ende)}"></label>
          <label class="field"><span>Pause</span><input type="number" inputmode="numeric" min="0" step="5" data-k="pause" value="${esc(e.pause)}" placeholder="Min."></label>
        </div>
      </div>`).join('') + (crew.length > 1
      ? '<button type="button" class="link-btn" id="crew-same">Zeiten der ersten Person für alle übernehmen</button>' : '')
      + (crew.length ? '' : '<p class="hint" style="margin:0 0 12px">Noch kein Personal ausgewählt.</p>');
    $$('#crew .crew').forEach((el) => {
      const e = crew[Number(el.dataset.i)];
      $$('[data-k]', el).forEach((inp) => {
        inp.oninput = () => {
          e[inp.dataset.k] = inp.dataset.k === 'pause' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
          changed();
        };
      });
      $('.crew-remove', el).onclick = () => {
        crew.splice(Number(el.dataset.i), 1);
        drawCrew();
        changed();
      };
    });
    drawSum();
    const same = $('#crew-same');
    if (same) same.onclick = () => {
      const [first] = crew;
      for (const e of crew) Object.assign(e, { beginn: first.beginn, ende: first.ende, pause: first.pause });
      drawCrew();
      changed();
    };
  };
  $('#add-crew').onclick = () => openPeoplePicker(report.mitarbeiter.map((e) => e.personId), (people) => {
    // Neue Personen übernehmen die Zeiten der ersten Person im Bericht, falls schon erfasst
    const first = report.mitarbeiter[0];
    for (const p of people) {
      report.mitarbeiter.push({
        personId: p.id, name: p.name, kategorie: kategorieOf(p),
        beginn: first?.beginn || '', ende: first?.ende || '', pause: first?.pause ?? '',
      });
    }
    sortCrew(report.mitarbeiter);
    drawCrew();
    changed();
  });
  drawCrew();
  drawSum();
  $('#hours').textContent = report.mitarbeiter.length ? `Summe ${formatHours(workedHours(report))}` : '';

  $$('#wetter .chip').forEach((chip) => {
    chip.onclick = () => {
      const w = chip.dataset.wetter;
      report.wetter = report.wetter.includes(w) ? report.wetter.filter((x) => x !== w) : [...report.wetter, w];
      chip.setAttribute('aria-pressed', report.wetter.includes(w));
      changed();
    };
  });

  const drawThumbs = async () => {
    const files = (await db.filesFor(report.id)).filter((f) => !pendingRemovals.has(f.id));
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
        if (pendingAdds.delete(file.id)) await db.deleteFile(file.id);
        else pendingRemovals.add(file.id);
        changed();
        drawThumbs();
      };
    });
  };

  const addFiles = async (list) => {
    if (!list.length) return;
    $('#sync-state').textContent = 'Anhänge werden vorbereitet …';
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        toast(`„${file.name}“ ist größer als 25 MB und wurde nicht hinzugefügt.`, 4000);
        continue;
      }
      const prepared = await prepareFile(file);
      const fid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      pendingAdds.add(fid);
      await db.putFile({
        id: fid,
        reportId: report.id,
        name: prepared.name,
        type: prepared.type,
        size: prepared.blob.size,
        blob: prepared.blob,
        addedAt: Date.now(),
      });
    }
    changed();
    updateState();
    drawThumbs();
  };
  $('#cam').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  $('#pick').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };

  function updateState() {
    const el = $('#sync-state');
    if (!el) return;
    if (isDraft) el.innerHTML = '';
    else if (!isConfigured(settings)) el.innerHTML = '<span class="pill local">Nur auf dem Handy</span>';
    else if (syncing) el.innerHTML = '<span class="pill pending">Wird hochgeladen …</span>';
    else if (report.syncError && report.dirty) el.innerHTML = `<span class="pill error">Upload-Fehler</span> <small>${esc(report.syncError)}</small>`;
    else if (report.dirty) el.innerHTML = '<span class="pill pending">Noch nicht hochgeladen</span>';
    else el.innerHTML = `<span class="pill ok">Hochgeladen ${timeLabel(report.syncedAt)}</span>`;
  }
  editorHooks = {
    id: report.id,
    hash: location.hash,
    hasUnsaved: () => unsaved,
    discard,
    refresh: async () => {
      const fresh = await db.getReport(report.id);
      if (fresh) {
        for (const k of ['syncedAt', 'syncError', 'remoteDir', 'remoteFiles']) report[k] = fresh[k];
        report.dirty = fresh.dirty;
      }
      updateState();
    },
  };

  $('#menu-btn').onclick = (e) => {
    e.stopPropagation();
    openMenu([
      { icon: ICON.share, label: 'Teilen', run: () => shareReport(report) },
      ...(isDraft ? [] : [{ icon: ICON.cloud, label: 'Jetzt hochladen', run: () => (isConfigured(settings) ? runSync(true) : (location.hash = '#/einstellungen')) }]),
      { icon: ICON.copy, label: 'Neuer Bericht mit diesen Angaben', run: () => duplicate(report) },
      { icon: ICON.trash, label: isDraft ? 'Verwerfen' : 'Bericht löschen', danger: true, run: () => (isDraft ? cancel() : removeReport(report, true)) },
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
  const title = `${artLabel(report)} ${formatDate(report.datum)}`;
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
  const copy = newReport();
  for (const k of ['art', 'baustelleId', 'baustelle', 'adresse', 'auftrag', 'taetigkeiten', 'material']) copy[k] = report[k];
  copy.mitarbeiter = structuredClone(report.mitarbeiter || []);
  drafts.set(copy.id, copy);
  location.hash = `#/bericht/${copy.id}`;
}

async function removeReport(report, saved) {
  if (!saved) {
    drafts.delete(report.id);
    editorHooks = null;
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
  await editorHooks?.discard();
  await db.deleteReport(report.id);
  toast('Bericht gelöscht.');
  editorHooks = null;
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

// ---------- Baustellen ----------

async function siteStats() {
  const stats = new Map();
  for (const r of await db.allReports()) {
    if (!r.baustelleId) continue;
    const s = stats.get(r.baustelleId) || { count: 0, hours: 0, last: '' };
    s.count++;
    s.hours += workedHours(r) || 0;
    if (r.datum > s.last) s.last = r.datum;
    stats.set(r.baustelleId, s);
  }
  return stats;
}

function siteCard(site, st) {
  const meta = st ? `${st.count} ${st.count === 1 ? 'Bericht' : 'Berichte'} · ${formatHours(st.hours)}` : 'Noch keine Berichte';
  return `<a class="scard ${site.archived ? 'archived' : ''}" href="#/baustelle/${encodeURIComponent(site.id)}">
      <div class="sicon">${ICON.pin}</div>
      <div class="body"><div class="title">${esc(site.name)}</div>
        ${site.adresse ? `<div class="preview">${esc(site.adresse)}</div>` : ''}
        <div class="meta">${meta}${site.auftrag ? ` · Nr. ${esc(site.auftrag)}` : ''}</div></div>
      ${ICON.chevron}</a>`;
}

async function renderSites() {
  appbar.innerHTML = '<h1>Baustellen</h1>';
  const sites = await db.allSites();
  const stats = await siteStats();
  const active = sites.filter((s) => !s.archived);
  const done = sites.filter((s) => s.archived);
  if (!sites.length) {
    view.innerHTML = `<div class="empty">
        <h2>Noch keine Baustellen</h2>
        <p>Lege deine Baustellen einmal an. Beim Bericht wählst du sie dann nur noch aus.</p>
        <a class="btn primary" href="#/baustelle/neu">${ICON.plus} Neue Baustelle</a></div>`;
    return;
  }
  view.innerHTML = `
    <a class="btn soft block" href="#/baustelle/neu" style="margin:6px 0 14px">${ICON.plus} Neue Baustelle</a>
    ${active.length ? `<div class="month"><span>Aktiv</span><span>${active.length}</span></div><div class="card-list">${active.map((s) => siteCard(s, stats.get(s.id))).join('')}</div>` : ''}
    ${done.length ? `<div class="month"><span>Abgeschlossen</span><span>${done.length}</span></div><div class="card-list">${done.map((s) => siteCard(s, stats.get(s.id))).join('')}</div>` : ''}`;
}

function siteFields(site) {
  return `
    <label class="field"><span>Name der Baustelle *</span><input type="text" name="name" value="${esc(site.name)}" placeholder="z. B. MFH Seestrasse" required></label>
    <label class="field"><span>Adresse</span><input type="text" name="adresse" value="${esc(site.adresse)}" placeholder="Strasse, Ort"></label>
    <div class="row">
      <label class="field"><span>Auftragsnummer</span><input type="text" name="auftrag" value="${esc(site.auftrag)}" placeholder="optional"></label>
      <label class="field"><span>Kunde / Bauherr</span><input type="text" name="kunde" value="${esc(site.kunde)}" placeholder="optional"></label>
    </div>`;
}

function readSiteFields(root, site) {
  for (const el of $$('[name]', root)) if (el.name in site) site[el.name] = el.value.trim();
  return site;
}

async function renderSiteEditor(id) {
  const isNew = id === 'neu';
  const site = isNew ? newSite() : await db.getSite(id);
  if (!site) {
    location.replace('#/baustellen');
    return;
  }
  appbar.innerHTML = `
    <button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button>
    <h1 class="small">${isNew ? 'Neue Baustelle' : esc(site.name)}</h1>`;
  $('#back').onclick = () => (location.hash = '#/baustellen');

  const reports = isNew ? [] : (await db.allReports()).filter((r) => r.baustelleId === site.id);
  view.innerHTML = `
    <form id="site-form" class="section" onsubmit="return false">
      ${siteFields(site)}
      <label class="field"><span>Notizen</span><textarea name="notiz" rows="3" placeholder="Ansprechpartner, Zugang, Besonderheiten …">${esc(site.notiz)}</textarea></label>
      ${isNew ? '' : `<div class="toggle"><span><b>Abgeschlossen</b><small>Wird bei neuen Berichten nicht mehr angeboten</small></span>
        <label class="switch"><input type="checkbox" id="archived" ${site.archived ? 'checked' : ''}><i></i></label></div>`}
    </form>
    <button class="btn primary block" id="save-site">${isNew ? 'Baustelle speichern' : 'Änderungen speichern'}</button>
    ${reports.length ? `<div class="month"><span>Berichte</span><span>${formatHours(reports.reduce((s, r) => s + (workedHours(r) || 0), 0))}</span></div>
      <div class="card-list">${reports.map((r) => `<a class="rcard" href="#/bericht/${encodeURIComponent(r.id)}">
        <div class="date"><b>${parseDate(r.datum).getDate()}</b><span>${weekday(r.datum).slice(0, 2)}</span></div>
        <div class="body"><div class="title">${formatDate(r.datum)}</div><div class="preview">${esc((r.taetigkeiten || r.bemerkungen || '').split('\n')[0])}</div></div>
        <div class="hours">${formatHours(workedHours(r))}</div></a>`).join('')}</div>` : ''}
    ${isNew ? '' : '<button class="btn danger block" id="delete-site" style="margin-top:20px">Baustelle löschen</button>'}`;

  $('#save-site').onclick = async () => {
    readSiteFields($('#site-form'), site);
    if (!site.name) {
      toast('Bitte einen Namen für die Baustelle eingeben.');
      $('[name=name]').focus();
      return;
    }
    const box = $('#archived');
    if (box) site.archived = box.checked ? 1 : 0;
    await db.putSite(site);
    toast(isNew ? 'Baustelle gespeichert.' : 'Änderungen gespeichert.');
    location.hash = '#/baustellen';
  };
  const del = $('#delete-site');
  if (del) del.onclick = async () => {
    const hint = reports.length ? ` Die ${reports.length} Berichte dazu bleiben erhalten.` : '';
    if (!confirm(`Baustelle „${site.name}“ löschen?${hint}`)) return;
    await db.deleteSite(site.id);
    location.hash = '#/baustellen';
  };
}

// Auswahl im Bericht: gespeicherte Baustelle antippen oder neue anlegen.
async function openSitePicker(currentId, onSelect) {
  const sites = (await db.allSites()).filter((s) => !s.archived || s.id === currentId);
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Baustelle auswählen">
      <div class="sheet-grip"></div>
      <h2>Baustelle auswählen</h2>
      ${sites.length ? `${sites.length > 6 ? `<label class="search">${ICON.search}<input id="sheet-search" type="search" placeholder="Baustelle suchen …" autocomplete="off"></label>` : ''}
        <div class="pick-list">${sites.map((s) => `<button type="button" class="pick ${s.id === currentId ? 'current' : ''}" data-id="${s.id}">
          ${ICON.pin}<span><b>${esc(s.name)}</b>${s.adresse ? `<small>${esc(s.adresse)}</small>` : ''}</span></button>`).join('')}</div>`
        : '<p class="hint" style="text-align:center;margin:4px 0 0">Noch keine Baustellen gespeichert.</p>'}
      <div class="sheet-or"><span>oder</span></div>
      <button class="btn ghost block" id="sheet-new">${ICON.plus} Neue Baustelle erstellen</button>
      <form id="sheet-form" class="section" hidden onsubmit="return false">
        <h2>Neue Baustelle</h2>
        ${siteFields(newSite())}
        <div class="attach-actions" style="margin-top:4px">
          <button type="button" class="btn ghost" id="sheet-cancel">Abbrechen</button>
          <button type="button" class="btn primary" id="sheet-save">Speichern</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));
  const close = () => {
    sheet.classList.remove('open');
    setTimeout(() => sheet.remove(), 200);
  };
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  $$('.pick', sheet).forEach((b) => {
    b.onclick = () => {
      close();
      onSelect(sites.find((s) => s.id === b.dataset.id));
    };
  });
  const search = $('#sheet-search', sheet);
  if (search) search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    $$('.pick', sheet).forEach((b) => { b.hidden = q && !b.textContent.toLowerCase().includes(q); });
  };
  $('#sheet-new', sheet).onclick = () => {
    $('#sheet-new', sheet).hidden = true;
    $('#sheet-form', sheet).hidden = false;
    $('#sheet-form', sheet).scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('[name=name]', sheet).focus();
  };
  $('#sheet-cancel', sheet).onclick = () => {
    $('#sheet-form', sheet).hidden = true;
    $('#sheet-new', sheet).hidden = false;
  };
  $('#sheet-save', sheet).onclick = async () => {
    const site = readSiteFields($('#sheet-form', sheet), newSite());
    if (!site.name) {
      toast('Bitte einen Namen für die Baustelle eingeben.');
      return;
    }
    await db.putSite(site);
    close();
    onSelect(site);
  };
}

// ---------- Personal ----------

function personFields(p) {
  return `
    <label class="field"><span>Name *</span><input type="text" name="name" value="${esc(p.name)}" placeholder="Vor- und Nachname" autocapitalize="words"></label>
    <div class="field"><span>Kategorie</span>
      <input type="hidden" name="kategorie" value="${esc(kategorieOf(p))}">
      <div class="chips kat-chips">${KATEGORIEN.map((k) => `<button type="button" class="chip" data-kat="${k}" aria-pressed="${kategorieOf(p) === k}">${k}</button>`).join('')}</div>
    </div>`;
}

function bindKategorie(root) {
  $$('.kat-chips .chip', root).forEach((chip) => {
    chip.onclick = () => {
      const box = chip.closest('.field');
      $('[name=kategorie]', box).value = chip.dataset.kat;
      $$('.chip', box).forEach((c) => c.setAttribute('aria-pressed', c === chip));
    };
  });
}

function openSheet(html) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `<div class="sheet" role="dialog"><div class="sheet-grip"></div>${html}</div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));
  const close = () => {
    sheet.classList.remove('open');
    setTimeout(() => sheet.remove(), 200);
  };
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  return { sheet, close };
}

// Mehrere Personen auswählen; Personen, die schon im Bericht sind, werden nicht angeboten.
async function openPeoplePicker(takenIds, onDone) {
  let people = sortCrew((await db.allPeople()).filter((p) => !p.archived && !takenIds.includes(p.id)));
  const chosen = new Set();
  const { sheet, close } = openSheet(`
    <h2>Personal auswählen</h2>
    <div class="pick-list" id="people-list"></div>
    <div class="sheet-or"><span>oder</span></div>
    <button class="btn ghost block" id="person-new">${ICON.plus} Neue Person anlegen</button>
    <form id="person-form" class="section" hidden onsubmit="return false">
      <h2>Neue Person</h2>
      ${personFields(newPerson())}
      <div class="attach-actions">
        <button type="button" class="btn ghost" id="person-cancel">Abbrechen</button>
        <button type="button" class="btn primary" id="person-save">Speichern</button>
      </div>
    </form>
    <button class="btn primary block" id="people-done" style="margin-top:16px"></button>`);
  const draw = () => {
    $('#people-list', sheet).innerHTML = people.length
      ? people.map((p) => `<button type="button" class="pick check" data-id="${p.id}" aria-pressed="${chosen.has(p.id)}">
          <i class="box"></i><span><b>${esc(p.name)}</b><small>${esc(kategorieOf(p))}</small></span></button>`).join('')
      : `<p class="hint" style="text-align:center;margin:4px 0 0">${takenIds.length ? 'Alle gespeicherten Personen sind schon im Bericht.' : 'Noch kein Personal gespeichert.'}</p>`;
    $$('.pick', sheet).forEach((b) => {
      b.onclick = () => {
        if (chosen.has(b.dataset.id)) chosen.delete(b.dataset.id);
        else chosen.add(b.dataset.id);
        b.setAttribute('aria-pressed', chosen.has(b.dataset.id));
        drawDone();
      };
    });
    drawDone();
  };
  const drawDone = () => {
    const btn = $('#people-done', sheet);
    btn.textContent = chosen.size ? `${chosen.size} ${chosen.size === 1 ? 'Person' : 'Personen'} übernehmen` : 'Fertig';
  };
  bindKategorie(sheet);
  $('#person-new', sheet).onclick = () => {
    $('#person-new', sheet).hidden = true;
    $('#person-form', sheet).hidden = false;
    $('#person-form', sheet).scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('[name=name]', sheet).focus();
  };
  const resetForm = () => {
    $('#person-form', sheet).hidden = true;
    $('#person-new', sheet).hidden = false;
    $('#person-form [name=name]', sheet).value = '';
  };
  $('#person-cancel', sheet).onclick = resetForm;
  $('#person-save', sheet).onclick = async () => {
    const person = readSiteFields($('#person-form', sheet), newPerson());
    if (!person.name) {
      toast('Bitte einen Namen eingeben.');
      return;
    }
    await db.putPerson(person);
    people = sortCrew([...people, person]);
    chosen.add(person.id);
    resetForm();
    draw();
  };
  $('#people-done', sheet).onclick = () => {
    close();
    const selected = people.filter((p) => chosen.has(p.id));
    if (selected.length) onDone(selected);
  };
  draw();
}

async function renderPeople() {
  appbar.innerHTML = `
    <button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button>
    <h1 class="small">Personal</h1>`;
  $('#back').onclick = () => (location.hash = '#/einstellungen');
  const people = await db.allPeople();
  view.innerHTML = `
    <button class="btn soft block" id="add-person" style="margin:6px 0 14px">${ICON.plus} Neue Person</button>
    ${people.length ? `<div class="card-list">${people.map((p) => `<button type="button" class="scard person ${p.archived ? 'archived' : ''}" data-id="${p.id}">
        <div class="sicon avatar">${esc(p.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div class="body"><div class="title">${esc(p.name)}</div><div class="meta">${esc(kategorieOf(p))}${p.archived ? ' · Ausgeschieden' : ''}</div></div>
        ${ICON.chevron}</button>`).join('')}</div>`
      : '<div class="empty"><h2>Noch kein Personal</h2><p>Lege deine Leute einmal an. Im Bericht wählst du sie dann nur noch aus.</p></div>'}`;
  const edit = (person, isNew) => {
    const { sheet, close } = openSheet(`
      <h2>${isNew ? 'Neue Person' : 'Person bearbeiten'}</h2>
      <form class="section" id="pf" onsubmit="return false">
        ${personFields(person)}
        ${isNew ? '' : `<div class="toggle"><span><b>Ausgeschieden</b><small>Wird im Bericht nicht mehr angeboten</small></span>
          <label class="switch"><input type="checkbox" id="p-archived" ${person.archived ? 'checked' : ''}><i></i></label></div>`}
      </form>
      <div class="attach-actions">
        <button type="button" class="btn ghost" id="pf-cancel">Abbrechen</button>
        <button type="button" class="btn primary" id="pf-save">Speichern</button>
      </div>
      ${isNew ? '' : '<button type="button" class="btn danger block" id="pf-delete" style="margin-top:12px">Person löschen</button>'}`);
    bindKategorie(sheet);
    $('#pf-cancel', sheet).onclick = close;
    $('#pf-save', sheet).onclick = async () => {
      readSiteFields($('#pf', sheet), person);
      if (!person.name) {
        toast('Bitte einen Namen eingeben.');
        return;
      }
      const box = $('#p-archived', sheet);
      if (box) person.archived = box.checked ? 1 : 0;
      await db.putPerson(person);
      close();
      renderPeople();
    };
    const del = $('#pf-delete', sheet);
    if (del) del.onclick = async () => {
      if (!confirm(`${person.name} löschen? Bestehende Berichte behalten den Namen.`)) return;
      await db.deletePerson(person.id);
      close();
      renderPeople();
    };
  };
  $('#add-person').onclick = () => edit(newPerson(), true);
  $$('.scard.person').forEach((b) => { b.onclick = () => edit(people.find((p) => p.id === b.dataset.id), false); });
}

// Baustellen aus früheren Berichten einmalig übernehmen.
async function migrateSites() {
  if (localStorage.getItem('tagesberichte.sitesMigrated')) return;
  const sites = await db.allSites();
  const byName = new Map(sites.map((s) => [s.name.toLowerCase(), s]));
  for (const r of await db.allReports()) {
    if (r.baustelleId || !r.baustelle) continue;
    let site = byName.get(r.baustelle.toLowerCase());
    if (!site) {
      site = newSite({ name: r.baustelle, auftrag: r.auftrag || '', lastUsed: r.createdAt });
      byName.set(site.name.toLowerCase(), site);
      await db.putSite(site);
    }
    r.baustelleId = site.id;
    await db.putReport(r);
  }
  localStorage.setItem('tagesberichte.sitesMigrated', '1');
}

// ---------- Einstellungen ----------

async function renderSettings() {
  appbar.innerHTML = '<h1>Einstellungen</h1>';
  const s = settings;
  view.innerHTML = `
    <a class="scard" href="#/personal" style="margin-bottom:12px">
      <div class="sicon">${ICON.people}</div>
      <div class="body"><div class="title">Personal verwalten</div><div class="meta">Leute anlegen, die im Bericht ausgewählt werden</div></div>
      ${ICON.chevron}</a>

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

window.addEventListener('hashchange', async () => {
  const ed = editorHooks;
  if (ed && ed.hash !== location.hash && ed.hasUnsaved()) {
    if (!confirm('Änderungen am Bericht verwerfen?')) {
      history.replaceState(null, '', ed.hash);
      return;
    }
    await ed.discard();
  } else if (ed) {
    await ed.discard();
  }
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

migrateSites().catch(() => {}).finally(route);
scheduleAutoSync(1500);


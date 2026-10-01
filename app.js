import * as db from './db.js';
import { prepareFile, formatBytes, MAX_FILE_BYTES } from './media.js';
import {
  WETTER, newReport, newSite, newPerson, crewOf, entryHours, KATEGORIEN, kategorieOf, sortCrew, hoursByKategorie, workedHours, formatHours, formatDate, weekday, monthLabel, parseDate, toMarkdown, ARTEN, artLabel,
  ABRECHNUNG, MASCHINEN_VORSCHLAEGE, maschinenStunden, today, newId,
} from './report.js';
import {
  buildPdf, pdfFileName, buildStundenPdf, stundenPdfName, buildSammelPdf, sammelPdfName,
} from './pdf.js';
import {
  TYPEN, typLabel, hatZeiten, newStunde, stundenOf, personKey, kw, summe, sortStunden, monatLabel, shiftMonth,
} from './stunden.js';
import {
  isConfigured, syncAll, syncReport, testConnection, deleteRemote, loadAdminConfig, saveAdminConfig, loadStundenRemote,
} from './sync.js';
import { startI18n, SPRACHEN } from './i18n.js';

const APP_VERSION = '1.14.0';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');
const appbar = $('#appbar');

let settings = db.loadSettings();
startI18n(settings.lang || 'de');
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

function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').classList.remove('show');
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
  $$('.sheet-backdrop, .pdf-view').forEach((el) => el.remove());
  document.body.classList.remove('no-scroll');
  document.body.classList.remove('editing');
  const hash = location.hash || '#/';
  $$('.tabbar a[data-tab]').forEach((a) => a.classList.toggle('active',
    (a.dataset.tab === 'list' && hash === '#/')
    || (a.dataset.tab === 'sites' && hash.startsWith('#/baustelle'))
    || (a.dataset.tab === 'hours' && hash === '#/stunden')
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
  if (hash === '#/stunden') return renderStunden();
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
    <button class="icon-btn" id="sum-btn" aria-label="Zusammenfassung als PDF">${ICON.doc}</button>
    <button class="icon-btn ${syncing ? 'spin' : ''}" id="sync-btn" aria-label="Jetzt hochladen">
      ${configured ? ICON.sync : ICON.cloud}
      ${pending && configured ? `<span class="badge">${pending}</span>` : ''}
    </button>`;
  $('#sync-btn').onclick = () => (configured ? runSync(true) : (location.hash = '#/einstellungen'));
  $('#sum-btn').onclick = () => openZusammenfassung();

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
            <div class="meta">${r.art === 'rapport' ? '<span class="pill art">Rapport</span>' : ''}${r.fremd && r.erstelltVon ? `<span class="pill von">von ${esc(r.erstelltVon)}</span>` : ''}${syncPill(r)}${n ? `<span>${ICON.clip} ${n}</span>` : ''}</div>
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
  report.abrechnung ||= 'regie';
  report.maschinen ||= [];
  report.unterschrift ||= null;
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

      <section class="section rapport-only">
        <h2>Abrechnung</h2>
        <div class="seg" id="abr-seg" role="radiogroup" aria-label="Abrechnung">${ABRECHNUNG.map((a) =>
          `<button type="button" role="radio" data-abr="${a.id}" aria-checked="${report.abrechnung === a.id}">${a.label}</button>`).join('')}</div>
      </section>

      <section class="section rapport-only">
        <h2>Maschinen und Fahrzeuge <span class="h-right" id="masch-sum"></span></h2>
        <div id="maschinen" class="masch-list"></div>
        <div class="chips" id="masch-quick">${MASCHINEN_VORSCHLAEGE.map((m) =>
          `<button type="button" class="chip" data-masch="${esc(m)}">${ICON.plus} ${esc(m)}</button>`).join('')}
          <button type="button" class="chip" data-masch="">${ICON.plus} Andere Maschine</button></div>
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

      <section class="section rapport-only">
        <h2>Unterschrift Bauherr</h2>
        <div id="sign-box"></div>
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
    ${isDraft ? '' : `<button class="btn soft block" id="pdf-btn">${ICON.share} Als PDF teilen</button>`}
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
    const fehlt = rapportFehlt(report);
    if (fehlt) {
      toast(fehlt.text, 4000);
      const el = fehlt.sel && $(fehlt.sel);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('missing');
        setTimeout(() => el.classList.remove('missing'), 2500);
      }
      return;
    }
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
  const pdfBtn = $('#pdf-btn');
  if (pdfBtn) pdfBtn.onclick = () => shareReport(report);

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

  const showRapport = () => $$('.rapport-only').forEach((el) => { el.hidden = report.art !== 'rapport'; });
  const setArt = (art) => {
    report.art = art;
    showRapport();
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
  showRapport();

  // Rapport: Abrechnung, Maschinenstunden, Unterschrift
  $$('#abr-seg button').forEach((b) => {
    b.onclick = () => {
      report.abrechnung = b.dataset.abr;
      $$('#abr-seg button').forEach((x) => x.setAttribute('aria-checked', x === b));
      changed();
    };
  });
  const drawMaschinenSum = () => {
    const h = maschinenStunden(report);
    $('#masch-sum').textContent = h ? `Summe ${formatHours(h)}` : '';
  };
  const drawMaschinen = () => {
    const list = report.maschinen;
    $('#maschinen').innerHTML = list.map((m, i) => `
      <div class="masch" data-i="${i}">
        <label class="field"><span>Maschine / Fahrzeug</span><input type="text" data-m="bezeichnung" value="${esc(m.bezeichnung)}" placeholder="z. B. Bagger"></label>
        <label class="field"><span>Stunden</span><input type="text" inputmode="decimal" data-m="stunden" value="${esc(m.stunden)}" placeholder="0"></label>
        <button type="button" class="icon-btn masch-remove" aria-label="Maschine entfernen">${ICON.x}</button>
      </div>`).join('');
    $$('#maschinen .masch').forEach((el) => {
      const m = list[Number(el.dataset.i)];
      $$('[data-m]', el).forEach((inp) => {
        inp.oninput = () => { m[inp.dataset.m] = inp.value; drawMaschinenSum(); changed(); };
      });
      $('.masch-remove', el).onclick = () => { list.splice(Number(el.dataset.i), 1); drawMaschinen(); changed(); };
    });
    drawMaschinenSum();
  };
  $$('#masch-quick [data-masch]').forEach((b) => {
    b.onclick = () => {
      report.maschinen.push({ bezeichnung: b.dataset.masch, stunden: '' });
      drawMaschinen();
      changed();
      const inputs = $$('#maschinen .masch');
      $(`[data-m=${b.dataset.masch ? 'stunden' : 'bezeichnung'}]`, inputs[inputs.length - 1]).focus();
    };
  });
  drawMaschinen();

  const drawSign = () => {
    const u = report.unterschrift;
    $('#sign-box').innerHTML = u?.dataUrl
      ? `<div class="sign-done"><img src="${u.dataUrl}" alt="Unterschrift">
          <small>${esc(u.name || 'Ohne Namen')} · ${new Date(u.zeit).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
         <div class="row two"><button type="button" class="btn soft" id="sign-btn">Neu signieren</button>
         <button type="button" class="btn ghost" id="sign-del">Entfernen</button></div>`
      : `<p class="hint" style="margin:0 0 12px">Der Bauherr bestätigt den Rapport mit dem Finger.</p>
         <button type="button" class="btn soft block" id="sign-btn">Unterschreiben lassen</button>`;
    $('#sign-btn').onclick = () => openSignature(u?.name || '', (res) => { report.unterschrift = res; drawSign(); changed(); });
    const del = $('#sign-del');
    if (del) del.onclick = () => { if (confirm('Unterschrift entfernen?')) { report.unterschrift = null; drawSign(); changed(); } };
  };
  drawSign();

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
      { icon: ICON.share, label: 'Als PDF teilen', run: () => shareReport(report) },
      ...(isDraft ? [] : [{ icon: ICON.cloud, label: 'Jetzt hochladen', run: () => (isConfigured(settings) ? runSync(true) : (location.hash = '#/einstellungen')) }]),
      { icon: ICON.copy, label: 'Neuer Bericht mit diesen Angaben', run: () => duplicate(report) },
      { icon: ICON.trash, label: isDraft ? 'Verwerfen' : 'Bericht löschen', danger: true, run: () => (isDraft ? cancel() : removeReport(report, true)) },
    ]);
  };

  updateState();
  drawThumbs();
}

let editorHooks = null;

// Pflichtangaben beim Rapport, bevor gespeichert werden darf.
const RAPPORT_PFLICHT = { zeiten: true, arbeiten: true, unterschrift: false };

function rapportFehlt(r) {
  if (r.art !== 'rapport') return null;
  if (RAPPORT_PFLICHT.zeiten) {
    if (!r.mitarbeiter.length) return { text: 'Rapport: Bitte zuerst Personal mit Beginn und Ende eintragen.', sel: '#add-crew' };
    const i = r.mitarbeiter.findIndex((e) => !e.beginn || !e.ende);
    if (i >= 0) return { text: `Rapport: Bei ${r.mitarbeiter[i].name || 'einer Person'} fehlt ${!r.mitarbeiter[i].beginn ? 'Beginn' : 'Ende'}.`, sel: `#crew .crew[data-i="${i}"]` };
  }
  if (RAPPORT_PFLICHT.arbeiten && !(r.taetigkeiten || '').trim()) return { text: 'Rapport: Bitte eintragen, welche Arbeiten ausgeführt wurden.', sel: '[data-field=taetigkeiten]' };
  if (RAPPORT_PFLICHT.unterschrift && !r.unterschrift?.dataUrl) return { text: 'Rapport: Bitte zuerst vom Bauherrn unterschreiben lassen.', sel: '#sign-box' };
  return null;
}

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

// Bericht als PDF mit eingebauten Fotos teilen (Mail, WhatsApp …).
async function shareReport(report) {
  toast('PDF wird erstellt …', 6000);
  let file;
  let extras = [];
  try {
    const files = await db.filesFor(report.id);
    const pdf = await buildPdf(report, files, settings.author);
    file = new File([pdf], pdfFileName(report), { type: 'application/pdf' });
    // Andere Dokumente (z. B. Lieferscheine als PDF) werden mitgeschickt; Fotos stecken schon im PDF.
    extras = files.filter((f) => !f.type.startsWith('image/')).map((f) => new File([f.blob], f.name, { type: f.type }));
  } catch (err) {
    toast(`PDF konnte nicht erstellt werden: ${err.message}`, 4000);
    return;
  }
  hideToast();
  const title = `${artLabel(report)} ${formatDate(report.datum)}${report.baustelle ? ` – ${report.baustelle}` : ''}`;
  await sharePdfFile(file, title, extras);
}

// PDF erst in der App ansehen; Teilen/Speichern über den Knopf unten.
let pdfjs = null;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('./vendor/pdf.min.js');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', location.href).href;
  }
  return pdfjs;
}

async function sharePdfFile(file, title, extras) {
  const share = async () => {
    const all = [file, ...extras];
    const list = navigator.canShare?.({ files: all }) ? all : [file];
    if (navigator.canShare?.({ files: list })) await navigator.share({ title, files: list });
    else openFile({ name: file.name, type: file.type, blob: file });
  };
  const view = document.createElement('div');
  view.className = 'pdf-view';
  view.innerHTML = `
    <header><button type="button" class="icon-btn" id="pdfv-close" aria-label="Schließen">${ICON.x}</button>
      <div><b>${esc(title)}</b><small id="pdfv-info">${esc(formatBytes(file.size))}</small></div></header>
    <div class="pdf-pages" id="pdfv-pages"><p class="hint" style="text-align:center;margin-top:40px">PDF wird geladen …</p></div>
    <footer><button type="button" class="btn primary block" id="pdfv-share">${ICON.share} Teilen oder speichern</button></footer>`;
  document.body.appendChild(view);
  document.body.classList.add('no-scroll');
  let closed = false;
  const close = () => { closed = true; view.remove(); document.body.classList.remove('no-scroll'); };
  $('#pdfv-close', view).onclick = close;
  $('#pdfv-share', view).onclick = async () => {
    try { await share(); } catch (e) { if (e.name !== 'AbortError') toast('Teilen hat nicht geklappt.'); }
  };

  const pages = $('#pdfv-pages', view);
  try {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (closed) return;
    pages.innerHTML = '';
    $('#pdfv-info', view).textContent = `${pdf.numPages} ${pdf.numPages === 1 ? 'Seite' : 'Seiten'} · ${formatBytes(file.size)}`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 1; i <= pdf.numPages && !closed; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const cssW = Math.min(pages.clientWidth - 16, 900);
      const vp = page.getViewport({ scale: (cssW / base.width) * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${cssW}px`;
      pages.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      page.cleanup();
    }
    pdf.cleanup();
  } catch (err) {
    // Vorschau geht nicht (z. B. sehr altes iOS): dann wie bisher teilen/öffnen
    if (closed) return;
    pages.innerHTML = `<p class="hint" style="text-align:center;margin-top:40px">Vorschau nicht möglich (${esc(err.message)}).<br>Tippe unten auf „Teilen oder speichern“.</p>`;
  }
}

async function duplicate(report) {
  const copy = newReport();
  for (const k of ['art', 'baustelleId', 'baustelle', 'adresse', 'auftrag', 'taetigkeiten', 'material']) copy[k] = report[k];
  copy.mitarbeiter = structuredClone(report.mitarbeiter || []);
  copy.abrechnung = report.abrechnung || 'regie';
  copy.maschinen = structuredClone((report.maschinen || []).map((m) => ({ bezeichnung: m.bezeichnung, stunden: '' })));
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
    ${reports.length ? `<button class="btn soft block" id="site-sum" style="margin-top:10px">${ICON.doc} Zusammenfassung als PDF</button>` : ''}
    ${reports.length ? `<div class="month"><span>Berichte</span><span>${formatHours(reports.reduce((s, r) => s + (workedHours(r) || 0), 0))}</span></div>
      <div class="card-list">${reports.map((r) => `<a class="rcard" href="#/bericht/${encodeURIComponent(r.id)}">
        <div class="date"><b>${parseDate(r.datum).getDate()}</b><span>${weekday(r.datum).slice(0, 2)}</span></div>
        <div class="body"><div class="title">${formatDate(r.datum)}</div><div class="preview">${esc((r.taetigkeiten || r.bemerkungen || '').split('\n')[0])}</div></div>
        <div class="hours">${formatHours(workedHours(r))}</div></a>`).join('')}</div>` : ''}
    ${isNew ? '' : isAdmin()
      ? '<button class="btn danger block" id="delete-site" style="margin-top:20px">Baustelle löschen</button>'
      : '<p class="hint" style="margin-top:20px;text-align:center">Löschen darf nur der Administrator. Fertige Baustellen kannst du oben als abgeschlossen markieren.</p>'}`;

  const siteSum = $('#site-sum');
  if (siteSum) siteSum.onclick = () => openZusammenfassung({ baustelleId: site.id });
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

// Unterschrift mit dem Finger auf einer Zeichenfläche.
function openSignature(name, onDone) {
  const { sheet, close } = openSheet(`
    <h2>Unterschrift Bauherr</h2>
    <label class="field"><span>Name</span><input type="text" id="sign-name" value="${esc(name)}" placeholder="Vor- und Nachname"></label>
    <div class="sign-pad"><canvas id="sign-canvas"></canvas><span class="sign-line">Hier unterschreiben</span></div>
    <div class="row three sign-actions">
      <button type="button" class="btn ghost" id="sign-cancel">Abbrechen</button>
      <button type="button" class="btn ghost" id="sign-clear">Löschen</button>
      <button type="button" class="btn primary" id="sign-ok">Übernehmen</button>
    </div>`);
  const canvas = $('#sign-canvas', sheet);
  const ratio = window.devicePixelRatio || 1;
  let ctx;
  let drawn = false;
  const setup = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    drawn = false;
  };
  requestAnimationFrame(setup);
  let last = null;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    last = pos(e);
    ctx.beginPath();
    ctx.arc(last[0], last[1], 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    drawn = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!last) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    last = p;
  });
  const end = () => { last = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  $('#sign-cancel', sheet).onclick = close;
  $('#sign-clear', sheet).onclick = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); setup(); };
  $('#sign-ok', sheet).onclick = () => {
    if (!drawn) { toast('Bitte zuerst unterschreiben.'); return; }
    // Auf weißem Grund speichern, damit die Unterschrift auch im dunklen Modus lesbar ist.
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext('2d');
    o.fillStyle = '#fff';
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    onDone({ name: $('#sign-name', sheet).value.trim(), dataUrl: out.toDataURL('image/png'), zeit: Date.now() });
    close();
  };
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
      ${isNew || !isAdmin() ? '' : '<button type="button" class="btn danger block" id="pf-delete" style="margin-top:12px">Person löschen</button>'}`);
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

// ---------- Zusammenfassung ----------
// Mehrere Berichte (Baustelle, Zeitraum, Art) in einem PDF mit Übersicht, Stunden und Material.

function monatsGrenzen(delta) {
  const d = new Date();
  const a = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const b = new Date(d.getFullYear(), d.getMonth() + delta + 1, 0);
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return [iso(a), iso(b)];
}

async function openZusammenfassung(preset = {}) {
  const reports = await db.allReports();
  if (!reports.length) { toast('Es gibt noch keine Berichte.'); return; }
  const sites = await db.allSites();
  const f = { baustelleId: preset.baustelleId || '', art: '', von: '', bis: '', gesamt: true };
  // „Gesamter Zeitraum“ = erster bis letzter Bericht der gewählten Baustelle/Art
  const gesamt = () => {
    const d = reports.filter((r) => (!f.baustelleId || r.baustelleId === f.baustelleId) && (!f.art || (r.art || 'tagesbericht') === f.art)).map((r) => r.datum).sort();
    if (d.length) { f.von = d[0]; f.bis = d[d.length - 1]; }
  };
  gesamt();
  const siteName = (id) => sites.find((x) => x.id === id)?.name || reports.find((r) => r.baustelleId === id)?.baustelle || '';
  const siteIds = [...new Set(reports.map((r) => r.baustelleId).filter(Boolean))].sort((a, b) => siteName(a).localeCompare(siteName(b), 'de'));
  const { sheet, close } = openSheet(`
    <h2>Zusammenfassung als PDF</h2>
    <label class="field"><span>Baustelle</span><select id="z-site">
      <option value="">Alle Baustellen</option>
      ${siteIds.map((id) => `<option value="${esc(id)}" ${id === f.baustelleId ? 'selected' : ''}>${esc(siteName(id))}</option>`).join('')}
    </select></label>
    <div class="field"><span>Art</span><div class="seg three" id="z-art">
      <button type="button" role="radio" data-art="" aria-checked="true">Alle</button>
      <button type="button" role="radio" data-art="tagesbericht" aria-checked="false">Tagesberichte</button>
      <button type="button" role="radio" data-art="rapport" aria-checked="false">Rapporte</button></div></div>
    <div class="field"><span>Zeitraum</span><div class="chips" id="z-quick">
      <button type="button" class="chip" data-q="alle">Gesamter Zeitraum</button>
      <button type="button" class="chip" data-q="0">Dieser Monat</button>
      <button type="button" class="chip" data-q="-1">Letzter Monat</button></div></div>
    <div class="row">
      <label class="field"><span>Von</span><input type="date" id="z-von" value="${f.von}"></label>
      <label class="field"><span>Bis</span><input type="date" id="z-bis" value="${f.bis}"></label>
    </div>
    <div class="crew-sum" id="z-info"></div>
    <button type="button" class="btn primary block" id="z-ok">${ICON.share} PDF erstellen</button>
    <p class="hint" style="text-align:center">Enthält die Berichte, die auf diesem Handy gespeichert sind.</p>`);

  const auswahl = () => reports.filter((r) => (!f.baustelleId || r.baustelleId === f.baustelleId)
    && (!f.art || (r.art || 'tagesbericht') === f.art) && r.datum >= f.von && r.datum <= f.bis);
  const draw = () => {
    if (f.gesamt) gesamt();
    $('#z-von', sheet).value = f.von;
    $('#z-bis', sheet).value = f.bis;
    $$('#z-quick .chip', sheet).forEach((c) => c.setAttribute('aria-pressed', c.dataset.q === 'alle' ? f.gesamt : !f.gesamt && monatsGrenzen(Number(c.dataset.q)).join() === `${f.von},${f.bis}`));
    const l = auswahl();
    const h = l.reduce((s, r) => s + (workedHours(r) || 0), 0);
    $('#z-info', sheet).innerHTML = l.length
      ? `<div class="kv total" style="border:0;margin:0;padding-top:4px"><span>${l.length} ${l.length === 1 ? 'Bericht' : 'Berichte'}</span><b>${formatHours(h)}</b></div>`
      : '<div class="kv"><span>Keine Berichte in dieser Auswahl.</span></div>';
    $('#z-ok', sheet).disabled = !l.length;
  };
  $('#z-site', sheet).onchange = (e) => { f.baustelleId = e.target.value; draw(); };
  $$('#z-art button', sheet).forEach((b) => {
    b.onclick = () => {
      f.art = b.dataset.art;
      $$('#z-art button', sheet).forEach((x) => x.setAttribute('aria-checked', x === b));
      draw();
    };
  });
  $$('#z-quick .chip', sheet).forEach((c) => {
    c.onclick = () => {
      f.gesamt = c.dataset.q === 'alle';
      if (!f.gesamt) [f.von, f.bis] = monatsGrenzen(Number(c.dataset.q));
      draw();
    };
  });
  $('#z-von', sheet).onchange = (e) => { f.gesamt = false; f.von = e.target.value; draw(); };
  $('#z-bis', sheet).onchange = (e) => { f.gesamt = false; f.bis = e.target.value; draw(); };
  draw();

  $('#z-ok', sheet).onclick = async () => {
    const l = auswahl();
    if (!l.length) return;
    const btn = $('#z-ok', sheet);
    btn.disabled = true;
    btn.textContent = 'PDF wird erstellt …';
    const artTitel = f.art === 'rapport' ? 'Rapporte' : f.art === 'tagesbericht' ? 'Tagesberichte' : 'Berichte';
    const titel = f.baustelleId ? siteName(f.baustelleId) : f.art ? `Alle Baustellen (${artTitel})` : 'Alle Baustellen';
    let file;
    try {
      const items = [];
      for (const r of l) items.push({ r, files: await db.filesFor(r.id) });
      const blob = await buildSammelPdf({ titel: f.baustelleId && f.art ? `${titel} (${artTitel})` : titel, von: f.von, bis: f.bis, items, author: settings.author });
      file = new File([blob], sammelPdfName(titel, f.von, f.bis), { type: 'application/pdf' });
    } catch (err) {
      toast(`PDF konnte nicht erstellt werden: ${err.message}`, 4000);
      btn.disabled = false;
      btn.innerHTML = `${ICON.share} PDF erstellen`;
      return;
    }
    close();
    await sharePdfFile(file, `Zusammenfassung ${titel}`, []);
  };
}

// ---------- Administrator ----------
// Der Administrator (Tomek) meldet sich auf seinem Handy einmal mit einer PIN an.
// Die PIN liegt nur als Prüfsumme im Repo (stammdaten/admin.json).

function isAdmin() {
  return settings.admin === true;
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function setAdmin(on) {
  settings = { ...settings, admin: on };
  db.saveSettings(settings);
}

async function adminLogin(onDone) {
  if (!isConfigured(settings)) {
    toast('Bitte zuerst den Zugangs-Token eintragen.', 3500);
    return;
  }
  let cfg;
  try {
    cfg = await loadAdminConfig(settings);
  } catch (err) {
    toast(`Keine Verbindung: ${err.message}`, 4000);
    return;
  }
  const isNew = !cfg;
  const { sheet, close } = openSheet(`
    <h2>${isNew ? 'Administrator einrichten' : 'Als Administrator anmelden'}</h2>
    <p class="hint">${isNew
      ? 'Lege eine PIN fest. Nur wer sie kennt, kann Baustellen und Personal löschen und die Stunden aller Mitarbeiter sehen.'
      : 'Gib die Administrator-PIN ein.'}</p>
    <label class="field"><span>PIN</span><input type="password" inputmode="numeric" autocomplete="off" id="pin1" placeholder="mindestens 4 Ziffern"></label>
    ${isNew ? '<label class="field"><span>PIN wiederholen</span><input type="password" inputmode="numeric" autocomplete="off" id="pin2"></label>' : ''}
    <div class="row sheet-actions">
      <button type="button" class="btn ghost" id="pin-cancel">Abbrechen</button>
      <button type="button" class="btn primary" id="pin-ok">${isNew ? 'PIN festlegen' : 'Anmelden'}</button>
    </div>`);
  setTimeout(() => $('#pin1', sheet)?.focus(), 250);
  $('#pin-cancel', sheet).onclick = close;
  $('#pin-ok', sheet).onclick = async () => {
    const pin = $('#pin1', sheet).value.trim();
    if (pin.length < 4) { toast('Die PIN braucht mindestens 4 Zeichen.'); return; }
    try {
      if (isNew) {
        if (pin !== $('#pin2', sheet).value.trim()) { toast('Die beiden PINs stimmen nicht überein.'); return; }
        const salt = newId();
        await saveAdminConfig(settings, { salt, pinHash: await hashPin(pin, salt), erstellt: new Date().toISOString() });
      } else if ((await hashPin(pin, cfg.salt)) !== cfg.pinHash) {
        toast('Falsche PIN.');
        return;
      }
    } catch (err) {
      toast(err.message, 4000);
      return;
    }
    setAdmin(true);
    close();
    toast('Du bist als Administrator angemeldet.');
    onDone?.();
  };
}

async function changeAdminPin() {
  const { sheet, close } = openSheet(`
    <h2>Neue Administrator-PIN</h2>
    <label class="field"><span>Neue PIN</span><input type="password" inputmode="numeric" autocomplete="off" id="pin1"></label>
    <label class="field"><span>PIN wiederholen</span><input type="password" inputmode="numeric" autocomplete="off" id="pin2"></label>
    <div class="row sheet-actions">
      <button type="button" class="btn ghost" id="pin-cancel">Abbrechen</button>
      <button type="button" class="btn primary" id="pin-ok">Speichern</button>
    </div>`);
  $('#pin-cancel', sheet).onclick = close;
  $('#pin-ok', sheet).onclick = async () => {
    const pin = $('#pin1', sheet).value.trim();
    if (pin.length < 4) { toast('Die PIN braucht mindestens 4 Zeichen.'); return; }
    if (pin !== $('#pin2', sheet).value.trim()) { toast('Die beiden PINs stimmen nicht überein.'); return; }
    try {
      const salt = newId();
      await saveAdminConfig(settings, { salt, pinHash: await hashPin(pin, salt), erstellt: new Date().toISOString() });
    } catch (err) {
      toast(err.message, 4000);
      return;
    }
    close();
    toast('PIN geändert.');
  };
}

// ---------- Stundennachweis ----------

let stundenMonat = today().slice(0, 7);
const stundenRemoteCache = new Map(); // "JJJJ-MM|Name" -> hochgeladene Einträge
const stundenRemoteLaden = new Set();

function stundenPerson() {
  return settings.stundenPerson?.name ? settings.stundenPerson : null;
}

function initials(name) {
  return esc((name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
}

async function renderStunden() {
  appbar.innerHTML = '<h1>Stunden</h1>';
  const person = stundenPerson();
  if (!person) {
    view.innerHTML = `<div class="empty">
        <h2>Stundennachweis</h2>
        <p>Hier trägst du jeden Tag deine Arbeitsstunden ein. Wähle zuerst, für wen die Stunden gelten.</p>
        <button class="btn primary" id="who-btn">${ICON.people} Mitarbeiter wählen</button></div>`;
    $('#who-btn').onclick = () => chooseStundenPerson();
    return;
  }
  const key = personKey(person);
  let all = (await db.allStunden()).filter((e) => personKey(e) === key);
  // Der Administrator sieht zusätzlich, was der Mitarbeiter von seinem Handy hochgeladen hat.
  const remoteKey = `${stundenMonat}|${person.name}`;
  const remote = isAdmin() ? stundenRemoteCache.get(remoteKey) : null;
  if (remote) {
    const local = new Set(all.map((e) => e.id));
    all = [...all, ...remote.filter((e) => !local.has(e.id)).map((e) => ({ ...e, fremd: true }))];
  }
  if (isAdmin() && !remote && isConfigured(settings) && navigator.onLine && !stundenRemoteLaden.has(remoteKey)) {
    stundenRemoteLaden.add(remoteKey);
    loadStundenRemote(settings, stundenMonat, person.name)
      .then((list) => { stundenRemoteCache.set(remoteKey, list); if (location.hash === '#/stunden') renderStunden(); })
      .catch(() => {})
      .finally(() => stundenRemoteLaden.delete(remoteKey));
  }
  const fremd = all.filter((e) => e.fremd && e.datum.startsWith(stundenMonat)).length;
  const list = sortStunden(all.filter((e) => e.datum.startsWith(stundenMonat))).reverse();
  const s = summe(list);

  // nach Kalenderwoche gruppieren
  const weeks = [];
  for (const e of list) {
    const w = kw(e.datum);
    if (!weeks.length || weeks[weeks.length - 1].kw !== w) weeks.push({ kw: w, items: [] });
    weeks[weeks.length - 1].items.push(e);
  }
  const card = (e) => {
    const d = parseDate(e.datum);
    const z = hatZeiten(e.typ);
    const title = z ? (e.baustelle || (e.typ === 'schule' ? 'Berufsschule' : 'Ohne Baustelle')) : typLabel(e.typ);
    const sub = z ? `${e.beginn || '–'} – ${e.ende || '–'}${Number(e.pause) ? ` · ${e.pause} min Pause` : ''}` : (e.notiz || '');
    return `<button type="button" class="rcard stunde ${z ? '' : 'frei'}" data-id="${e.id}">
      <div class="date"><b>${d.getDate()}</b><span>${weekday(e.datum).slice(0, 2)}</span></div>
      <div class="body">
        <div class="title">${esc(title)}</div>
        <div class="preview">${esc(sub)}${z && e.notiz ? ` · ${esc(e.notiz)}` : ''}</div>
        ${e.typ !== 'arbeit' ? `<div class="meta"><span class="pill art">${typLabel(e.typ)}</span></div>` : ''}
      </div>
      <div class="hours">${z ? formatHours(stundenOf(e)) : ''}</div></button>`;
  };

  view.innerHTML = `
    <button type="button" class="site-pick who" id="who-btn">
      <div class="avatar">${initials(person.name)}</div>
      <span><b>${esc(person.name)}</b><small>Stundennachweis für</small></span>${isAdmin() ? '<em>Ändern</em>' : ''}</button>
    <div class="month-nav">
      <button class="icon-btn" id="m-prev" aria-label="Vorheriger Monat">${ICON.back}</button>
      <b>${monatLabel(stundenMonat)}</b>
      <button class="icon-btn" id="m-next" aria-label="Nächster Monat"><span class="flip">${ICON.back}</span></button>
    </div>
    ${fremd ? `<p class="hint" style="text-align:center;margin:0 0 10px">${fremd} Einträge vom Handy von ${esc(person.name)} (nur ansehen)</p>` : ''}
    <div class="stats">
      <div class="stat"><b>${formatHours(s.stunden).replace(' h', '')}</b><span>Stunden</span></div>
      <div class="stat"><b>${s.arbeitstage}</b><span>Arbeitstage</span></div>
      <div class="stat"><b>${s.urlaub}<small> / ${s.krank}</small></b><span>Urlaub / Krank</span></div>
    </div>
    ${weeks.length ? weeks.map((w) => `
      <div class="month"><span>KW ${w.kw}</span><span>${formatHours(w.items.reduce((a, e) => a + (stundenOf(e) || 0), 0))}</span></div>
      <div class="card-list">${w.items.map(card).join('')}</div>`).join('')
    : '<p class="hint" style="text-align:center;margin:28px 0">Für diesen Monat ist noch nichts eingetragen.</p>'}
    ${list.length ? `<button class="btn soft block" id="stunden-pdf" style="margin-top:18px">${ICON.share} Monat als PDF teilen</button>` : ''}
    <button class="fab" id="stunde-neu">${ICON.plus}<span>Stunden eintragen</span></button>`;

  $('#who-btn').onclick = () => {
    if (isAdmin()) chooseStundenPerson();
    else toast('Du siehst nur deine eigenen Stunden. Wechseln kann nur der Administrator.', 3500);
  };
  $('#m-prev').onclick = () => { stundenMonat = shiftMonth(stundenMonat, -1); renderStunden(); };
  $('#m-next').onclick = () => { stundenMonat = shiftMonth(stundenMonat, 1); renderStunden(); };
  $('#stunde-neu').onclick = () => {
    const last = sortStunden(all.filter((e) => hatZeiten(e.typ))).pop();
    const datum = stundenMonat === today().slice(0, 7) ? today() : `${stundenMonat}-01`;
    openStundeEditor(newStunde({
      personId: person.personId || null,
      name: person.name,
      datum,
      beginn: last?.beginn || '07:00',
      ende: last?.ende || '16:00',
      pause: last?.pause ?? 30,
      baustelleId: last?.baustelleId || null,
      baustelle: last?.baustelle || '',
    }), true);
  };
  $$('.rcard.stunde').forEach((b) => {
    b.onclick = () => {
      const e = list.find((x) => x.id === b.dataset.id);
      if (e.fremd) toast('Diesen Eintrag kann nur der Mitarbeiter auf seinem Handy ändern.', 3500);
      else openStundeEditor(structuredClone(e), false);
    };
  });
  const pdfBtn = $('#stunden-pdf');
  if (pdfBtn) pdfBtn.onclick = () => shareStundenPdf(person.name, stundenMonat, list);
}

async function chooseStundenPerson() {
  const people = (await db.allPeople()).filter((p) => !p.archived);
  const cur = stundenPerson();
  const { sheet, close } = openSheet(`
    <h2>Für wen sind die Stunden?</h2>
    <div class="pick-list">${sortCrew(people).map((p) => `<button type="button" class="pick ${cur?.personId === p.id ? 'current' : ''}" data-id="${p.id}">
      <div class="avatar">${initials(p.name)}</div><span><b>${esc(p.name)}</b><small>${esc(kategorieOf(p))}</small></span></button>`).join('')}</div>
    ${people.length ? '<div class="sheet-or">oder</div>' : ''}
    <label class="field"><span>Name eingeben</span><input type="text" id="who-name" placeholder="Vor- und Nachname" value="${cur && !cur.personId ? esc(cur.name) : ''}"></label>
    <button type="button" class="btn primary block" id="who-ok">Übernehmen</button>`);
  const set = (p) => {
    settings.stundenPerson = p;
    db.saveSettings(settings);
    close();
    renderStunden();
  };
  $$('.pick', sheet).forEach((b) => {
    b.onclick = () => { const p = people.find((x) => x.id === b.dataset.id); set({ personId: p.id, name: p.name }); };
  });
  $('#who-ok', sheet).onclick = () => {
    const name = $('#who-name', sheet).value.trim();
    if (!name) { toast('Bitte einen Namen eingeben oder eine Person antippen.'); return; }
    const match = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    set(match ? { personId: match.id, name: match.name } : { personId: null, name });
  };
}

// Zeiten aus einem Bericht desselben Tages vorschlagen, in dem die Person eingetragen ist.
async function stundenAusBericht(e) {
  for (const r of await db.allReports()) {
    if (r.datum !== e.datum) continue;
    const m = crewOf(r).find((c) => (e.personId && c.personId === e.personId) || c.name.trim().toLowerCase() === e.name.trim().toLowerCase());
    if (m) return { beginn: m.beginn, ende: m.ende, pause: m.pause, baustelleId: r.baustelleId, baustelle: r.baustelle };
  }
  return null;
}

function openStundeEditor(e, isNew) {
  const origMonth = isNew ? null : { ...e };
  const { sheet, close } = openSheet(`
    <h2>${isNew ? 'Stunden eintragen' : 'Eintrag bearbeiten'}</h2>
    <label class="field"><span>Datum</span><input type="date" id="st-datum" value="${esc(e.datum)}"></label>
    <div class="chips" id="st-typ" style="margin-bottom:14px">${TYPEN.map((t) =>
      `<button type="button" class="chip" data-typ="${t.id}" aria-pressed="${e.typ === t.id}">${t.label}</button>`).join('')}</div>
    <div id="st-zeit">
      <div class="field"><span>Baustelle</span><button type="button" class="site-pick" id="st-site"></button></div>
      <div class="row three">
        <label class="field"><span>Beginn</span><input type="time" id="st-beginn" value="${esc(e.beginn)}"></label>
        <label class="field"><span>Ende</span><input type="time" id="st-ende" value="${esc(e.ende)}"></label>
        <label class="field"><span>Pause</span><input type="number" inputmode="numeric" min="0" step="5" id="st-pause" value="${esc(e.pause)}" placeholder="Min."></label>
      </div>
      <div class="crew-sum"><div class="kv total" style="border:0;margin:0;padding-top:4px"><span>Arbeitszeit</span><b id="st-h"></b></div></div>
      <p class="hint" id="st-hint" style="margin:-4px 0 12px" hidden></p>
    </div>
    <label class="field"><span>Notiz</span><input type="text" id="st-notiz" value="${esc(e.notiz)}" placeholder="optional, z. B. Fahrzeit, Überstunden"></label>
    <div class="row sheet-actions">
      <button type="button" class="btn ghost" id="st-cancel">Abbrechen</button>
      <button type="button" class="btn primary" id="st-save">Speichern</button>
    </div>
    ${isNew ? '' : `<button type="button" class="btn danger block" id="st-del" style="margin-top:10px">${ICON.trash} Eintrag löschen</button>`}`);

  const drawSite = () => {
    $('#st-site', sheet).innerHTML = e.baustelle
      ? `${ICON.pin}<span><b>${esc(e.baustelle)}</b></span><em>Ändern</em>`
      : `${ICON.pin}<span><b class="muted">Baustelle wählen</b><small>optional</small></span>`;
  };
  const drawHours = () => {
    $('#st-h', sheet).textContent = formatHours(entryHours(e));
  };
  const drawTyp = () => {
    $$('#st-typ .chip', sheet).forEach((c) => c.setAttribute('aria-pressed', c.dataset.typ === e.typ));
    $('#st-zeit', sheet).hidden = !hatZeiten(e.typ);
  };
  const fromReport = async () => {
    const hit = await stundenAusBericht(e);
    if (!hit) return;
    Object.assign(e, hit);
    $('#st-beginn', sheet).value = e.beginn || '';
    $('#st-ende', sheet).value = e.ende || '';
    $('#st-pause', sheet).value = e.pause ?? '';
    const hint = $('#st-hint', sheet);
    hint.textContent = `Zeiten aus dem Bericht ${e.baustelle ? `„${e.baustelle}“ ` : ''}übernommen.`;
    hint.hidden = false;
    drawSite();
    drawHours();
  };
  drawSite();
  drawHours();
  drawTyp();
  if (isNew) fromReport();

  $('#st-datum', sheet).onchange = (ev) => { e.datum = ev.target.value; if (isNew) fromReport(); };
  $$('#st-typ .chip', sheet).forEach((c) => { c.onclick = () => { e.typ = c.dataset.typ; drawTyp(); }; });
  $('#st-site', sheet).onclick = () => openSitePicker(e.baustelleId, (site) => {
    e.baustelleId = site.id;
    e.baustelle = site.name;
    drawSite();
  });
  for (const k of ['beginn', 'ende', 'pause']) {
    $(`#st-${k}`, sheet).oninput = (ev) => { e[k] = k === 'pause' ? (ev.target.value === '' ? '' : Number(ev.target.value)) : ev.target.value; drawHours(); };
  }
  $('#st-notiz', sheet).oninput = (ev) => { e.notiz = ev.target.value; };
  $('#st-cancel', sheet).onclick = close;
  $('#st-save', sheet).onclick = async () => {
    if (!e.datum) { toast('Bitte ein Datum wählen.'); return; }
    if (hatZeiten(e.typ) && (!e.beginn || !e.ende)) { toast('Bitte Beginn und Ende eintragen.'); return; }
    if (!hatZeiten(e.typ)) Object.assign(e, { beginn: '', ende: '', pause: '', baustelleId: null, baustelle: '' });
    await db.putStunde(e);
    if (origMonth && origMonth.datum.slice(0, 7) !== e.datum.slice(0, 7)) db.markStundenDirty(origMonth);
    stundenMonat = e.datum.slice(0, 7);
    close();
    toast('Gespeichert.');
    renderStunden();
  };
  const del = $('#st-del', sheet);
  if (del) del.onclick = async () => {
    if (!confirm('Eintrag löschen?')) return;
    await db.deleteStunde(e);
    close();
    renderStunden();
  };
}

async function shareStundenPdf(name, ym, entries) {
  toast('PDF wird erstellt …', 6000);
  let file;
  try {
    file = new File([await buildStundenPdf(name, ym, entries)], stundenPdfName(name, ym), { type: 'application/pdf' });
  } catch (err) {
    toast(`PDF konnte nicht erstellt werden: ${err.message}`, 4000);
    return;
  }
  hideToast();
  await sharePdfFile(file, `Stundennachweis ${monatLabel(ym)} – ${name}`, []);
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
      <label class="field"><span>Sprache</span><select id="lang-select" data-roh>
        ${SPRACHEN.map((l) => `<option value="${l.id}" ${(s.lang || 'de') === l.id ? 'selected' : ''}>${l.flagge} ${l.name}</option>`).join('')}
      </select></label>
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
      <h2>Administrator <span class="h-right">${isAdmin() ? '<span class="pill ok">Angemeldet</span>' : ''}</span></h2>
      <p class="hint" style="margin-top:0">${isAdmin()
        ? 'Auf diesem Handy darfst du Baustellen und Personal löschen und die Stunden aller Mitarbeiter sehen.'
        : 'Baustellen und Personal löschen und die Stunden aller Mitarbeiter sehen darf nur der Administrator.'}</p>
      ${isAdmin()
        ? '<div class="row"><button class="btn ghost" id="admin-pin">PIN ändern</button><button class="btn ghost" id="admin-out">Abmelden</button></div>'
        : '<button class="btn ghost block" id="admin-in">Als Administrator anmelden</button>'}
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

  $('#lang-select').onchange = (e) => {
    settings.lang = e.target.value;
    db.saveSettings(settings);
    location.reload();
  };
  $$('[data-set]').forEach((el) => {
    el.addEventListener('change', () => {
      const key = el.dataset.set;
      settings = { ...settings, [key]: el.type === 'checkbox' ? el.checked : el.value.trim() };
      db.saveSettings(settings);
      $('#conn-state').innerHTML = isConfigured(settings) ? '<span class="pill ok">Eingerichtet</span>' : '<span class="pill local">Aus</span>';
      if (key === 'token' || key === 'autoSync') scheduleAutoSync();
    });
  });

  const adminIn = $('#admin-in');
  if (adminIn) adminIn.onclick = () => adminLogin(renderSettings);
  const adminOut = $('#admin-out');
  if (adminOut) adminOut.onclick = () => { setAdmin(false); toast('Abgemeldet.'); renderSettings(); };
  const adminPin = $('#admin-pin');
  if (adminPin) adminPin.onclick = () => changeAdminPin();

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
    result = await syncAll(settings, null, { alle: isAdmin() });
  } finally {
    syncing = false;
  }
  if (manual || result.failed) {
    if (result.failed) toast(`${result.failed} Bericht(e) konnten nicht hochgeladen werden.`, 4000);
    else if (result.ok) toast(result.ok === 1 ? 'Bericht hochgeladen.' : `${result.ok} Berichte hochgeladen.`);
    else if (manual) toast('Alles ist bereits hochgeladen.');
  }
  const g = result.geladen;
  if (g && (g.neu || g.geaendert)) {
    const n = g.neu + g.geaendert;
    toast(n === 1 ? '1 Bericht vom Repo geladen.' : `${n} Berichte vom Repo geladen.`);
  } else if (manual && result.ladeFehler && !result.failed) toast(`Berichte laden: ${result.ladeFehler}`, 4000);
  if (manual && result.stammdatenError) toast(`Baustellen/Personal: ${result.stammdatenError}`, 4000);
  // Ansicht aktualisieren, ohne das Formular neu aufzubauen
  if (/^#\/bericht\//.test(location.hash)) editorHooks?.refresh();
  else if ((location.hash || '#/') === '#/') renderList();
  else if (g?.neu && /^#\/baustelle\//.test(location.hash) && !document.querySelector('.sheet-backdrop')) route();
  else if (result.stammdatenChanged && !document.querySelector('.sheet-backdrop')) {
    if (location.hash === '#/baustellen') renderSites();
    else if (location.hash === '#/personal') renderPeople();
  }
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
window.addEventListener('stammdaten-changed', () => scheduleAutoSync(1500));
// Beim Öffnen der App die Baustellen und das Personal der anderen holen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleAutoSync(800);
});
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

// Sprache einmal abfragen (beim ersten Start; der Administrator arbeitet auf Deutsch)
function spracheWaehlen() {
  const { sheet, close } = openSheet(`
    <h2>Sprache · Język · Limbă · Јазик · Gjuha</h2>
    <div class="pick-list">${SPRACHEN.map((l) => `<button type="button" class="pick lang-pick" data-lang="${l.id}" data-roh>
      <span class="flag">${l.flagge}</span><span><b>${l.name}</b></span></button>`).join('')}</div>`);
  $$('.lang-pick', sheet).forEach((b) => {
    b.onclick = () => {
      settings.lang = b.dataset.lang;
      db.saveSettings(settings);
      close();
      if (settings.lang !== 'de') location.reload();
    };
  });
}

migrateSites().catch(() => {}).finally(() => {
  route();
  if (!settings.lang && !settings.admin) spracheWaehlen();
});
scheduleAutoSync(1500);


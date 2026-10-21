// Baustellen der Berichte-App im Raumaufmaß: gelesen und neu angelegt im selben Speicher wie die
// Berichte-App (IndexedDB „tagesberichte“, db.js). Mit Token gleicht das Raumaufmaß die Liste auch selbst
// mit dem Repo ab (stammdaten/baustellen.json), damit eine hier angelegte Baustelle in der Berichte-App
// ankommt und umgekehrt. Nötig ist das auf dem iPhone, wo jede App vom Home-Bildschirm eigenen Speicher hat.

import * as db from '../db.js';
import { newSite } from '../report.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const suchText = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const verbunden = () => !!db.loadSettings().token;
export async function baustellen() { return (await db.allSites()).filter((s) => !s.archived); }

export function tokenSpeichern(token) {
  db.saveSettings({ ...db.loadSettings(), token: token.trim() });
}

// Abgleich mit dem Repo; gibt true zurück, wenn neue Baustellen auf das Gerät kamen
export async function abgleichen() {
  const s = db.loadSettings();
  if (!s.token) return false;
  const { syncStammdaten } = await import('../sync.js');
  return syncStammdaten(s);
}

async function anlegen(felder) {
  const site = newSite({ ...felder, lastUsed: Date.now() });
  await db.putSite(site);
  // gleich hochladen, damit sie in der Berichte-App erscheint (ohne Netz beim nächsten Abgleich)
  abgleichen().catch(() => {});
  return site;
}

// Blatt „Baustelle wählen“: gibt {id, name} zurück, null = ohne Baustelle, undefined = abgebrochen
export function baustelleWaehlen({ titel = 'Baustelle wählen', aktuell = null } = {}) {
  return new Promise(async (resolve) => {
    let liste = await baustellen();
    const el = document.createElement('div');
    el.className = 'sheet-backdrop open';
    const zu = (wert) => { el.remove(); resolve(wert); };
    const zeichnen = () => {
      el.innerHTML = `<div class="sheet ra-baustelle" role="dialog" aria-label="${esc(titel)}"><div class="sheet-grip"></div>
        <h2>${esc(titel)}</h2>
        ${liste.length > 6 ? '<input type="search" class="ra-bs-suche" placeholder="Baustelle suchen">' : ''}
        <div class="pick-list">
          ${liste.map((s) => `<button type="button" class="pick${aktuell === s.id ? ' current' : ''}" data-id="${esc(s.id)}"><b>${esc(s.name)}</b>${s.adresse ? `<small>${esc(s.adresse)}</small>` : ''}</button>`).join('')}
          ${liste.length ? '' : `<p class="hint">${verbunden() ? 'Noch keine Baustellen. Unten eine neue anlegen.' : 'Keine Baustellen auf diesem Gerät. Unten eine neue anlegen oder auf der Startseite das Token eintragen, dann kommen die Baustellen aus der Berichte-App.'}</p>`}
        </div>
        <button type="button" class="btn soft block ra-bs-neu">+ Neue Baustelle</button>
        <form class="ra-bs-form" hidden>
          <label class="field"><span>Name der Baustelle</span><input name="name" required></label>
          <label class="field"><span>Adresse</span><input name="adresse"></label>
          <label class="field"><span>Kunde</span><input name="kunde"></label>
          <div class="row"><button type="button" class="btn ghost ra-bs-abbr">Abbrechen</button><button type="submit" class="btn primary">Anlegen</button></div>
        </form>
        <button type="button" class="btn ghost block ra-bs-ohne">Ohne Baustelle</button>
        <button type="button" class="btn ghost block ra-bs-zu">Abbrechen</button>
      </div>`;
      el.querySelectorAll('.pick[data-id]').forEach((b) => {
        b.onclick = () => { const s = liste.find((x) => x.id === b.dataset.id); zu({ id: s.id, name: s.name }); };
      });
      const suche = $('.ra-bs-suche', el);
      if (suche) suche.oninput = () => {
        const q = suchText(suche.value).trim();
        el.querySelectorAll('.pick[data-id]').forEach((b) => { b.hidden = q && !suchText(b.textContent).includes(q); });
      };
      const form = $('.ra-bs-form', el);
      $('.ra-bs-neu', el).onclick = () => { form.hidden = false; $('.ra-bs-neu', el).hidden = true; form.elements.name.focus(); };
      $('.ra-bs-abbr', el).onclick = () => { form.hidden = true; $('.ra-bs-neu', el).hidden = false; };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        if (!name) return;
        const site = await anlegen({ name, adresse: form.elements.adresse.value.trim(), kunde: form.elements.kunde.value.trim() });
        zu({ id: site.id, name: site.name });
      };
      $('.ra-bs-ohne', el).onclick = () => zu(null);
      $('.ra-bs-zu', el).onclick = () => zu(undefined);
    };
    el.onclick = (e) => { if (e.target === el) zu(undefined); };
    zeichnen();
    document.body.appendChild(el);
    // im Hintergrund neue Baustellen aus dem Repo holen
    abgleichen().then(async (neu) => { if (neu && el.isConnected && $('.ra-bs-form', el).hidden) { liste = await baustellen(); zeichnen(); } }).catch(() => {});
  });
}

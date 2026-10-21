// Laser-Entfernungsmesser per Bluetooth (Web Bluetooth): Leica DISTO und Bosch GLM „C“-Modelle.
// Geht in Chrome/Edge auf Android und am PC und auf dem iPhone z. B. im Browser Bluefy; Safari kann kein
// Web Bluetooth. Die Protokolle sind nicht offiziell dokumentiert, sondern aus frei verfügbaren Projekten
// übernommen: Leica schickt die Entfernung als float32 (little endian, Meter), Bosch in Rahmen
// „C0 55 10 06 …“ mit float32 ab Byte 7, nachdem „Autosync“ eingeschaltet ist.

const LEICA = '3ab10100-f831-4395-b29d-570977d5bf94';
const LEICA_MESSUNG = ['3ab10101-f831-4395-b29d-570977d5bf94', '3ab1010d-f831-4395-b29d-570977d5bf94'];
const BOSCH = '02a6c0d0-0451-4000-b000-fb3210111989';
const BOSCH_KANAL = '02a6c0d1-0451-4000-b000-fb3210111989';
const BOSCH_AUTOSYNC = [0xc0, 0x55, 0x02, 0x01, 0x00, 0x1a];

// Messwerte aus den Bluetooth-Daten lesen (ohne Gerät testbar)
export function leicaWert(dv) {
  if (!dv || dv.byteLength < 4) return null;
  const m = dv.getFloat32(0, true);
  return Number.isFinite(m) && m > 0 && m < 1000 ? m : null;
}
export function boschWert(dv) {
  if (!dv || dv.byteLength < 11) return null;
  if (dv.getUint8(0) !== 0xc0 || dv.getUint8(1) !== 0x55 || dv.getUint8(2) !== 0x10 || dv.getUint8(3) !== 0x06) return null;
  const m = dv.getFloat32(7, true);
  return Number.isFinite(m) && m > 0 && m < 1000 ? m : null;
}

export const laserMoeglich = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;

// Eine Verbindung für die ganze Sitzung; Messwerte gehen an den gerade gesetzten Empfänger
const zustand = { geraet: null, name: '', art: '', empfaenger: null, status: null, letzter: { m: 0, t: 0 } };
export const laserName = () => (zustand.geraet?.gatt?.connected ? zustand.name : '');
export function laserEmpfaenger(fn) { zustand.empfaenger = fn; }
export function laserStatus(fn) { zustand.status = fn; }

function melden(m) {
  if (m == null) return;
  // dasselbe Maß kurz hintereinander nur einmal (Leica meldet es manchmal auf zwei Kanälen)
  const jetzt = Date.now();
  if (Math.abs(m - zustand.letzter.m) < 1e-6 && jetzt - zustand.letzter.t < 600) return;
  zustand.letzter = { m, t: jetzt };
  zustand.empfaenger?.(Math.round(m * 1000) / 1000);
}

export async function laserVerbinden() {
  if (!laserMoeglich()) throw new Error('Dieser Browser kann kein Bluetooth');
  const geraet = await navigator.bluetooth.requestDevice({
    filters: [{ services: [LEICA] }, { services: [BOSCH] }, { namePrefix: 'DISTO' }, { namePrefix: 'GLM' }, { namePrefix: 'Bosch' }],
    optionalServices: [LEICA, BOSCH],
  });
  const server = await geraet.gatt.connect();
  let art = '';
  try {
    const dienst = await server.getPrimaryService(LEICA);
    for (const k of await dienst.getCharacteristics()) {
      if (!(k.properties.notify || k.properties.indicate)) continue;
      // alle Kanäle abonnieren (manche DISTO schicken sonst nichts), gelesen werden nur die Messkanäle
      try { await k.startNotifications(); } catch { continue; }
      if (LEICA_MESSUNG.includes(k.uuid)) k.addEventListener('characteristicvaluechanged', (e) => melden(leicaWert(e.target.value)));
    }
    art = 'leica';
  } catch {
    const dienst = await server.getPrimaryService(BOSCH);
    const k = await dienst.getCharacteristic(BOSCH_KANAL);
    await k.startNotifications();
    k.addEventListener('characteristicvaluechanged', (e) => melden(boschWert(e.target.value)));
    await k.writeValue(new Uint8Array(BOSCH_AUTOSYNC));
    art = 'bosch';
  }
  if (zustand.geraet && zustand.geraet !== geraet) zustand.geraet.gatt?.disconnect();
  zustand.geraet = geraet;
  zustand.art = art;
  zustand.name = geraet.name || (art === 'leica' ? 'Leica DISTO' : 'Bosch GLM');
  geraet.addEventListener('gattserverdisconnected', () => zustand.status?.(''));
  zustand.status?.(zustand.name);
  return zustand.name;
}

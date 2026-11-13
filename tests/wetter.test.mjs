// Prüft, wie Wetterdaten (Bright Sky / DWD) in die Wetter-Knöpfe der App übersetzt werden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wetterAusDaten } from '../wetter.js';

test('aktueller Wert: klar und kalt', () => {
  const r = wetterAusDaten([{ temperature: 4.2, condition: 'dry', icon: 'clear-day', cloud_cover: 25, wind_speed_10: 9, wind_gust_speed_10: 17.6 }]);
  assert.deepEqual(r, { wetter: ['sonnig'], temperatur: '4' });
});

test('aktueller Wert: Regen mit Sturmböen', () => {
  const r = wetterAusDaten([{ temperature: 8.6, condition: 'rain', icon: 'rain', cloud_cover: 100, wind_speed_10: 20, wind_gust_speed_10: 62 }]);
  assert.deepEqual(r, { wetter: ['regen', 'wind'], temperatur: '9' });
});

test('Frost und Schnee, kein Regen', () => {
  const r = wetterAusDaten([{ temperature: -2.4, condition: 'snow', icon: 'snow', cloud_cover: 100 }]);
  assert.deepEqual(r, { wetter: ['schnee', 'frost'], temperatur: '-2' });
});

test('Stundenwerte: Temperatur um 12 Uhr, Frost am Morgen, bewölkt', () => {
  const stunden = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => ({
    timestamp: `2026-11-12T${String(h).padStart(2, '0')}:00:00+01:00`,
    temperature: h < 9 ? -1 : 6, condition: 'dry', icon: 'cloudy', cloud_cover: 80, precipitation: 0, wind_speed: 10, wind_gust_speed: 20,
  }));
  stunden[5].temperature = 7.4;
  assert.deepEqual(wetterAusDaten(stunden, '12'), { wetter: ['bewoelkt', 'frost'], temperatur: '7' });
});

test('leer oder unbrauchbar', () => {
  assert.equal(wetterAusDaten([]), null);
  assert.equal(wetterAusDaten([null]), null);
});

// Tests für das Lesen der Laser-Messwerte (ohne Gerät): node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leicaWert, boschWert } from '../raumaufmass/laser.js';

const float = (m) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, m, true); return [...new Uint8Array(dv.buffer)]; };
const dv = (bytes) => new DataView(new Uint8Array(bytes).buffer);

test('Laser: Leica DISTO schickt float32 in Metern', () => {
  assert.ok(Math.abs(leicaWert(dv(float(3.452))) - 3.452) < 1e-6);
  assert.equal(leicaWert(dv([1, 2])), null);
  assert.equal(leicaWert(dv(float(0))), null);
});

test('Laser: Bosch GLM-Rahmen C0 55 10 06, float32 ab Byte 7', () => {
  // Beispiel aus dem Nordic-Forum: 2C 43 9C 3E ≈ 0,305 m
  const rahmen = [0xc0, 0x55, 0x10, 0x06, 0, 0, 0, 0x2c, 0x43, 0x9c, 0x3e, 0, 0, 0, 0, 0, 0, 0, 0, 0x36];
  assert.ok(Math.abs(boschWert(dv(rahmen)) - 0.305) < 0.001);
  assert.equal(boschWert(dv([0xc0, 0x55, 0x10, 0x02, 0, 0, 0, 0x2c, 0x43, 0x9c, 0x3e])), null);
  assert.equal(boschWert(dv([0xc0, 0x55, 0x02, 0x01, 0x00, 0x1a])), null);
});

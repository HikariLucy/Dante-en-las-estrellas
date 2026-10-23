import test from 'node:test';
import assert from 'node:assert/strict';
import { cart } from './helpers.mjs';
import {
  renderSfx, renderMusic, musicOrder, patternTicks, noteFreq, sfxLength, SAMPLES_PER_TICK,
} from '../web/js/synth.js';

const NOTE = 16 * SAMPLES_PER_TICK; // nota de la música (velocidad 16)
const rms = (a, from = 0, to = a.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, to - from));
};

// Frecuencia estimada contando cruces ascendentes por cero.
function freqOf(a, from, to) {
  let n = 0, first = -1, last = -1;
  for (let i = from + 1; i < to; i++) {
    if (a[i - 1] < 0 && a[i] >= 0) {
      if (first < 0) first = i;
      last = i;
      n++;
    }
  }
  return ((n - 1) * 22050) / (last - first);
}

test('tono 33 = La 440 Hz', () => {
  assert.equal(noteFreq(33), 440);
  assert.ok(Math.abs(noteFreq(45) - 880) < 1e-9);
});

test('SFX 32 y 33: longitud tomada del inicio de bucle', () => {
  assert.equal(sfxLength(cart.sfx[32]), 8);
  assert.equal(renderSfx(cart, 32).length, 8 * 9 * SAMPLES_PER_TICK);
  assert.equal(sfxLength(cart.sfx[33]), 12);
  assert.equal(renderSfx(cart, 33).length, 12 * 12 * SAMPLES_PER_TICK);
  assert.ok(rms(renderSfx(cart, 32)) > 0.02);
  assert.ok(rms(renderSfx(cart, 33)) > 0.02);
});

test('la nota sintetizada tiene la frecuencia del cartucho', () => {
  // SFX 8, notas 0-3: tono 0x1a (26) en sierra inclinada, volumen 3.
  const a = renderSfx(cart, 8);
  const f = freqOf(a, 200, 4 * 9 * SAMPLES_PER_TICK);
  assert.ok(Math.abs(f / noteFreq(26) - 1) < 0.01, `${f} Hz vs ${noteFreq(26)} Hz`);
  // SFX 0, nota 0: tono 0x39 (57) en triángulo.
  const b = renderSfx(cart, 0);
  const g = freqOf(b, 200, NOTE);
  assert.ok(Math.abs(g / noteFreq(57) - 1) < 0.01, `${g} Hz vs ${noteFreq(57)} Hz`);
});

test('música 0: patrones 0→3 en bucle, 4 canales de 17 s', () => {
  assert.deepEqual(musicOrder(cart.music, 0), { order: [0, 1, 2, 3], loopIndex: 0 });
  assert.equal(patternTicks(cart, cart.music[0]), 32 * 16);
  const m = renderMusic(cart, 0);
  assert.equal(m.length, 4 * 32 * NOTE);
  assert.equal(m.loopStart, 0);
  assert.ok(Math.abs(m.length / 22050 - 17.0) < 0.05);
  for (let c = 0; c < 4; c++) assert.ok(rms(m.channels[c]) > 0.005, `canal ${c} suena`);
  // Canal 3 (SFX 24) empieza con tres notas en silencio.
  assert.ok(rms(m.channels[3], 0, 3 * NOTE) < 1e-6);
  assert.ok(rms(m.channels[3], 3 * NOTE, 4 * NOTE) > 0.01);
  // El canal 1 del patrón 0 es el SFX 8.
  const s8 = renderSfx(cart, 8);
  for (const i of [100, 5000, 20000]) assert.ok(Math.abs(m.channels[1][i] - s8[i]) < 1e-6);
});

test('los patrones 8 y 9 (SFX 32/33) no forman parte del bucle', () => {
  assert.deepEqual(musicOrder(cart.music, 8), { order: [8], loopIndex: -1 });
});

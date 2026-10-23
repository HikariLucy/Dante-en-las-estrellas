import test from 'node:test';
import assert from 'node:assert/strict';
import { cart } from './helpers.mjs';

const tile = (planet, x, y) => cart.map[y * 128 + (planet - 1) * 16 + x];
const findTiles = (planet, id) => {
  const out = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (tile(planet, x, y) === id) out.push([x, y]);
  return out;
};

test('contiene todas las secciones y el Lua de la versión 1.4', () => {
  assert.match(cart.lua, /version 1\.4/);
  assert.match(cart.lua, /function _update60\(\)/);
});

test('__gfx__: un píxel por carácter, sprites 8x8 en su lugar', () => {
  // Fila 0: "0000000000aaaa00..." → sprite 1 comienza en x=8.
  assert.equal(cart.gfx[0], 0);
  assert.equal(cart.gfx[10], 10);
  assert.equal(cart.gfx[13], 10);
  assert.equal(cart.gfx[14], 0);
  // Sprite 16 (suelo del planeta 1), primera fila "99999999".
  for (let x = 0; x < 8; x++) assert.equal(cart.gfx[8 * 128 + x], 9);
  // Fuera de los datos, la hoja queda en 0.
  assert.equal(cart.gfx[127 * 128 + 127], 0);
});

test('__gff__: banderas de sólidos, cometa y cristal', () => {
  for (const id of [16, 18, 19, 21, 22, 23, 24, 32, 33, 34, 35, 48, 49, 50, 51]) assert.equal(cart.flags[id], 1, `sprite ${id}`);
  assert.equal(cart.flags[25], 2); // cometa
  assert.equal(cart.flags[36], 4); // cristal
  assert.equal(cart.flags[17], 0); // estrella
  assert.equal(cart.flags[20], 0); // rosa
});

test('__map__: tres planetas con 3 estrellas y una rosa cada uno', () => {
  for (const p of [1, 2, 3]) {
    assert.equal(findTiles(p, 17).length, 3, `estrellas planeta ${p}`);
    assert.equal(findTiles(p, 20).length, 1, `rosa planeta ${p}`);
  }
  assert.deepEqual(findTiles(1, 20), [[14, 1]]);
  assert.equal(findTiles(2, 25).length, 4); // cometas
  assert.equal(findTiles(3, 36).length, 6); // cristales
  // Suelo completo en la fila 11 de cada planeta.
  for (const p of [1, 2, 3]) for (let x = 0; x < 16; x++) assert.ok(cart.flags[tile(p, x, 11)] & 1);
});

test('__sfx__: velocidad, longitud y notas', () => {
  assert.equal(cart.sfx[0].speed, 16);
  assert.deepEqual(cart.sfx[0].notes[0], { pitch: 0x39, wave: 0, volume: 5, effect: 0 });
  assert.deepEqual(cart.sfx[8].notes[0], { pitch: 0x1a, wave: 1, volume: 3, effect: 0 });
  assert.deepEqual(cart.sfx[16].notes[0], { pitch: 0x26, wave: 5, volume: 3, effect: 0 });
  // SFX de estrella y corazón: el inicio de bucle con fin 0 es la longitud.
  assert.deepEqual([cart.sfx[32].speed, cart.sfx[32].loopStart, cart.sfx[32].loopEnd], [9, 8, 0]);
  assert.deepEqual([cart.sfx[33].speed, cart.sfx[33].loopStart, cart.sfx[33].loopEnd], [12, 12, 0]);
  assert.deepEqual(cart.sfx[32].notes[7], { pitch: 0x3e, wave: 5, volume: 3, effect: 5 });
});

test('__music__: patrones 0-3 en bucle', () => {
  assert.deepEqual(cart.music[0], { flags: 1, channels: [0, 8, 16, 24] });
  assert.deepEqual(cart.music[3], { flags: 2, channels: [3, 11, 19, 27] });
  assert.equal(cart.music[8].flags, 4);
});

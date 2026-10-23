import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './helpers.mjs';
import { fullPlaythrough } from './solver.mjs';

test('se pueden completar los tres planetas y el epílogo de corrido', () => {
  const frames = fullPlaythrough();
  const h = makeGame({ draw: true });
  h.game._init();
  const visited = [];
  let victorias = 0;
  let prevVictoria = false;
  for (const b of frames) {
    h.run(1, b);
    if (h.game.victoria && !prevVictoria) {
      victorias++;
      visited.push(h.game.planeta);
    }
    prevVictoria = h.game.victoria;
  }
  assert.deepEqual(visited, [1, 2, 3]);
  assert.equal(victorias, 3);
  assert.equal(h.game.planeta, 1, 'tras el epílogo, Z vuelve al planeta 1');
  assert.equal(h.game.victoria, false);

  const music = h.calls.filter((c) => c.kind === 'music');
  const estrellas = h.calls.filter((c) => c.kind === 'sfx' && c.n === 32);
  const corazon = h.calls.filter((c) => c.kind === 'sfx' && c.n === 33);
  assert.equal(music.length, 1, 'la música se inicia una sola vez');
  assert.equal(estrellas.length, 9, 'nueve estrellas recogidas');
  assert.equal(corazon.length, 1);
});

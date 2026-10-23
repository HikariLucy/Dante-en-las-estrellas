import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, cart } from './helpers.mjs';
import { fx } from '../web/js/game.js';

const L = 0, R = 1, Z = 4;

function onGround(planet = 1) {
  const h = makeGame();
  h.game._init();
  if (planet !== 1) h.game.cambiar_planeta(planet);
  h.run(10);
  return h;
}

test('inicio: planeta 1, Dante en x=60 y música una sola vez con fundido de 500 ms', () => {
  const { game, calls } = makeGame();
  game._init();
  assert.equal(game.planeta, 1);
  assert.equal(game.dante.x, 60);
  assert.equal(game.dante.y, 80);
  assert.deepEqual(calls, [{ kind: 'music', n: 0, fade: 500, frame: 0 }]);
  assert.equal(game.estrellas.length, 3);
  assert.deepEqual(game.rosa, { x: 112, y: 8 });
});

test('objetos por planeta: cometas en el 2 y cristales en el 3', () => {
  const { game } = makeGame();
  game.cambiar_planeta(2);
  assert.equal(game.dante.x, 8);
  assert.equal(game.plataformas.length, 4);
  assert.equal(game.temporales.length, 0);
  game.cambiar_planeta(3);
  assert.equal(game.plataformas.length, 0);
  assert.equal(game.temporales.length, 6);
});

test('Dante se asienta sobre el suelo (fila 11) y queda en_suelo', () => {
  const { game } = onGround();
  assert.ok(game.dante.en_suelo);
  assert.equal(Math.floor(game.dante.y), 80);
  assert.equal(game.dante.vy, 0);
});

test('movimiento horizontal de 1 px por cuadro y límite x<=120', () => {
  const { game, run } = onGround();
  const x0 = game.dante.x;
  run(10, [R]);
  assert.equal(game.dante.x, x0 + 10);
  assert.equal(game.dante.direccion, 1);
  run(200, [R]);
  assert.equal(game.dante.x, 120);
  run(5, [L]);
  assert.equal(game.dante.x, 115);
  assert.equal(game.dante.direccion, -1);
  // Con ambas flechas gana la derecha, como en el Lua.
  run(1, [L, R]);
  assert.equal(game.dante.x, 116);
});

test('salto: -3.5 inicial, gravedad 0.22 y altura ~26 px', () => {
  const { game, run } = onGround();
  game.dante.x = 96; // sin bloques encima (en x=60 el salto choca con la fila 6)
  const y0 = game.dante.y;
  run(1, [Z]);
  assert.equal(game.dante.vy, -3.5 + fx(0.22));
  let minY = game.dante.y;
  for (let i = 0; i < 40; i++) {
    run(1);
    minY = Math.min(minY, game.dante.y);
  }
  const altura = y0 - minY;
  assert.ok(altura > 26 && altura < 26.2, `altura ${altura}`);
  assert.ok(game.dante.en_suelo);
});

test('velocidad vertical limitada a 3 px por cuadro', () => {
  const { game, run } = makeGame();
  game.cambiar_planeta(1);
  game.dante.x = 0;
  game.dante.y = -100; // sin suelo encima: caída libre larga
  let maxVy = 0;
  for (let i = 0; i < 40; i++) {
    run(1);
    maxVy = Math.max(maxVy, game.dante.vy);
  }
  assert.equal(maxVy, 3);
});

test('mantener Z repite btnp tras 30 cuadros y vuelve a saltar al aterrizar', () => {
  const { game, run } = onGround();
  let saltos = 0;
  let prev = game.dante.vy;
  for (let i = 0; i < 120; i++) {
    run(1, [Z]);
    if (game.dante.vy < -3 && prev >= -3) saltos++;
    prev = game.dante.vy;
  }
  assert.ok(saltos >= 2, `saltos ${saltos}`);
});

test('cometas del planeta 2: 0.4 px por cuadro, ida y vuelta de ±8 px', () => {
  const { game, run } = makeGame();
  game.cambiar_planeta(2);
  const p = game.plataformas[0];
  const o = p.origen;
  run(1);
  assert.equal(p.x, o + fx(0.4));
  assert.equal(p.dx, fx(0.4));
  let maxX = -Infinity, minX = Infinity;
  for (let i = 0; i < 200; i++) {
    run(1);
    maxX = Math.max(maxX, p.x);
    minX = Math.min(minX, p.x);
  }
  assert.equal(maxX, o + 8);
  assert.equal(minX, o - 8);
});

test('Dante viaja encima del cometa', () => {
  const { game, run } = makeGame();
  game.cambiar_planeta(2);
  const p = game.plataformas[1]; // (2,4) → x=16, y=32
  game.dante.x = p.x;
  game.dante.y = p.y - 12;
  run(8);
  assert.equal(game.dante.sobre, p);
  const rel = game.dante.x - p.x;
  run(10);
  assert.ok(game.dante.sobre === p || game.dante.en_suelo);
  assert.ok(Math.abs(game.dante.x - p.x - rel) < 1, 'se desplaza con el cometa');
});

test('cristales del planeta 3: 48 cuadros activos, caída y 90 de recuperación', () => {
  const { game, run } = makeGame();
  game.cambiar_planeta(3);
  const c = game.temporales.find((t) => t.x === 24 && t.y === 48); // (3,6)
  game.dante.x = c.x;
  game.dante.y = c.y - 10;
  let f = 0;
  while (c.estado === 0 && f < 30) { run(1); f++; }
  assert.equal(c.estado, 1);
  assert.equal(c.t, 48);
  assert.equal(game.dante.sobre, c);
  run(47);
  assert.equal(c.estado, 1);
  assert.equal(game.dante.y, c.y - 8);
  run(1);
  assert.equal(c.estado, 2);
  assert.equal(c.t, 90);
  run(5);
  assert.ok(game.dante.y > c.y - 8, 'Dante cae al desaparecer el cristal');
  run(89 - 5);
  assert.equal(c.estado, 2);
  run(1);
  assert.equal(c.estado, 0);
});

test('estrellas: sfx 32 en canal 3; la rosa solo cuenta tras recogerlas todas', () => {
  const { game, run, calls } = onGround();
  const r = game.rosa;
  game.dante.x = r.x; game.dante.y = r.y; game.dante.vy = 0;
  run(1);
  assert.equal(game.victoria, false, 'sin estrellas no hay victoria');
  for (const e of game.estrellas) {
    game.dante.x = e.x; game.dante.y = e.y; game.dante.vy = -0.22;
    run(1);
  }
  assert.equal(game.recogidas, 3);
  assert.deepEqual(calls.filter((c) => c.kind === 'sfx').map((c) => [c.n, c.ch]), [[32, 3], [32, 3], [32, 3]]);
  game.dante.x = r.x; game.dante.y = r.y; game.dante.vy = -0.22;
  run(1);
  assert.equal(game.victoria, true);
});

function ganar(h) {
  const { game, run } = h;
  for (const e of game.estrellas) e.tomada = true;
  game.recogidas = game.estrellas.length;
  game.dante.x = game.rosa.x; game.dante.y = game.rosa.y; game.dante.vy = -0.22;
  run(1, [Z]); // tocar la rosa con Z pulsado
  assert.equal(game.victoria, true);
}

test('cuento entre planetas: hay que soltar Z y volver a pulsarlo', () => {
  const h = onGround();
  const { game, run, calls } = h;
  ganar(h);
  run(20, [Z]); // mantener Z (sin repetición todavía) no avanza
  assert.equal(game.planeta, 1);
  run(1);
  assert.equal(game.listo, true);
  run(1, [Z]);
  assert.equal(game.planeta, 2);
  assert.equal(game.victoria, false);
  ganar(h);
  run(1); run(1, [Z]);
  assert.equal(game.planeta, 3);
  assert.equal(calls.filter((c) => c.kind === 'music').length, 1, 'la música no se reinicia');
});

test('epílogo: Camila entra tras 150 cuadros, llega a x=72 en el 278, reinicio tras 390', () => {
  const h = onGround(3);
  const { game, run, calls } = h;
  ganar(h);
  run(150);
  assert.equal(game.final_t, 150);
  assert.equal(game.camila_x, 136);
  run(1);
  assert.equal(game.camila_x, 135.5);
  run(126);
  assert.equal(game.final_t, 277);
  assert.equal(game.camila_x, 72.5);
  assert.equal(calls.filter((c) => c.n === 33).length, 0);
  run(1);
  assert.equal(game.camila_x, 72);
  const corazon = calls.filter((c) => c.kind === 'sfx' && c.n === 33);
  assert.equal(corazon.length, 1);
  assert.equal(corazon[0].ch, 3);
  run(111);
  run(1, [Z]); // final_t 390: todavía no se puede reiniciar
  assert.equal(game.final_t, 390);
  assert.equal(game.planeta, 3);
  run(1);
  run(1, [Z]); // final_t 392 > 390
  assert.equal(game.planeta, 1);
  assert.equal(game.victoria, false);
  run(400);
  assert.equal(calls.filter((c) => c.n === 33).length, 1, 'el corazón suena una vez');
  assert.equal(calls.filter((c) => c.kind === 'music').length, 1, 'la música no se reinicia');
});

test('determinismo: mismas entradas, mismo estado', () => {
  const plan = [[30, [R]], [1, [R, Z]], [25, [R]], [40, [L]], [1, [Z]], [60, []]];
  const final = () => {
    const h = makeGame();
    h.game._init();
    h.game.cambiar_planeta(2);
    for (const [n, b] of plan) h.run(n, b);
    return JSON.stringify([h.game.dante.x, h.game.dante.y, h.game.dante.vy, h.game.plataformas.map((p) => p.x)]);
  };
  assert.equal(final(), final());
});

test('el dibujo usa la capa 1 del mapa: cometas, cristales, estrellas y rosa no se pintan con map()', () => {
  for (const id of [17, 20, 25, 36]) assert.equal(cart.flags[id] & 1, 0);
});

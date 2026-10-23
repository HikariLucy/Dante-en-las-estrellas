// Búsqueda "primero el mejor" de una secuencia de entradas que complete un
// planeta. Sirve para comprobar que el port se puede terminar y para generar
// una partida grabada que luego se reproduce entera.
import { makeGame, snapshot, restore } from './helpers.mjs';

const K = 4; // cuadros por macro-acción
const ACTIONS = [];
for (const dir of [[], [0], [1]]) for (const jump of [false, true]) ACTIONS.push({ dir, jump });

// Botones de cada cuadro de una macro-acción.
export function actionFrames({ dir, jump }) {
  const frames = [];
  for (let i = 0; i < K; i++) frames.push(jump && i === 0 ? [...dir, 4] : [...dir]);
  return frames;
}

class Heap {
  constructor() { this.a = []; }
  push(v) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function heuristic(g) {
  const d = g.dante;
  const left = g.estrellas.filter((e) => !e.tomada);
  const targets = left.length ? left : [g.rosa];
  let best = Infinity;
  for (const t of targets) best = Math.min(best, Math.hypot(t.x - d.x, t.y - d.y));
  return left.length * 200 + best;
}

function key(g) {
  const d = g.dante;
  const stars = g.estrellas.map((e) => (e.tomada ? 1 : 0)).join('');
  const plat = g.plataformas.map((p) => p.x.toFixed(1)).join(',');
  const temp = g.temporales.map((p) => `${p.estado}:${Math.floor(p.t / 8)}`).join(',');
  return `${d.x.toFixed(1)},${d.y.toFixed(1)},${d.vy.toFixed(2)},${d.en_suelo ? 1 : 0},${stars}|${plat}|${temp}`;
}

// Devuelve la lista de botones por cuadro desde el estado inicial
// (planeta recién cargado + un cuadro sin botones) hasta tocar la rosa.
export function solvePlanet(planet, { maxNodes = 300000 } = {}) {
  const h = makeGame();
  h.game.cambiar_planeta(planet);
  h.run(1);
  const root = snapshot(h.game);
  const heap = new Heap();
  const seen = new Set([key(h.game)]);
  heap.push({ f: heuristic(h.game), g: 0, snap: root, path: null });
  let nodes = 0;
  while (heap.size && nodes < maxNodes) {
    const node = heap.pop();
    for (const a of ACTIONS) {
      restore(h.game, node.snap);
      h.input.held.fill(0);
      for (const b of actionFrames(a)) {
        h.run(1, b);
        if (h.game.victoria) break;
      }
      nodes++;
      const path = { a, prev: node.path };
      if (h.game.victoria) {
        const frames = [];
        for (let p = path; p; p = p.prev) frames.unshift(...actionFrames(p.a));
        return trimToVictory(planet, frames);
      }
      const k = key(h.game);
      if (seen.has(k)) continue;
      seen.add(k);
      heap.push({ f: heuristic(h.game) + node.g * 0.5, g: node.g + 1, snap: snapshot(h.game), path });
    }
  }
  throw new Error(`sin solución para el planeta ${planet} tras ${nodes} nodos`);
}

// Recorta los cuadros sobrantes tras la victoria.
function trimToVictory(planet, frames) {
  const h = makeGame();
  h.game.cambiar_planeta(planet);
  h.run(1);
  for (let i = 0; i < frames.length; i++) {
    h.run(1, frames[i]);
    if (h.game.victoria) return frames.slice(0, i + 1);
  }
  throw new Error('la secuencia no reproduce la victoria');
}

// Partida completa: lista de botones por cuadro desde _init() hasta volver
// a empezar tras el epílogo. La exporta también la prueba de navegador.
export function fullPlaythrough() {
  const frames = [];
  for (const p of [1, 2, 3]) {
    frames.push([]); // primer cuadro del planeta, sin botones
    frames.push(...solvePlanet(p));
    if (p < 3) frames.push([], [4]); // soltar Z y pulsarlo para continuar
  }
  for (let i = 0; i < 391; i++) frames.push([]);
  frames.push([4]); // volver a jugar
  return frames;
}

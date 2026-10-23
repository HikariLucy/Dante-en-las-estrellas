import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCart } from '../web/js/cart.js';
import { Game } from '../web/js/game.js';
import { Gfx } from '../web/js/gfx.js';

export const CART_PATH = fileURLToPath(new URL('../dante_estrellas_final.p8', import.meta.url));
export const cart = parseCart(fs.readFileSync(CART_PATH, 'utf8'));

// Entrada controlada por la prueba: held[b] cuenta cuadros mantenidos.
// btnp sigue la misma regla que web/js/input.js (repetición 30/8).
export class FakeInput {
  constructor() {
    this.want = new Array(6).fill(false);
    this.held = new Array(6).fill(0);
    this.btn = (b) => this.held[b] > 0;
    this.btnp = (b) => {
      const h = this.held[b];
      return h === 1 || (h > 30 && (h - 31) % 8 === 0);
    };
  }
  set(buttons) {
    this.want.fill(false);
    for (const b of buttons) this.want[b] = true;
  }
  tick() {
    for (let b = 0; b < 6; b++) this.held[b] = this.want[b] ? this.held[b] + 1 : 0;
  }
}

export function makeGame({ draw = false } = {}) {
  const input = new FakeInput();
  const calls = [];
  const audio = {
    music: (n, fade) => calls.push({ kind: 'music', n, fade, frame: game.frames }),
    sfx: (n, ch) => calls.push({ kind: 'sfx', n, ch, frame: game.frames }),
  };
  const gfx = draw ? new Gfx(cart) : null;
  const game = new Game(cart, { input, audio, gfx });
  // Avanza n cuadros con los botones indicados mantenidos.
  const run = (n = 1, buttons = []) => {
    input.set(buttons);
    for (let i = 0; i < n; i++) {
      input.tick();
      game.step(draw);
    }
  };
  return { game, input, calls, run, gfx };
}

// Instantánea del estado mutable del juego (conserva la referencia
// dante.sobre a su plataforma gracias a structuredClone).
const FIELDS = ['planeta', 'offset', 'estrellas', 'plataformas', 'temporales', 'recogidas',
  'rosa', 'victoria', 'listo', 'final_t', 'camila_x', 'corazon_sonido', 'dante', 'frames'];

export function snapshot(game) {
  const o = {};
  for (const f of FIELDS) o[f] = game[f];
  return structuredClone(o);
}

export function restore(game, snap) {
  Object.assign(game, structuredClone(snap));
}

// Estado de botones con la semántica de btn()/btnp() de la consola:
// 0 izquierda, 1 derecha, 2 arriba, 3 abajo, 4 botón O (Z), 5 botón X.
// btnp() es verdadero al pulsar y, si se mantiene, se repite tras 15
// cuadros y luego cada 4 (medidos a 30 fps, es decir 30 y 8 a 60 fps).
const REPEAT_DELAY = 30;
const REPEAT_EVERY = 8;

export class Input {
  constructor() {
    this.sources = Array.from({ length: 6 }, () => new Set());
    this.latch = new Array(6).fill(false);
    this.held = new Array(6).fill(0);
    this.btn = (b) => this.held[b] > 0;
    this.btnp = (b) => {
      const h = this.held[b];
      return h === 1 || (h > REPEAT_DELAY && (h - REPEAT_DELAY - 1) % REPEAT_EVERY === 0);
    };
  }

  // "source" distingue teclado y dedos para que soltar uno no suelte el otro.
  press(b, source = 'k') {
    this.sources[b].add(source);
    this.latch[b] = true;
  }

  release(b, source = 'k') {
    this.sources[b].delete(source);
  }

  releaseAll() {
    this.sources.forEach((s) => s.clear());
  }

  // Llamar una vez al comienzo de cada cuadro de 60 Hz. Una pulsación
  // breve entre dos cuadros cuenta igualmente como pulsada.
  tick() {
    for (let b = 0; b < 6; b++) {
      const down = this.sources[b].size > 0 || this.latch[b];
      this.latch[b] = false;
      this.held[b] = down ? this.held[b] + 1 : 0;
    }
  }
}

// Teclas equivalentes a la consola (Z/C/N para O, X/V para X). La M se
// reserva para silenciar el audio.
const KEYS = {
  ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3,
  z: 4, c: 4, n: 4, x: 5, v: 5,
};

export function keyToButton(e) {
  if (e.code === 'KeyZ') return 4;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return KEYS[k] ?? -1;
}

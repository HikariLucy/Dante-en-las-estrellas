// Framebuffer indexado de 128x128 con las primitivas que usa el cartucho.
import { FONT } from './font.js';

// Paleta estándar de 16 colores de la consola.
export const PALETTE = [
  0x000000, 0x1d2b53, 0x7e2553, 0x008751, 0xab5236, 0x5f574f, 0xc2c3c7, 0xfff1e8,
  0xff004d, 0xffa300, 0xffec27, 0x00e436, 0x29adff, 0x83769c, 0xff77a8, 0xffccaa,
];

export class Gfx {
  constructor(cart) {
    this.cart = cart;
    this.fb = new Uint8Array(128 * 128);
  }

  pset(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && x < 128 && y >= 0 && y < 128) this.fb[y * 128 + x] = c & 15;
  }

  cls(c = 0) {
    this.fb.fill(c & 15);
  }

  rectfill(x0, y0, x1, y1, c) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.pset(x, y, c);
  }

  // Línea de Bresenham entre los extremos (incluidos).
  line(x0, y0, x1, y1, c) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Sprite 8x8; el color 0 es transparente.
  spr(n, x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    const sx = (n % 16) * 8, sy = Math.floor(n / 16) * 8;
    const gfx = this.cart.gfx;
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) {
        const c = gfx[(sy + j) * 128 + sx + i];
        if (c !== 0) this.pset(x + i, y + j, c);
      }
  }

  // map(celx, cely, sx, sy, w, h, capa): dibuja solo las celdas cuyo
  // sprite tiene todas las banderas de "capa"; el sprite 0 nunca se dibuja.
  map(celx, cely, sx, sy, w, h, layer = 0) {
    const { map, flags } = this.cart;
    for (let cy = 0; cy < h; cy++)
      for (let cx = 0; cx < w; cx++) {
        const id = map[(cely + cy) * 128 + celx + cx];
        if (id === 0) continue;
        if (layer && (flags[id] & layer) !== layer) continue;
        this.spr(id, sx + cx * 8, sy + cy * 8);
      }
  }

  print(str, x, y, c) {
    let cx = Math.floor(x);
    for (const ch of String(str)) {
      const g = FONT[ch.toLowerCase()];
      if (g) {
        for (let j = 0; j < 5; j++)
          for (let i = 0; i < 3; i++) if (g[j][i]) this.pset(cx + i, y + j, c);
      }
      cx += 4;
    }
  }

  // Volcar a un buffer RGBA (ImageData.data o similar).
  toRGBA(out) {
    for (let i = 0; i < 128 * 128; i++) {
      const rgb = PALETTE[this.fb[i]];
      out[i * 4] = rgb >> 16;
      out[i * 4 + 1] = (rgb >> 8) & 255;
      out[i * 4 + 2] = rgb & 255;
      out[i * 4 + 3] = 255;
    }
    return out;
  }
}

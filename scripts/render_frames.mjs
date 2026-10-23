// Genera capturas PNG (escala 4x) de las etapas clave reproduciendo una
// partida completa con el motor web, sin navegador. Útil para comparar con
// capturas de PICO-8.
//   node scripts/render_frames.mjs [carpeta]   (por defecto dist/screenshots)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { makeGame } from '../tests/helpers.mjs';
import { fullPlaythrough } from '../tests/solver.mjs';
import { PALETTE } from '../web/js/gfx.js';

const SCALE = 4;
const outDir = process.argv[2] || 'dist/screenshots';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(fb) {
  const w = 128 * SCALE;
  const raw = Buffer.alloc((w * 3 + 1) * w);
  for (let y = 0; y < w; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const rgb = PALETTE[fb[Math.floor(y / SCALE) * 128 + Math.floor(x / SCALE)]];
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = rgb >> 16; raw[o + 1] = (rgb >> 8) & 255; raw[o + 2] = rgb & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(w, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const frames = fullPlaythrough();
const h = makeGame({ draw: true });
h.game._init();
fs.mkdirSync(outDir, { recursive: true });
const saved = [];
const save = (name) => {
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, png(h.gfx.fb));
  saved.push(file);
};

let planeta = 0, enPlaneta = 0, prevVictoria = false, enCuento = 0;
for (const b of frames) {
  h.run(1, b);
  const g = h.game;
  if (g.planeta !== planeta) { planeta = g.planeta; enPlaneta = 0; }
  if (!g.victoria) {
    enPlaneta++;
    if (enPlaneta === 30 && saved.length < 8) save(`planeta${planeta}_inicio`);
    if (enPlaneta === 150 && saved.length < 8) save(`planeta${planeta}_juego`);
  } else {
    if (!prevVictoria) enCuento = 0;
    enCuento++;
    if (planeta < 3 && enCuento === 2) save(`cuento${planeta}`);
    if (planeta === 3 && g.final_t === 200) save('epilogo_camila_camina');
    if (planeta === 3 && g.final_t === 300) save('epilogo_corazon');
    if (planeta === 3 && g.final_t === 391) save('epilogo_volver_a_jugar');
  }
  prevVictoria = g.victoria;
}
console.log(saved.join('\n'));

// Exporta a WAV la música y los SFX tal como los sintetiza el port, para
// escucharlos y compararlos con PICO-8 sin abrir el juego.
//   node scripts/render_audio.mjs [carpeta]   (por defecto dist/audio)
import fs from 'node:fs';
import path from 'node:path';
import { cart } from '../tests/helpers.mjs';
import { renderMusic, renderSfx, SAMPLE_RATE } from '../web/js/synth.js';

const outDir = process.argv[2] || 'dist/audio';

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

fs.mkdirSync(outDir, { recursive: true });
const m = renderMusic(cart, 0);
// Dos vueltas del bucle, con el fundido de entrada de 500 ms de music(0,500).
const loops = 2;
const mix = new Float32Array(m.length * loops);
for (let i = 0; i < mix.length; i++) {
  const j = i % m.length;
  const fade = Math.min(1, i / (SAMPLE_RATE * 0.5));
  mix[i] = (m.channels[0][j] + m.channels[1][j] + m.channels[2][j] + m.channels[3][j]) * fade;
}
const files = {
  'musica_bucle_x2.wav': mix,
  'sfx32_estrella.wav': renderSfx(cart, 32),
  'sfx33_corazon.wav': renderSfx(cart, 33),
};
for (const [name, data] of Object.entries(files)) {
  const f = path.join(outDir, name);
  fs.writeFileSync(f, wav(data));
  console.log(`${f} (${(data.length / SAMPLE_RATE).toFixed(2)} s)`);
}

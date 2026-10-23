// Lector del formato de texto .p8 (secciones __gfx__, __gff__, __map__,
// __sfx__ y __music__). No usa ningún código del runtime de PICO-8: solo
// interpreta la codificación hexadecimal documentada del cartucho.

function sections(text) {
  const out = {};
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = /^__(\w+)__$/.exec(raw.trim());
    if (m) {
      current = m[1];
      out[current] = [];
    } else if (current) {
      out[current].push(raw);
    }
  }
  // Quitar líneas vacías finales de cada sección.
  for (const k of Object.keys(out)) {
    while (out[k].length && out[k][out[k].length - 1].trim() === '') out[k].pop();
  }
  return out;
}

const hex = (s, i, n) => parseInt(s.substr(i, n), 16);

// Hoja de sprites 128x128, un índice de color (0-15) por píxel.
// En el texto .p8 cada carácter es un píxel, en orden de lectura.
function parseGfx(lines = []) {
  const gfx = new Uint8Array(128 * 128);
  lines.slice(0, 128).forEach((line, y) => {
    for (let x = 0; x < 128 && x < line.length; x++) gfx[y * 128 + x] = hex(line, x, 1);
  });
  return gfx;
}

// Banderas de 256 sprites, dos dígitos hex por sprite.
function parseGff(lines = []) {
  const flags = new Uint8Array(256);
  const s = lines.join('');
  for (let i = 0; i < 256 && i * 2 < s.length; i++) flags[i] = hex(s, i * 2, 2);
  return flags;
}

// Mapa de 128x32 celdas, dos dígitos hex por celda.
function parseMap(lines = []) {
  const map = new Uint8Array(128 * 64);
  lines.slice(0, 32).forEach((line, y) => {
    for (let x = 0; x < 128 && x * 2 < line.length; x++) map[y * 128 + x] = hex(line, x * 2, 2);
  });
  return map;
}

// Cada SFX: modo editor, velocidad, inicio y fin de bucle, y 32 notas
// de 5 dígitos: tono (2), forma de onda (1), volumen (1), efecto (1).
function parseSfx(lines = []) {
  const list = [];
  for (let n = 0; n < 64; n++) {
    const line = lines[n] || '';
    const sfx = {
      mode: hex(line, 0, 2) || 0,
      speed: hex(line, 2, 2) || 0,
      loopStart: hex(line, 4, 2) || 0,
      loopEnd: hex(line, 6, 2) || 0,
      notes: [],
    };
    for (let i = 0; i < 32; i++) {
      const o = 8 + i * 5;
      const ok = o + 5 <= line.length;
      sfx.notes.push({
        pitch: ok ? hex(line, o, 2) : 0,
        wave: ok ? hex(line, o + 2, 1) : 0,
        volume: ok ? hex(line, o + 3, 1) : 0,
        effect: ok ? hex(line, o + 4, 1) : 0,
      });
    }
    list.push(sfx);
  }
  return list;
}

// Cada patrón: banderas (bit0 inicio de bucle, bit1 fin de bucle,
// bit2 detener) y cuatro canales; bit 6 del canal = canal desactivado.
function parseMusic(lines = []) {
  const list = [];
  for (let n = 0; n < 64; n++) {
    const line = (lines[n] || '').trim();
    if (!line) {
      list.push({ flags: 0, channels: [-1, -1, -1, -1] });
      continue;
    }
    const [f, ch] = line.split(/\s+/);
    const channels = [];
    for (let c = 0; c < 4; c++) {
      const v = hex(ch, c * 2, 2);
      channels.push(v & 0x40 ? -1 : v & 0x3f);
    }
    list.push({ flags: parseInt(f, 16), channels });
  }
  return list;
}

export function parseCart(text) {
  const s = sections(text);
  return {
    lua: (s.lua || []).join('\n'),
    gfx: parseGfx(s.gfx),
    flags: parseGff(s.gff),
    map: parseMap(s.map),
    sfx: parseSfx(s.sfx),
    music: parseMusic(s.music),
  };
}

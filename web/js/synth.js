// Sintetizador propio que interpreta los datos __sfx__ y __music__ del
// cartucho y los convierte en muestras PCM. Es una aproximación escrita
// para este port: las formas de onda y la mezcla se modelan de forma
// independiente y no reproducen bit a bit el sonido de la consola.
//
// Temporización: una "tick" dura 183 muestras a 22050 Hz y cada nota dura
// velocidad × tick. El tono 33 corresponde a La 440 Hz.

export const SAMPLE_RATE = 22050;
export const SAMPLES_PER_TICK = 183;
const CHANNEL_GAIN = 0.35;
// Constante del suavizado de volumen (~2 ms) para evitar chasquidos.
const VOL_SMOOTH = 0.02;

export const noteFreq = (pitch) => 440 * 2 ** ((pitch - 33) / 12);

const tri = (p) => (p < 0.5 ? -1 + 4 * p : 3 - 4 * p);

// Formas de onda 0-7 sobre la fase p en [0, 1).
function wave(w, p, st) {
  switch (w) {
    case 0: return tri(p) * 0.9; // triángulo
    case 1: { // sierra inclinada: sube durante 7/8 del ciclo
      const k = 0.875;
      return p < k ? -1 + (2 * p) / k : 1 - (2 * (p - k)) / (1 - k);
    }
    case 2: return (2 * p - 1) * 0.7; // sierra
    case 3: return (p < 0.5 ? 1 : -1) * 0.5; // cuadrada
    case 4: return (p < 0.3125 ? 1 : -1) * 0.5; // pulso
    case 5: return (tri(p) + tri((2 * p) % 1) * 0.5) / 1.5; // órgano
    case 6: return st.noise * 0.6; // ruido
    case 7: return (tri(p) + tri(st.phase2)) * 0.5; // phaser
    default: return 0;
  }
}

// Número de notas que suena un SFX: si el fin de bucle es 0 y el inicio
// no, el inicio actúa como longitud.
export function sfxLength(sfx) {
  return sfx.loopEnd === 0 && sfx.loopStart > 0 ? Math.min(sfx.loopStart, 32) : 32;
}

const loops = (sfx) => sfx.loopEnd > sfx.loopStart;

export function newVoice() {
  return { phase: 0, phase2: 0, vol: 0, noise: 0, noiseAcc: 0, lastPitch: 0, lastVol: 0 };
}

// Escribe (sumando) "samples" muestras del SFX en out[offset...].
export function renderSfxInto(sfx, out, offset, samples, st = newVoice()) {
  const speed = Math.max(1, sfx.speed);
  const noteLen = speed * SAMPLES_PER_TICK;
  const len = sfxLength(sfx);
  let i = 0;
  let s = 0;
  while (s < samples) {
    if (i >= len) {
      if (!loops(sfx)) break;
      i = sfx.loopStart;
    }
    const n = sfx.notes[i];
    const vol = n.volume / 7;
    const groupBase = i & ~3;
    for (let k = 0; k < noteLen && s < samples; k++, s++) {
      const t = k / noteLen;
      let pitch = n.pitch;
      let v = vol;
      switch (n.effect) {
        case 1: // deslizamiento desde la nota anterior
          pitch = st.lastPitch + (n.pitch - st.lastPitch) * t;
          v = st.lastVol + (vol - st.lastVol) * t;
          break;
        case 2: // vibrato
          pitch += 0.5 * tri((k / SAMPLE_RATE * 7.5) % 1);
          break;
        case 3: // caída
          pitch = n.pitch * (1 - t);
          break;
        case 4: // entrada gradual
          v = vol * t;
          break;
        case 5: // salida gradual
          v = vol * (1 - t);
          break;
        case 6:
        case 7: { // arpegio sobre el grupo de 4 notas
          const ticksPerStep = n.effect === 6 ? (speed <= 8 ? 2 : 4) : (speed <= 8 ? 4 : 8);
          const step = Math.floor(k / (ticksPerStep * SAMPLES_PER_TICK)) % 4;
          pitch = sfx.notes[groupBase + step].pitch;
          break;
        }
      }
      const freq = noteFreq(pitch);
      st.vol += (v - st.vol) * VOL_SMOOTH;
      st.phase = (st.phase + freq / SAMPLE_RATE) % 1;
      st.phase2 = (st.phase2 + (freq * 1.01) / SAMPLE_RATE) % 1;
      st.noiseAcc += freq / SAMPLE_RATE * 8;
      if (st.noiseAcc >= 1) {
        st.noiseAcc %= 1;
        st.noise = Math.random() * 2 - 1;
      }
      out[offset + s] += wave(n.wave & 7, st.phase, st) * st.vol * CHANNEL_GAIN;
    }
    st.lastPitch = n.pitch;
    st.lastVol = vol;
    i++;
  }
  return s;
}

export function renderSfx(cart, n) {
  const sfx = cart.sfx[n];
  const samples = sfxLength(sfx) * Math.max(1, sfx.speed) * SAMPLES_PER_TICK;
  const out = new Float32Array(samples);
  renderSfxInto(sfx, out, 0, samples);
  return out;
}

// Orden de patrones a partir de "start" según las banderas de bucle:
// bit0 inicio de bucle, bit1 fin de bucle (vuelve al último inicio),
// bit2 detener al terminar el patrón.
export function musicOrder(music, start) {
  const order = [];
  let p = start;
  for (;;) {
    if (p < 0 || p > 63 || music[p].channels.every((c) => c < 0)) return { order, loopIndex: -1 };
    if (order.includes(p)) return { order, loopIndex: order.indexOf(p) };
    order.push(p);
    const { flags } = music[p];
    if (flags & 2) {
      let t = p;
      while (t > 0 && !(music[t].flags & 1)) t--;
      p = t;
    } else if (flags & 4) {
      return { order, loopIndex: -1 };
    } else {
      p++;
    }
  }
}

// Duración del patrón en ticks: la marca el canal más a la izquierda cuyo
// SFX no está en bucle (si todos están en bucle, el primero).
export function patternTicks(cart, pat) {
  const sfxs = pat.channels.filter((c) => c >= 0).map((c) => cart.sfx[c]);
  const ref = sfxs.find((s) => !loops(s)) || sfxs[0];
  return sfxLength(ref) * Math.max(1, ref.speed);
}

// Música renderizada por canal, para poder silenciar un canal mientras
// un SFX lo ocupa. loopStart/length en muestras.
export function renderMusic(cart, start = 0) {
  const { order, loopIndex } = musicOrder(cart.music, start);
  const starts = [];
  let total = 0;
  for (const p of order) {
    starts.push(total);
    total += patternTicks(cart, cart.music[p]) * SAMPLES_PER_TICK;
  }
  const channels = [0, 1, 2, 3].map(() => new Float32Array(total));
  for (let c = 0; c < 4; c++) {
    const st = newVoice();
    order.forEach((p, idx) => {
      const n = cart.music[p].channels[c];
      const len = (idx + 1 < order.length ? starts[idx + 1] : total) - starts[idx];
      if (n >= 0) renderSfxInto(cart.sfx[n], channels[c], starts[idx], len, st);
      else st.vol = 0;
    });
  }
  return {
    sampleRate: SAMPLE_RATE,
    channels,
    order,
    length: total,
    loopStart: loopIndex >= 0 ? starts[loopIndex] : -1,
  };
}

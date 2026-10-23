// Reproducción con Web Audio API. La música se renderiza una vez por canal
// y suena como cuatro buffers en bucle sincronizados: nunca se reinicia al
// cambiar de planeta. Un SFX lanzado en un canal silencia ese canal de la
// música mientras dura, como ocurre en la consola.
import { renderMusic, renderSfx } from './synth.js';

export class Audio {
  constructor(cart) {
    this.cart = cart;
    this.ctx = null;
    this.musicCache = new Map();
    this.sfxCache = new Map();
    this.musicSources = [];
    this.channelGains = [];
    this.sfxOnChannel = [null, null, null, null];
    this.muted = false;
  }

  // Debe llamarse dentro de un gesto del usuario (clic, toque o tecla).
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      for (let c = 0; c < 4; c++) {
        const g = this.ctx.createGain();
        g.connect(this.musicGain);
        this.channelGains.push(g);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  buffer(data, rate) {
    const b = this.ctx.createBuffer(1, data.length, rate);
    b.copyToChannel(data, 0);
    return b;
  }

  music(n, fadeMs = 0) {
    if (!this.ctx) return;
    this.musicSources.forEach((s) => s.stop());
    this.musicSources = [];
    if (n < 0) return;
    if (!this.musicCache.has(n)) this.musicCache.set(n, renderMusic(this.cart, n));
    const m = this.musicCache.get(n);
    if (!m.length) return;
    const now = this.ctx.currentTime;
    const at = now + 0.05;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(fadeMs > 0 ? 0 : 1, at);
    if (fadeMs > 0) this.musicGain.gain.linearRampToValueAtTime(1, at + fadeMs / 1000);
    m.channels.forEach((data, c) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer(data, m.sampleRate);
      if (m.loopStart >= 0) {
        src.loop = true;
        src.loopStart = m.loopStart / m.sampleRate;
        src.loopEnd = m.length / m.sampleRate;
      }
      src.connect(this.channelGains[c]);
      src.start(at);
      this.musicSources.push(src);
    });
  }

  sfx(n, channel = -1) {
    if (!this.ctx) return;
    if (!this.sfxCache.has(n)) {
      this.sfxCache.set(n, this.buffer(renderSfx(this.cart, n), 22050));
    }
    const buf = this.sfxCache.get(n);
    const ch = channel >= 0 && channel < 4 ? channel : 3;
    const prev = this.sfxOnChannel[ch];
    if (prev) {
      prev.onended = null;
      prev.stop();
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    const now = this.ctx.currentTime;
    const gain = this.channelGains[ch].gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.setValueAtTime(1, now + buf.duration);
    src.onended = () => {
      if (this.sfxOnChannel[ch] === src) this.sfxOnChannel[ch] = null;
    };
    this.sfxOnChannel[ch] = src;
    src.start(now);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}

import CART_TEXT from './cart_data.js';
import { parseCart } from './cart.js';
import { Gfx } from './gfx.js';
import { Game } from './game.js';
import { Input, keyToButton } from './input.js';
import { Audio } from './audio.js';

const STEP = 1000 / 60;

const cart = parseCart(CART_TEXT);
const gfx = new Gfx(cart);
const input = new Input();
const audio = new Audio(cart);
const game = new Game(cart, { input, audio, gfx });

const canvas = document.getElementById('screen');
const ctx2d = canvas.getContext('2d');
const image = ctx2d.createImageData(128, 128);
const overlay = document.getElementById('start');
const pausedNote = document.getElementById('paused');
const muteBtn = document.getElementById('mute');

let started = false;
let running = false;
let last = 0;
let acc = 0;

function present() {
  gfx.toRGBA(image.data);
  ctx2d.putImageData(image, 0, 0);
}

function frame(now) {
  if (!running) return;
  acc += Math.min(now - last, 250);
  last = now;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    acc -= STEP;
    steps++;
    input.tick();
    game.step(acc < STEP || steps === 4);
  }
  if (steps === 4) acc = 0;
  if (steps) present();
  requestAnimationFrame(frame);
}

function run() {
  if (running) return;
  running = true;
  last = performance.now();
  acc = 0;
  requestAnimationFrame(frame);
}

function start() {
  if (started) return;
  started = true;
  overlay.hidden = true;
  audio.unlock();
  // La tecla usada para comenzar no debe contar como primera pulsación.
  input.releaseAll();
  game._init();
  run();
}

// Escalado entero mientras quepa; si la pantalla es diminuta, ajustar.
function layout() {
  let reserved = 0;
  for (const id of ['touch', 'help']) {
    const el = document.getElementById(id);
    if (getComputedStyle(el).display !== 'none') reserved += el.offsetHeight + 8;
  }
  const avail = Math.min(window.innerWidth, window.innerHeight - reserved);
  const scale = avail >= 128 ? Math.floor(avail / 128) : avail / 128;
  const size = Math.max(1, 128 * scale);
  canvas.style.width = canvas.style.height = `${size}px`;
  document.getElementById('frame').style.width = `${size}px`;
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  muteBtn.textContent = audio.muted ? 'Sonido: no' : 'Sonido: sí';
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') {
    toggleMute();
    return;
  }
  const b = keyToButton(e);
  if (!started) {
    if (b === 4 || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      start();
    }
    return;
  }
  if (b >= 0 || e.key === ' ') e.preventDefault();
  if (b >= 0 && !e.repeat) input.press(b);
});

window.addEventListener('keyup', (e) => {
  const b = keyToButton(e);
  if (b >= 0) input.release(b);
});

window.addEventListener('blur', () => input.releaseAll());

overlay.addEventListener('click', start);
muteBtn.addEventListener('click', (e) => {
  e.currentTarget.blur();
  toggleMute();
});

// Botones táctiles: cada dedo es una fuente independiente.
for (const el of document.querySelectorAll('[data-btn]')) {
  const b = Number(el.dataset.btn);
  const down = (e) => {
    e.preventDefault();
    if (!started) start();
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('on');
    input.press(b, `p${e.pointerId}`);
  };
  const up = (e) => {
    el.classList.remove('on');
    input.release(b, `p${e.pointerId}`);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Al ocultar la pestaña se pausa el juego y el audio; al volver, la música
// sigue desde donde estaba.
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) {
    running = false;
    input.releaseAll();
    audio.suspend();
    pausedNote.hidden = false;
  } else {
    pausedNote.hidden = true;
    audio.resume();
    run();
  }
});

window.addEventListener('resize', layout);
layout();

// Primer cuadro visible detrás de la pantalla de inicio.
game.cambiar_planeta(1);
game._draw();
present();

// Gancho para pruebas automáticas en navegador (solo lectura de estado).
window.__dante = { game, input, audio, start };

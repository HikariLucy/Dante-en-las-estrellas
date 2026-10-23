// Prueba de humo en Chrome real (headless) sobre dist/itchio servido por HTTP:
//  1. carga sin errores de consola ni peticiones externas;
//  2. reproduce dentro de la página la partida completa grabada;
//  3. con eventos de teclado reales: Z inicia el juego y el audio, la flecha
//     derecha mueve a Dante, y se guarda una captura.
// Requiere haber ejecutado scripts/build_web.py.
//   node scripts/browser_smoke.mjs [ruta-a-chrome]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fullPlaythrough } from '../tests/solver.mjs';

const CHROME = process.argv[2] || 'google-chrome';
const ROOT = new URL('..', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Puertos libres elegidos por el sistema, para no chocar con otros servicios.
const freePort = () => new Promise((r) => {
  const srv = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => r(port));
  });
});
const HTTP_PORT = await freePort();
const CDP_PORT = await freePort();

const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1', '-d', path.join(ROOT, 'dist/itchio')], { stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dante-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--window-size=800,800', 'about:blank'], { stdio: 'ignore' });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK ' : 'FALLA'} ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  // Confirmar que el puerto lo sirve nuestro dist/itchio.
  let served = false;
  for (let i = 0; i < 30 && !served; i++) {
    await sleep(100);
    try {
      served = (await (await fetch(`http://127.0.0.1:${HTTP_PORT}/js/cart_data.js`)).text()).includes('dante y las estrellas');
    } catch { /* servidor arrancando */ }
  }
  if (!served) throw new Error('el servidor local no sirve dist/itchio');

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* Chrome aún arrancando */ }
  }
  if (!target) throw new Error('no se pudo conectar con Chrome');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) events.push(msg);
  });
  const send = (method, params = {}) => new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  };
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      try {
        if (await evaluate('!!(window.__dante && document.readyState === "complete")')) return;
      } catch { /* navegando */ }
    }
    throw new Error('la página no terminó de cargar');
  };
  const key = (type, k, code, keyCode) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: keyCode });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  const url = `http://127.0.0.1:${HTTP_PORT}/`;
  await send('Page.enable');
  await send('Page.navigate', { url });
  await ready();

  const errors = events.filter((e) => e.method === 'Runtime.exceptionThrown' ||
    (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
    (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'));
  check('carga sin errores de consola', errors.length === 0, errors.map((e) => JSON.stringify(e.params).slice(0, 200)).join(' | '));
  const external = events.filter((e) => e.method === 'Network.requestWillBeSent' && !e.params.request.url.startsWith(url));
  check('sin peticiones externas', external.length === 0, external.map((e) => e.params.request.url).join(', '));
  check('el cartucho embebido se parsea', await evaluate('window.__dante.game.cart.lua.includes("version 1.4")'));

  // Partida completa grabada, paso a paso dentro de la página (sin bucle rAF).
  const frames = fullPlaythrough();
  const summary = await evaluate(`(() => {
    const { game, input } = window.__dante;
    const frames = ${JSON.stringify(frames)};
    const visited = [];
    let prev = false;
    game._init();
    for (const bs of frames) {
      input.releaseAll();
      for (const b of bs) input.press(b, 't');
      input.tick();
      game.step(true);
      if (game.victoria && !prev) visited.push(game.planeta);
      prev = game.victoria;
    }
    input.releaseAll();
    return { visited, planeta: game.planeta, victoria: game.victoria };
  })()`);
  check('partida completa en el navegador (3 planetas + epílogo + reinicio)',
    JSON.stringify(summary) === JSON.stringify({ visited: [1, 2, 3], planeta: 1, victoria: false }), JSON.stringify(summary));

  // Interacción real: recargar, pulsar Z, mover a la derecha.
  events.length = 0;
  await send('Page.reload');
  await sleep(300);
  await ready();
  await key('keyDown', 'z', 'KeyZ', 90);
  await key('keyUp', 'z', 'KeyZ', 90);
  await sleep(700);
  const x0 = await evaluate('window.__dante.game.dante.x');
  await key('rawKeyDown', 'ArrowRight', 'ArrowRight', 39);
  await sleep(500);
  await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
  await sleep(100);
  const st = await evaluate(`(() => {
    const d = window.__dante;
    return { x: d.game.dante.x, frames: d.game.frames, ctx: d.audio.ctx && d.audio.ctx.state,
      sources: d.audio.musicSources.length, overlay: document.getElementById('start').hidden };
  })()`);
  check('Z oculta la pantalla de inicio y arranca el bucle', st.overlay && st.frames > 30, `frames=${st.frames}`);
  check('flecha derecha mueve a Dante', st.x > x0 + 10, `x ${x0} → ${st.x}`);
  check('AudioContext activo tras el gesto, 4 canales de música', st.ctx === 'running' && st.sources === 4, `ctx=${st.ctx} fuentes=${st.sources}`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(ROOT, 'dist/screenshots/chrome_planeta1.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`captura: ${path.relative(ROOT, out)}`);
  ws.close();
} catch (e) {
  check('ejecución', false, e.message);
} finally {
  chrome.kill();
  server.kill();
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exit(results.every(Boolean) ? 0 : 1);

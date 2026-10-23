# Dante en las Estrellas: versión web (HTML5)

Port independiente del cartucho `dante_estrellas_final.p8` (versión 1.4) a HTML5 + Canvas 2D + Web Audio, pensado para publicarse gratis en itch.io. No usa ni distribuye código del runtime de PICO-8: la lógica Lua está traducida a mano a JavaScript, y los gráficos, flags, mapa, SFX y música se leen del propio `.p8` en cada build.

> ⚠️ **Antes de publicar:** la melodía de la música es una adaptación de una referencia externa. Hay que identificar al autor y las condiciones de redistribución y conseguir permiso o licencia, o reemplazarla por una composición propia o con licencia. Ver «Licencia de música» en [`WEB_PORTING_PLAN.md`](../WEB_PORTING_PLAN.md). **Este bloqueo sigue abierto.**

## Requisitos

- Python 3.8+ (build y servidor local).
- Node.js 20+ (pruebas y herramientas; sin dependencias npm).
- Opcional: Google Chrome para la prueba de humo en navegador.

## Uso rápido

```bash
python3 scripts/build_web.py --serve      # construye dist/itchio y lo sirve en http://localhost:8000
```

Se abre `http://localhost:8000` y se pulsa **Z** (o se toca la pantalla) para empezar. Si el puerto 8000 está ocupado, se puede usar `--port 8123`.

`index.html` no funciona abierto como `file://`, porque los navegadores bloquean los módulos ES fuera de HTTP. En itch.io se sirve por HTTPS, así que funciona sin cambios.

## Controles

| Entrada | Acción |
| --- | --- |
| ← / → | Mover a Dante |
| Z (también C o N) | Saltar / continuar / volver a jugar |
| M | Silenciar o activar el sonido |
| Táctil | Botones ◀ ▶ y Z bajo la pantalla (solo en dispositivos táctiles) |

Las flechas y Z no hacen scroll en la página. Al ocultar la pestaña, el juego y el audio se pausan, y al volver la música sigue desde el mismo punto.

## Pruebas

```bash
npm test                                   # = node --test tests/*.test.mjs
python3 scripts/build_web.py && node scripts/browser_smoke.mjs   # Chrome headless
node scripts/render_frames.mjs             # capturas PNG 4x en dist/screenshots/
node scripts/render_audio.mjs              # WAV de música y SFX en dist/audio/
```

- `tests/cart.test.mjs`: lectura de `__gfx__`, `__gff__`, `__map__`, `__sfx__` y `__music__`.
- `tests/game.test.mjs`: física (1 px/cuadro, salto −3.5, gravedad 0.22, tope 3), suelo, límites, cometas (0.4 px/cuadro, ±8 px, Dante viaja encima), cristales (48 + 90 cuadros), estrellas y rosa, transiciones con Z, tiempos del epílogo (150 / x=72 en el cuadro 278 / 390), música iniciada una sola vez y determinismo.
- `tests/playthrough.test.mjs`: un buscador (`tests/solver.mjs`) encuentra entradas que completan cada planeta. Después se reproduce la partida entera de corrido (3 planetas, cuentos, epílogo y reinicio) y se comprueba que suenan 9 SFX de estrella, 1 de corazón y que la música se inicia una sola vez.
- `tests/synth.test.mjs`: duración de SFX 32/33, frecuencia de notas sintetizadas, orden y duración del bucle musical (patrones 0→3, 17 s) y canales.
- `scripts/browser_smoke.mjs`: en Chrome real comprueba que no haya errores de consola ni peticiones externas, reproduce dentro de la página la partida completa grabada y, con eventos de teclado reales, que Z arranca el juego y el `AudioContext` y que la flecha mueve a Dante.

## Empaquetar para itch.io

```bash
python3 scripts/build_web.py
```

Genera:

- `dist/itchio/`: sitio estático autocontenido (sin CDN ni recursos remotos; el build falla si encuentra alguno).
- `dist/dante-en-las-estrellas-web.zip`: ZIP con `index.html` en la raíz, listo para subir.

En itch.io: *Kind of project* → **HTML**; subir el ZIP y marcar *This file will be played in the browser*. Tamaño de viewport recomendado: **640 × 680** (pantalla a escala 5 más la línea de ayuda). Conviene activar *Mobile friendly* y el botón de pantalla completa.

### Cuando cambia el cartucho

- **Gráficos, flags, mapa, SFX o música:** basta con volver a ejecutar `scripts/build_web.py`, que incrusta el `.p8` actual en `js/cart_data.js`.
- **Código `__lua__`:** el build se detiene porque la huella `LUA_SHA256` ya no coincide. Hay que actualizar `web/js/game.js` (se conservan los mismos nombres de funciones y variables para poder comparar línea a línea), luego la huella, y volver a ejecutar las pruebas.

El `.p8` solo se lee; el build nunca lo modifica.

## Arquitectura

```
web/
  index.html, style.css   página, escalado entero, botones táctiles
  js/cart.js              parser del formato de texto .p8
  js/game.js              traducción del Lua (_init, _update60, _draw...)
  js/gfx.js               framebuffer 128×128 indexado: cls, pset, line, rectfill, spr, map, print
  js/font.js              fuente 3×5 propia
  js/synth.js             sintetizador: SFX/música → PCM (22 050 Hz)
  js/audio.js             Web Audio: 4 canales de música en bucle + SFX
  js/input.js             btn/btnp con repetición, teclado y táctil
  js/main.js              bucle fijo de 60 Hz, inicio, pausa
scripts/build_web.py      build + ZIP + comprobaciones
```

`game.js` no depende del DOM: recibe entrada, audio y gráficos por inyección, así que se prueba en Node con exactamente el mismo código que corre en el navegador.

**Música continua:** `music(0,500)` se llama una sola vez en `_init`. La música se renderiza por canal y suena como cuatro `AudioBufferSourceNode` en bucle sincronizados, que nunca se detienen al cambiar de planeta ni al reiniciar. `sfx(32,3)` y `sfx(33,3)` silencian el canal 3 de la música mientras suenan.

## Diferencias pendientes respecto al original

Estado honesto de lo que **no** está verificado contra PICO-8 o es una aproximación:

1. **Timbre del audio (aproximación, sin escuchar).** Notas, volúmenes, velocidades, longitudes y efectos salen del cartucho. Las formas de onda (triángulo, sierra inclinada y órgano, las únicas que usa el juego) son modelos propios, no idénticos a los de PICO-8, y no se emula el filtrado de salida. El audio **no se ha escuchado**: solo hay comprobaciones automáticas de duración, frecuencia y nivel. Pendiente: escuchar `dist/audio/*.wav` y el juego junto a PICO-8.
2. **SFX sobre un canal de la música:** se asume que el canal 3 de la música se silencia mientras dura el SFX y se reanuda en su posición actual. Hay que confirmarlo de oído contra PICO-8.
3. **Repetición de `btnp`:** se usan 30 cuadros de retardo y 8 de repetición a 60 Hz (15 y 4 a 30 fps). Mantener Z vuelve a saltar al aterrizar, como en el Lua. Falta compararlo con PICO-8.
4. **Punto fijo 16.16:** los literales 0.22 y 0.4 se redondean al valor de punto fijo más cercano. Si PICO-8 los trunca, la diferencia es de 1/65536 px por cuadro.
5. **Fuente:** es una 3×5 propia con el mismo avance de 4 px (la tilde de «él» cae en su sitio), pero los glyphs no son los de PICO-8.
6. **`line()`:** usa Bresenham. Las dos líneas diagonales del fondo del planeta 2 pueden diferir en algún píxel.
7. **`time()`:** se calcula como cuadros/60 desde el inicio. Las animaciones de caminar o estar quieto pueden ir desfasadas una fracción de ciclo respecto a PICO-8.
8. **Firefox:** se verificó la carga y el primer cuadro (captura headless). La partida y el audio no se han probado de forma interactiva.
9. **Táctil:** el código existe (Pointer Events, multitoque) pero no se ha probado en un dispositivo real.
10. **Capturas comparativas con PICO-8:** las capturas del port están en `dist/screenshots/` (generadas), pero falta tomar las equivalentes en PICO-8 y compararlas.

## Registro de pruebas

**2026-10-23**, rama `feat/web-itchio-port`, Node 24.21, Python 3.12, Linux:

| Prueba | Resultado |
| --- | --- |
| `npm test` (27 pruebas: cartucho, lógica, partida completa, sintetizador) | ✅ 27/27 |
| `scripts/build_web.py`: 11 archivos, ZIP de ~20 KB, sin recursos remotos, `.p8` sin cambios (sha256 `182c412c…7ac0`) | ✅ |
| `scripts/browser_smoke.mjs` en Google Chrome headless: sin errores de consola, sin peticiones externas, partida completa grabada (3 planetas + epílogo + reinicio), Z inicia el juego y el `AudioContext` queda `running` con 4 canales, → mueve a Dante | ✅ 7/7 |
| Firefox headless: carga y primer cuadro visibles | ✅ (solo carga) |
| Revisión visual de capturas del port (3 planetas, cuentos y epílogo) | ✅ coherentes con el código; sin comparar aún con PICO-8 |
| Escucha del audio | ❌ no realizada |
| Prueba en dispositivo táctil | ❌ no realizada |
| Derechos de la música | ❌ bloqueo abierto |

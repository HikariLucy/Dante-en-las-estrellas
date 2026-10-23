# Port web / itch.io — Dante en las Estrellas

## Objetivo

Crear una **versión web independiente y gratuita** del juego existente en `dante_estrellas_final.p8`, para jugar directamente en el navegador y subir un ZIP a itch.io. Mantener el cartucho PICO-8 y `main` intactos.

La rama de trabajo es `feat/web-itchio-port`. Fuente de verdad: el cartucho del repositorio, versión 1.4, que contiene `__lua__`, `__gfx__`, `__gff__`, `__map__`, `__sfx__` y `__music__`.

## Decisiones técnicas

- Stack: **HTML, CSS y JavaScript ES modules, Canvas 2D**. Sin React, sin servidor de backend y sin dependencias de pago.
- Resolución lógica 128 × 128, render con `image-rendering: pixelated` y escalado entero cuando sea viable.
- Implementar una traducción explícita de la lógica Lua del juego; **no copiar ni distribuir el runtime propietario de PICO-8**.
- Mantener una conversión reproducible de los datos gráficos, flags y mapa del cartucho; documentar cómo se actualiza la versión web cuando cambia el `.p8`.
- Audio con Web Audio API a partir de los datos `__sfx__` / `__music__`, sin bajar archivos ni usar reproductores propietarios. Debe arrancar después de una interacción del usuario, como exigen los navegadores. Priorizar fidelidad de notas, instrumentos, velocidad y transiciones, documentando diferencias que queden.
- Evitar CDN y recursos remotos; el ZIP de itch.io debe ser autocontenido. `index.html` en la raíz del ZIP.

## Paridad funcional obligatoria

1. Las **tres etapas** deben reproducir el mapa original: planeta 1 plataformas fijas, planeta 2 cometas horizontales (velocidad ~0.4 px/frame), planeta 3 cristales temporales (48 frames activos tras pisarlos y 90 frames de recuperación).
2. Reproducir fielmente física a 60 Hz: horizontal ±1 px/frame, salto inicial -3.5 px/frame, gravedad +0.22 y velocidad vertical máxima 3; colisiones de caja 8×8 y límite del mapa.
3. Dibujar sprites originales de 8×8, animaciones de caminar/saltar y fondo/HUD. Leer `__gfx__`, `__gff__`, `__map__` respetando su codificación PICO-8.
4. Recolectar todas las estrellas antes de revelar la rosa; al tocarla mostrar la escena de cuento, y con Z avanzar al planeta siguiente.
5. Respetar **todos** los textos y el epílogo: Camila comienza a entrar tras 150 frames, camina hacia x=72 a 0.5 px/frame, aparece el corazón al llegar, se puede recomenzar tras 390 frames.
6. Mantener la **música en bucle continuo, sin reiniciarla** al cambiar de planeta. Reproducir SFX de estrella (32) y corazón (33), teniendo en cuenta la mezcla por canales.
7. Controles teclado: flechas izquierda/derecha, Z para salto/continuar/reiniciar; prevenir scroll al jugar. Añadir botones táctiles si son útiles sin tapar el juego.
8. Soportar Chrome y Firefox en escritorio; inicio con interacción para desbloquear audio; pausa al ocultar la pestaña si corresponde.

## Plan de entrega

- `web/`: fuentes HTML/CSS/JS con runtime **propio** (juego, datos, render y sonido).
- `scripts/build_web.py` o similar: empaquetar/copiar recursos y crear `dist/itchio/` autocontenido a partir del cartucho original.
- `web/README.md`: ejecutar servidor de desarrollo (`python3 -m http.server`), construir y generar el ZIP.
- Pruebas automatizadas para la lectura de los datos del cartucho y la lógica determinista del juego, con especial atención a colisiones y transiciones.
- `dist/itchio/` debe poder jugarse **offline una vez servido** (sin solicitudes a GitHub ni CDN) y funcionar al subir el ZIP a itch.io.
- Screenshots comparables con PICO-8 de las tres etapas y el epílogo, controles comprobados y audio comprobado manualmente.
- No actualizar `README.md` principal para afirmar que la versión web está terminada hasta haberla probado.

## Licencia de música: bloqueo editorial

La melodía usada originalmente fue adaptada desde una referencia externa. **Antes de publicar en itch.io**, identificar autor y condiciones de redistribución y obtener permiso/licencia, o reemplazar por una composición propia/licenciada. No suponer que ser un cover o transcribirla en tracker permite publicarla.

## Criterio de cierre

Se considera lista cuando cualquiera puede abrir la página publicada y terminar los tres planetas hasta la escena final; sprites, colisiones y transiciones coinciden razonablemente con PICO-8; la música no se reinicia y su uso es legalmente apto para publicación. Mantener el `.p8` original como fuente y evitar cambios sobre `main` sin revisión.

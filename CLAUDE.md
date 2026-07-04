# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Un juego de Arkanoid/Breakout para navegador hecho con **HTML, CSS y JavaScript puros — cero dependencias**. El juego en sí **todavía no está implementado**; por ahora el repo solo contiene infraestructura de renderizado y un flujo de trabajo guiado por specs. El objetivo (según `readme.md`) es un Arkanoid jugable que corra directamente en el navegador.

El usuario escribe y piensa en español. Respondé en el mismo idioma del prompt (los skills de spec también lo exigen).

## Cómo ejecutarlo

No hay paso de build, bundler ni gestor de paquetes. El juego se sirve como archivos estáticos. Una vez que exista un `index.html`, abrilo en el navegador o serví el directorio (ej. `python -m http.server`). Los sprites se cargan desde `assets/spritesheet-breakout.png` con una **ruta relativa**, así que la página debe servirse/abrirse desde la raíz del repo para que los assets resuelvan.

## Flujo guiado por specs (cómo se espera trabajar acá)

Las features se construyen a través de dos skills, no con código improvisado. Preferí este flujo para cualquier feature no trivial:

- **`/spec <descripción>`** — diseña una spec de forma interactiva (preguntas de aclaración → sección por sección) y la guarda en `specs/NN-slug.md` en estado `Draft`. Nunca escribe código del juego. También crea `specs/.spec-config.yml` en su primera ejecución.
- **`/spec-impl <NN-slug>`** — implementa una spec **aprobada**. Se niega a avanzar salvo que la línea de estado de la spec signifique "Aprobado" (en cualquier idioma). Crea/cambia a una rama git `spec-NN-slug` y luego implementa el plan **paso a paso, pausando después de cada paso** para revisar el diff.

Reglas clave incorporadas en estos skills:
- Las specs se numeran secuencialmente (`01-`, `02-`, …). El próximo número se determina mirando `specs/`.
- Una spec nueva se guarda como `Draft`; solo el humano la cambia a `Aprobado`. `/spec-impl` bloquea de forma tajante cualquier estado que no sea Aprobado.
- La creación automática de rama se controla con `AutoCreateBranch` en `specs/.spec-config.yml` (por defecto `true`).
- Implementá exactamente lo que dice la spec. Planteá desacuerdos como observaciones; no te desvíes en silencio. Los pedidos fuera de alcance se difieren a una spec futura, no se codean en la rama actual.

Nota: este repo **no es un repositorio git** en este momento. La lógica de ramas de `/spec-impl` asume git — hará falta `git init` antes de implementar una spec.

## Infraestructura de renderizado (`assets/spritesheet.js`)

Todo el dibujado pasa por un único spritesheet cargado una sola vez en un canvas fuera de pantalla. El código nuevo del juego debería reusar estos globals en vez de cargar imágenes por su cuenta:

- `loadSpritesheet(cb)` — carga `assets/spritesheet-breakout.png`, la decodifica en un canvas offscreen e invoca `cb` cuando está listo (encola callbacks si se llama antes de que termine la carga). Llamalo antes de renderizar.
- `drawSprite(ctx, name, x, y, w, h)` — dibuja un sprite por nombre. Nombres: `paddle`, `ball`, o `block_<color>` donde color ∈ `gray, red, yellow, cyan, magenta, hotpink, green`.
- `drawFrame(ctx, frame, x, y, w, h)` — dibuja un frame explícito `{sx, sy, sw, sh}`, usado para la animación de explosión por color (`EXPLOSION_FRAMES`, `EXPLOSION_DURATION` = 150ms).

Las coordenadas de sprites/frames están hardcodeadas al layout específico de `spritesheet-breakout.png`; no cambies los offsets sin verificar la imagen real. Ambas funciones de dibujo no hacen nada (no-op) en silencio hasta que el spritesheet esté cargado.

## Assets

- `assets/spritesheet-breakout.png` — el atlas de sprites único (paddle, pelota, bloques, explosiones).
- `assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3` — efectos de sonido.

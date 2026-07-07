# SPEC 02 — Animación de destrucción de bloques

> **Estado:** Draft
> **Depende de:** SPEC 01 — MVP jugable de Arkanoid
> **Fecha:** 2026-07-07
> **Objetivo:** Al romperse un bloque, reproducir en su lugar una animación de explosión de 4 frames por color (150ms, sprites del spritesheet) como capa puramente visual, sin tocar la lógica de colisión, puntaje ni victoria.

## Alcance

**Incluye:**

- Al romper un bloque en `collideBricks`, además de la lógica actual (`alive:false`, +10 puntos, rebote), **encolar una explosión** en `state.explosions` con `{ x, y, w, h, color, start }`, donde `start` es el timestamp de inicio.
- **Reproducir la animación** de 4 frames por color usando `EXPLOSION_FRAMES[color]` y `drawFrame`, avanzando por tiempo: `frame = floor((now - start) / (EXPLOSION_DURATION / 4))`, con `EXPLOSION_DURATION = 150` ms.
- **Dibujar cada explosión centrada sobre el hueco del bloque y un 30% más grande** (factor `1.3×` sobre `w`/`h`), por encima de bloques, paddle y pelota.
- **Purgar** cada explosión al superar los 150 ms (cuando el índice de frame llega a 4), de forma independiente de la fase del juego.
- **Limpiar `state.explosions`** al reiniciar la partida (`resetGame`).
- Pasar un timestamp `now` al ciclo para gestionar el ciclo de vida de las explosiones (usar el que provee `requestAnimationFrame`).

**Fuera de alcance (para futuras specs):**

- Sonido de rotura (`break-sound.mp3`) — sigue diferido.
- Cualquier cambio en la física: el bloque muere, suma y rebota en el **mismo frame** del impacto; la explosión no colisiona ni afecta el puntaje.
- Retrasar el overlay de victoria hasta que termine la última explosión (se muestra inmediato, como hoy).
- Animaciones de otros elementos (pelota, paddle, pérdida de vida).
- Efectos de partículas, sacudida de pantalla u otros embellecimientos.

> Esta spec **reemplaza** el comportamiento "desaparece (sin animación)" descripto en la SPEC 01 para la rotura de bloques.

## Modelo de datos

No se introduce ninguna estructura nueva: el scaffolding ya existe en `game.js`.

```js
// Ya presente en state (game.js): explosiones activas, solo visuales
explosions: [], // { x, y, w, h, color, start }
```

Convenciones:

- `x, y, w, h` se copian del bloque roto (su rect en la grilla). El dibujado se centra sobre ese rect y se escala por `EXPLOSION_SCALE`.
- `color` es el color de fila del bloque (`ROW_COLORS`), que existe como clave en `EXPLOSION_FRAMES`.
- `start` es el timestamp (`now` del `requestAnimationFrame`) del frame en que se rompió el bloque. La explosión termina cuando `now - start >= EXPLOSION_DURATION`.
- Constante nueva local en `game.js`: `EXPLOSION_SCALE = 1.3`.

## Plan de implementación

1. **Encolar la explosión al romper.** En `collideBricks`, tras marcar `brick.alive = false` y sumar el puntaje, hacer `state.explosions.push({ x: brick.x, y: brick.y, w: brick.w, h: brick.h, color: brick.color, start: now })`. Requiere que `collideBricks` (y su cadena `update → updateBall`) reciba `now`. Prueba: `console.log(state.explosions.length)` sube al romper un bloque.

2. **Propagar `now` por la cadena de update.** `loop(now)` (timestamp de `requestAnimationFrame`) → `update(now)` → `updateBall(now)` → `collideBricks(now)`. Prueba: no hay errores en consola y el juego sigue corriendo igual.

3. **Avanzar y purgar el ciclo de vida.** Agregar `updateExplosions(now)` que recorra `state.explosions` y elimine las que cumplieron `now - start >= EXPLOSION_DURATION`. Llamarla en `update` **antes** de los `return` tempranos por fase, para que las explosiones se apaguen aunque la fase no sea `"playing"`. Prueba: tras romper un bloque, el array vuelve a vaciarse ~150ms después.

4. **Dibujar las explosiones.** Agregar `drawExplosions(now)`: para cada explosión, calcular `i = Math.floor((now - start) / (EXPLOSION_DURATION / 4))`; si `i` está entre 0 y 3, tomar `EXPLOSION_FRAMES[color][i]` y dibujarla centrada y escalada por `EXPLOSION_SCALE` con `drawFrame(ctx, frame, cx - w*S/2, cy - h*S/2, w*S, h*S)`. Llamarla en `render(now)` **después** de `drawBricks`/`drawPaddle`/`drawBall` (por encima de todo). Requiere pasar `now` a `render`. Prueba: al romper un bloque se ve la explosión de 4 frames en su lugar, un poco más grande que el hueco.

5. **Limpiar al reiniciar.** En `resetGame`, agregar `state.explosions = []` (o `.length = 0`). Prueba: ganar/perder y reiniciar no arrastra explosiones viejas a la nueva partida.

## Criterios de aceptación

- [ ] Al romper un bloque aparece en su lugar una animación de explosión de 4 frames del color del bloque.
- [ ] La animación dura ~150ms y luego desaparece por completo (no queda ningún residuo dibujado).
- [ ] La explosión se dibuja centrada sobre el hueco del bloque y ~30% más grande que el bloque.
- [ ] La explosión se ve por encima de bloques, paddle y pelota.
- [ ] Romper un bloque sigue sumando exactamente 10 puntos y produciendo el rebote en el mismo frame (la lógica de juego no cambió).
- [ ] Al romper el último bloque, el overlay de "¡Ganaste!" aparece de inmediato (comportamiento actual).
- [ ] Reiniciar la partida no muestra explosiones heredadas de la partida anterior.
- [ ] No hay errores en consola y los FPS se mantienen estables con varias explosiones simultáneas.

## Decisiones

- **Sí:** avance de frame **por tiempo** (`performance.now` / timestamp de rAF), no por conteo de frames. Independiza la animación de los FPS y reutiliza el campo `start` que el scaffolding ya previó.
- **No:** avanzar la animación por contador de frames de rAF. En máquinas lentas la explosión duraría más de lo debido.
- **Sí:** explosión **centrada sobre el bloque y 1.3× más grande**. La explosión "desborda" levemente el hueco y se siente más impactante que encajada al rect exacto.
- **Sí:** animación **puramente cosmética**. El bloque muere, suma y rebota en el mismo frame del impacto; la explosión es una capa visual encima. Mantiene la física de la SPEC 01 intacta y el alcance chico.
- **No:** que el bloque siga colisionando mientras explota. Cambiaría la física y complicaría el alcance sin beneficio claro.
- **Sí:** overlay de victoria **inmediato** al romper el último bloque. No agrega estados de "esperando fin de animación"; la última explosión corre detrás del overlay.
- **No:** retrasar el overlay hasta que termine la última explosión. Overengineering para el efecto buscado.
- **Sí:** purgar explosiones **independiente de la fase**, para que no queden congeladas al entrar en `ready`/`won`/`gameover`.
- **Nota de método:** definición acelerada — el usuario pidió grabar la spec tras confirmar encabezado y alcance; el resto de las secciones se completó con las decisiones ya cerradas en la fase de preguntas.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `render`/`update` hoy no reciben el timestamp; agregar `now` a la cadena puede romper alguna firma. | Tomar `now` del argumento de `requestAnimationFrame(loop)` y propagarlo explícitamente por `update`/`render`; verificar que ninguna llamada quede sin el parámetro. |
| Si no se purgan, las explosiones se acumulan en el array y degradan el render. | `updateExplosions` elimina por tiempo cada frame; además `resetGame` vacía el array. |
| Un color de bloque sin entrada en `EXPLOSION_FRAMES` rompería el dibujado. | Los 6 colores de `ROW_COLORS` (red, hotpink, magenta, yellow, cyan, green) están todos en `EXPLOSION_FRAMES`; `drawExplosions` puede además saltear defensivamente si `EXPLOSION_FRAMES[color]` no existe. |

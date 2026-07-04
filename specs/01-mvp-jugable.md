# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** Borrador
> **Depende de:** —
> **Fecha:** 2026-07-04
> **Objetivo:** Un Arkanoid jugable en una sola pantalla de 800×600 con paddle (mouse + teclado), pelota de física predecible, grilla de 10×6 bloques que suman 10 puntos al romperse, 3 vidas y overlay de victoria/derrota reiniciable.

## Alcance

**Incluye:**

- Canvas fijo de 800×600 px, servido desde `index.html`.
- Paddle controlable de forma simultánea con **mouse** (sigue la posición horizontal) y **teclado** (flechas ← → y/o A/D).
- Pelota que arranca **pegada al paddle** y se lanza con **click o barra espaciadora**.
- Rebote de la pelota en paredes, techo y paddle. En el paddle, el ángulo de salida depende de la **posición de impacto** (centro → más vertical, borde → más abierto).
- Grilla de **10 columnas × 6 filas** de bloques dibujados con los sprites `block_<color>` del spritesheet (un color por fila).
- Al golpear un bloque: **desaparece** (sin animación) y suma **10 puntos**.
- **3 vidas.** La pelota que cae por abajo resta una vida y re-arranca pegada al paddle. Con 0 vidas → Game Over.
- **Victoria** al romper los 60 bloques.
- **Overlay** superpuesto al canvas para "Ganaste" y "Game Over", con marcador de puntaje y vidas visible durante el juego.
- Reinicio de la partida con **tecla o click** desde el overlay, **sin recargar la página**.

**Fuera de alcance (para futuras specs):**

- Sonido (rebote y rotura con los mp3 existentes).
- Animación de explosión de bloques.
- Múltiples niveles y estructura de datos de niveles.
- Power-ups.
- Persistencia de high-scores.
- Versión móvil / controles táctiles.
- Bloques con más de un golpe de resistencia.

## Modelo de datos

Todo el estado vive en un único objeto en memoria (sin persistencia). Coordenadas con origen arriba-izquierda; velocidades en píxeles/frame.

```js
// Dimensiones fijas del canvas
const WIDTH = 800;
const HEIGHT = 600;

// Estado global de la partida
const state = {
  phase: "ready",        // "ready" | "playing" | "won" | "gameover"
  score: 0,
  lives: 3,

  paddle: { x: 350, y: 560, w: 100, h: 20, speed: 7 },

  ball: {
    x: 400, y: 540, r: 8,
    vx: 0, vy: 0,        // 0,0 mientras está pegada (phase "ready")
    speed: 5,            // magnitud constante de la velocidad
    stuck: true,         // pegada al paddle hasta el lanzamiento
  },

  // 60 bloques (10 col × 6 filas). Cada uno:
  bricks: [/* { x, y, w, h, color, alive } */],
};

// Un color por fila (sprites block_<color> del spritesheet)
const ROW_COLORS = ["red", "hotpink", "magenta", "yellow", "cyan", "green"];
```

Convenciones:

- La grilla de bloques se genera al iniciar/reiniciar recorriendo 6 filas × 10 columnas y calculando `x`/`y` a partir de un margen superior, un padding entre bloques y el ancho disponible.
- Un bloque roto pasa a `alive: false` y deja de dibujarse y de colisionar (no se elimina del array).
- La velocidad de la pelota mantiene magnitud constante (`speed`); el rebote en el paddle solo cambia la **dirección** según la posición de impacto.

## Plan de implementación

1. **Crear `index.html`** con un `<canvas id="game" width="800" height="600">`, un contenedor para el overlay, y los `<script>` que cargan `assets/spritesheet.js` y `game.js` (aún vacío). Prueba manual: abrir la página, ver el canvas en blanco sin errores en consola.

2. **Crear `game.js` con el bootstrap de render.** Llamar a `loadSpritesheet(cb)` y, en el callback, obtener el `ctx` y pintar el fondo. Definir `WIDTH`/`HEIGHT` y el objeto `state` inicial. Prueba: fondo pintado al cargar.

3. **Dibujar el paddle** con `drawSprite(ctx, "paddle", ...)` en su posición inicial. Prueba: se ve el paddle abajo y centrado.

4. **Generar y dibujar la grilla de bloques.** Poblar `state.bricks` (10×6) con colores por fila y dibujarlos con `drawSprite(ctx, "block_"+color, ...)`. Prueba: se ve la grilla completa arriba.

5. **Loop de juego con `requestAnimationFrame`.** Separar `update()` y `render()`. Por ahora `update` no mueve nada. Prueba: el loop corre (comprobable con un log throttled o un contador).

6. **Control del paddle (mouse + teclado).** Mover `paddle.x` con `mousemove` y con flechas/A-D, clampeando a los bordes del canvas. Prueba: el paddle se mueve con ambos y no se sale.

7. **Pelota pegada y lanzamiento.** Dibujar la pelota; en `phase "ready"` sigue al paddle. Con click o barra espaciadora pasar a `"playing"` y asignar `vx/vy` (hacia arriba). Prueba: la pelota se pega, se lanza y sube.

8. **Rebote en paredes y techo.** Invertir `vx` en bordes laterales y `vy` en el techo, manteniendo magnitud. Prueba: la pelota rebota en las tres paredes indefinidamente.

9. **Rebote en el paddle según posición de impacto.** Al colisionar con el paddle, calcular el ángulo de salida a partir de dónde pegó (centro→vertical, borde→abierto), manteniendo `speed`. Prueba: pegar en distintas zonas del paddle cambia el ángulo de forma predecible.

10. **Colisión con bloques + score.** Detectar impacto pelota-bloque `alive`, marcar `alive: false`, invertir el eje correspondiente y sumar 10 a `score`. Prueba: romper bloques suma puntos y rebota.

11. **Vidas y caída de la pelota.** Si la pelota sale por abajo, restar una vida y volver a `phase "ready"` (pelota pegada). Con 0 vidas → `phase "gameover"`. Prueba: perder la pelota descuenta vida y re-arranca; a las 3 caídas, game over.

12. **Condición de victoria.** Al no quedar bloques `alive`, pasar a `phase "won"`. Prueba: romper los 60 bloques dispara la victoria.

13. **HUD (score + vidas).** Dibujar puntaje y vidas sobre el canvas durante el juego. Prueba: el marcador se actualiza al romper bloques y perder vidas.

14. **Overlay de fin y reinicio.** Mostrar overlay con "Ganaste" o "Game Over" según `phase`; con tecla o click reiniciar `state` (regenerar bloques, vidas=3, score=0, `phase "ready"`) sin recargar. Prueba: ganar/perder muestra overlay y se puede volver a jugar.

## Criterios de aceptación

- [ ] La página carga en el navegador sin errores en consola y muestra un canvas de 800×600.
- [ ] Se ve el paddle abajo y una grilla de 60 bloques (10×6), un color por fila, arriba.
- [ ] El paddle se mueve con el mouse y con las flechas/A-D, y no se sale de los bordes.
- [ ] La pelota arranca pegada al paddle y se lanza con click o barra espaciadora.
- [ ] La pelota rebota en las dos paredes laterales y en el techo sin perder velocidad.
- [ ] Pegar en el borde del paddle abre más el ángulo que pegar en el centro, de forma determinista.
- [ ] Romper un bloque lo hace desaparecer (sin animación) y suma exactamente 10 puntos.
- [ ] El puntaje y las vidas se ven en pantalla y se actualizan en tiempo real.
- [ ] Si la pelota cae por abajo, se pierde una vida y la pelota vuelve a arrancar pegada al paddle.
- [ ] Al llegar a 0 vidas aparece el overlay de "Game Over".
- [ ] Al romper los 60 bloques aparece el overlay de "Ganaste".
- [ ] Desde cualquiera de los dos overlays, una tecla o click reinicia la partida (bloques, 3 vidas, score 0) sin recargar la página.

## Decisiones

- **Sí:** un único archivo `game.js` para toda la lógica del juego. El MVP es chico y no justifica modularizar todavía.
- **No:** dividir en módulos (`paddle.js`, `ball.js`, etc.). Overengineering para el alcance actual; se puede refactorizar en otra spec si crece.
- **Sí:** reusar los globals de `assets/spritesheet.js` (`loadSpritesheet`, `drawSprite`) para todo el dibujado. Es la infraestructura ya provista por el repo.
- **Sí:** rebote en el paddle según posición de impacto (centro→vertical, borde→abierto). Da control al jugador sin dejar de ser determinista.
- **No:** reflexión simple por espejo en el paddle. Es predecible pero no deja controlar el ángulo; le quita gracia al juego.
- **Sí:** pelota pegada al paddle hasta lanzarla con click/espacio. Evita la muerte instantánea al perder una vida.
- **Sí:** magnitud de velocidad constante; el rebote solo cambia la dirección. Física predecible y fácil de razonar.
- **Sí:** estado en un único objeto `state` en memoria, sin persistencia. No hay nada que guardar entre sesiones en el MVP.
- **Sí:** overlay HTML/canvas superpuesto para victoria/derrota, con reinicio sin recargar. Suficiente para el MVP y mejor experiencia que `location.reload()`.
- **No:** pantallas dedicadas de victoria/game over. Un overlay alcanza y evita manejar más estados de pantalla.
- **No:** sonido, explosiones, niveles múltiples, power-ups y persistencia. Todos diferidos a futuras specs para mantener el MVP terminable.
- **Sí:** bloques que se rompen de un solo golpe. Sin resistencia; los bloques con vida múltiple quedan para otra spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La página abierta fuera de la raíz del repo no resuelve `assets/spritesheet-breakout.png` (ruta relativa) y no se dibuja nada. | Servir/abrir desde la raíz del repo (ej. `python -m http.server`). Documentado en `CLAUDE.md`. |
| Con velocidad alta, la pelota puede "atravesar" un bloque o el paddle entre frames (tunneling). | Mantener `speed` moderado en el MVP y hacer la detección de colisión por solapamiento de rectángulos, no solo por punto central. |
| Romper varios bloques en un mismo frame invierte el eje varias veces y produce rebotes raros. | Procesar una sola colisión de bloque por frame (el primero detectado) e invertir el eje una única vez. |

## Lo que **no** entra en esta spec

- Sonido (rebote y rotura).
- Animación de explosión de bloques.
- Múltiples niveles.
- Power-ups.
- Persistencia de high-scores.
- Versión móvil / controles táctiles.
- Bloques con resistencia (más de un golpe).

Cada uno de esos, si aparece, va en su propia spec.

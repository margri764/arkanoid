// game.js — lógica del juego Arkanoid (MVP, spec 01)

// Dimensiones fijas del canvas
const WIDTH = 800;
const HEIGHT = 600;

// Un color por fila (sprites block_<color> del spritesheet)
const ROW_COLORS = ["red", "hotpink", "magenta", "yellow", "cyan", "green"];

// Layout de la grilla de bloques
const COLS = 10;
const ROWS = 6;
const BRICK_W = 72;
const BRICK_H = 20;
const BRICK_PAD = 4;
const GRID_TOP = 50;
const GRID_LEFT = (WIDTH - (COLS * BRICK_W + (COLS - 1) * BRICK_PAD)) / 2;

// Máximo ángulo de rebote en el paddle respecto de la vertical (60°)
const MAX_BOUNCE = (60 * Math.PI) / 180;

// Escala de la explosión sobre el rect del bloque (30% más grande)
const EXPLOSION_SCALE = 1.3;

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

  // 60 bloques (10 col × 6 filas): { x, y, w, h, color, alive }
  bricks: [],

  // Explosiones activas (solo visuales): { x, y, w, h, color, start }
  explosions: [],
};

let ctx = null;

// Teclas de movimiento presionadas
const keys = { left: false, right: false };

// ---------------------------------------------------------------------------
// Inicialización de estado
// ---------------------------------------------------------------------------

// Genera la grilla de 10×6 bloques (un color por fila)
function initBricks() {
  const bricks = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        x: GRID_LEFT + col * (BRICK_W + BRICK_PAD),
        y: GRID_TOP + row * (BRICK_H + BRICK_PAD),
        w: BRICK_W,
        h: BRICK_H,
        color: ROW_COLORS[row],
        alive: true,
      });
    }
  }
  return bricks;
}

// Deja la pelota pegada y centrada sobre el paddle (phase "ready")
function resetBall() {
  const p = state.paddle;
  state.ball.stuck = true;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.x = p.x + p.w / 2;
  state.ball.y = p.y - state.ball.r;
}

// Reinicia toda la partida sin recargar la página
function resetGame() {
  state.phase = "ready";
  state.score = 0;
  state.lives = 3;
  state.paddle.x = (WIDTH - state.paddle.w) / 2;
  state.bricks = initBricks();
  state.explosions = [];
  resetBall();
  hideOverlay();
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

// Lanza la pelota si está lista, o reinicia si estamos en un overlay de fin
function fireOrRestart() {
  if (state.phase === "ready") {
    state.phase = "playing";
    state.ball.stuck = false;
    state.ball.vx = 0;
    state.ball.vy = -state.ball.speed;
  } else if (state.phase === "won" || state.phase === "gameover") {
    resetGame();
  }
}

function setupInput(canvas) {
  // Mouse: el paddle sigue la posición horizontal del cursor
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (WIDTH / rect.width);
    state.paddle.x = clampPaddle(mx - state.paddle.w / 2);
  });

  // Click: lanza o reinicia
  canvas.addEventListener("mousedown", fireOrRestart);

  // Teclado: flechas / A-D para mover; espacio para lanzar/reiniciar
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "Space") {
      e.preventDefault();
      fireOrRestart();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  });
}

// Mantiene el paddle dentro del canvas
function clampPaddle(x) {
  return Math.max(0, Math.min(WIDTH - state.paddle.w, x));
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function update(now) {
  updatePaddle();
  updateExplosions(now);

  if (state.phase === "ready") {
    // La pelota sigue al paddle mientras está pegada
    resetBall();
    return;
  }

  if (state.phase !== "playing") return;

  updateBall(now);
}

function updatePaddle() {
  const p = state.paddle;
  if (keys.left) p.x = clampPaddle(p.x - p.speed);
  if (keys.right) p.x = clampPaddle(p.x + p.speed);
}

// Purga las explosiones que ya cumplieron su duración (independiente de la fase)
function updateExplosions(now) {
  state.explosions = state.explosions.filter(
    (e) => now - e.start < EXPLOSION_DURATION
  );
}

function updateBall(now) {
  const b = state.ball;
  b.x += b.vx;
  b.y += b.vy;

  // Rebote en paredes laterales
  if (b.x - b.r < 0) {
    b.x = b.r;
    b.vx = Math.abs(b.vx);
  } else if (b.x + b.r > WIDTH) {
    b.x = WIDTH - b.r;
    b.vx = -Math.abs(b.vx);
  }

  // Rebote en el techo
  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = Math.abs(b.vy);
  }

  collidePaddle();
  collideBricks(now);

  // Caída por abajo: pierde una vida
  if (b.y - b.r > HEIGHT) {
    loseLife();
  }
}

// Rebote en el paddle según la posición de impacto (centro→vertical, borde→abierto)
function collidePaddle() {
  const b = state.ball;
  const p = state.paddle;
  if (b.vy <= 0) return; // solo cuando baja
  if (
    b.y + b.r >= p.y &&
    b.y - b.r <= p.y + p.h &&
    b.x + b.r >= p.x &&
    b.x - b.r <= p.x + p.w
  ) {
    // Posición relativa de impacto: -1 (borde izq) .. 0 (centro) .. 1 (borde der)
    let rel = (b.x - (p.x + p.w / 2)) / (p.w / 2);
    rel = Math.max(-1, Math.min(1, rel));
    const angle = rel * MAX_BOUNCE;
    b.vx = b.speed * Math.sin(angle);
    b.vy = -b.speed * Math.cos(angle);
    b.y = p.y - b.r; // reubicar arriba del paddle
  }
}

// Colisión con bloques: una sola por frame (el primero detectado)
function collideBricks(now) {
  const b = state.ball;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    if (
      b.x + b.r > brick.x &&
      b.x - b.r < brick.x + brick.w &&
      b.y + b.r > brick.y &&
      b.y - b.r < brick.y + brick.h
    ) {
      brick.alive = false;
      state.score += 10;

      // Encolar la explosión visual en el lugar del bloque roto
      state.explosions.push({
        x: brick.x,
        y: brick.y,
        w: brick.w,
        h: brick.h,
        color: brick.color,
        start: now,
      });

      // Invertir el eje según la menor penetración (por dónde entró)
      const overlapX = Math.min(
        b.x + b.r - brick.x,
        brick.x + brick.w - (b.x - b.r)
      );
      const overlapY = Math.min(
        b.y + b.r - brick.y,
        brick.y + brick.h - (b.y - b.r)
      );
      if (overlapX < overlapY) {
        b.vx = -b.vx;
      } else {
        b.vy = -b.vy;
      }

      if (state.bricks.every((br) => !br.alive)) {
        state.phase = "won";
        showOverlay("¡Ganaste!");
      }
      return; // una sola colisión por frame
    }
  }
}

// Pierde una vida y re-arranca, o dispara game over
function loseLife() {
  state.lives--;
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = "gameover";
    showOverlay("Game Over");
  } else {
    state.phase = "ready";
    resetBall();
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function drawBackground() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawBricks() {
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    drawSprite(ctx, "block_" + brick.color, brick.x, brick.y, brick.w, brick.h);
  }
}

function drawPaddle() {
  const p = state.paddle;
  drawSprite(ctx, "paddle", p.x, p.y, p.w, p.h);
}

function drawBall() {
  const b = state.ball;
  drawSprite(ctx, "ball", b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
}

// Dibuja las explosiones activas: 4 frames por color, centradas y 1.3× más grandes
function drawExplosions(now) {
  for (const e of state.explosions) {
    const frames = EXPLOSION_FRAMES[e.color];
    if (!frames) continue; // color sin animación: saltear defensivamente
    const i = Math.floor((now - e.start) / (EXPLOSION_DURATION / 4));
    if (i < 0 || i > 3) continue;
    const frame = frames[i];
    const S = EXPLOSION_SCALE;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    drawFrame(
      ctx,
      frame,
      cx - (e.w * S) / 2,
      cy - (e.h * S) / 2,
      e.w * S,
      e.h * S
    );
  }
}

// HUD: puntaje y vidas sobre el canvas
function drawHUD() {
  ctx.fillStyle = "#fff";
  ctx.font = "20px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("Puntos: " + state.score, 12, 12);
  ctx.textAlign = "right";
  ctx.fillText("Vidas: " + state.lives, WIDTH - 12, 12);
}

function render(now) {
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  drawExplosions(now);
  drawHUD();
}

// ---------------------------------------------------------------------------
// Overlay (fin de partida)
// ---------------------------------------------------------------------------

function showOverlay(title) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML =
    '<h1 style="font-size:48px;margin:0 0 12px">' + title + "</h1>" +
    '<p style="font-size:22px;margin:0 0 8px">Puntaje: ' + state.score + "</p>" +
    '<p style="font-size:18px;opacity:.8;margin:0">Click o barra espaciadora para jugar de nuevo</p>';
  overlay.style.display = "flex";
}

function hideOverlay() {
  const overlay = document.getElementById("overlay");
  overlay.style.display = "none";
  overlay.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------

function loop(now) {
  update(now);
  render(now);
  requestAnimationFrame(loop);
}

// Arranque: cargar el spritesheet y comenzar el juego
loadSpritesheet(() => {
  const canvas = document.getElementById("game");
  ctx = canvas.getContext("2d");
  state.paddle.x = (WIDTH - state.paddle.w) / 2;
  state.bricks = initBricks();
  resetBall();
  setupInput(canvas);
  requestAnimationFrame(loop);
});

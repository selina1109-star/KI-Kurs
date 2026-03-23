const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const gameOverEl = document.getElementById('gameOver');

const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  Space: false
};

const SHIP_RADIUS = 16;
const MAX_LASER_DISTANCE = 0.65;
const INVULN_MS = 1400;

const ASTEROID_CONFIG = {
  large: { radius: 52, speedMin: 0.6, speedMax: 1.4, points: 20, splitTo: 'medium' },
  medium: { radius: 32, speedMin: 1.0, speedMax: 2.0, points: 50, splitTo: 'small' },
  small: { radius: 18, speedMin: 1.5, speedMax: 2.8, points: 100, splitTo: null }
};

let stars = [];
let ship;
let lasers;
let asteroids;
let score;
let lives;
let gameOver;
let spawnTimer;
let lastTime;

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function wrapPosition(obj) {
  if (obj.x < 0) obj.x += canvas.width;
  if (obj.x > canvas.width) obj.x -= canvas.width;
  if (obj.y < 0) obj.y += canvas.height;
  if (obj.y > canvas.height) obj.y -= canvas.height;
}

function resizeCanvas() {
  const maxW = Math.min(window.innerWidth, 1600);
  const maxH = Math.min(window.innerHeight, 1200);
  canvas.width = Math.max(800, maxW);
  canvas.height = Math.max(600, maxH);
  generateStars();
}

function generateStars() {
  const count = Math.floor((canvas.width * canvas.height) / 6000);
  stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: random(0, canvas.width),
      y: random(0, canvas.height),
      r: random(0.7, 2.2),
      alpha: random(0.3, 0.95)
    });
  }
}

function createShip() {
  ship = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    turnSpeed: 0.08,
    thrustPower: 0.18,
    friction: 0.992,
    canShoot: true,
    invulnerableUntil: 0
  };
}

function randomEdgeSpawn(radius) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: -radius, y: random(0, canvas.height) };
  if (side === 1) return { x: canvas.width + radius, y: random(0, canvas.height) };
  if (side === 2) return { x: random(0, canvas.width), y: -radius };
  return { x: random(0, canvas.width), y: canvas.height + radius };
}

function createAsteroid(size, x, y) {
  const cfg = ASTEROID_CONFIG[size];
  const angle = random(0, Math.PI * 2);
  const speed = random(cfg.speedMin, cfg.speedMax);

  const jitter = [];
  const verts = 11;
  for (let i = 0; i < verts; i += 1) {
    jitter.push(random(0.72, 1.25));
  }

  return {
    size,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: cfg.radius,
    points: cfg.points,
    splitTo: cfg.splitTo,
    jitter
  };
}

function spawnAsteroid(size = 'large') {
  const radius = ASTEROID_CONFIG[size].radius;
  const spawn = randomEdgeSpawn(radius);
  asteroids.push(createAsteroid(size, spawn.x, spawn.y));
}

function shootLaser() {
  if (!ship.canShoot || gameOver) return;

  const speed = 7;
  const laser = {
    x: ship.x + Math.cos(ship.angle) * SHIP_RADIUS,
    y: ship.y + Math.sin(ship.angle) * SHIP_RADIUS,
    vx: Math.cos(ship.angle) * speed + ship.vx * 0.2,
    vy: Math.sin(ship.angle) * speed + ship.vy * 0.2,
    traveled: 0,
    maxDistance: Math.hypot(canvas.width, canvas.height) * MAX_LASER_DISTANCE
  };

  lasers.push(laser);
  ship.canShoot = false;
}

function resetGame() {
  score = 0;
  lives = 3;
  gameOver = false;
  spawnTimer = 0;
  lasers = [];
  asteroids = [];

  createShip();
  for (let i = 0; i < 4; i += 1) {
    spawnAsteroid('large');
  }

  scoreEl.textContent = `Score: ${score}`;
  livesEl.textContent = `Lives: ${lives}`;
  gameOverEl.hidden = true;
}

function destroyAsteroid(index) {
  const asteroid = asteroids[index];
  score += asteroid.points;
  scoreEl.textContent = `Score: ${score}`;

  if (asteroid.splitTo) {
    for (let i = 0; i < 2; i += 1) {
      const child = createAsteroid(asteroid.splitTo, asteroid.x, asteroid.y);
      child.vx += random(-0.8, 0.8);
      child.vy += random(-0.8, 0.8);
      asteroids.push(child);
    }
  }

  asteroids.splice(index, 1);
}

function loseLife() {
  lives -= 1;
  livesEl.textContent = `Lives: ${lives}`;

  if (lives <= 0) {
    gameOver = true;
    gameOverEl.hidden = false;
    return;
  }

  ship.x = canvas.width / 2;
  ship.y = canvas.height / 2;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = -Math.PI / 2;
  ship.invulnerableUntil = performance.now() + INVULN_MS;
}

function updateShip() {
  if (keys.ArrowLeft) ship.angle -= ship.turnSpeed;
  if (keys.ArrowRight) ship.angle += ship.turnSpeed;

  if (keys.ArrowUp) {
    ship.vx += Math.cos(ship.angle) * ship.thrustPower;
    ship.vy += Math.sin(ship.angle) * ship.thrustPower;
  }

  ship.vx *= ship.friction;
  ship.vy *= ship.friction;

  ship.x += ship.vx;
  ship.y += ship.vy;

  wrapPosition(ship);
}

function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i -= 1) {
    const laser = lasers[i];
    laser.x += laser.vx;
    laser.y += laser.vy;
    laser.traveled += Math.hypot(laser.vx, laser.vy);
    wrapPosition(laser);

    if (laser.traveled > laser.maxDistance) {
      lasers.splice(i, 1);
    }
  }
}

function updateAsteroids() {
  for (let i = 0; i < asteroids.length; i += 1) {
    const asteroid = asteroids[i];
    asteroid.x += asteroid.vx;
    asteroid.y += asteroid.vy;
    wrapPosition(asteroid);
  }

  spawnTimer += 1;
  if (spawnTimer > 240 && !gameOver) {
    spawnAsteroid('large');
    spawnTimer = 0;
  }
}

function checkCollisions(now) {
  for (let i = lasers.length - 1; i >= 0; i -= 1) {
    for (let j = asteroids.length - 1; j >= 0; j -= 1) {
      const dx = lasers[i].x - asteroids[j].x;
      const dy = lasers[i].y - asteroids[j].y;
      if (Math.hypot(dx, dy) < asteroids[j].radius) {
        lasers.splice(i, 1);
        destroyAsteroid(j);
        break;
      }
    }
  }

  if (now < ship.invulnerableUntil || gameOver) return;

  for (let i = 0; i < asteroids.length; i += 1) {
    const asteroid = asteroids[i];
    const dx = ship.x - asteroid.x;
    const dy = ship.y - asteroid.y;
    if (Math.hypot(dx, dy) < SHIP_RADIUS + asteroid.radius * 0.85) {
      loseLife();
      break;
    }
  }
}

function drawStars() {
  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i];
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = '#d9ecff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShip(now) {
  const blinking = now < ship.invulnerableUntil && Math.floor(now / 90) % 2 === 0;
  if (blinking) return;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle + Math.PI / 2);
  ctx.strokeStyle = '#b8fff7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -SHIP_RADIUS);
  ctx.lineTo(SHIP_RADIUS * 0.72, SHIP_RADIUS);
  ctx.lineTo(0, SHIP_RADIUS * 0.42);
  ctx.lineTo(-SHIP_RADIUS * 0.72, SHIP_RADIUS);
  ctx.closePath();
  ctx.stroke();

  if (keys.ArrowUp) {
    ctx.strokeStyle = '#ffb46a';
    ctx.beginPath();
    ctx.moveTo(0, SHIP_RADIUS * 0.55);
    ctx.lineTo(0, SHIP_RADIUS * 1.45 + random(-3, 3));
    ctx.stroke();
  }

  ctx.restore();
}

function drawLasers() {
  ctx.fillStyle = '#ff7f7f';
  for (let i = 0; i < lasers.length; i += 1) {
    ctx.beginPath();
    ctx.arc(lasers[i].x, lasers[i].y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAsteroids() {
  ctx.strokeStyle = '#d5d9ff';
  ctx.lineWidth = 2;

  for (let i = 0; i < asteroids.length; i += 1) {
    const asteroid = asteroids[i];
    const verts = asteroid.jitter.length;

    ctx.beginPath();
    for (let v = 0; v < verts; v += 1) {
      const angle = (Math.PI * 2 * v) / verts;
      const r = asteroid.radius * asteroid.jitter[v];
      const px = asteroid.x + Math.cos(angle) * r;
      const py = asteroid.y + Math.sin(angle) * r;

      if (v === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function draw(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();
  drawAsteroids();
  drawLasers();
  drawShip(now);
}

function gameLoop(now) {
  if (!lastTime) lastTime = now;
  lastTime = now;

  if (!gameOver) {
    updateShip();
    updateLasers();
    updateAsteroids();
    checkCollisions(now);
  }

  draw(now);
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    keys.Space = true;
    shootLaser();
    return;
  }

  if (event.key === 'r' || event.key === 'R') {
    resetGame();
    return;
  }

  if (event.key in keys) {
    event.preventDefault();
    keys[event.key] = true;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    keys.Space = false;
    ship.canShoot = true;
    return;
  }

  if (event.key in keys) {
    keys[event.key] = false;
  }
});

window.addEventListener('resize', () => {
  const xRatio = ship ? ship.x / canvas.width : 0.5;
  const yRatio = ship ? ship.y / canvas.height : 0.5;
  resizeCanvas();

  if (ship) {
    ship.x = canvas.width * xRatio;
    ship.y = canvas.height * yRatio;
  }
});

resizeCanvas();
resetGame();
requestAnimationFrame(gameLoop);

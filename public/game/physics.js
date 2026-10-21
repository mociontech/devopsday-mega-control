/* Coordenadas del mundo: x hacia la derecha, y hacia abajo. */
(function (root) {
  'use strict';
  const CONFIG = { width: 1280, height: 720, speed: 330, gravity: 1800, jump: 740, robotHeight: 100, halfWidth: 24, duration: 60, itemPoints: 10 };
  const platforms = [{ x: 0, y: 565, w: 330, sprite: 'start' }];
  const heights = [520, 450, 510, 430, 490, 550];
  for (let i = 0; i < 18; i++) platforms.push({ x: 470 + i * 285, y: heights[i % heights.length], w: 165, sprite: 'base' + (i % 3 + 1) });
  platforms.push({ x: 5600, y: 530, w: 280, sprite: 'base2' });
  const worldWidth = 6100;
  const itemTypes = ['Pincel', 'Control', 'Camara', 'Balon', 'Cerebro'];
  const collectibles = platforms.slice(1, -1).map((p, i) => ({
    id: i, sprite: itemTypes[i % itemTypes.length], x: p.x + p.w / 2, y: p.y - 55, size: 52
  })).filter(item => ![2, 5, 9, 12, 15].includes(item.id)); // 13 objetos × 10 puntos = 130.
  function createState() {
    return { x: 160, y: platforms[0].y, vy: 0, facing: 1, grounded: true, coyote: 0.1, buffer: 0, camera: 0, won: false, lost: false, falls: 0, moving: false, score: 0, collected: [], timeLeft: CONFIG.duration, pickupFlash: 0 };
  }
  function reset(s) { Object.assign(s, createState()); }
  // La misma altura se usa al dibujar y al comprobar la recolección.
  function collectibleY(item, s) {
    return item.y + Math.sin((CONFIG.duration - s.timeLeft) * Math.PI * 2 / 2.4 + item.id * 0.8) * 9;
  }
  function advanceTime(s, seconds) {
    if (s.won || s.lost) return;
    s.timeLeft = Math.max(0, s.timeLeft - Math.max(0, seconds));
    if (s.timeLeft === 0) s.lost = true;
  }
  function step(s, input, dt) {
    if (s.won || s.lost) return;
    s.pickupFlash = Math.max(0, s.pickupFlash - dt);
    const direction = Number(!!input.right) - Number(!!input.left);
    s.moving = direction !== 0;
    if (direction) s.facing = direction;
    s.coyote = s.grounded ? 0.1 : Math.max(0, s.coyote - dt);
    s.buffer = input.jump ? 0.12 : Math.max(0, s.buffer - dt);
    if (s.buffer > 0 && s.coyote > 0) { s.vy = -CONFIG.jump; s.grounded = false; s.coyote = 0; s.buffer = 0; }
    const oldY = s.y;
    s.x = Math.max(CONFIG.halfWidth, Math.min(worldWidth - CONFIG.halfWidth, s.x + direction * CONFIG.speed * dt));
    s.vy += CONFIG.gravity * dt;
    s.y += s.vy * dt;
    s.grounded = false;
    // Solo aterriza al cruzar la superficie desde arriba, nunca al subir.
    if (s.vy >= 0) {
      const hit = platforms.filter(p => s.x + CONFIG.halfWidth > p.x && s.x - CONFIG.halfWidth < p.x + p.w && oldY <= p.y + 0.01 && s.y >= p.y).sort((a,b) => a.y - b.y)[0];
      if (hit) { s.y = hit.y; s.vy = 0; s.grounded = true; if (hit === platforms[platforms.length - 1]) s.won = true; }
    }
    if (s.y - CONFIG.robotHeight > CONFIG.height) { s.lost = true; s.falls++; }
    for (const item of collectibles) {
      if (s.collected.includes(item.id)) continue;
      const radius = item.size / 2;
      const y = collectibleY(item, s);
      if (Math.abs(s.x - item.x) < CONFIG.halfWidth + radius && s.y > y - radius && s.y - CONFIG.robotHeight < y + radius) {
        s.collected.push(item.id);
        s.score += CONFIG.itemPoints;
        s.pickupFlash = 0.7;
      }
    }
    const target = Math.max(0, Math.min(worldWidth - CONFIG.width, s.x - CONFIG.width * 0.36));
    s.camera += (target - s.camera) * (1 - Math.exp(-8 * dt));
  }
  const api = { CONFIG, platforms, collectibles, collectibleY, worldWidth, createState, reset, step, advanceTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlatformGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

const { test } = require('node:test');
const assert = require('node:assert/strict');
// physics.js es un script clásico (en el navegador lo carga <script>); como el proyecto es "type": "module",
// aquí se evalúa con un `module` propio en vez de require().
const fs = require('node:fs');
const path = require('node:path');
const physics = { exports: {} };
new Function('module', fs.readFileSync(path.join(__dirname, '../public/game/physics.js'), 'utf8'))(physics);
const { createState, step, platforms, collectibles, reset, CONFIG, advanceTime } = physics.exports;
const dt = 1 / 120;
test('El robot permanece sobre la base de inicio', () => {
  const s = createState();
  for (let i = 0; i < 240; i++) step(s, {}, dt);
  assert.equal(s.y, platforms[0].y);
  assert.equal(s.grounded, true);
});
test('Un salto sube, no permite doble salto y aterriza', () => {
  const s = createState();
  step(s, { jump: true }, dt);
  for (let i = 0; i < 25; i++) step(s, {}, dt);
  const velocity = s.vy;
  step(s, { jump: true }, dt);
  assert.ok(s.vy > velocity);
  assert.ok(s.y < platforms[0].y);
  for (let i = 0; i < 150; i++) step(s, {}, dt);
  assert.equal(s.y, platforms[0].y);
  assert.equal(s.grounded, true);
});
test('Caer termina la partida sin devolver al inicio; reiniciar limpia el resultado', () => {
  const s = createState();
  s.x = 400;
  s.y = CONFIG.height + 181;
  step(s, {}, dt);
  assert.equal(s.x, 400);
  assert.equal(s.lost, true);
  assert.equal(s.won, false);
  assert.equal(s.falls, 1);
  const ended = { ...s };
  for (let i = 0; i < 120; i++) step(s, { right: true, jump: true }, dt);
  assert.deepEqual(s, ended);
  reset(s);
  assert.equal(s.lost, false);
  assert.equal(s.x, 160);
  assert.equal(s.falls, 0);
});
test('Todas las plataformas se alcanzan en una partida continua', () => {
  const s = createState();
  function play(input) { step(s, input, dt); assert.equal(s.lost, false); }
  for (let i = 1; i < platforms.length; i++) {
    const origin = platforms[i - 1], target = platforms[i];
    const landingX = target.x + target.w / 2;
    while (s.x < origin.x + origin.w - 15) play({ right: true });
    play({ right: true, jump: true });
    let landed = false;
    for (let tick = 0; tick < 180; tick++) {
      play({ right: s.x < landingX });
      assert.equal(s.falls, 0, 'Caída en plataforma ' + i);
      if (s.grounded) { landed = true; break; }
    }
    assert.ok(landed, 'Aterriza en plataforma ' + i);
    assert.equal(s.y, target.y, 'Altura de plataforma ' + i);
    assert.ok(s.x >= target.x && s.x <= target.x + target.w);
  }
  assert.equal(s.won, true);
  assert.equal(s.collected.length, collectibles.length);
  assert.equal(s.score, collectibles.length * CONFIG.itemPoints);
  assert.equal(collectibles.length, 13);
  assert.equal(s.score, 130);
  assert.equal(s.lost, false);
  const ended = { ...s };
  step(s, { right: true, jump: true }, dt);
  assert.deepEqual(s, ended);
  assert.ok(s.camera > 0);
});
test('Los objetos se recogen por contacto una sola vez y se restauran al reiniciar', () => {
  const s = createState(), item = collectibles[0];
  s.x = item.x;
  s.y = item.y - 40;
  step(s, {}, dt);
  assert.equal(s.score, 0, 'No recoge un objeto fuera del cuerpo');
  s.y = platforms[1].y;
  for (let i = 0; i < 120; i++) step(s, {}, dt);
  assert.deepEqual(s.collected, [item.id]);
  assert.equal(s.score, 10);
  advanceTime(s, 12);
  reset(s);
  assert.equal(s.score, 0);
  assert.deepEqual(s.collected, []);
  assert.equal(s.timeLeft, 60);
  assert.equal(new Set(collectibles.map(item => item.sprite)).size, 5);
});
test('La cuenta regresiva termina a los 60 segundos y se detiene al acabar', () => {
  const s = createState();
  advanceTime(s, 59);
  assert.equal(s.timeLeft, 1);
  assert.equal(s.lost, false);
  advanceTime(s, 2);
  assert.equal(s.timeLeft, 0);
  assert.equal(s.lost, true);
  const ended = structuredClone(s);
  step(s, { right: true }, dt);
  advanceTime(s, 10);
  assert.deepEqual(s, ended);
  reset(s);
  s.won = true;
  advanceTime(s, 61);
  assert.equal(s.timeLeft, 60);
  assert.equal(s.lost, false);
});

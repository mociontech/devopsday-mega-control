(() => {
  'use strict';
  const { CONFIG, platforms, collectibles, collectibleY, worldWidth, createState, reset, step, advanceTime } = window.PlatformGame;
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#status');
  const state = createState();
  // El puntaje que ve la persona es el que se guarda en la base y en Evius: los puntos del juego (10 por objeto, 130 con
  // todos) escalados a 0-100. Misma fórmula que escalarPuntaje() en src/player-service.ts.
  const MAX_POINTS = collectibles.length * CONFIG.itemPoints;
  const shown = points => (MAX_POINTS > 0 ? Math.round(Math.min(100, Math.max(0, points / MAX_POINTS * 100))) : 0);
  function resize() {
    // Adapta el campo de visión sin deformar las imágenes.
    CONFIG.width = CONFIG.height * window.innerWidth / window.innerHeight;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * density);
    canvas.height = Math.round(window.innerHeight * density);
    ctx.setTransform(canvas.width / CONFIG.width, 0, 0, canvas.height / CONFIG.height, 0, 0);
    state.camera = Math.max(0, Math.min(worldWidth - CONFIG.width, state.x - CONFIG.width * 0.36));
  }
  window.addEventListener('resize', resize);
  resize();
  const keys = new Set(), pointers = new Map();
  let jumpQueued = false, ready = false, active = false;
  let goalAnimation = 0;
  const GOAL_ANIMATION_SECONDS = 5;
  document.addEventListener('megacontrol:start', () => { restart(); resize(); active = true; });
  document.addEventListener('megacontrol:reset', () => { active = false; restart(); });
  const sources = { background: 'fondo_largo', start: 'base_inicio', base1: 'base_salto1', base2: 'base_salto2', base3: 'base_salto3', idle: 'Quieto', lateral: 'Lateral', up: 'Salto_1', down: 'Salto_2', win: 'Saludo', timer: 'Cronometro', Pincel: 'Pincel', Control: 'Control', Camara: 'Camara', Balon: 'Balon', Cerebro: 'Cerebro' };
  const images = {};
  Object.assign(sources, { goalEnemy1: 'Enemigo_1', goalEnemy2: 'Enemigo_2' });
  const actions = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
  function clearInput() { keys.clear(); pointers.clear(); jumpQueued = false; }
  window.addEventListener('keydown', e => {
    if (!active || state.won) return;
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (actions[e.code]) { e.preventDefault(); if (actions[e.code] === 'jump' && !e.repeat) jumpQueued = true; keys.add(e.code); }
    if (e.code === 'KeyR' && !e.repeat) restart();
    if (e.code === 'KeyF' && !e.repeat) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); pointers.set(e.pointerId, button.dataset.action); if (button.dataset.action === 'jump') jumpQueued = true; });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, e => pointers.delete(e.pointerId));
  }
  function restart() { reset(state); goalAnimation = 0; clearInput(); previous = 0; accumulator = 0; }
  document.querySelector('#restart').addEventListener('click', () => { if (!state.won) restart(); });
  function held(action) { return [...keys].some(k => actions[k] === action) || [...pointers.values()].includes(action); }
  // Recortes de dibujo: alinean la superficie sólida con la colisión,
  // sin modificar las imágenes originales ni contar su halo como suelo.
  const art = {
    start: { sx: 0, sy: 330, sw: 720, sh: 459, left: 0, right: 630, top: 190 },
    base1: { sx: 0, sy: 0, sw: 535, sh: 203, left: 110, right: 425, top: 54 },
    base2: { sx: 0, sy: 0, sw: 536, sh: 342, left: 115, right: 425, top: 95 },
    base3: { sx: 0, sy: 0, sw: 350, sh: 172, left: 48, right: 302, top: 24 }
  };
  function draw() {
    const bg = images.background;
    const bgWidth = bg.width * CONFIG.height / bg.height;
    const bgX = -state.camera / (worldWidth - CONFIG.width) * (bgWidth - CONFIG.width);
    ctx.drawImage(bg, bgX, 0, bgWidth, CONFIG.height);
    ctx.save(); ctx.translate(-state.camera, 0);
    platforms.forEach((p, i) => {
      if (p.x + p.w < state.camera - 200 || p.x > state.camera + CONFIG.width + 200) return;
      const a = art[p.sprite], scale = p.w / (a.right - a.left);
      ctx.drawImage(images[p.sprite], a.sx, a.sy, a.sw, a.sh, p.x - a.left * scale, p.y - a.top * scale, a.sw * scale, a.sh * scale);
      ctx.fillStyle = '#183d60'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
      if (i === 0) ctx.fillText('INICIO', 160, p.y + 95);
    });
    drawGoal();
    for (const item of collectibles) {
      if (state.collected.includes(item.id) || Math.abs(item.x - state.camera - CONFIG.width / 2) > CONFIG.width / 2 + 100) continue;
      const img = images[item.sprite];
      // Pincel incluye márgenes transparentes y su masa visual está a la derecha.
      // Centrar el contenido visible evita que parezca desplazado sobre la base.
      const crop = item.sprite === 'Pincel'
        ? { x: 23, y: 5, w: 256, h: 374, anchorX: 149 }
        : { x: 0, y: 0, w: img.width, h: img.height, anchorX: img.width / 2 };
      const scale = item.size / Math.max(crop.w, crop.h);
      ctx.save();
      ctx.shadowColor = '#67ffff'; ctx.shadowBlur = 12;
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h,
        item.x - crop.anchorX * scale, collectibleY(item, state) - crop.h * scale / 2,
        crop.w * scale, crop.h * scale);
      ctx.restore();
    }
    const sprite = images[state.won ? 'win' : !state.grounded ? (state.vy < 0 ? 'up' : 'down') : state.moving ? 'lateral' : 'idle'];
    const h = CONFIG.robotHeight, w = h * sprite.width / sprite.height;
    ctx.save(); ctx.translate(state.x, state.y); ctx.scale(state.facing, 1); ctx.drawImage(sprite, -w / 2, -h, w, h); ctx.restore();
    if (state.pickupFlash > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, state.pickupFlash * 3);
      ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#e90078';
      const y = state.y - h - 15 - (0.7 - state.pickupFlash) * 35;
      const gained = '+' + (shown(state.score) - shown(state.score - CONFIG.itemPoints));
      ctx.strokeText(gained, state.x, y); ctx.fillText(gained, state.x, y); ctx.restore();
    }
    ctx.restore();
    drawHud();
    const message = state.won ? '¡Ganaste!' : state.lost ? '¡Perdiste!' : `Puntos: ${shown(state.score)}. Objetos: ${state.collected.length} de ${collectibles.length}. Tiempo: ${Math.ceil(state.timeLeft)} segundos.`;
    if (status.textContent !== message) status.textContent = message;
  }
  function drawGoal() {
    const goal = platforms[platforms.length - 1];
    const x = goal.x + goal.w * 0.72;
    const time = CONFIG.duration - state.timeLeft + goalAnimation;
    const spinProgress = Math.max(0, Math.min(1, (goalAnimation - 0.4) / 3.6));
    const transformed = state.won && spinProgress >= 0.5;
    // Se contrae hasta el 4% en el cambio de personaje y vuelve a crecer.
    // La curva suaviza la llegada y la salida del tamaño mínimo.
    const sizeProgress = (1 + Math.cos(spinProgress * Math.PI * 2)) / 2;
    const characterScale = 0.04 + 0.96 * sizeProgress;
    const change = transformed ? 1 : 0;
    const bob = Math.sin(time * 3) * 4;
    ctx.save(); ctx.translate(x, goal.y - bob);
    // Halo y partículas acompañan la transición del rojo al cian.
    if (state.won) {
      ctx.strokeStyle = `rgba(${Math.round(255 * (1 - change))}, ${Math.round(90 + 165 * change)}, ${Math.round(90 + 165 * change)}, 0.8)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -65, 65 + Math.sin(goalAnimation * 5) * 8, 85, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const angle = time * 2 + i * Math.PI / 6;
        ctx.fillStyle = '#a4ffff'; ctx.beginPath();
        ctx.arc(Math.cos(angle) * 75, -65 + Math.sin(angle) * 90, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    function character(img, rotation) {
      const height = 125, width = height * img.width / img.height;
      // Gira sobre su centro, siempre opaco; cambia de aspecto durante la vuelta.
      ctx.save(); ctx.translate(0, -height / 2); ctx.rotate(rotation); ctx.scale(-characterScale, characterScale);
      ctx.drawImage(img, -width / 2, -height / 2, width, height); ctx.restore();
    }
    const enemy = images[Math.floor(time * 4) % 2 ? 'goalEnemy1' : 'goalEnemy2'];
    const rotation = spinProgress * Math.PI * 6;
    character(transformed ? images.win : enemy, rotation);
    ctx.restore();
  }
  function drawHud() {
    ctx.save();
    const scale = Math.min(1, CONFIG.width / 640);
    ctx.scale(scale, scale);
    const width = CONFIG.width / scale;
    ctx.fillStyle = '#ffffffbd'; ctx.beginPath(); ctx.roundRect(24, 28, 245, 76, 18); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#173b63'; ctx.font = 'bold 27px system-ui';
    ctx.fillText(shown(state.score) + ' puntos', 42, 61);
    ctx.font = '16px system-ui'; ctx.fillText(`${state.collected.length} / ${collectibles.length} objetos`, 42, 87);
    ctx.drawImage(images.timer, width - 284, 16, 260, 96.2);
    const seconds = Math.ceil(state.timeLeft);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = seconds <= 10 ? '#ff82b7' : '#c4ffff';
    ctx.fillText(time, width - 112, 76);
    ctx.restore();
  }
  let previous = 0, accumulator = 0;
  function frame(now) {
    if (!previous) previous = now;
    const elapsed = (now - previous) / 1000;
    accumulator += Math.min(elapsed, 0.05); previous = now;
    if (ready && active) {
      // El reloj usa tiempo real, independiente de la tasa de fotogramas.
      advanceTime(state, elapsed);
      while (accumulator >= 1 / 120) { step(state, { left: held('left'), right: held('right'), jump: jumpQueued }, 1 / 120); jumpQueued = false; accumulator -= 1 / 120; }
      if (state.won) {
        clearInput();
        goalAnimation += Math.min(elapsed, 0.05);
        // Mantiene a ambos personajes visibles incluso en pantallas estrechas.
        const goal = platforms[platforms.length - 1];
        const targetX = goal.x + 55;
        state.x += (targetX - state.x) * (1 - Math.exp(-5 * elapsed));
        const camera = Math.max(0, Math.min(worldWidth - CONFIG.width, goal.x + goal.w / 2 - CONFIG.width / 2));
        state.camera += (camera - state.camera) * (1 - Math.exp(-5 * elapsed));
      }
      draw();
      if (state.lost || (state.won && goalAnimation >= GOAL_ANIMATION_SECONDS)) {
        active = false;
        clearInput();
        accumulator = 0;
        // Resultado para el registro de participantes (ver src/player-service.ts). Va antes de 'finish'.
        document.dispatchEvent(new CustomEvent('megacontrol:result', { detail: {
          won: state.won, score: state.score, maxScore: collectibles.length * CONFIG.itemPoints,
          items: state.collected.length, totalItems: collectibles.length,
          timeLeft: state.timeLeft, duration: CONFIG.duration
        } }));
        document.dispatchEvent(new CustomEvent('megacontrol:finish', { detail: state.won ? 'won' : 'lost' }));
      }
    } else accumulator = 0;
    requestAnimationFrame(frame);
  }
  Promise.all(Object.entries(sources).map(([key, name]) => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => { images[key] = img; resolve(); }; img.onerror = () => reject(new Error('No se pudo cargar ' + name + '.webp')); img.src = 'images/' + encodeURIComponent(name) + '.webp';
  }))).then(() => { ready = true; requestAnimationFrame(frame); }).catch(error => { status.className = 'error'; status.textContent = error.message + '. Revisa la carpeta images y recarga.'; });
})();

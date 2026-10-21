// Recorrido completo de Mega Control con la base de datos y Evius SIMULADOS (no se manda nada real).
// Requiere la app arriba (npm run dev) y Playwright global:  PW=$(npm root -g)/playwright node tests/flow.cjs
const { chromium } = require(process.env.PW);
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const leer = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const EVIUS_HOST = new URL(leer('VITE_EVIUS_URL')).hostname;
const EXPERIENCE_ID = leer('VITE_EVIUS_EXPERIENCE_ID');
const OUT = process.env.OUT;

let fallos = 0;
const ok = (c, m) => { console.log(`   ${c ? 'OK ' : 'FALLA'} ${m}`); if (!c) fallos++; };

async function preparar(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const llamadas = []; const evius = []; const externas = []; const errores = [];
  const estado = { jugado: false };
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
  await page.route('**/*', async (r) => {
    const req = r.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (u.hostname === EVIUS_HOST) {
      const body = JSON.parse(req.postData() || '{}');
      evius.push({ ruta: u.pathname.split('/').pop(), body, idem: req.headers()['idempotency-key'] });
      return r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ received: 1, processed: 1, failed: 0, errors: [] }) });
    }
    if (u.hostname.endsWith('supabase.co')) {
      const body = req.postData() ? JSON.parse(req.postData()) : null;
      llamadas.push({ metodo: req.method(), ruta: u.pathname.split('/api')[1], query: u.search, body });
      if (u.pathname.endsWith('/registrar')) {
        if (body.correo === 'repetido@test.co') return r.fulfill({ status: 409, headers: cors, body: JSON.stringify({ error: 'correo_duplicado', mensaje: 'Este correo ya está registrado. Usa tu ID con «digitar ID código».' }) });
        return r.fulfill({ status: 201, headers: cors, body: JSON.stringify({ id: '482-917', nombre: body.nombre }) });
      }
      if (u.pathname.includes('/participante/')) {
        if (u.pathname.endsWith('000-000')) return r.fulfill({ status: 404, headers: cors, body: JSON.stringify({ error: 'no_encontrado', mensaje: 'No' }) });
        // Igual que el servidor: el contacto viaja solo mientras la persona no haya completado la experiencia.
        return r.fulfill({ status: 200, headers: cors, body: JSON.stringify(estado.jugado
          ? { id: '482-917', nombre: 'Ana', lienzo: null, jugado: true }
          : { id: '482-917', nombre: 'Ana', lienzo: null, jugado: false, correo: 'Rescatado@Test.co', celular: '3001112233', empresa: 'Empresa Rescatada' }) });
      }
      if (u.pathname.endsWith('/participacion')) return r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, guardado: true }) });
    }
    if (!/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) externas.push(req.url());
    return r.abort();
  });
  return { page, llamadas, evius, externas, errores, estado };
}

const visible = (page, id) => page.evaluate((i) => !document.getElementById(i).hidden, id);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  console.log('\n== Registro con 4 campos, ID y partida real (se pierde por tiempo)');
  {
    const { page, llamadas, evius, externas, errores } = await preparar(browser);
    await page.goto('http://127.0.0.1:5503/'); await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Registrarme ahora' }).click();
    if (OUT) await page.screenshot({ path: `${OUT}/mc_registro_vacio.png` });

    await page.fill('#player-name', 'Ana Pérez'); await page.fill('#player-phone', '300 12'); await page.fill('#player-company', 'Mocion QA'); await page.fill('#player-email', 'repetido@test.co');
    ok((await page.inputValue('#player-phone')) === '30012', 'el celular solo admite dígitos');
    await page.getByRole('button', { name: 'Comenzar' }).click();
    ok(await visible(page, 'registration'), 'celular de 5 dígitos: no avanza');
    await page.fill('#player-phone', '3001234567');
    await page.getByRole('button', { name: 'Comenzar' }).click(); await page.waitForTimeout(700);
    ok((await page.textContent('#registration .form-error')).includes('ya está registrado'), 'correo repetido: muestra el aviso del servidor');
    if (OUT) await page.screenshot({ path: `${OUT}/mc_registro_error.png` });

    await page.fill('#player-email', 'ANA@Test.co');
    await page.getByRole('button', { name: 'Comenzar' }).click(); await page.waitForTimeout(700);
    ok(await visible(page, 'your-id'), 'registro correcto → "Tu ID único"');
    ok((await page.textContent('#assigned-id-first')) + '-' + (await page.textContent('#assigned-id-last')) === '482-917', 'muestra el ID que devolvió el servidor (482-917)');
    const reg = llamadas.find((l) => l.ruta === '/registrar' && l.body.correo === 'ANA@Test.co');
    ok(reg && reg.body.experiencia === 'mega' && reg.body.celular === '3001234567' && reg.body.empresa === 'Mocion QA' && reg.body.nombre === 'Ana Pérez', 'POST /registrar con nombre, celular, empresa, correo y experiencia mega');
    if (OUT) await page.screenshot({ path: `${OUT}/mc_tu_id.png` });

    ok(evius.length === 1 && evius[0].ruta === 'attendees' && evius[0].body.records[0].email === 'ana@test.co', 'Evius: /attendees con el correo normalizado (la participación espera al resultado)');

    await page.locator('#id-next').click(); await page.waitForTimeout(400);
    ok(await visible(page, 'instructions'), 'Comenzar → instrucciones');
    await page.evaluate(() => { window.PlatformGame.CONFIG.duration = 2; });       // partida de 2 s para la prueba
    await page.locator('#start-game').click(); await page.waitForTimeout(500);
    ok(await visible(page, 'play'), 'Iniciar → juego');
    if (OUT) await page.screenshot({ path: `${OUT}/mc_juego.png` });
    await page.waitForFunction(() => !document.getElementById('lost').hidden, null, { timeout: 8000 });
    ok(true, 'se acaba el tiempo → "Perdiste"');
    await page.waitForTimeout(700);

    const res = llamadas.find((l) => l.ruta === '/participacion');
    ok(!!res && res.body.id === '482-917' && res.body.experiencia === 'mega', 'POST /participacion con el ID y la experiencia mega');
    ok(!!res && Number.isInteger(res.body.puntaje) && res.body.puntaje >= 0 && res.body.puntaje <= 100, `puntaje entero 0-100 (${res && res.body.puntaje})`);
    ok(!!res && res.body.detalles.gano === 0 && res.body.detalles.puntosJuego === 0 && res.body.detalles.objetos === 0, 'detalles: gano 0, puntosJuego, objetos, tiempoRestanteS');
    const exp = evius.find((e) => e.ruta === 'experiences');
    ok(!!exp && exp.body.experienceId === EXPERIENCE_ID && exp.body.records[0].score === res.body.puntaje, 'Evius: /experiences con el experienceId de Mega y el mismo puntaje');
    ok(!!exp && /^exp:/.test(exp.idem), 'Evius: Idempotency-Key exp:');

    await page.waitForFunction(() => !document.getElementById('thanks').hidden, null, { timeout: 9000 });
    ok(true, 'Perdiste → Pantalla final → Gracias');
    await page.keyboard.press('KeyA'); await page.waitForTimeout(400);
    ok(await visible(page, 'welcome'), 'una tecla vuelve a la bienvenida');
    ok((await page.inputValue('#player-name', { timeout: 2000 }).catch(() => '')) === '', 'los formularios quedan limpios');
    ok(externas.length === 0, `ninguna otra petición externa (${externas.length})`);
    ok(errores.length === 0, `sin errores en consola (${JSON.stringify(errores)})`);
    await page.close();
  }

  console.log('\n== Partida ganada: 130 puntos del juego = 100 en la base y en Evius');
  {
    const { page, llamadas, evius } = await preparar(browser);
    await page.goto('http://127.0.0.1:5503/'); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Registrarme ahora' }).click();
    await page.fill('#player-name', 'Luis'); await page.fill('#player-phone', '3009876543'); await page.fill('#player-company', 'X'); await page.fill('#player-email', 'luis@test.co');
    await page.getByRole('button', { name: 'Comenzar' }).click(); await page.waitForTimeout(500);
    await page.locator('#id-next').click(); await page.locator('#start-game').click(); await page.waitForTimeout(300);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('megacontrol:result', { detail: { won: true, score: 130, maxScore: 130, items: 13, totalItems: 13, timeLeft: 20.4, duration: 60 } })));
    await page.waitForTimeout(600);
    const res = llamadas.find((l) => l.ruta === '/participacion');
    ok(res.body.puntaje === 100 && res.body.detalles.gano === 1 && res.body.detalles.puntosJuego === 130 && res.body.detalles.objetos === 13, 'puntaje 100; detalles gano 1, 130 puntos, 13 objetos');
    const exp = evius.find((e) => e.ruta === 'experiences').body.records[0];
    ok(exp.score === 100 && exp.durationMs === 39600, `Evius: score 100 y duración ${exp.durationMs} ms`);
    const mitad = await page.evaluate(() => window.PlayerService && true);
    ok(mitad === true, 'window.PlayerService instalado');
    await page.close();
  }

  console.log('\n== Acceso rápido con un ID existente');
  {
    const { page, llamadas, evius, estado } = await preparar(browser);
    await page.goto('http://127.0.0.1:5503/'); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Registrarme ahora' }).click();
    await page.getByRole('button', { name: 'Digitar ID código' }).click();
    if (OUT) await page.screenshot({ path: `${OUT}/mc_agrega_id.png` });
    await page.fill('#id-first', '000'); await page.fill('#id-last', '000'); await page.getByRole('button', { name: 'Comenzar' }).click(); await page.waitForTimeout(600);
    ok((await page.textContent('#enter-id .form-error')).includes('No encontramos ese ID'), 'ID inexistente: aviso');
    estado.jugado = true;
    await page.fill('#id-first', '482'); await page.fill('#id-last', '917'); await page.getByRole('button', { name: 'Comenzar' }).click(); await page.waitForTimeout(600);
    ok((await page.textContent('#enter-id .form-error')).includes('ya participaste'), 'ID que ya jugó: "Parece que ya participaste en esta experiencia"');
    ok(evius.length === 0, 'ID que ya jugó: no se manda nada a Evius');
    estado.jugado = false;
    await page.getByRole('button', { name: 'Comenzar' }).click(); await page.waitForTimeout(800);
    ok(await visible(page, 'instructions'), 'ID válido → instrucciones');
    ok(llamadas.some((l) => l.ruta.startsWith('/participante/482-917') && l.query === '?experiencia=mega'), 'GET /participante/:id?experiencia=mega');
    const att = evius.find((e) => e.ruta === 'attendees');
    ok(!!att && att.body.records[0].email === 'rescatado@test.co' && att.body.records[0].phone === '3001112233' && att.body.records[0].company === 'Empresa Rescatada', 'Evius: /attendees con el contacto rescatado de la base (correo normalizado, celular y empresa)');
    await page.locator('#start-game').click(); await page.waitForTimeout(300);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('megacontrol:result', { detail: { won: true, score: 65, maxScore: 130, items: 6, totalItems: 13, timeLeft: 30, duration: 60 } })));
    await page.waitForTimeout(700);
    const exp = evius.find((e) => e.ruta === 'experiences');
    ok(!!exp && exp.body.records[0].email === 'rescatado@test.co' && exp.body.records[0].score === 50, 'al terminar: /experiences para el mismo correo con el puntaje (65 de 130 → 50)');
    ok(evius[0].ruta === 'attendees', 'Evius: /attendees fue primero');
    await page.close();
  }

  await browser.close();
  console.log(fallos ? `\n${fallos} verificación(es) fallaron` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
})();

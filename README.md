# Mega Control — DevOps Days Bogotá 2026

Juego de plataformas (entregado por el equipo del juego) con el registro conectado a la base de datos compartida del
evento y a Evius. Vite + TypeScript; el juego son scripts clásicos servidos tal cual.

```bash
npm install
npm run dev        # http://127.0.0.1:5503
npm run build      # tipos + dist/
npm test           # física del juego (node --test)
```

## Recorrido

Bienvenida → Registro → Tu ID → Instrucciones → Juego → Ganaste / Perdiste → Pantalla final → Gracias → Bienvenida.
Con un ID existente: Registro → «digitar ID código» → Ingresar ID → Instrucciones.

- **Registro de 4 campos** (nombre, celular, empresa, correo), con teclado físico. Se arma en HTML (`index.html`,
  estilos al final de `src/styles.css`) con el diseño de Figma; el juego solo traía nombre y correo en una imagen.
- **Un ID por persona** (`321-321`), generado en el servidor y válido en todas las experiencias del evento.
- **Una partida por persona:** si el ID ya terminó Mega Control, el acceso rápido avisa «Parece que ya participaste
  en esta experiencia».

## Cómo se conecta (`src/`)

El juego solo conoce `window.PlayerService` y tres eventos; todo lo demás está en `src/player-service.ts`.

| Del juego | Qué hace la app |
|---|---|
| `PlayerService.register({ name, email, phone, company })` | `POST /registrar` (base) y `/attendees` a Evius en segundo plano |
| `PlayerService.lookup(id)` | `GET /participante/:id?experiencia=mega` |
| evento `megacontrol:result` | puntaje → `POST /participacion` (con cola local y reintentos) y `/experiences` a Evius |

- **Puntaje:** los puntos del juego (10 por objeto, máx. 130) se escalan a **0–100** (`escalarPuntaje`), para pesar igual
  que las demás experiencias en el ranking global. En `detalles` también viajan: ganó, puntos del juego, objetos y tiempo
  restante. Una partida perdida también guarda lo que se alcanzó a recoger.
- **Evius** se envía directo desde la app (`src/lib/evius.ts`), en paralelo a la base y con reintentos; el token queda en el
  código del navegador. Solo se envía si la persona se registró en este equipo (el acceso rápido no devuelve el correo).
  La persona se registra en Evius al inscribirse y su participación (con el puntaje) al terminar la partida.
- Variables (`.env`, ver `.env.example`): `VITE_API_URL` y `VITE_EVIUS_*`. En Netlify, cargarlas como variables del sitio.

**Requiere** la migración `backend/supabase/migrations/20261021_003_memory_match.sql` y la función `api` redesplegada
(`registrar_resultado`, marca de "ya jugó"). Sin ellas el registro funciona pero el resultado no se guarda en la base.

## Cambios sobre el juego original

El juego original está intacto salvo esto (por si llega una versión nueva, son los únicos puntos a reaplicar):

| Archivo | Cambio |
|---|---|
| `public/game/game.js` | Imágenes desde `images/*.webp` (antes `Public/Images/*.png`); fondo `fondo_largo`; evento nuevo `megacontrol:result` con puntos, objetos y tiempo, justo antes de `megacontrol:finish`. |
| `public/game/journey.js` | El registro lee y valida 4 campos (celular de 10 dígitos, empresa) y los pasa a `PlayerService.register`. |
| `index.html` | La sección de registro es HTML (4 campos); las demás pantallas siguen siendo sus imágenes. Scripts desde `/game/`. |
| `player-service.js` | Reemplazado por `src/player-service.ts`. |
| `tests/physics.test.cjs` | Carga `physics.js` con un `module` propio (el proyecto es ESM). |

Las imágenes pasaron de 58.6 MB a 2.5 MB (WebP). El fondo largo (22 000 px, WebP admite 16 383) se redujo a 1 296 px de
alto; las bases y los objetos conservan sus dimensiones porque `game.js` los recorta por píxeles. Se dejó fuera `Golpe.png`
(el juego no lo usa) y `Registro.png` (reemplazado por el registro HTML).

## Pendientes

- `Pantalla_Final` trae impreso «130 puntos» en la imagen: no cambia con la partida (necesita un diseño con cifra dinámica).
- El instructivo habla de «juego en pareja»; el juego actual es de un jugador (viene así del equipo del juego).
- `GAME-README.md` y `GAME-INTEGRATION.md` son los documentos originales del juego (referencia).

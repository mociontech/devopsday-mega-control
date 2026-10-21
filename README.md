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
| `PlayerService.register({ name, email, phone, company })` | `POST /api/registrar` |
| `PlayerService.lookup(id)` | `GET /api/participante/:id` |
| evento `megacontrol:result` | puntaje → `POST /api/participacion` (con cola local y reintentos) |

- **Puntaje:** los puntos del juego (10 por objeto, máx. 130) se escalan a **0–100** (`escalarPuntaje`), para pesar igual
  que las demás experiencias en el ranking global. En `detalles` también viajan: ganó, puntos del juego, objetos y tiempo
  restante. Una partida perdida también guarda lo que se alcanzó a recoger.
- **Una sola partida, un solo puntaje:** el control gigante lo manejan dos personas, pero cuenta como una participación
  (un ID). El tope es 100 en la app y en la base.

## Servidor propio (`server/`)

Este proyecto es **autónomo**: trae su propio servidor y sus propias variables de entorno. Lo único compartido con las
otras experiencias es la **base de datos** (Supabase, mismas tablas); el código no se comparte, se replica.

- `server/registros.ts`: todo el acceso a datos (base + Evius). La experiencia (`mega`) es la única línea que cambia entre proyectos.
- `server/handler.ts`: la API (`POST /api/registrar`, `GET /api/participante/:id`, `POST /api/participacion`).
- El navegador solo habla con `/api/*` del mismo origen; **las claves nunca llegan al navegador**.
- El ID (`321-321`) lo genera la base. Un correo ya registrado devuelve el ID de esa persona (no se duplica).
- El acceso rápido devuelve solo el nombre. El servidor lee el contacto de la base y registra a la persona en Evius
  (`/attendees` y luego `/experiences`); si Evius falla, queda pendiente en la base y se reintenta con espera creciente.
- Es una experiencia **local**: `npm start` compila y arranca `server/local.ts`, que sirve la app y `/api/*` en
  http://127.0.0.1:5503 y reintenta lo pendiente hacia Evius cada 30 s. Requiere Node 22.18 o superior (ejecuta TypeScript directo).

Variables (`.env` local o panel del hosting; ver `.env.example`):

| Variable | Para qué |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base compartida. La clave de servicio (secret key) va **solo** en el servidor. |
| `EVIUS_MODE` | `live` activa el envío a Evius; con cualquier otro valor no se manda nada. |
| `EVIUS_URL`, `EVIUS_TOKEN`, `EVIUS_EVENT_ID`, `EVIUS_EXPERIENCE_ID`, `EVIUS_SOURCE` | Evius (Datahub). |

**Requiere** que la migración `backend/supabase/migrations/20261021_003_autonomo.sql` esté aplicada en Supabase.

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
- `GAME-README.md` y `GAME-INTEGRATION.md` son los documentos originales del juego (referencia).

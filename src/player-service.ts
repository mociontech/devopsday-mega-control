/**
 * Adaptador entre el juego y el registro de participantes (ver GAME-INTEGRATION.md).
 *
 * El juego solo conoce `window.PlayerService` y tres eventos; todo lo demás (servidor del proyecto, base compartida,
 * Evius, reintentos) vive fuera del juego:
 *
 *   register({ name, email, phone, company })  → { id, name, email }   registro nuevo
 *   lookup(id)                                  → { id, name }          acceso rápido con un ID existente
 *   intentos()                                  → { restantes, mejor }  intentos que le quedan a la persona y su mejor puntaje
 *   'megacontrol:start'  { player }                                      arranca la partida
 *   'megacontrol:result' { won, score, maxScore, items, timeLeft, ... }  termina la partida (antes de 'finish')
 *   'megacontrol:reset'                                                  vuelve a la bienvenida
 */
import { Registros, mensajeDe, type DatosRegistro } from "./lib/api";
import { enqueueResultado } from "./lib/outbox";

interface PlayerServiceAPI {
  register(datos: { name: string; email: string; phone: string; company: string }): Promise<{ id: string; name: string; email: string }>;
  lookup(id: string): Promise<{ id: string; name: string }>;
  /** Intentos que le quedan a la persona actual (de 3) y su mejor puntaje (0-100), o null si aún no ha jugado. */
  intentos(): { restantes: number; mejor: number | null };
}

declare global {
  interface Window {
    PlayerService: PlayerServiceAPI;
  }
}

interface ResultadoJuego {
  won: boolean;
  score: number;
  maxScore: number;
  items: number;
  timeLeft: number;
  duration: number;
}

/** Los puntos del juego (0 a maxScore, p. ej. 130) se escalan a 0-100 para pesar igual que las demás experiencias. */
export function escalarPuntaje(score: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0;
  return Math.round(Math.min(100, Math.max(0, (score / maxScore) * 100)));
}

export function instalarPlayerService(): void {
  let jugador: { id: string } | null = null;
  // Intentos de la persona actual. Lo confirma la base; aquí se lleva la cuenta para decidir la pantalla siguiente sin esperar la red.
  let restantes = 0;
  let mejor: number | null = null;

  window.PlayerService = {
    async register({ name, email, phone, company }) {
      const datos: DatosRegistro = { nombre: name, celular: phone, empresa: company, correo: email };
      try {
        const persona = await Registros.guardar(datos);
        restantes = persona.intentosRestantes;
        mejor = persona.mejor;
        return { id: persona.id, name: persona.nombre, email };
      } catch (e) {
        throw new Error(mensajeDe(e));
      }
    },

    async lookup(id) {
      let persona;
      try {
        persona = await Registros.buscarPorId(id);
      } catch (e) {
        throw new Error(mensajeDe(e));
      }
      if (!persona) throw new Error("No encontramos ese ID. Revísalo e inténtalo de nuevo.");
      if (persona.jugado) throw new Error("Ya usaste tus 3 intentos en esta experiencia. ¡Gracias por participar!");
      restantes = persona.intentosRestantes;
      mejor = persona.mejor;
      return { id: persona.id, name: persona.nombre };
    },

    intentos: () => ({ restantes, mejor }),
  };

  document.addEventListener("megacontrol:start", (event) => {
    const { player } = (event as CustomEvent<{ player: { id: string } | null }>).detail;
    jugador = player;
  });
  document.addEventListener("megacontrol:reset", () => {
    jugador = null;
    restantes = 0;
    mejor = null;
  });

  document.addEventListener("megacontrol:result", (event) => {
    const r = (event as CustomEvent<ResultadoJuego>).detail;
    const puntaje = escalarPuntaje(r.score, r.maxScore);
    // Cuenta el intento y se queda con el mejor puntaje.
    restantes = Math.max(0, restantes - 1);
    mejor = mejor === null ? puntaje : Math.max(mejor, puntaje);
    const unidad = (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`;
    // Pantalla final: el puntaje de ESTA partida. Pantalla de agradecimiento: el MEJOR de sus intentos. Los dos son los
    // que se guardan (las imágenes traen un "130 puntos" fijo que se tapa).
    const marcador = document.getElementById("final-score");
    if (marcador) marcador.textContent = unidad(puntaje);
    const gracias = document.getElementById("thanks-score");
    if (gracias) gracias.textContent = unidad(mejor).toUpperCase();
    if (!jugador) return;
    const { id } = jugador;

    // A la base: se guarda local primero y se reintenta. La clave identifica la partida: si el envío se repite no gasta otro intento.
    enqueueResultado({
      id,
      clave: crypto.randomUUID(),
      puntaje,
      detalles: {
        gano: r.won ? 1 : 0,
        puntosJuego: r.score,
        objetos: r.items,
        tiempoRestanteS: Math.round(r.timeLeft),
      },
    });

    // El servidor guarda el resultado en la base y lo manda a Evius (con reintentos): aquí no hace falta nada más.
  });
}

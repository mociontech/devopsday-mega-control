/**
 * Adaptador entre el juego y el registro de participantes (ver GAME-INTEGRATION.md).
 *
 * El juego solo conoce `window.PlayerService` y tres eventos; todo lo demás (base de datos compartida, Evius,
 * reintentos) vive aquí:
 *
 *   register({ name, email, phone, company })  → { id, name, email }   registro nuevo
 *   lookup(id)                                  → { id, name }          acceso rápido con un ID existente
 *   'megacontrol:start'  { player }                                      arranca la partida
 *   'megacontrol:result' { won, score, maxScore, items, timeLeft, ... }  termina la partida (antes de 'finish')
 *   'megacontrol:reset'                                                  vuelve a la bienvenida
 */
import { Registros, mensajeDe, type DatosRegistro } from "./lib/api";
import { contactoDe, enviarEvius, recordarContacto, registrarContactoEnEvius } from "./lib/evius";
import { enqueueResultado } from "./lib/outbox";

interface PlayerServiceAPI {
  register(datos: { name: string; email: string; phone: string; company: string }): Promise<{ id: string; name: string; email: string }>;
  lookup(id: string): Promise<{ id: string; name: string }>;
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

  window.PlayerService = {
    async register({ name, email, phone, company }) {
      const datos: DatosRegistro = { nombre: name, celular: phone, empresa: company, correo: email };
      try {
        const persona = await Registros.guardar(datos);
        // Supabase ya confirmó el registro: lo mismo va a Evius en segundo plano (con cola y reintentos).
        // La participación se envía al terminar la partida, con su puntaje.
        const contacto = { email, fullName: name, phone, company };
        recordarContacto(persona.id, contacto);
        enviarEvius(contacto);
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
      if (persona.jugado) throw new Error("Parece que ya participaste en esta experiencia. ¡Gracias!");
      // La persona ya estaba registrada: se rescata su contacto de la base para mandarla a Evius.
      // La participación (con el puntaje) se envía al terminar la partida.
      registrarContactoEnEvius(persona.id, persona.nombre, persona.contacto);
      return { id: persona.id, name: persona.nombre };
    },
  };

  document.addEventListener("megacontrol:start", (event) => {
    const { player } = (event as CustomEvent<{ player: { id: string } | null }>).detail;
    jugador = player;
  });
  document.addEventListener("megacontrol:reset", () => {
    jugador = null;
  });

  document.addEventListener("megacontrol:result", (event) => {
    const r = (event as CustomEvent<ResultadoJuego>).detail;
    if (!jugador) return;
    const { id } = jugador;
    const puntaje = escalarPuntaje(r.score, r.maxScore);

    // A la base: se guarda local primero y se reintenta; idempotente en el servidor.
    enqueueResultado({
      id,
      puntaje,
      detalles: {
        gano: r.won ? 1 : 0,
        puntosJuego: r.score,
        objetos: r.items,
        tiempoRestanteS: Math.round(r.timeLeft),
      },
    });

    // A Evius, en paralelo y en segundo plano. El contacto viene del registro (o se rescató de la base al entrar con ID).
    const contacto = contactoDe(id);
    if (contacto) enviarEvius(contacto, { score: puntaje, durationMs: Math.round((r.duration - r.timeLeft) * 1000) });
  });
}

/* Registros (base de datos compartida)
 *
 * Punto único de integración con el backend. Las experiencias del evento hablan con la misma función de servidor:
 * el ID (321-321) lo genera el servidor y sirve en todas. Aquí no hay claves ni tokens.
 *
 *   guardar(datos)            → { id, nombre }               POST /registrar
 *   buscarPorId(id)           → { id, nombre, jugado } | null GET  /participante/:id
 *   guardarResultado(result)  → void                          POST /participacion (idempotente)
 */

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || "https://jvhxghykvifkggekcdvi.supabase.co/functions/v1/api";

const EXPERIENCIA = "mega" as const;

export const MSG_RED = "No hay conexión con el servidor. Revisa internet e inténtalo de nuevo.";

export interface Persona {
  id: string;
  nombre: string;
}

export interface PersonaConsultada extends Persona {
  /** Ya terminó una partida de Mega Control: no puede repetir. */
  jugado: boolean;
  /** Contacto guardado (solo si aún no completó esta experiencia): sirve para registrarla en Evius. */
  contacto?: { correo?: string; celular?: string; empresa?: string };
}

export interface DatosRegistro {
  nombre: string;
  celular: string;
  empresa: string;
  correo: string;
}

export interface Resultado {
  id: string;
  /** 0-100, entero (los puntos del juego, escalados). */
  puntaje: number;
  detalles: Record<string, number>;
}

export class ErrorApi extends Error {
  codigo: string;
  constructor(mensaje: string, codigo = "interno") {
    super(mensaje);
    this.codigo = codigo;
  }
}

/** true si el error es de conexión (vale la pena reintentar); false si el servidor rechazó la solicitud. */
export const esErrorDeRed = (e: unknown) => e instanceof ErrorApi && (e.codigo === "red" || e.codigo === "interno");

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const ctl = new AbortController();
  const corte = setTimeout(() => ctl.abort(), 12000);
  let res: Response;
  try {
    // El GET no lleva cabeceras propias: así el navegador se ahorra la petición previa (preflight).
    res = await fetch(
      API_URL + ruta,
      cuerpo === undefined
        ? { signal: ctl.signal }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), signal: ctl.signal },
    );
  } catch {
    throw new ErrorApi(MSG_RED, "red");
  } finally {
    clearTimeout(corte);
  }

  let datos: { mensaje?: string; error?: string } | null = null;
  try {
    datos = await res.json();
  } catch {
    /* sin cuerpo */
  }
  if (!res.ok) {
    throw new ErrorApi(datos?.mensaje || "No pudimos completar la solicitud. Inténtalo de nuevo.", datos?.error || "interno");
  }
  return datos as T;
}

// Si el envío se repite (respuesta perdida) se reutiliza la misma clave y el servidor no duplica.
let envio: { huella: string; idem: string } | null = null;

export const Registros = {
  async guardar(datos: DatosRegistro): Promise<Persona> {
    const huella = JSON.stringify(datos);
    if (!envio || envio.huella !== huella) envio = { huella, idem: crypto.randomUUID() };
    const r = await pedir<Persona>("/registrar", { ...datos, experiencia: EXPERIENCIA, idem: envio.idem });
    envio = null;
    return { id: r.id, nombre: r.nombre };
  },

  async buscarPorId(id: string): Promise<PersonaConsultada | null> {
    try {
      const r = await pedir<{ id: string; nombre: string; jugado?: boolean; correo?: string; celular?: string; empresa?: string }>(
        `/participante/${encodeURIComponent(id)}?experiencia=${EXPERIENCIA}`,
      );
      const contacto = r.correo ? { correo: r.correo, celular: r.celular, empresa: r.empresa } : undefined;
      return { id: r.id, nombre: r.nombre, jugado: r.jugado === true, contacto };
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === "no_encontrado") return null;
      throw e;
    }
  },

  /** Idempotente en el servidor: solo cuenta la primera vez, así que reintentar es seguro. */
  async guardarResultado(resultado: Resultado): Promise<void> {
    await pedir("/participacion", { ...resultado, experiencia: EXPERIENCIA });
  },
};

/** Convierte cualquier fallo en un mensaje para la persona. */
export const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? e.message : MSG_RED);

/* Registros (base de datos compartida)
 *
 * Punto único de integración con el backend. Las 3 experiencias hablan con la misma función de servidor:
 * el ID (321-321) lo genera el servidor y sirve en las 3. Aquí no hay claves ni tokens.
 *
 *   guardar(datos)           → { id, nombre }          POST /registrar
 *   buscarPorId(id, exp)     → { id, nombre } | null   GET  /participante/:id
 *   actualizar(id, {lienzo}) → true                    POST /participacion
 */

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || "https://jvhxghykvifkggekcdvi.supabase.co/functions/v1/api";

export const MSG_RED = "No hay conexión con el servidor. Revisa internet e inténtalo de nuevo.";

export type ExperienciaApi = "vr" | "laser" | "mega";

export interface Persona {
  id: string;
  nombre: string;
  lienzo?: string | null;
}

export interface DatosRegistro {
  nombre: string;
  celular: string;
  empresa: string;
  correo: string;
  experiencia: ExperienciaApi;
}

export class ErrorApi extends Error {
  codigo: string;
  constructor(mensaje: string, codigo = "interno") {
    super(mensaje);
    this.codigo = codigo;
  }
}

// Si el envío se repite (respuesta perdida) se reutiliza la misma clave y el servidor no duplica.
let envio: { huella: string; idem: string } | null = null;

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

export const Registros = {
  async guardar(datos: DatosRegistro): Promise<Persona> {
    const huella = JSON.stringify(datos);
    if (!envio || envio.huella !== huella) envio = { huella, idem: crypto.randomUUID() };
    const r = await pedir<{ id: string; nombre: string }>("/registrar", { ...datos, idem: envio.idem });
    envio = null;
    return { id: r.id, nombre: r.nombre };
  },

  async buscarPorId(id: string, experiencia: ExperienciaApi): Promise<Persona | null> {
    try {
      const r = await pedir<{ id: string; nombre: string; lienzo: string | null }>(
        `/participante/${encodeURIComponent(id)}?experiencia=${encodeURIComponent(experiencia)}`,
      );
      return { id: r.id, nombre: r.nombre, lienzo: r.lienzo };
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === "no_encontrado") return null;
      throw e;
    }
  },

  async actualizar(id: string, { lienzo }: { lienzo: string }): Promise<true> {
    await pedir("/participacion", { id, experiencia: "laser", lienzo });
    return true;
  },
};

/** Convierte cualquier fallo en un mensaje para la persona. */
export const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? e.message : MSG_RED);

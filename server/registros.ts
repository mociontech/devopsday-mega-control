/**
 * Registros: TODO el acceso a datos de esta experiencia (base compartida de DevOps Days Bogotá 2026 + Evius).
 *
 * Este proyecto es autónomo: este archivo corre en SU servidor (función de Netlify o servidor Node local) y es el
 * único que conoce las claves. El navegador nunca las ve. Lo único compartido entre proyectos es la base
 * (Supabase); el código se replica copiando esta carpeta `server/` y cambiando SOLO la línea EXPERIENCIA.
 *
 * Variables de entorno (panel de Netlify o .env local; ver .env.example):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   EVIUS_MODE=live (si no, no se envía nada), EVIUS_URL, EVIUS_TOKEN, EVIUS_EVENT_ID, EVIUS_EXPERIENCE_ID, EVIUS_SOURCE
 */

export type Experiencia = "vr" | "laser" | "mega" | "memory" | "insta";

/** La única línea que cambia entre proyectos. */
export const EXPERIENCIA: Experiencia = "mega";

const env = (k: string, def = ""): string => process.env[k] ?? def;

/* ------------------------------------------------------------------ */
/* Base de datos (Supabase, solo funciones RPC con la clave de servicio) */
/* ------------------------------------------------------------------ */

export class ErrorBase extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

async function rpc<T>(funcion: string, args: Record<string, unknown>): Promise<T> {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const clave = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !clave) throw new ErrorBase("configuracion", "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.");

  const res = await fetch(`${base}/rest/v1/rpc/${funcion}`, {
    method: "POST",
    // Las claves nuevas (sb_secret_…) viajan solo en `apikey`; las antiguas (JWT) también en Authorization.
    headers: { "Content-Type": "application/json", apikey: clave, ...(clave.startsWith("eyJ") ? { Authorization: `Bearer ${clave}` } : {}) },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10_000),
  });
  const texto = await res.text();
  if (!res.ok) {
    let mensaje = texto.slice(0, 200);
    try {
      mensaje = (JSON.parse(texto) as { message?: string }).message ?? mensaje;
    } catch {
      /* cuerpo no JSON */
    }
    throw new ErrorBase(mensaje.includes("ids_agotados") ? "ids_agotados" : "base", `${funcion} -> HTTP ${res.status}: ${mensaje}`);
  }
  return (texto ? JSON.parse(texto) : null) as T;
}

export interface DatosRegistro {
  nombre: string;
  celular: string;
  empresa: string;
  correo: string;
  idem: string;
}

export interface PersonaRegistrada {
  id: string;
  nombre: string;
  /** Ya no le quedan intentos en esta experiencia. */
  jugado: boolean;
  /** Intentos que le quedan (Mega Control: 3 en total; las demás experiencias: 1). */
  intentosRestantes: number;
  /** Su mejor puntaje hasta ahora, o null si aún no ha jugado. */
  mejor: number | null;
  /** El correo ya estaba registrado: se devolvió el ID de esa persona. */
  existente: boolean;
  usados?: number;
}

export async function registrar(d: DatosRegistro): Promise<PersonaRegistrada> {
  const r = await rpc<{ id: string; nombre: string; jugado: boolean; intentosRestantes?: number; mejor?: number | null; repetido: boolean; usados?: number }>("registrar_participante", {
    p_nombre: d.nombre,
    p_celular: d.celular,
    p_empresa: d.empresa,
    p_correo: d.correo,
    p_experiencia: EXPERIENCIA,
    p_idem: d.idem,
  });
  return {
    id: r.id, nombre: r.nombre, jugado: r.jugado === true, intentosRestantes: r.intentosRestantes ?? 1, mejor: r.mejor ?? null,
    existente: r.repetido === true, usados: r.usados,
  };
}

export interface PersonaConsultada {
  nombre: string;
  lienzo: string | null;
  jugado: boolean;
  intentosRestantes: number;
  mejor: number | null;
}

/** Acceso rápido: solo lo mínimo para entrar. Deja registrada la participación. null si el ID no existe. */
export async function entrar(id: string): Promise<PersonaConsultada | null> {
  const r = await rpc<{ nombre: string; lienzo: string | null; jugado: boolean; intentosRestantes?: number; mejor?: number | null } | null>("entrar_participante", {
    p_id: id,
    p_experiencia: EXPERIENCIA,
  });
  return r ? { nombre: r.nombre, lienzo: r.lienzo ?? null, jugado: r.jugado === true, intentosRestantes: r.intentosRestantes ?? 1, mejor: r.mejor ?? null } : null;
}

/** Láser Grafiti: guarda el lienzo elegido. false si la persona no tiene participación. */
export async function guardarLienzo(id: string, lienzo: string): Promise<boolean> {
  return (await rpc<boolean>("actualizar_lienzo", { p_id: id, p_lienzo: lienzo })) === true;
}

/**
 * Guarda una partida (0-100). Cuenta como un intento y deja el MEJOR puntaje. `clave` identifica la partida: si el mismo
 * envío se repite (respuesta perdida) no gasta otro intento. null si la persona no existe.
 */
export async function guardarResultado(
  id: string, puntaje: number, detalles: Record<string, number>, clave?: string,
): Promise<{ guardado: boolean; intentosRestantes: number; mejor: number | null } | null> {
  const r = await rpc<{ guardado: boolean; intentosRestantes?: number; mejor?: number | null } | null>("registrar_resultado", {
    p_id: id,
    p_experiencia: EXPERIENCIA,
    p_puntaje: puntaje,
    p_detalles: detalles,
    p_clave: clave ?? null,
  });
  return r ? { guardado: r.guardado === true, intentosRestantes: r.intentosRestantes ?? 0, mejor: r.mejor ?? null } : null;
}

/* ------------------------------------------------------------------ */
/* Evius (Datahub)                                                     */
/* ------------------------------------------------------------------ */
// Lotes { eventId, source, sentAt, records } con `Idempotency-Key`; el éxito se decide por el CUERPO
// (failed === 0 y processed >= records.length) porque la API responde 200 aunque algunos registros fallen.
// Orden: primero /attendees (la persona, identificada por correo) y luego /experiences.
// La cola vive en la base (participaciones sin evius_enviado_en): si Evius falla queda pendiente y se reintenta con
// espera creciente desde el siguiente envío o desde el reintento programado. [CONFIRMAR contra dev] los campos.

const evius = () => ({
  activo: env("EVIUS_MODE") === "live",
  url: env("EVIUS_URL").replace(/\/$/, ""),
  token: env("EVIUS_TOKEN"),
  eventId: env("EVIUS_EVENT_ID"),
  experienceId: env("EVIUS_EXPERIENCE_ID"),
  source: env("EVIUS_SOURCE", "devopsdays-bogota-2026"),
});

async function huella(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function enviarLote(ruta: string, extra: Record<string, unknown>, records: unknown[], idem: string): Promise<void> {
  const c = evius();
  const res = await fetch(`${c.url}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}`, "Idempotency-Key": idem },
    body: JSON.stringify({ eventId: c.eventId, source: c.source, sentAt: new Date().toISOString(), ...extra, records }),
    signal: AbortSignal.timeout(15_000),
  });
  const texto = await res.text();
  const breve = texto.slice(0, 200).replace(/\s+/g, " ");
  if (!res.ok) throw new Error(`POST ${ruta} -> HTTP ${res.status}: ${breve}`);

  let cuerpo: { processed?: number; failed?: number; errors?: string[] };
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    throw new Error(`POST ${ruta} -> respuesta no es JSON: ${breve}`);
  }
  const errores = cuerpo.errors ?? [];
  if ((cuerpo.failed ?? 0) > 0 || errores.length > 0 || (cuerpo.processed ?? 0) < records.length) {
    throw new Error(`POST ${ruta} -> rechazado: ${errores.join("; ") || breve}`.slice(0, 300));
  }
}

/** Detalles de la partida con los nombres que lleva Evius (los de la base están en español). */
const NOMBRES_EVIUS: Record<string, string> = {
  intentos: "attempts",
  duracionMs: "durationMs",
  parejas: "pairs",
  gano: "won",
  puntosJuego: "gamePoints",
  objetos: "items",
  tiempoRestanteS: "timeLeftSeconds",
};

function nombresEvius(detalles: Record<string, unknown> | null): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detalles ?? {})) r[NOMBRES_EVIUS[k] ?? k] = v;
  return r;
}

interface Pendiente {
  participacion_id: number;
  participante_id: string;
  lienzo: string | null;
  puntaje: number | null;
  detalles: Record<string, unknown> | null;
  jugado_en: string;
  nombre: string;
  celular: string;
  empresa: string;
  correo: string;
  asistente_enviado: boolean;
}

export interface ResultadoEnvio {
  omitido?: string;
  reclamados?: number;
  enviados?: number;
  fallidos?: number;
}

let enCurso = false;

/**
 * Envía a Evius lo pendiente de ESTA experiencia. No lanza: devuelve un resumen. Seguro de llamar varias veces
 * (la base da candado y espera creciente por participación).
 */
export async function enviarPendientes(limite = 25): Promise<ResultadoEnvio> {
  const c = evius();
  if (!c.activo) return { omitido: "evius_apagado" };
  if (!c.url || !c.token || !c.eventId || !c.experienceId) return { omitido: "evius_sin_configurar" };
  if (enCurso) return { omitido: "en_curso" };
  enCurso = true;
  try {
    const filas = (await rpc<Pendiente[] | null>("evius_reclamar", { p_limite: limite, p_experiencia: EXPERIENCIA })) ?? [];
    if (!filas.length) return { reclamados: 0, enviados: 0, fallidos: 0 };

    const marcarError = async (f: Pendiente, e: unknown) => {
      try {
        await rpc("evius_marcar_error", { p_participacion: f.participacion_id, p_mensaje: e instanceof Error ? e.message : String(e) });
      } catch {
        /* si tampoco se puede anotar, el candado de la base ya espaciará el reintento */
      }
    };

    // 1) Personas que Evius aún no conoce.
    const nuevas = [...new Map(filas.filter((f) => !f.asistente_enviado).map((f) => [f.participante_id, f])).values()];
    if (nuevas.length) {
      try {
        await enviarLote(
          "/attendees",
          {},
          nuevas.map((f) => ({
            email: f.correo.toLowerCase(),
            fullName: f.nombre,
            phone: f.celular,
            company: f.empresa,
            // El ID de la base (321-321): el mismo en todas las experiencias de la persona.
            participantId: f.participante_id,
          })),
          `att:${c.eventId}:${await huella(nuevas.map((f) => f.participante_id).sort().join(","))}`,
        );
      } catch (e) {
        for (const f of filas) await marcarError(f, e);
        return { reclamados: filas.length, enviados: 0, fallidos: filas.length };
      }
    }

    // 2) Su participación en esta experiencia.
    // Todo lo que guarda la base de esta participación. Evius identifica a la persona por el correo y aquí van además su ID
    // y el de la participación: si hace dos o más experiencias, todas llegan con el mismo correo y participantId.
    const records = filas.map((f) => ({
      email: f.correo.toLowerCase(),
      fullName: f.nombre,
      participantId: f.participante_id,
      participationId: f.participacion_id,
      experience: EXPERIENCIA,
      play_timestamp: f.jugado_en,
      ...(f.puntaje !== null ? { score: f.puntaje } : {}),
      ...(f.lienzo ? { lienzo: f.lienzo } : {}),
      ...nombresEvius(f.detalles),
    }));
    try {
      await enviarLote(
        "/experiences",
        { experienceId: c.experienceId },
        records,
        `exp:${c.eventId}:${c.experienceId}:${await huella(filas.map((f) => f.participacion_id).sort().join(","))}`,
      );
    } catch (e) {
      for (const f of filas) await marcarError(f, e);
      return { reclamados: filas.length, enviados: 0, fallidos: filas.length };
    }

    await rpc("evius_marcar_ok", {
      p_participaciones: filas.map((f) => f.participacion_id),
      p_participantes: [...new Set(filas.map((f) => f.participante_id))],
    });
    return { reclamados: filas.length, enviados: filas.length, fallidos: 0 };
  } catch (e) {
    console.error("evius:", e instanceof Error ? e.message : e);
    return { omitido: "error" };
  } finally {
    enCurso = false;
  }
}

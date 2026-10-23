/**
 * API de esta experiencia (Request → Response estándar, para que la misma lógica corra en una función de Netlify,
 * en una ruta de Next, en el middleware de Vite o en el servidor Node local). Misma API en las 5 experiencias:
 *
 *   POST /api/registrar          crea la persona (o devuelve su ID si el correo ya existe) y la deja en esta experiencia
 *   GET  /api/participante/:id   acceso rápido: solo nombre (y si ya jugó); deja registrada la participación
 *   POST /api/participacion      Láser Grafiti: guarda el lienzo · Memory, Mega e Insta: guarda el resultado (0-100)
 *
 * Mismo origen que la app: no hay CORS. Las claves viven solo en las variables del servidor.
 */

import { ErrorBase, EXPERIENCIA, enviarPendientes, entrar, guardarLienzo, guardarResultado, registrar } from "./registros.ts";

export interface Contexto {
  /** Trabajo que debe terminar aunque ya se haya respondido (envío a Evius). Si no hay, se lanza sin esperar. */
  despues?: (tarea: Promise<unknown>) => void;
}

const LIENZOS = ["pulse", "devops", "evius", "connect", "mocion"];
const ID_RE = /^\d{3}-\d{3}$/;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (status: number, cuerpo: unknown): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const fallo = (status: number, codigo: string, mensaje: string) => json(status, { error: codigo, mensaje });

// Quita caracteres de control y colapsa espacios.
const limpiar = (v: unknown, max: number) =>
  String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function leerJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const t = await req.text();
    if (t.length > 4096) return null;
    const v: unknown = JSON.parse(t);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function validarRegistro(b: Record<string, unknown>) {
  const nombre = limpiar(b.nombre, 80);
  const empresa = limpiar(b.empresa, 80);
  const correo = limpiar(b.correo, 120).toLowerCase();
  const celular = String(b.celular ?? "").replace(/\D/g, "");
  const idem = limpiar(b.idem, 80);

  if (nombre.length < 2) return { error: "nombre", mensaje: "Escribe tu nombre." };
  if (!/^\d{10}$/.test(celular)) return { error: "celular", mensaje: "El celular debe tener 10 dígitos." };
  if (!empresa) return { error: "empresa", mensaje: "Escribe tu empresa." };
  if (!CORREO_RE.test(correo)) return { error: "correo", mensaje: "Escribe un correo válido." };
  if (idem.length < 8) return { error: "idem", mensaje: "Falta la clave de envío." };
  return { datos: { nombre, celular, empresa, correo, idem: `reg:${idem}` } };
}

/** Solo se guardan los campos conocidos de cada experiencia y acotados; cualquier otra cosa del cliente se descarta. */
function detallesDe(d: Record<string, unknown>): Record<string, number> {
  const acotar = (v: unknown, max: number) => (Number.isFinite(Number(v)) ? Math.min(Math.max(Math.trunc(Number(v)), 0), max) : 0);
  if (EXPERIENCIA === "memory") {
    return { intentos: acotar(d.intentos, 1000), duracionMs: acotar(d.duracionMs, 3_600_000), parejas: acotar(d.parejas, 50) };
  }
  if (EXPERIENCIA === "mega") {
    return { gano: acotar(d.gano, 1), puntosJuego: acotar(d.puntosJuego, 1000), objetos: acotar(d.objetos, 100), tiempoRestanteS: acotar(d.tiempoRestanteS, 3600) };
  }
  return {}; // Insta Face: completar la experiencia vale 100 puntos; no hay más detalle que guardar
}

export async function responder(req: Request, ctx: Contexto = {}): Promise<Response> {
  const partes = new URL(req.url).pathname.split("/").filter(Boolean);
  const i = partes.indexOf("api");
  const ruta = "/" + (i >= 0 ? partes.slice(i + 1) : partes).join("/");

  // Tras guardar, se intenta enviar a Evius sin hacer esperar a la persona; lo que falle queda pendiente en la base.
  const enviarEvius = () => {
    const tarea = enviarPendientes().catch(() => undefined);
    ctx.despues?.(tarea);
  };

  try {
    // POST /registrar
    if (req.method === "POST" && ruta === "/registrar") {
      const body = await leerJson(req);
      if (!body) return fallo(400, "solicitud", "Solicitud no válida.");
      const v = validarRegistro(body);
      if (!v.datos) return fallo(422, v.error!, v.mensaje!);

      const p = await registrar(v.datos);
      if (p.jugado) return fallo(409, "ya_participo", "Parece que ya participaste en esta experiencia. ¡Gracias!");
      // Aviso de capacidad: 1.000.000 de combinaciones (000-000 a 999-999).
      if ((p.usados ?? 0) > 500_000) console.warn(`IDs usados: ${p.usados} de 1000000 (>50%)`);
      enviarEvius();
      return json(201, { id: p.id, nombre: p.nombre, existente: p.existente, intentosRestantes: p.intentosRestantes, mejor: p.mejor });
    }

    // GET /participante/:id  (acceso rápido)
    if (req.method === "GET" && partes[partes.length - 2] === "participante") {
      const id = partes[partes.length - 1] ?? "";
      if (!ID_RE.test(id)) return fallo(400, "solicitud", "ID no válido.");
      const p = await entrar(id);
      if (!p) return fallo(404, "no_encontrado", "No encontramos ese ID. Revísalo e inténtalo de nuevo.");
      enviarEvius();
      return json(200, { id, nombre: p.nombre, lienzo: p.lienzo, jugado: p.jugado, intentosRestantes: p.intentosRestantes, mejor: p.mejor });
    }

    // POST /participacion
    if (req.method === "POST" && ruta === "/participacion") {
      const b = await leerJson(req);
      if (!b || !ID_RE.test(String(b.id))) return fallo(400, "solicitud", "Datos no válidos.");
      const id = String(b.id);

      if (EXPERIENCIA === "laser") {
        if (!LIENZOS.includes(String(b.lienzo))) return fallo(400, "solicitud", "Datos no válidos.");
        if (!(await guardarLienzo(id, String(b.lienzo)))) return fallo(404, "no_encontrado", "No hay participación para ese ID.");
        enviarEvius();
        return json(200, { ok: true });
      }

      if (EXPERIENCIA === "memory" || EXPERIENCIA === "mega" || EXPERIENCIA === "insta") {
        const puntaje = Number(b.puntaje);
        if (!Number.isInteger(puntaje) || puntaje < 0 || puntaje > 100) return fallo(400, "solicitud", "Puntaje no válido.");
        const d = b.detalles && typeof b.detalles === "object" ? (b.detalles as Record<string, unknown>) : {};
        const clave = limpiar(b.clave, 80);
        const r = await guardarResultado(id, puntaje, detallesDe(d), clave || undefined);
        if (!r) return fallo(404, "no_encontrado", "No hay participación para ese ID.");
        enviarEvius();
        return json(200, { ok: true, guardado: r.guardado, intentosRestantes: r.intentosRestantes, mejor: r.mejor });
      }

      return fallo(400, "solicitud", "Datos no válidos.");
    }

    return fallo(404, "ruta", "Ruta no encontrada.");
  } catch (e) {
    // Nunca devolvemos detalles internos ni claves.
    console.error("error:", e instanceof Error ? e.message : e);
    if (e instanceof ErrorBase && e.codigo === "ids_agotados") return fallo(503, "ids_agotados", "No hay IDs disponibles. Avisa al equipo.");
    return fallo(500, "interno", "No pudimos completar la solicitud. Inténtalo de nuevo.");
  }
}

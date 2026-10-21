/**
 * Envío directo a Evius (Datahub) desde la app, en paralelo a la base de datos (Supabase).
 *
 * Igual que en las experiencias anteriores: la app habla con los dos destinos. Supabase es el que confirma el
 * registro (bloquea el flujo si falla); Evius va en segundo plano para que un mal wifi o una caída de Evius
 * nunca dejen a una persona esperando. Lo que no se pueda enviar queda en una cola local y se reintenta.
 *
 * Los lotes y las reglas son los de Datahub: { eventId, source, sentAt, records }, `Idempotency-Key`, y el éxito
 * se decide por el CUERPO (failed === 0 y processed >= records.length) porque la API responde 200 aunque algunos
 * registros fallen. Orden: primero /attendees (la persona, identificada por correo) y luego /experiences.
 * [CONFIRMAR contra dev] Nombres de los campos de cada record: se ajustan solo aquí.
 *
 * Variables (Vite): VITE_EVIUS_URL, VITE_EVIUS_TOKEN, VITE_EVIUS_EVENT_ID, VITE_EVIUS_EXPERIENCE_ID y, opcional,
 * VITE_EVIUS_SOURCE. Sin ellas el envío queda apagado (no hace nada).
 *
 * Importante: el token va en el código que llega al navegador, así que cualquiera con las herramientas del
 * navegador puede leerlo. Úsese un token con permisos limitados a este evento.
 */

const e = import.meta.env;
const URL_BASE = ((e.VITE_EVIUS_URL as string | undefined) ?? "").replace(/\/$/, "");
const TOKEN = (e.VITE_EVIUS_TOKEN as string | undefined) ?? "";
const EVENT_ID = (e.VITE_EVIUS_EVENT_ID as string | undefined) ?? "";
const EXPERIENCE_ID = (e.VITE_EVIUS_EXPERIENCE_ID as string | undefined) ?? "";
const SOURCE = (e.VITE_EVIUS_SOURCE as string | undefined) || "devopsdays-bogota-2026";

export const eviusActivo = Boolean(URL_BASE && TOKEN && EVENT_ID && EXPERIENCE_ID);

export interface Contacto {
  email: string;
  fullName: string;
  phone: string;
  company: string;
}

/** Datos de la participación en esta experiencia (todos opcionales: cada experiencia manda lo que tiene). */
export interface Participacion {
  score?: number;
  lienzo?: string;
  attempts?: number;
  durationMs?: number;
}

interface Job {
  id: string;
  contacto: Contacto;
  /** Si viene, además de registrar a la persona se registra su participación. */
  participacion?: Participacion & { play_timestamp: string };
}

const OUTBOX_KEY = "evius:outbox";
const ASISTENTES_KEY = "evius:asistentes";
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;
const POLL_INTERVAL_MS = 20_000;

/* ---------- Contacto en memoria ---------- */
// El acceso rápido por ID solo devuelve el nombre (no el correo), así que el contacto solo se conoce en el equipo
// donde la persona se registró; vive en memoria, nunca en disco, y se pierde al recargar la página.
const contactos = new Map<string, Contacto>();
export const recordarContacto = (id: string, contacto: Contacto) => void contactos.set(id, contacto);
export const contactoDe = (id: string) => contactos.get(id);

/* ---------- Almacenamiento local ---------- */
function leer<T>(clave: string, vacio: T): T {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as T) : vacio;
  } catch {
    return vacio;
  }
}
function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento no disponible: se intenta enviar igual */
  }
}

const normalizar = (c: Contacto): Contacto => ({ ...c, email: c.email.trim().toLowerCase() });

/* ---------- HTTP ---------- */
async function postLote(ruta: string, extra: Record<string, unknown>, records: unknown[], idempotencyKey: string): Promise<void> {
  const res = await fetch(`${URL_BASE}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`, "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ eventId: EVENT_ID, source: SOURCE, sentAt: new Date().toISOString(), ...extra, records }),
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

async function enviarJob(job: Job): Promise<void> {
  const { contacto, participacion } = job;
  const email = contacto.email;

  const asistentes = leer<string[]>(ASISTENTES_KEY, []);
  if (!asistentes.includes(email)) {
    await postLote(
      "/attendees",
      {},
      [{ email, fullName: contacto.fullName, phone: contacto.phone, company: contacto.company }],
      `att:${EVENT_ID}:${email}`,
    );
    escribir(ASISTENTES_KEY, [...asistentes, email]);
  }

  if (participacion) {
    await postLote(
      "/experiences",
      { experienceId: EXPERIENCE_ID },
      [{ email, fullName: contacto.fullName, ...participacion }],
      `exp:${EVENT_ID}:${EXPERIENCE_ID}:${email}`,
    );
  }
}

/* ---------- Cola con reintentos ---------- */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function conReintentos(job: Job): Promise<boolean> {
  for (let intento = 0; ; intento++) {
    try {
      await enviarJob(job);
      return true;
    } catch {
      const espera = RETRY_DELAYS_MS[intento];
      if (espera === undefined) return false;
      await sleep(espera);
    }
  }
}

let enCurso = false;

/** Reintenta todo lo pendiente. Lo que siga fallando queda para el próximo disparo (conexión o poll). */
export async function vaciarCola(): Promise<void> {
  if (!eviusActivo || enCurso) return;
  enCurso = true;
  try {
    for (const job of leer<Job[]>(OUTBOX_KEY, [])) {
      if (await conReintentos(job)) escribir(OUTBOX_KEY, leer<Job[]>(OUTBOX_KEY, []).filter((j) => j.id !== job.id));
    }
  } finally {
    enCurso = false;
  }
}

/**
 * Registra a la persona en Evius y, si se indica, su participación en esta experiencia. No se espera (await):
 * guarda en la cola local primero y envía en segundo plano.
 */
export function enviarEvius(contacto: Contacto, participacion?: Participacion): void {
  if (!eviusActivo) return;
  const job: Job = {
    id: crypto.randomUUID(),
    contacto: normalizar(contacto),
    ...(participacion ? { participacion: { ...participacion, play_timestamp: new Date().toISOString() } } : {}),
  };
  escribir(OUTBOX_KEY, [...leer<Job[]>(OUTBOX_KEY, []), job]);
  void vaciarCola();
}

/** Reintenta al recuperar conexión y cada POLL_INTERVAL_MS mientras haya pendientes. Llamar una vez al arrancar. */
export function iniciarEnvioEvius(): () => void {
  if (!eviusActivo) return () => {};
  const alConectar = () => void vaciarCola();
  window.addEventListener("online", alConectar);
  void vaciarCola();
  const intervalo = setInterval(() => {
    if (leer<Job[]>(OUTBOX_KEY, []).length > 0) void vaciarCola();
  }, POLL_INTERVAL_MS);
  return () => {
    window.removeEventListener("online", alConectar);
    clearInterval(intervalo);
  };
}


/** Contacto que devuelve el servidor en el acceso rápido (la persona ya se registró en otra experiencia o equipo). */
export interface ContactoServidor {
  correo?: string;
  celular?: string;
  empresa?: string;
}

/**
 * Acceso rápido por ID: rescata el contacto guardado en la base para poder registrar a la persona en Evius, que la
 * identifica por correo. Queda solo en memoria. Si ya completó esta experiencia el servidor no lo devuelve y no se hace nada.
 */
export function registrarContactoEnEvius(id: string, nombre: string, contacto: ContactoServidor | undefined, participacion?: Participacion): void {
  if (!contacto?.correo) return;
  const c: Contacto = { email: contacto.correo, fullName: nombre, phone: contacto.celular ?? "", company: contacto.empresa ?? "" };
  recordarContacto(id, c);
  enviarEvius(c, participacion);
}

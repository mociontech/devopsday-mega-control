import { Registros, esErrorDeRed, type Resultado } from "./api";

const OUTBOX_KEY = "mc:outbox";
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const; // 4 esperas -> 5 intentos en total
/**
 * Reintento periódico, independiente del evento `online` del navegador: en el wifi de un venue el navegador puede
 * reportarse "conectado" sin internet real y nunca disparar `online`. El poll es la red de seguridad.
 */
const POLL_INTERVAL_MS = 20_000;

function readOutbox(): Resultado[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as Resultado[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: Resultado[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {
    /* almacenamiento no disponible: se intenta enviar igual */
  }
}

/**
 * Guarda el resultado localmente ANTES de depender de la red, para que la persona nunca quede bloqueada,
 * y dispara un envío en segundo plano. Nunca se espera (await) desde la UI.
 */
export function enqueueResultado(resultado: Resultado): void {
  const outbox = readOutbox();
  if (!outbox.some((entry) => entry.id === resultado.id)) writeOutbox([...outbox, resultado]);
  void flushOutbox();
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** true si quedó entregado o el servidor lo rechazó de forma definitiva (reintentar no lo arregla). */
async function sendWithRetries(resultado: Resultado): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      await Registros.guardarResultado(resultado);
      return true;
    } catch (e) {
      if (!esErrorDeRed(e)) return true; // 4xx: ID inexistente o datos no válidos; no se arregla reintentando
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) return false;
      await sleep(delay);
    }
  }
}

let isFlushing = false;

/** Reintenta cada resultado pendiente; lo que siga fallando queda para el próximo disparo. */
export async function flushOutbox(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;
  try {
    for (const resultado of readOutbox()) {
      if (await sendWithRetries(resultado)) writeOutbox(readOutbox().filter((e) => e.id !== resultado.id));
    }
  } finally {
    isFlushing = false;
  }
}

/** Reintenta al recuperar conexión y cada POLL_INTERVAL_MS mientras haya pendientes. Llamar una vez al arrancar. */
export function initOutboxFlush(): () => void {
  const handleOnline = () => void flushOutbox();
  window.addEventListener("online", handleOnline);
  void flushOutbox();

  const interval = setInterval(() => {
    if (readOutbox().length > 0) void flushOutbox();
  }, POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
  };
}

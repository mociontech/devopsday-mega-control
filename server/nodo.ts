/**
 * Adaptador de Node (http) a la API estándar de handler.ts. Lo usan el middleware de Vite (desarrollo y preview)
 * y el servidor local. En Netlify y Next no hace falta: ellos ya entregan un Request.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { responder } from "./handler.ts";

async function leerCuerpo(req: IncomingMessage): Promise<Uint8Array | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const trozos: Buffer[] = [];
  let total = 0;
  for await (const t of req) {
    total += (t as Buffer).length;
    if (total > 8192) break; // el handler rechaza cuerpos grandes; aquí solo cortamos la lectura
    trozos.push(t as Buffer);
  }
  return Buffer.concat(trozos);
}

/** Atiende una petición /api/*. Devuelve false si no es de la API (para que siga el siguiente middleware). */
export async function atender(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? "/";
  if (!url.startsWith("/api/")) return false;

  const host = req.headers.host ?? "localhost";
  const cuerpo = await leerCuerpo(req);
  const request = new Request(`http://${host}${url}`, {
    method: req.method,
    headers: { "content-type": req.headers["content-type"] ?? "application/json" },
    ...(cuerpo ? { body: cuerpo as BodyInit } : {}),
  });
  const respuesta = await responder(request);
  res.statusCode = respuesta.status;
  respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor));
  res.end(Buffer.from(await respuesta.arrayBuffer()));
  return true;
}

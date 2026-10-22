// Función de Netlify: sirve /api/* con la lógica de server/handler.ts. Las claves salen del panel de Netlify del sitio.
import { responder } from "../../server/handler.ts";

export default async (req: Request, context: { waitUntil(tarea: Promise<unknown>): void }) =>
  responder(req, { despues: (tarea) => context.waitUntil(tarea) });

export const config = { path: "/api/*" };

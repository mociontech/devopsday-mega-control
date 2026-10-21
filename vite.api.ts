import { loadEnv, type Plugin } from "vite";
import { atender } from "./server/nodo.ts";

/**
 * Sirve /api/* con el MISMO código del servidor (server/handler.ts) en `npm run dev` y `npm run preview`.
 * En producción (Netlify) lo sirve la función netlify/functions/api.mts. Las variables sin prefijo VITE_
 * (claves del servidor) se leen del .env local y nunca llegan al navegador.
 */
export function apiLocal(): Plugin {
  const middleware = (
    req: Parameters<typeof atender>[0],
    res: Parameters<typeof atender>[1],
    next: () => void,
  ) => {
    atender(req, res)
      .then((atendida) => {
        if (!atendida) next();
      })
      .catch((e) => {
        console.error("api local:", e instanceof Error ? e.message : e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "interno", mensaje: "No pudimos completar la solicitud." }));
      });
  };

  return {
    name: "api-local",
    config(_, { mode }) {
      for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

/**
 * Servidor local de Mega Control: sirve la app compilada (dist/) y la API (/api/*) en el mismo puerto, y reintenta
 * cada 30 s lo que quedó pendiente hacia Evius. Las claves salen de .env (nunca llegan al navegador).
 *
 *   npm start        compila y arranca en http://127.0.0.1:5503
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { atender } from "./nodo.ts";
import { enviarPendientes } from "./registros.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

const PUERTO = Number(process.env.PORT ?? 5503);
const RAIZ = resolve("dist");
const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
};

createServer(async (req, res) => {
  try {
    if (await atender(req, res)) return;
    const ruta = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const archivo = normalize(join(RAIZ, ruta === "/" ? "index.html" : ruta));
    if (!archivo.startsWith(RAIZ)) { res.statusCode = 403; return res.end(); }
    const datos = await readFile(archivo);
    res.setHeader("Content-Type", TIPOS[extname(archivo).toLowerCase()] ?? "application/octet-stream");
    res.end(datos);
  } catch {
    res.statusCode = 404;
    res.end("No encontrado");
  }
}).listen(PUERTO, "127.0.0.1", () => console.log(`Mega Control en http://127.0.0.1:${PUERTO}`));

setInterval(() => void enviarPendientes(50), 30_000);

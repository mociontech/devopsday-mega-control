import { defineConfig } from "vite";
import { apiLocal } from "./vite.api.ts";

// Cada experiencia es un despliegue independiente (puerto fijo en local). /api/* lo sirve el plugin apiLocal.
export default defineConfig({
  plugins: [apiLocal()],
  server: { host: "127.0.0.1", port: 5503, strictPort: true },
  preview: { host: "127.0.0.1", port: 5503, strictPort: true },
});

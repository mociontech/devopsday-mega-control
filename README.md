# Mega Control · registro (DevOps Days Bogotá 2026)

React + Vite + TypeScript. Despliegue independiente; habla con la API compartida del proyecto (`../backend`).

```bash
npm install
npm run dev        # http://127.0.0.1:5503
npm run build      # genera dist/ (tipos + bundle)
```

- Variables en `.env` (ver `.env.example`). Solo `VITE_*` llega al navegador.
- Pantallas: `src/screens/` · llamadas a la API: `src/lib/api.ts` · contenido de la experiencia: `src/experience.ts`.
- Rutas por hash: `#/registro`, `#/agrega-id`, `#/tu-id`, `#/extra` (instructivo).
- Al terminar el registro se dispara el evento `registro:completo` en `window`.
- Para producción agrega el dominio del despliegue en `ALLOWED_ORIGINS` de la función `api`.

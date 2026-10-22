// Función programada de Netlify: cada minuto reintenta lo que quedó pendiente hacia Evius (solo de esta experiencia).
import { enviarPendientes } from "../../server/registros.ts";

export default async () => {
  await enviarPendientes(50);
};

export const config = { schedule: "* * * * *" };

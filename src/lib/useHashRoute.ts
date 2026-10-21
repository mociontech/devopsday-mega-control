import { useCallback, useSyncExternalStore } from "react";

// Rutas por hash (#/registro, #/agrega-id, ...): funcionan en cualquier hosting estático sin configuración.
const leer = () => window.location.hash.replace(/^#\/?/, "").split("/")[0] || "bienvenida";

const suscribir = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function useHashRoute() {
  const ruta = useSyncExternalStore(suscribir, leer);
  const ir = useCallback((destino: string) => {
    window.location.hash = `#/${destino}`;
  }, []);
  return [ruta, ir] as const;
}

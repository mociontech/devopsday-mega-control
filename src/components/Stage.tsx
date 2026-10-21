import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const STAGE_W = 1920;
const STAGE_H = 1080;

const escala = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);

/** Escenario fijo 1920×1080 escalado al tamaño de la ventana. */
export default function Stage({ children }: { children: ReactNode }) {
  const [s, setS] = useState(escala);

  useEffect(() => {
    const alCambiar = () => setS(escala());
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);

  return (
    <main className="stage" style={{ "--s": s } as CSSProperties} aria-live="polite">
      {children}
    </main>
  );
}

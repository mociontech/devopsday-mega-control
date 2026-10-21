import { useCallback, useEffect, useState } from "react";
import Stage from "./components/Stage";
import { useHashRoute } from "./lib/useHashRoute";
import type { Persona } from "./lib/api";
import { experience } from "./experience";
import Bienvenida from "./screens/Bienvenida";
import Registro from "./screens/Registro";
import AgregaId from "./screens/AgregaId";
import TuId from "./screens/TuId";
import Extra from "./screens/Extra";

/*
 * Flujo:
 *   bienvenida → registro → tu-id → (extra | fin)
 *   registro → "digitar ID código" → agrega-id → (extra | fin)
 *
 * `extra` es el paso propio de cada experiencia (lienzo en Láser Grafiti, instructivo en Mega Control).
 */
const NECESITA_PERSONA = ["tu-id", "extra"];

export default function App() {
  const [ruta, ir] = useHashRoute();
  const [persona, setPersona] = useState<Persona | null>(null);

  // Fin del registro: avisa al resto de la app (juego / ranking) y reinicia la estación.
  const terminar = useCallback(
    (final: Persona | null) => {
      window.dispatchEvent(new CustomEvent("registro:completo", { detail: { registro: final, experiencia: experience.api } }));
      setPersona(null);
      ir("bienvenida");
    },
    [ir],
  );

  const avanzar = (p: Persona) => {
    setPersona(p);
    if (experience.siguiente === "fin") terminar(p);
    else ir("extra");
  };

  const sinPersona = NECESITA_PERSONA.includes(ruta) && !persona;
  useEffect(() => {
    if (sinPersona) ir("registro"); // pantalla que requiere un registro previo
  }, [sinPersona, ir]);

  let pantalla;
  if (sinPersona) pantalla = null;
  else if (ruta === "registro") {
    pantalla = (
      <Registro
        onRegistrado={(p) => {
          setPersona(p);
          ir("tu-id");
        }}
        onAgregarId={() => ir("agrega-id")}
      />
    );
  } else if (ruta === "agrega-id") {
    pantalla = <AgregaId onEncontrado={avanzar} onVolver={() => ir("registro")} />;
  } else if (ruta === "tu-id" && persona) {
    pantalla = (
      <TuId
        persona={persona}
        onContinuar={() => avanzar(persona)}
        // El registro ya quedó guardado: volver reinicia la estación, no vuelve al formulario.
        onVolver={() => {
          setPersona(null);
          ir("bienvenida");
        }}
      />
    );
  } else if (ruta === "extra" && persona) {
    pantalla = <Extra persona={persona} onTerminar={terminar} />;
  } else {
    pantalla = <Bienvenida onRegistrar={() => ir("registro")} />;
  }

  return <Stage>{pantalla}</Stage>;
}

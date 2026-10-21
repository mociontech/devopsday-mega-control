import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import LightFrame from "../components/LightFrame";
import { Registros, mensajeDe, type Persona } from "../lib/api";
import { experience } from "../experience";

const soloDigitos = (v: string) => v.replace(/\D+/g, "").slice(0, 3);

interface Props {
  onEncontrado: (persona: Persona) => void;
  onVolver: () => void;
}

export default function AgregaId({ onEncontrado, onVolver }: Props) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [invalido, setInvalido] = useState<("a" | "b")[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const refA = useRef<HTMLInputElement>(null);
  const refB = useRef<HTMLInputElement>(null);

  const alEscribir = (campo: "a" | "b", valor: string) => {
    const limpio = soloDigitos(valor);
    if (campo === "a") {
      setA(limpio);
      if (limpio.length === 3) refB.current?.focus();
    } else {
      setB(limpio);
    }
    setInvalido([]);
    setError("");
  };

  const alBorrar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !b) refA.current?.focus();
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;

    if (a.length !== 3 || b.length !== 3) {
      setInvalido((["a", "b"] as const).filter((c) => (c === "a" ? a : b).length !== 3));
      setError("Escribe los 6 dígitos de tu ID.");
      return;
    }

    setEnviando(true);
    try {
      const persona = await Registros.buscarPorId(`${a}-${b}`, experience.api);
      if (!persona) {
        setInvalido(["a", "b"]);
        setError("No encontramos ese ID. Revísalo e inténtalo de nuevo.");
        return;
      }
      onEncontrado(persona);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  const clase = (c: "a" | "b") => `id-box${invalido.includes(c) ? " is-invalid" : ""}`;

  return (
    <LightFrame back={onVolver}>
      <h1 className="title title--140" style={{ left: 165, top: 332, width: 1590, height: 104 }}>
        Agrega ID
      </h1>

      <form onSubmit={enviar} noValidate autoComplete="off">
        <div className="id-code" style={{ left: 607, top: 511 }}>
          <input ref={refA} className={clase("a")} inputMode="numeric" maxLength={3} placeholder="321" autoFocus
            aria-label="Primeros tres dígitos del ID" value={a} onChange={(e) => alEscribir("a", e.target.value)} />
          <span className="id-dash">-</span>
          <input ref={refB} className={clase("b")} inputMode="numeric" maxLength={3} placeholder="321"
            aria-label="Últimos tres dígitos del ID" value={b} onChange={(e) => alEscribir("b", e.target.value)} onKeyDown={alBorrar} />
        </div>

        <p className="form-error form-error--center" role="alert" style={{ left: 607, top: 690, width: 704 }}>
          {error}
        </p>

        <button className="btn btn--dark btn--pill" type="submit" disabled={enviando} style={{ left: 628, top: 760, width: 684, height: 133 }}>
          Comenzar
        </button>
      </form>
    </LightFrame>
  );
}

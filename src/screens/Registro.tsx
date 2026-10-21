import { useState, type FormEvent } from "react";
import LightFrame from "../components/LightFrame";
import { asset } from "../lib/asset";
import { ErrorApi, Registros, mensajeDe, type Persona } from "../lib/api";
import { experience } from "../experience";
import { enviarEvius, recordarContacto } from "../lib/evius";

type Campo = "nombre" | "celular" | "empresa" | "correo";

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  onRegistrado: (persona: Persona) => void;
  onAgregarId: () => void;
}

export default function Registro({ onRegistrado, onAgregarId }: Props) {
  const [valores, setValores] = useState<Record<Campo, string>>({ nombre: "", celular: "", empresa: "", correo: "" });
  const [invalidos, setInvalidos] = useState<Campo[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo: Campo, valor: string) =>
    setValores((v) => ({ ...v, [campo]: campo === "celular" ? valor.replace(/\D+/g, "") : valor }));

  const validar = (): [Campo, string][] => {
    const falta: [Campo, string][] = [];
    if (valores.nombre.trim().length < 2) falta.push(["nombre", "Escribe tu nombre."]);
    if (!/^\d{10}$/.test(valores.celular)) falta.push(["celular", "El celular debe tener 10 dígitos."]);
    if (!valores.empresa.trim()) falta.push(["empresa", "Escribe tu empresa."]);
    if (!CORREO_RE.test(valores.correo.trim())) falta.push(["correo", "Escribe un correo válido."]);
    return falta;
  };

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;

    const falta = validar();
    setInvalidos(falta.map(([c]) => c));
    if (falta.length) {
      setError(falta[0][1]);
      (e.currentTarget.elements.namedItem(falta[0][0]) as HTMLInputElement | null)?.focus();
      return;
    }
    setError("");

    setEnviando(true);
    try {
      const persona = await Registros.guardar({
        nombre: valores.nombre.trim(),
        celular: valores.celular,
        empresa: valores.empresa.trim(),
        correo: valores.correo.trim(),
        experiencia: experience.api,
      });
      // Supabase ya confirmó el registro: lo mismo va a Evius en segundo plano (con cola y reintentos).
      const contacto = { email: valores.correo.trim(), fullName: valores.nombre.trim(), phone: valores.celular, company: valores.empresa.trim() };
      recordarContacto(persona.id, contacto);
      void enviarEvius(contacto, {});
      onRegistrado(persona);
    } catch (err) {
      setError(mensajeDe(err));
      // El servidor indica el campo en el código del error (p. ej. correo_duplicado → correo).
      const campo = err instanceof ErrorApi ? (err.codigo.split("_")[0] as Campo) : null;
      setInvalidos(campo && campo in valores ? [campo] : []);
    } finally {
      setEnviando(false);
    }
  }

  const clase = (c: Campo) => `field${invalidos.includes(c) ? " is-invalid" : ""}`;

  return (
    <LightFrame>
      <h1 className="title title--97" style={{ left: 519, top: 355, width: 882, height: 78 }}>
        REGISTRO
      </h1>

      <form onSubmit={enviar} noValidate autoComplete="off">
        <label className={clase("nombre")} style={{ left: 235, top: 471 }}>
          <img className="field__icon" src={asset("icon-person.svg")} alt="" style={{ left: 61, top: 30, width: 25.7, height: 38 }} />
          <input name="nombre" type="text" placeholder="Nombre" autoComplete="name" maxLength={80} autoFocus
            value={valores.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
        </label>

        <label className={clase("celular")} style={{ left: 955, top: 471 }}>
          <input name="celular" type="tel" inputMode="numeric" placeholder="Celular" autoComplete="tel" maxLength={10}
            value={valores.celular} onChange={(e) => cambiar("celular", e.target.value)} />
        </label>

        <label className={clase("empresa")} style={{ left: 235, top: 599 }}>
          <input name="empresa" type="text" placeholder="Empresa" autoComplete="organization" maxLength={80}
            value={valores.empresa} onChange={(e) => cambiar("empresa", e.target.value)} />
        </label>

        <label className={clase("correo")} style={{ left: 955, top: 599 }}>
          <img className="field__icon" src={asset("icon-mail.svg")} alt="" style={{ left: 49, top: 30, width: 50, height: 38.4 }} />
          <input name="correo" type="email" placeholder="Correo" autoComplete="email" maxLength={120}
            value={valores.correo} onChange={(e) => cambiar("correo", e.target.value)} />
        </label>

        <p className="form-error" role="alert" style={{ left: 235, top: 710, width: 1393 }}>
          {error}
        </p>

        <button className="btn btn--dark btn--pill" type="submit" disabled={enviando} style={{ left: 621, top: 772, width: 678, height: 123.8 }}>
          Comenzar
        </button>
      </form>

      <button className="link-btn" type="button" onClick={onAgregarId} style={{ left: 664, top: 915, width: 593, height: 88 }}>
        digitar ID código
      </button>
    </LightFrame>
  );
}

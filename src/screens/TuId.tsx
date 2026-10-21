import LightFrame from "../components/LightFrame";
import type { Persona } from "../lib/api";

interface Props {
  persona: Persona;
  onContinuar: () => void;
  onVolver: () => void;
}

export default function TuId({ persona, onContinuar, onVolver }: Props) {
  const [a, b] = persona.id.split("-");

  return (
    <LightFrame back={onVolver}>
      <h1 className="title title--140" style={{ left: 165, top: 306, width: 1590, height: 104 }}>
        Tu ID unico
      </h1>
      <p className="lead lead--id" style={{ left: 535, top: 412, width: 851, height: 162 }}>
        <strong>Este es tu código personal.</strong>
        <span>Guárdalo, lo necesitarás para iniciar.</span>
      </p>

      <div className="id-code" style={{ left: 607, top: 593 }}>
        <output className="id-box id-box--value">{a}</output>
        <span className="id-dash">-</span>
        <output className="id-box id-box--value">{b}</output>
      </div>

      <button className="btn btn--dark btn--pill" type="button" onClick={onContinuar} style={{ left: 628, top: 839, width: 684, height: 133 }}>
        Comenzar
      </button>
    </LightFrame>
  );
}

import { asset } from "../lib/asset";
import type { Persona } from "../lib/api";

interface Props {
  persona: Persona;
  onTerminar: (persona: Persona | null) => void;
}

/** Mega Control: instructivo del juego en pareja antes de iniciar. */
export default function Extra({ persona, onTerminar }: Props) {
  return (
    <section className="screen screen--pink">
      <img className="abs" src={asset("circle-white.svg")} alt="" style={{ left: 213, top: -112, width: 1495, height: 1495 }} />
      <div className="abs art" style={{ left: -223, top: 295, width: 686.5, height: 762.1 }}>
        <img src={asset("robot.png")} alt="" style={{ width: 508.3, height: 630.6, "--r": "19.08deg" } as React.CSSProperties} />
      </div>
      <div className="abs art" style={{ left: 1394.6, top: 610.8, width: 729.5, height: 772.1 }}>
        <img src={asset("robot-wave.png")} alt="" style={{ width: 510, height: 607, "--r": "-26.91deg" } as React.CSSProperties} />
      </div>
      <img className="abs" src={asset("menu-icon.svg")} alt="" style={{ left: 101, top: 61, width: 147, height: 43.4 }} />

      <div className="brand" style={{ left: 512, top: 99, width: 897, height: 190.4 }}>
        <img className="abs" src={asset("hi-mocion.svg")} alt="Mocion" style={{ left: 0, top: 48.9, width: 465, height: 101.6 }} />
        <span className="brand__rule" style={{ left: 511.8, top: 0, height: 190.4 }} />
        <img className="abs" src={asset("hi-devops.svg")} alt="DevOps Days Bogotá 2026" style={{ left: 554.1, top: 19.8, width: 342.3, height: 151.1 }} />
      </div>

      <h1 className="title title--97" style={{ left: 519, top: 387, width: 882, height: 78 }}>
        Instructivo
      </h1>
      <p className="lead lead--instructivo" style={{ left: 432, top: 431, width: 1057, height: 323 }}>
        <strong>Luchen y sobrevivan en pareja.</strong>
        <span>Un jugador avanza y el otro salta y esquiva. Su objetivo es sincronizar sus movimientos para recolectar los objetivos.</span>
      </p>

      <button className="btn btn--dark btn--pill" type="button" onClick={() => onTerminar(persona)} style={{ left: 621, top: 827, width: 678, height: 123.8 }}>
        Iniciar
      </button>
    </section>
  );
}

import type { ReactNode } from "react";
import { asset } from "../lib/asset";

/** Marco claro de las pantallas de registro: blobs turquesa, menú y marca Mocion · DevOps Days. */
export default function LightFrame({ children, back }: { children: ReactNode; back?: () => void }) {
  return (
    <section className="screen screen--light">
      <img className="abs" src={asset("blob-right.svg")} alt="" style={{ left: 1085, top: 827, width: 1426, height: 1426 }} />
      <img className="abs blob-left" src={asset("blob-left.svg")} alt="" />
      <img className="abs" src={asset("menu-icon.svg")} alt="" style={{ left: 101, top: 61, width: 147, height: 43.4 }} />
      <img
        className="abs"
        src={asset("header-dark.svg")}
        alt="Mocion · DevOps Days Bogotá 2026"
        style={{ left: 1110, top: 61, width: 723.6, height: 153.6 }}
      />
      {children}
      {back && (
        <button className="back" type="button" onClick={back} aria-label="Volver" style={{ left: 1715, top: 924 }}>
          <img src={asset("arrow-back.svg")} alt="" />
        </button>
      )}
    </section>
  );
}

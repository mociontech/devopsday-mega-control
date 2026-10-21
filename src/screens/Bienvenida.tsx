import type { CSSProperties } from "react";
import { asset } from "../lib/asset";
import { experience } from "../experience";

export default function Bienvenida({ onRegistrar }: { onRegistrar: () => void }) {
  return (
    <section className="screen screen--bienvenida">
      <img className="abs bg-hero" src={asset("bg-hero.png")} alt="" />
      <img className="abs" src={asset("welcome-rings.svg")} alt="" style={{ left: 1051, top: 169, width: 1254, height: 1153 }} />
      <img className="abs" src={asset("welcome-rings-left.svg")} alt="" style={{ left: -404, top: -244.5, width: 922.7, height: 987.3 }} />

      <div className="layer">
        {experience.diamonds.map((d) => {
          const lado = d.size / Math.SQRT2;
          return (
            <img
              key={`${d.src}-${d.x}`}
              className="abs diamond"
              src={asset(`${d.src}.svg`)}
              alt=""
              style={{ left: d.x + (d.size - lado) / 2, top: d.y + (d.size - lado) / 2, width: lado, height: lado }}
            />
          );
        })}
      </div>

      <div className="brand" style={{ left: 578, top: 76, width: 765, height: 162.4 }}>
        <img className="abs" src={asset("hp-mocion.svg")} alt="Mocion" style={{ left: 0, top: 41.7, width: 396.6, height: 86.6 }} />
        <span className="brand__rule" style={{ left: 436.5, top: 0, height: 162.4 }} />
        <img className="abs" src={asset("hp-devops.svg")} alt="DevOps Days Bogotá 2026" style={{ left: 472.6, top: 16.9, width: 292, height: 128.9 }} />
      </div>

      <div className="layer">
        {experience.art.map((a, i) =>
          "img" in a ? (
            <div key={i} className="abs art" style={{ left: a.x, top: a.y, width: a.w, height: a.h }}>
              <img
                src={asset(`${a.img}.png`)}
                alt=""
                style={{ width: a.iw ?? a.w, height: a.ih ?? a.h, "--r": `${a.rot ?? 0}deg` } as CSSProperties}
              />
            </div>
          ) : (
            <div key={i} className="hero-word" style={{ left: a.cx - a.w / 2, top: a.cy - a.h / 2, width: a.w, height: a.h }}>
              {a.word}
            </div>
          ),
        )}
      </div>

      <button className="btn btn--pink" type="button" onClick={onRegistrar} style={{ left: 614, top: 754, width: 693, height: 133 }}>
        Registrarme Ahora
      </button>

      <div className="social" style={{ left: 690, top: 980 }}>
        <img src={asset("social.svg")} alt="" width={540} height={36} />
        <a className="social__link" href="https://mocion.global/" target="_blank" rel="noopener noreferrer">
          Mocion.global
        </a>
      </div>
    </section>
  );
}

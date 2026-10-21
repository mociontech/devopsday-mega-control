import type { ExperienciaApi } from "./lib/api";

export type ArtItem =
  | { img: string; x: number; y: number; w: number; h: number; iw?: number; ih?: number; rot?: number }
  | { word: string; cx: number; cy: number; w: number; h: number };

export interface Diamond {
  src: string;
  x: number;
  y: number;
  /** Lado de la caja envolvente del rombo rotado -45°. */
  size: number;
}

export interface Experience {
  api: ExperienciaApi;
  nombre: string;
  /** Qué sigue tras el ID: terminar o pasar al paso propio de la experiencia (`Extra`). */
  siguiente: "fin" | "extra";
  diamonds: Diamond[];
  /** Coordenadas del escenario 1920×1080. Las imágenes se centran en su caja y se rotan `rot` grados. */
  art: ArtItem[];
}

export const experience: Experience = {
  api: "mega",
  nombre: "Mega Control",
  siguiente: "extra",
  diamonds: [
    { src: "diamond-a", x: 1134, y: 48, size: 790.2 },
    { src: "diamond-b", x: 12, y: 172, size: 790.2 },
  ],
  art: [
    { img: "robot", x: 1340, y: 291, w: 348.3, h: 395.4, iw: 272.6, ih: 338.1, rot: 14.45 },
    { word: "control", cx: 1030.6, cy: 571.1, w: 809.7, h: 263.3 },
    { img: "joystick", x: 280, y: 355, w: 350.9, h: 328.3, iw: 303.7, ih: 275.1, rot: -11.07 },
    { word: "Mega", cx: 760, cy: 398.3, w: 623.6, h: 264.2 },
  ],
};

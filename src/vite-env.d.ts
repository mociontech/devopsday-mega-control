/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de la función de servidor (API compartida del evento). Hay un valor por defecto en lib/api.ts. */
  readonly VITE_API_URL?: string;
  /** Evius (Datahub). Sin ellas el envío a Evius queda apagado. */
  readonly VITE_EVIUS_URL?: string;
  readonly VITE_EVIUS_TOKEN?: string;
  readonly VITE_EVIUS_EVENT_ID?: string;
  readonly VITE_EVIUS_EXPERIENCE_ID?: string;
  readonly VITE_EVIUS_SOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

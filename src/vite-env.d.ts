/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Evius (Datahub). Sin ellas el envío a Evius queda apagado. */
  readonly VITE_EVIUS_URL?: string;
  readonly VITE_EVIUS_TOKEN?: string;
  readonly VITE_EVIUS_EVENT_ID?: string;
  readonly VITE_EVIUS_EXPERIENCE_ID?: string;
  readonly VITE_EVIUS_SOURCE?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

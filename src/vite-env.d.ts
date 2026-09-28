/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base de l'API Laravel (ex. `http://localhost:8000/api`). */
  readonly VITE_API_BASE_URL?: string;
  /** Clé de l'API JavaScript Google Maps. Vide = cartes en repli OpenStreetMap, jamais d'erreur. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_REVERB_APP_ID?: string;
  readonly VITE_REVERB_KEY?: string;
  readonly VITE_REVERB_HOST?: string;
  readonly VITE_REVERB_PORT?: string | number;
  readonly VITE_REVERB_SCHEME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Chargeur de l'API JavaScript Google Maps + formes pures.
 *
 * Ce module reste volontairement sans React : les composants s'abonnent via
 * `src/hooks/useGoogleMapsSdk.ts`, et les tests node peuvent exercer les helpers.
 *
 * Règles du projet :
 * - la clé vient TOUJOURS de `VITE_GOOGLE_MAPS_API_KEY` (`.env.local`, ignoré par git) ;
 * - l'absence de clé n'est jamais une erreur bloquante : l'état passe à `inactif` et les cartes
 *   rendent le repli OpenStreetMap ;
 * - aucune requête Google n'est loggée (le query string porte la clé).
 */

export type EtatSdkGoogle = 'inactif' | 'chargement' | 'pret' | 'echec';

/** Clé lue au build/dev-time par Vite ; vide = Google Maps désactivé, repli OSM. */
const CLE = String((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '').trim();

export const DELAI_MISE_EN_DEHORS_MS = 8000;
const NOM_CALLBACK = '__tokpaGoogleMapsInit';

/** Le SDK n'est pas typé dans ce projet (pas de @types/google.maps) : on décrit le sous-ensemble utilisé. */
export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface SdkGoogle {
  maps: {
    Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    Polyline: new (options: Record<string, unknown>) => { setMap: (map: GoogleMap | null) => void };
    Polygon: new (options: Record<string, unknown>) => { setMap: (map: GoogleMap | null) => void };
    InfoWindow: new (options: Record<string, unknown>) => {
      open: (args: { map: GoogleMap; anchor?: GoogleMarker }) => void;
      close: () => void;
    };
    Point: new (x: number, y: number) => unknown;
    Size: new (w: number, h: number) => unknown;
    SymbolPath: { CIRCLE: number; FORWARD_CLOSED_ARROW?: number };
    event: {
      // Le SDK passe un événement `google.maps.*` que nous ne typons pas (aucune @types/google.maps dans
      // le projet) : il entre en unknown, chaque gestionnaire le réduit au besoin.
      addListener: (instance: unknown, eventName: string, handler: (...evenement: unknown[]) => void) => { remove: () => void };
      clearInstanceListeners: (instance: unknown) => void;
    };
    LatLngBounds: new (southWest: LatLngLiteral, northEast: LatLngLiteral) => {
      extend: (point: LatLngLiteral) => void;
    };
    importLibrary?: (name: string) => Promise<unknown>;
  };
}

export interface GoogleMap {
  panTo: (position: LatLngLiteral, zoom?: number) => void;
  fitBounds: (bounds: { toString?: () => string } | unknown, options?: Record<string, unknown>) => void;
  setOptions: (options: Record<string, unknown>) => void;
  getZoom: () => number;
  destroy?: () => void;
}

export interface GoogleMarker {
  setPosition: (position: LatLngLiteral) => void;
  setMap: (map: GoogleMap | null) => void;
}

declare global {
  interface Window {
    google?: SdkGoogle;
  }
}

/** Une clé est « exploitable » dès qu'elle est non vide : on ne rejette pas une clé proxy/inversée. */
export function estValide(cle: string | undefined | null): boolean {
  return typeof cle === 'string' && cle.trim().length > 0;
}

export function cleGoogleMaps(): string {
  return CLE;
}

export function googleMapsConfigure(): boolean {
  return estValide(CLE);
}

/** URL du SDK. Exposée séparément pour être testée sans DOM ni réseau. */
export function urlSdkGoogleMaps(cle: string, langue: 'fr' | 'en'): string {
  const params = new URLSearchParams({
    key: cle.trim(),
    language: langue,
    // `geometry` sert aux distances de la trace ; `loading=async` impose le callback.
    libraries: 'geometry',
    loading: 'async',
    callback: NOM_CALLBACK,
    region: 'bj',
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

/**
 * Anneaux GeoJSON (`{ type:'Polygon', coordinates:[[[lng,lat],…]] }`) → anneaux de `[lat,lng]`.
 *
 * Le backend stocke `zones.polygone_geo` en GeoJSON (`ZoneSeeder`), donc [longitude, latitude] : c'est
 * cet ordre qui est lu ici. Les objets `{ lat, lng }` sont acceptés en plus, par tolérance.
 */
export function normaliserPolygone(raw: unknown): [number, number][][] {
  const brut = raw && typeof raw === 'object' && 'coordinates' in (raw as Record<string, unknown>)
    ? (raw as { coordinates: unknown }).coordinates
    : raw;
  if (!Array.isArray(brut)) return [];
  const anneaux: [number, number][][] = [];
  for (const anneau of brut) {
    if (!Array.isArray(anneau)) continue;
    const points: [number, number][] = [];
    for (const sommet of anneau) {
      const p = normaliserSommet(sommet);
      if (p) points.push(p);
    }
    if (points.length >= 3) anneaux.push(points);
  }
  return anneaux;
}

/**
 * Sommet GeoJSON quelconque → `[lat, lng]` (ou null si inexploitable).
 *
 * Le contrat est celui de la spec GeoJSON : un tableau est `[longitude, latitude]`. L'inverse n'est
 * PAS détectable au Bénin (les deux nombres tiennent dans les bornes acceptées), donc un seul ordre
 * est assumé — `ZoneSeeder` écrit bien `[[lng,lat],…]`.
 */
export function normaliserSommet(sommet: unknown): [number, number] | null {
  if (sommet && typeof sommet === 'object' && !Array.isArray(sommet)) {
    const o = sommet as Record<string, unknown>;
    const lat = Number(o.lat ?? o.latitude);
    const lng = Number(o.lng ?? o.longitude);
    return sommetValide(lat, lng) ? [lat, lng] : null;
  }
  if (!Array.isArray(sommet) || sommet.length < 2) return null;
  const lng = Number(sommet[0]);
  const lat = Number(sommet[1]);
  return sommetValide(lat, lng) ? [lat, lng] : null;
}

function sommetValide(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** Centre approché (boîte englobante) d'un polygone, pour cadrer la carte sans Google. */
export function centrePolygone(anneaux: [number, number][][]): [number, number] | null {
  const plats = anneaux.flat();
  if (!plats.length) return null;
  let latMin = Infinity;
  let latMax = -Infinity;
  let lngMin = Infinity;
  let lngMax = -Infinity;
  for (const [lat, lng] of plats) {
    latMin = Math.min(latMin, lat);
    latMax = Math.max(latMax, lat);
    lngMin = Math.min(lngMin, lng);
    lngMax = Math.max(lngMax, lng);
  }
  return [(latMin + latMax) / 2, (lngMin + lngMax) / 2];
}

// ---------------------------------------------------------------------------
// Chargement (singleton) + état observable
// ---------------------------------------------------------------------------

let etat: EtatSdkGoogle = 'inactif';
let promesse: Promise<SdkGoogle> | null = null;
const ecoutes = new Set<() => void>();
let version = 0;

function notifier() {
  version += 1;
  for (const f of Array.from(ecoutes)) f();
}

export function etatGoogleMaps(): EtatSdkGoogle {
  return etat;
}

/** Snapshot stable pour `useSyncExternalStore` (le numéro de version change à chaque émission). */
export function instantaneGoogleMaps(): number {
  return version;
}

export function souscrireGoogleMaps(ecouter: () => void): () => void {
  ecoutes.add(ecouter);
  return () => ecoutes.delete(ecouter);
}

/**
 * Insère le script du SDK une seule fois. En cas d'échec (réseau coupé, clé refusée, temporisation),
 * l'état passe à `echec` : les cartes basculent sur le repli OSM au lieu de laisser un cadre vide.
 */
export function chargerGoogleMaps(langue: 'fr' | 'en' = 'fr'): Promise<SdkGoogle> {
  if (promesse) return promesse;
  const cle = cleGoogleMaps();
  if (!estValide(cle) || typeof document === 'undefined') {
    etat = 'inactif';
    return Promise.reject(new Error('tokpa:google-maps-cle-absente'));
  }
  if (window.google?.maps) {
    etat = 'pret';
    notifier();
    return Promise.resolve(window.google);
  }

  etat = 'chargement';
  notifier();

  promesse = new Promise<SdkGoogle>((resolve, reject) => {
    let regle = false;
    let minuterie = 0;
    const script = document.createElement('script');

    const finir = (sdk?: SdkGoogle) => {
      if (regle) return;
      regle = true;
      if (minuterie) window.clearTimeout(minuterie);
      delete (window as unknown as Record<string, unknown>)[NOM_CALLBACK];
      if (sdk?.maps) {
        etat = 'pret';
        notifier();
        resolve(sdk);
        return;
      }
      script.remove();
      etat = 'echec';
      notifier();
      reject(new Error('tokpa:google-maps-refuse'));
    };

    (window as unknown as Record<string, unknown>)[NOM_CALLBACK] = () => finir(window.google);
    script.src = urlSdkGoogleMaps(cle, langue);
    script.async = true;
    script.referrerPolicy = 'origin';
    script.onerror = () => finir();
    minuterie = window.setTimeout(() => finir(), DELAI_MISE_EN_DEHORS_MS);
    document.head.appendChild(script);
  }).catch((error) => {
    // Échec non terminal : un futur remontage pourra relancer le chargement.
    promesse = null;
    throw error;
  });

  return promesse;
}

/** Force la relance après un échec (bouton « Réessayer » d'un écran). */
export function reinitialiserGoogleMaps(): void {
  promesse = null;
  etat = 'inactif';
  notifier();
}

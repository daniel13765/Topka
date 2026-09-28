import { positionExploitable } from './carteTypes';

/**
 * Options du moteur Google, isolées en fonctions pures : ce sont elles qui font qu'une carte Google
 * ressemble à la maquette (décor épuré, gestuelle mobile, trace pointillée). Les tester sans DOM est
 * possible tant qu'elles ne construisent pas d'objets du SDK.
 */

export const CENTRE_DEFAUT: [number, number] = [6.3725, 2.4332]; // Marché Dantokpa

export function optionsCarte(centre: [number, number] | null | undefined, zoom = 14): Record<string, unknown> {
  const c = centre && positionExploitable(centre) ? centre : CENTRE_DEFAUT;
  return {
    center: { lat: c[0], lng: c[1] },
    zoom,
    disableDefaultUI: true,
    zoomControl: true,
    // Sur mobile, la page doit pouvoir défiler : ce n'est qu'avec deux doigts (ou Ctrl+molette)
    // que la carte zoome, comme dans le repli Leaflet (`scrollWheelZoom: false`).
    gestureHandling: 'cooperative',
    clickableIcons: false,
    backgroundColor: '#e8ede9',
    // La maquette montre un fond neutre sans enseignes : on coupe les étiquettes de commerces.
    styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
  };
}

/** Style du polygone de zone — mêmes valeurs que le repli Leaflet. */
export function stylePolygone(): Record<string, unknown> {
  return {
    strokeColor: '#f97316',
    strokeOpacity: 0.9,
    strokeWeight: 2,
    fillColor: '#f97316',
    fillOpacity: 0.08,
    clickable: false,
  };
}

/**
 * Trace pointillée. `Polyline` classic n'a pas de `strokeDashArray` : la seule façon d'obtenir des
 * pointillés sans Directions API est de répéter un court segment via `icons`.
 */
export function configTrace(): Record<string, unknown> {
  return {
    strokeColor: '#f97316',
    strokeOpacity: 0.25,
    strokeWeight: 5,
    icons: [
      {
        path: 'M 0,0 L 12,0',
        strokeColor: '#f97316',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        scale: 1,
        offset: '0px',
        repeat: '20px',
      },
    ],
  };
}

/** Position Google à partir d'un couple `[lat, lng]` (null si la donnée est inexploitable). */
export function positionGoogle(position: [number, number] | null | undefined): { lat: number; lng: number } | null {
  if (!position || !positionExploitable(position)) return null;
  return { lat: position[0], lng: position[1] };
}

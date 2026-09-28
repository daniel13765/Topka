import { faCircleDot, faLocationDot, faMotorcycle, faStore } from '@fortawesome/free-solid-svg-icons';

import { COULEURS_MARQUEUR, type RolleMarqueur } from './carteTypes';

/**
 * Marqueurs de carte en SVG Font Awesome, rendus comme images autonomes.
 *
 * Les deux moteurs (Google Maps et le repli Leaflet) consomment la même source : un pin Google et une
 * divIcon Leaflet doivent être identiques, sinon le repli ne ressemble plus à la maquette. Le projet
 * impose Font Awesome (la base reprise utilisait des glyphes de police) : d'où le tracé embarqué, qui
 * fonctionne aussi dans une image SVG isolée, où aucune police n'est chargée.
 */
const TRACES: Record<RolleMarqueur, { width: number; height: number; path: string }> = (() => {
  const entree = (icone: typeof faStore) => ({
    width: Number(icone.icon[0]),
    height: Number(icone.icon[1]),
    path: String(icone.icon[4] ?? ''),
  });
  return {
    depart: entree(faStore),
    livreur: entree(faMotorcycle),
    destination: entree(faLocationDot),
    repere: entree(faCircleDot),
  };
})();

/** SVG complet (40 × 40 par défaut) d'un marqueur TOKPa : pastille colorée, liseré blanc, glyphe. */
export function svgMarqueur(role: RolleMarqueur, taille = 40, options?: { pulsation?: boolean }): string {
  const couleurs = COULEURS_MARQUEUR[role] ?? COULEURS_MARQUEUR.repere;
  const trace = TRACES[role] ?? TRACES.repere;
  const rayon = taille / 2;
  const cercle = rayon - 2.5;
  const echelleGlyphes = (taille * 0.5) / Math.max(1, trace.height);
  const largeurGlyphe = trace.width * echelleGlyphes;
  const animation = options?.pulsation
    ? `<animate attributeName="opacity" values="1;0.55;1" dur="1.8s" repeatCount="indefinite"/>`
    : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">`,
    `<circle cx="${rayon}" cy="${rayon}" r="${cercle}" fill="${couleurs.fond}" stroke="${couleurs.contour}" stroke-width="3">${animation}</circle>`,
    trace.path
      ? `<g fill="#ffffff" transform="translate(${rayon} ${rayon}) scale(${echelleGlyphes.toFixed(4)}) translate(${(-largeurGlyphe / 2).toFixed(2)} ${(-trace.height / 2).toFixed(2)})"><path d="${trace.path}"/></g>`
      : '',
    '</svg>',
  ]
    .filter(Boolean)
    .join('');
}

/** Data URI à donner à `icon.url` (Google) ou à un `<img>` (Leaflet) : aucune ressource externe. */
export function dataUriMarqueur(role: RolleMarqueur, taille = 40, options?: { pulsation?: boolean }): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarqueur(role, taille, options))}`;
}

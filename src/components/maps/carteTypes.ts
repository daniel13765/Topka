/** Contrat commun aux deux moteurs de carte (Google Maps et repli OpenStreetMap). */
export type RolleMarqueur = 'depart' | 'livreur' | 'destination' | 'repere';

export interface MarqueurCarte {
  position: [number, number];
  /** Titre du marqueur (nom réel venant de l'API, jamais une donnée de démo). */
  etiquette: string;
  /** Ligne secondaire du pavé d'info (GPS, quartier…). */
  detail?: string;
  role: RolleMarqueur;
}

export interface CarteProps {
  marqueurs: MarqueurCarte[];
  /** Trace pointillée reliant les points dans l'ordre donné (aucun calcul d'itinéraire : le backend ne le sert pas). */
  trace?: [number, number][] | null;
  /** Anneaux du polygone de zone, déjà normalisés en `[lat, lng]`. */
  polygone?: [number, number][][] | null;
  centre?: [number, number] | null;
  zoom?: number;
  className?: string;
  /** Quand cette position change, la carte se recentre dessus (suivi GPS). */
  suivre?: [number, number] | null;
  onRecentrer?: () => void;
  /** Libellé du bouton de recentrage (aria-label). */
  libelleRecentrage?: string;
  /** Masque le bouton de recentrage (cartes encastrées d'une page de réglages). */
  sansBouton?: boolean;
  /**
   * Compteur incrémenté par le bouton de recentrage du conteneur : à chaque changement, le moteur
   * recadre sur `suivre`, à défaut sur `centre`, à défaut sur le premier marqueur. Un numéro plutôt
   * qu'une fonction garde les deux moteurs autonomes l'un de l'autre.
   */
  recadrage?: number;
}

/** Palette par rôle : mêmes couleurs que la maquette (orange départ, vert livreur, bleu client). */
export const COULEURS_MARQUEUR: Record<RolleMarqueur, { fond: string; contour: string; texte: string }> = {
  depart: { fond: '#f97316', contour: '#ffffff', texte: 'text-primary-dark' },
  livreur: { fond: '#10b981', contour: '#ffffff', texte: 'text-success-dark' },
  destination: { fond: '#3b82f6', contour: '#ffffff', texte: 'text-info-dark' },
  repere: { fond: '#64748b', contour: '#ffffff', texte: 'text-text-secondary' },
};

/** Diamètres en px, calés sur la maquette (40 / 46 / 40). */
export const TAILLE_MARQUEUR: Record<RolleMarqueur, number> = {
  depart: 40,
  livreur: 46,
  destination: 40,
  repere: 30,
};

/**
 * Le SDK n'est pas typé dans ce projet : on construit le contenu du pavé sans `innerHTML`,
 * les noms viennent de l'API (et peuvent donc contenir n'importe quoi).
 */
export function blocPave(etiquette: string, detail: string | undefined, classeTexte: string): HTMLElement {
  const bloc = document.createElement('div');
  bloc.className = 'font-sans text-center p-1';
  const titre = document.createElement('strong');
  titre.className = `block font-bold ${classeTexte}`;
  titre.textContent = etiquette;
  bloc.appendChild(titre);
  if (detail) {
    const ligne = document.createElement('span');
    ligne.className = 'text-xs text-gray-600';
    ligne.textContent = detail;
    bloc.appendChild(ligne);
  }
  return bloc;
}

/** `Number(null)` vaut 0 : ce garde évite un marqueur en plein océan sur une donnée manquante. */
export function positionExploitable(position: [number, number] | null | undefined): position is [number, number] {
  if (!Array.isArray(position) || position.length < 2) return false;
  const [lat, lng] = [Number(position[0]), Number(position[1])];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return !(lat === 0 && lng === 0);
}

import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';
import { Carte } from '../../maps/Carte';
import type { MarqueurCarte } from '../../maps/carteTypes';

/**
 * Point de retrait du marché de Dantokpa : seul repère géographique codé en dur du projet, parce que
 * c'est le lieu physique d'où partent les courses. Les anciennes coordonnées « position du livreur
 * Jean Kouassi » et « destination Cadjehoun » de la maquette sont supprimées : sans le mode
 * démonstration, plus rien ne les consommait, et la position affichée vient toujours de l'API.
 */
export const DANTOKPA_COORDS: [number, number] = [6.3725, 2.4332];

interface RealBeninMapProps {
  /** Position GPS réelle du livreur (endpoint tracking / Reverb) — null = aucun marqueur, rien n'est dessiné. */
  riderCoords?: [number, number] | null;
  /** Nom réel du livreur (GET /orders/{id} → livreur.nom_complet). */
  riderName?: string;
  /** Destination RÉELLE de la commande (landmark du point_reperes) — null = aucun marqueur destination. */
  destinationCoords?: [number, number] | null;
  /** Libellé réel de la destination (landmark.nom + description_lieu). */
  destinationLabel?: string;
  onRecenterRider?: () => void;
}

/**
 * Carte de suivi d'une course : point de retrait (Dantokpa), position GPS du livreur, destination.
 * Le moteur est choisi par `Carte` (Google Maps si une clé est configurée, OpenStreetMap sinon) ;
 * ce composant ne fait que traduire le domaine « course » en marqueurs.
 */
export default function RealBeninMap({
  riderCoords = null,
  riderName,
  destinationCoords = null,
  destinationLabel,
  onRecenterRider,
}: RealBeninMapProps) {
  useLanguage();

  const marqueurs: MarqueurCarte[] = [
    {
      role: 'depart',
      position: DANTOKPA_COORDS,
      etiquette: tx('Marché Dantokpa'),
      detail: tx('Cotonou, Bénin'),
    },
  ];
  if (riderCoords) {
    marqueurs.push({
      role: 'livreur',
      position: riderCoords,
      etiquette: riderName ? `${riderName} (${tx('Livreur')})` : tx('Livreur TOKPa'),
      detail: `GPS : ${riderCoords[0].toFixed(4)}, ${riderCoords[1].toFixed(4)}`,
    });
  }
  if (destinationCoords) {
    marqueurs.push({
      role: 'destination',
      position: destinationCoords,
      etiquette: destinationLabel || tx('Point de livraison'),
      detail: tx('Destination de la commande'),
    });
  }

  const trace: [number, number][] = [
    DANTOKPA_COORDS,
    ...(riderCoords ? [riderCoords] : []),
    ...(destinationCoords ? [destinationCoords] : []),
  ];

  return (
    <div className="relative z-10 h-full min-h-[450px] w-full">
      <Carte
        marqueurs={marqueurs}
        trace={trace}
        centre={riderCoords ?? destinationCoords ?? DANTOKPA_COORDS}
        zoom={14}
        suivre={riderCoords}
        onRecentrer={onRecenterRider}
        libelleRecentrage={tx('Recentrer sur la position temps réel du livreur')}
      />
    </div>
  );
}

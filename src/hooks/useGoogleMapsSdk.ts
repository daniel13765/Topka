import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useLanguage } from '../context/LanguageContext';
import {
  chargerGoogleMaps,
  etatGoogleMaps,
  googleMapsConfigure,
  instantaneGoogleMaps,
  souscrireGoogleMaps,
  type EtatSdkGoogle,
  type SdkGoogle,
} from '../utils/googleMaps';

export interface CarteGoogle {
  /** `inactif` = aucune clé d'environnement ; `echec` = SDK injoignable (réseau, clé refusée, temporisation). */
  etat: EtatSdkGoogle;
  sdk: SdkGoogle | null;
  /** Le SDK est utilisable maintenant. */
  pret: boolean;
  /** Replat explicite : après un échec, rien n'est relancé tout seul (pas de boucle de ré-injection du script). */
  reessayer: () => void;
}

/**
 * Abonnement au chargeur du SDK Google Maps.
 *
 * Une seule tentative par montage : l'échec est un état terminal affiché à l'écran (repli
 * OpenStreetMap + bouton « Réessayer »), jamais une boucle de ré Injection du script.
 */
export function useGoogleMapsSdk(): CarteGoogle {
  const { language } = useLanguage();
  const langue: 'fr' | 'en' = language === 'en' ? 'en' : 'fr';
  const configure = googleMapsConfigure();
  const [tentative, setTentative] = useState(0);
  useSyncExternalStore(souscrireGoogleMaps, instantaneGoogleMaps, instantaneGoogleMaps);
  const etat = etatGoogleMaps();

  useEffect(() => {
    if (!configure) return;
    if (etatGoogleMaps() === 'pret' || etatGoogleMaps() === 'chargement') return;
    void chargerGoogleMaps(langue).catch(() => {
      /* l'état `echec` suffit : le composant affiche le repli et propose de relancer */
    });
  }, [configure, langue, tentative]);

  const reessayer = useCallback(() => setTentative((n) => n + 1), []);

  // `typeof window` : le rendu serveur (renderToStaticMarkup des tests) n'a pas de global `window`.
  const google = typeof window === 'undefined' ? undefined : window.google;
  return {
    etat,
    sdk: etat === 'pret' ? (google ?? null) : null,
    pret: etat === 'pret' && Boolean(google?.maps),
    reessayer,
  };
}

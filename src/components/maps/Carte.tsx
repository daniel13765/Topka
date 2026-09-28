import { useState } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { useGoogleMapsSdk } from '../../hooks/useGoogleMapsSdk';
import { tx } from '../../i18n/tx';
import { CarteGoogle } from './CarteGoogle';
import { CarteOsm } from './CarteOsm';
import type { CarteProps } from './carteTypes';

/**
 * Carte de localisation TOKPa : Google Maps dès qu'une clé est disponible, repli OpenStreetMap sinon.
 *
 * Le repli n'est jamais une impasse :
 * - pas de clé (`inactif`) → Leaflet, sans requête Google ;
 * - SDK injoignable (`echec` : réseau coupé, clé refusée, temporisation) → Leaflet + « Réessayer » ;
 * - chargement en cours → squelette, pour éviter un aller-retour Leaflet → Google à l'écran.
 */
export function Carte(props: CarteProps) {
  // Abonné à la langue : le SDK est requis avec `language=`, un changement de langue doit recadrer le texte.
  const { language } = useLanguage();
  const { etat, sdk, pret, reessayer } = useGoogleMapsSdk();

  const [recadrage, setRecadrage] = useState(0);

  if (pret && sdk) {
    return (
      <div className="relative h-full w-full">
        <CarteGoogle sdk={sdk} {...props} recadrage={recadrage} />
        {BoutonRecentrage(props, () => setRecadrage((n) => n + 1))}
      </div>
    );
  }

  if (etat === 'chargement') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-container-low">
        <span className="flex items-center gap-sm rounded-full bg-white/80 px-md py-xs font-micro text-micro text-text-secondary animate-pulse">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8z" />
          </svg>
          {tx('Chargement de la carte…')}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <CarteOsm {...props} recadrage={recadrage} />
      {BoutonRecentrage(props, () => setRecadrage((n) => n + 1))}
      {etat !== 'pret' && (
        <span className="absolute left-2 top-2 z-[400] flex items-center gap-xs rounded-full border border-border-default bg-white/90 px-sm py-1 font-micro text-[10px] text-text-secondary shadow-sm">
          {etat === 'echec' ? tx('Carte Google injoignable — repli OpenStreetMap') : tx('Google Maps non configuré — repli OpenStreetMap')}
          {etat === 'echec' && (
            <button
              type="button"
              onClick={reessayer}
              className="rounded-full bg-surface-container-low px-sm py-0.5 font-label text-[10px] font-semibold text-primary-dark transition-colors hover:bg-primary hover:text-white"
            >
              {tx('Réessayer')}
            </button>
          )}
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            title={tx('Renseigner VITE_GOOGLE_MAPS_API_KEY dans .env.local active les tuiles Google Maps.')}
          />
        </span>
      )}
      <span className="sr-only">{language === 'en' ? 'OpenStreetMap fallback' : 'Repli OpenStreetMap'}</span>
    </div>
  );
}

/**
 * Bouton de recentrage de la maquette (pastille blanche en bas à droite). Il est posé par le
 * conteneur et non par un moteur : le même geste doit fonctionner avec Google Maps comme avec le
 * repli OpenStreetMap. Un rappel `onRecentrer` est émis en plus, pour les écrans qui ont leur propre
 * logique (relecture GPS par exemple).
 */
function BoutonRecentrage(props: CarteProps, onRecadrer: () => void) {
  if (props.sansBouton) return null;
  const libelle = props.libelleRecentrage ?? 'Recentrer';
  return (
    <button
      type="button"
      onClick={() => {
        props.onRecentrer?.();
        onRecadrer();
      }}
      title={libelle}
      aria-label={libelle}
      className="absolute bottom-6 right-6 z-[400] flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-white text-text-main shadow-xl transition-transform hover:bg-bg-secondary active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5" />
      </svg>
    </button>
  );
}

export type { CarteProps, MarqueurCarte } from './carteTypes';

import { useEffect, useRef } from 'react';

import {
  blocPave,
  COULEURS_MARQUEUR,
  positionExploitable,
  TAILLE_MARQUEUR,
  type CarteProps,
} from './carteTypes';
import { dataUriMarqueur } from './marqueurIcones';
import { configTrace, optionsCarte, positionGoogle, stylePolygone } from './carteGoogleOptions';
import type { GoogleMap, GoogleMarker, SdkGoogle } from '../../utils/googleMaps';

const MARGE_CADRE = 48;

export interface CarteGoogleProps extends CarteProps {
  sdk: SdkGoogle;
}

/**
 * Carte Google Maps impérative (API JavaScript classique, sans `mapId`) : mêmes marqueurs, mêmes
 * couleurs et même trace pointillée que le repli OpenStreetMap, pour que le rendu ne dépende pas de
 * la présence d'une clé.
 *
 * Volontairement : pas de Directions API (le backend ne sert aucun itinéraire, seulement des points),
 * et pas de Geocoder (aucun champ d'adresse n'est exposé par l'API pour le livreur).
 */
export function CarteGoogle({
  sdk,
  marqueurs,
  trace,
  polygone,
  centre,
  zoom = 14,
  suivre,
  recadrage = 0,
  className,
}: CarteGoogleProps) {
  const { maps } = sdk;
  const conteneur = useRef<HTMLDivElement | null>(null);
  const carte = useRef<GoogleMap | null>(null);
  const calques = useRef<{ retirer: () => void } | null>(null);
  const premierCadre = useRef(false);

  const cleContenu = JSON.stringify({ marqueurs, trace: trace ?? null, polygone: polygone ?? null });

  useEffect(() => {
    if (!conteneur.current) return undefined;
    carte.current = creerCarte(maps, conteneur.current, centre ?? marqueurs[0]?.position ?? null, zoom);
    return () => {
      calques.current?.retirer();
      calques.current = null;
      carte.current?.destroy?.();
      carte.current = null;
      premierCadre.current = false;
    };
  }, [maps]);

  useEffect(() => {
    const instance = carte.current;
    if (!instance) return;

    calques.current?.retirer();
    calques.current = poserCalques(maps, instance, { marqueurs, trace, polygone });

    if (!premierCadre.current) {
      const cadre = cadreDe(maps, { marqueurs, trace, polygone });
      if (cadre) {
        instance.fitBounds(cadre, { left: MARGE_CADRE, right: MARGE_CADRE, top: MARGE_CADRE, bottom: MARGE_CADRE });
        premierCadre.current = true;
      }
    }
    // `cleContenu` condense le contenu : les tableaux sont recréés à chaque rendu appelant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, cleContenu]);

  // Clé primitive : l'appelant re-crée le tableau à chaque tic d'horloge, on ne recadre que si la
  // position a réellement changé.
  const cleSuivre = suivre && positionExploitable(suivre) ? `${suivre[0].toFixed(5)},${suivre[1].toFixed(5)}` : null;
  useEffect(() => {
    if (!cleSuivre || !carte.current) return;
    carte.current.panTo({ lat: suivre![0], lng: suivre![1] }, carte.current.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleSuivre]);

  // Bouton « recentrer » du conteneur : on ignore la valeur initiale pour ne pas annuler le cadrage
  // automatique du premier rendu.
  const dernierRecadrage = useRef(recadrage);
  useEffect(() => {
    if (recadrage === dernierRecadrage.current) return;
    dernierRecadrage.current = recadrage;
    const cible = suivre ?? centre ?? marqueurs[0]?.position ?? null;
    if (!cible || !carte.current || !positionExploitable(cible)) return;
    carte.current.panTo({ lat: cible[0], lng: cible[1] }, carte.current.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recadrage]);

  return (
    <div data-carte="google" className={className ?? 'relative h-full w-full'}>
      <div ref={conteneur} className="h-full w-full" />
    </div>
  );
}

function creerCarte(maps: SdkGoogle['maps'], el: HTMLElement, centre: [number, number] | null, zoom: number) {
  return new maps.Map(el, optionsCarte(centre, zoom));
}

interface Contenu {
  marqueurs: CarteProps['marqueurs'];
  trace?: [number, number][] | null;
  polygone?: [number, number][][] | null;
}

function poserCalques(maps: SdkGoogle['maps'], carte: GoogleMap, contenu: Contenu) {
  const marqueurs: GoogleMarker[] = [];
  const annexes: { setMap: (map: null) => void }[] = [];
  const fenetres: { close: () => void }[] = [];

  for (const anneau of contenu.polygone ?? []) {
    const path = anneau
      .filter(positionExploitable)
      .map(([lat, lng]) => ({ lat, lng }));
    if (path.length < 3) continue;
    const poly = new maps.Polygon({ path, map: carte, ...stylePolygone() });
    annexes.push(poly as unknown as { setMap: (map: null) => void });
  }

  const trace = (contenu.trace ?? []).filter(positionExploitable).map(([lat, lng]) => ({ lat, lng }));
  if (trace.length >= 2) {
    // Trace en pointillés, comme la maquette : `icons` répète un segment vide (pas de Directions API).
    const ligne = new maps.Polyline({ path: trace, map: carte, ...configTrace() });
    annexes.push(ligne as unknown as { setMap: (map: null) => void });
  }

  for (const marqueur of contenu.marqueurs) {
    const position = positionGoogle(marqueur.position);
    if (!position) continue;
    const taille = TAILLE_MARQUEUR[marqueur.role] ?? 40;
    const instance = new maps.Marker({
      position,
      map: carte,
      title: marqueur.etiquette,
      icon: {
        url: dataUriMarqueur(marqueur.role, taille, { pulsation: marqueur.role === 'livreur' }),
        scaledSize: new maps.Size(taille, taille),
        anchor: new maps.Point(taille / 2, taille / 2),
      },
    });
    marqueurs.push(instance);
    const couleurs = COULEURS_MARQUEUR[marqueur.role] ?? COULEURS_MARQUEUR.repere;
    const fenetre = new maps.InfoWindow({ content: blocPave(marqueur.etiquette, marqueur.detail, couleurs.texte) });
    fenetres.push(fenetre);
    maps.event.addListener(instance, 'click', () => {
      for (const autre of fenetres) if (autre !== fenetre) autre.close();
      fenetre.open({ map: carte, anchor: instance });
    });
  }

  return {
    retirer: () => {
      for (const m of marqueurs) {
        maps.event.clearInstanceListeners(m);
        m.setMap(null);
      }
      for (const a of annexes) a.setMap(null);
      for (const f of fenetres) f.close();
    },
  };
}

function cadreDe(maps: SdkGoogle['maps'], contenu: Contenu) {
  const points: { lat: number; lng: number }[] = [];
  for (const m of contenu.marqueurs) {
    const p = positionGoogle(m.position);
    if (p) points.push(p);
  }
  for (const t of contenu.trace ?? []) {
    const p = positionGoogle(t);
    if (p) points.push(p);
  }
  for (const anneau of contenu.polygone ?? []) {
    for (const sommet of anneau) {
      const p = positionGoogle(sommet);
      if (p) points.push(p);
    }
  }
  const premier = points[0];
  if (!premier) return null;
  const cadre = new maps.LatLngBounds(premier, premier);
  for (const p of points) cadre.extend(p);
  return cadre;
}

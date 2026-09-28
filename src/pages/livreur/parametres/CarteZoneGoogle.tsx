import { useCallback, useEffect, useState } from 'react';

import { Carte } from '../../../components/maps/Carte';
import type { MarqueurCarte } from '../../../components/maps/carteTypes';
import FaIcon from '../../../components/shared/FaIcon';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';
import { centrePolygone } from '../../../utils/googleMaps';
import { fetchZonesGeo, zoneCorrespond, type ZoneGeo } from '../livreurData';

type EtatGps = 'off' | 'ok' | 'chargement' | 'refuse' | 'incompatible';

interface Props {
  zoneId: number | null;
  zoneNom: string | null;
}

/**
 * « Zone & position d'intervention » : le polygone réellement stocké dans `zones.polygone_geo`
 * (GeoJSON, via `GET /zones` — public) + les points de repère de la zone + ma position GPS.
 *
 * Aucune donnée inventée : sans zone assignée au compte, la carte n'est pas dessinée, un encart le
 * dit. La position ne vient que de `navigator.geolocation` (le backend ne stocke pas la dernière
 * position d'un livreur de façon consultable par son propre compte).
 */
export function CarteZoneGoogle({ zoneId, zoneNom }: Props) {
  useLanguage();
  const [zones, setZones] = useState<ZoneGeo[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [gps, setGps] = useState<EtatGps>('off');
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    let vivant = true;
    setZones(null);
    setErreur(null);
    fetchZonesGeo(rechargement > 0)
      .then((value) => vivant && setZones(value))
      .catch(() => {
        if (!vivant) return;
        setZones([]);
        setErreur(tx('Les zones n’ont pas pu être chargées.'));
      });
    return () => {
      vivant = false;
    };
  }, [rechargement]);

  const localiser = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGps('incompatible');
      return;
    }
    setGps('chargement');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition([p.coords.latitude, p.coords.longitude]);
        setGps('ok');
      },
      () => setGps('refuse'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }, []);

  const zone = zones ? zoneCorrespond(zones, zoneId, zoneNom) : null;

  const marqueurs: MarqueurCarte[] = [];
  if (zone) {
    for (const repere of zone.reperes) {
      marqueurs.push({
        role: 'repere',
        position: [repere.lat, repere.lng],
        etiquette: repere.nom,
        detail: zone.nom,
      });
    }
  }
  if (position) {
    marqueurs.push({
      role: 'livreur',
      position,
      etiquette: tx('Ma position actuelle'),
      detail: `GPS : ${position[0].toFixed(4)}, ${position[1].toFixed(4)}`,
    });
  }

  const centre: [number, number] | null =
    position ?? (zone ? (centrePolygone(zone.polygone) ?? (zone.reperes[0] ? [zone.reperes[0].lat, zone.reperes[0].lng] : null)) : null);

  const libelleGps =
    gps === 'incompatible'
      ? tx('Géolocalisation indisponible sur ce navigateur')
      : gps === 'refuse'
        ? tx('Position refusée par le navigateur')
        : gps === 'chargement'
          ? tx('Localisation en cours…')
          : null;

  return (
    <div className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex min-w-0 items-center gap-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-card text-primary-dark shadow-sm">
            <FaIcon name="map" className="text-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="font-label text-label font-semibold text-text-main">{tx('Zone & position d’intervention')}</p>
            <p className="font-micro text-micro text-text-secondary">
              {zone
                ? tr(
                    `${zone.nom} — ${zone.reperes.length} point(s) de repère`,
                    `${zone.nom} — ${zone.reperes.length} landmark(s)`,
                  )
                : tx('Périmètre dessiné à partir de la zone assignée au compte')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={localiser}
          disabled={gps === 'chargement'}
          className="flex items-center gap-xs rounded-[10px] bg-bg-card px-md py-xs font-label text-label font-medium text-primary-dark shadow-sm transition-all hover:bg-primary-tint active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          <FaIcon name="my_location" className="text-[16px]" />
          {position ? tx('Recadrer sur ma position') : tx('Me localiser')}
        </button>
      </div>

      {libelleGps && (
        <p className="font-micro text-micro text-text-secondary">
          <FaIcon name={gps === 'ok' ? 'check_circle' : 'error'} className="mr-1 inline text-[13px]" />
          {libelleGps}
        </p>
      )}

      {erreur ? (
        <div className="flex flex-wrap items-center justify-between gap-sm rounded-[10px] border border-amber-200 bg-amber-50 px-md py-sm">
          <p className="font-micro text-micro text-amber-900">{erreur}</p>
          <button
            type="button"
            onClick={() => setRechargement((n) => n + 1)}
            className="flex items-center gap-xs rounded-full bg-white px-sm py-0.5 font-micro text-micro font-semibold text-amber-900 transition-colors hover:bg-amber-100"
          >
            <FaIcon name="refresh" className="text-[12px]" />
            {tx('Réessayer')}
          </button>
        </div>
      ) : zones === null ? (
        <div className="flex h-[220px] items-center justify-center rounded-[10px] bg-white/60">
          <span className="flex items-center gap-sm font-micro text-micro text-text-secondary animate-pulse">
            <FaIcon name="sync" className="text-[14px]" />
            {tx('Chargement de la carte de zone…')}
          </span>
        </div>
      ) : !zone ? (
        <p className="rounded-[10px] border border-border-default bg-white/70 px-md py-sm font-micro text-micro text-text-secondary">
          {tx('Aucune zone géométrique ne correspond à ce compte : la carte reste vide tant que l’administration n’a pas affecté de zone.')}
        </p>
      ) : (
        <div className="relative h-[260px] overflow-hidden rounded-[10px] border border-border-default">
          <Carte
            marqueurs={marqueurs}
            polygone={zone.polygone}
            centre={centre}
            zoom={13}
            sansBouton
            libelleRecentrage={tx('Recentrer sur la zone')}
          />
        </div>
      )}
    </div>
  );
}

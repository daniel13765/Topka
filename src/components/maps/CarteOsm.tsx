import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { COULEURS_MARQUEUR, positionExploitable, TAILLE_MARQUEUR, type CarteProps } from './carteTypes';
import { dataUriMarqueur } from './marqueurIcones';
import { tx } from '../../i18n/tx';

function icones(): Map<string, L.Icon> {
  const index = new Map<string, L.Icon>();
  for (const role of Object.keys(TAILLE_MARQUEUR)) {
    const taille = TAILLE_MARQUEUR[role as keyof typeof TAILLE_MARQUEUR];
    index.set(
      role,
      L.icon({
        iconUrl: dataUriMarqueur(role as keyof typeof TAILLE_MARQUEUR, taille),
        iconSize: [taille, taille],
        iconAnchor: [taille / 2, taille / 2],
        popupAnchor: [0, -taille / 2],
        className: 'tokpa-marqueur-carte',
      }),
    );
  }
  return index;
}

const ICONES = /* @__PURE__ */ icones();

const CENTRE_DEFAUT: [number, number] = [6.3725, 2.4332]; // Marché Dantokpa

function Recentrer({ position, forcage }: { position: [number, number] | null; forcage: number }) {
  const carte = useMap();
  // Idem côté Google : dépendre d'une clé, pas de la référence du tableau (nouvelle à chaque tic).
  const cle = position && positionExploitable(position) ? `${position[0].toFixed(5)},${position[1].toFixed(5)}` : null;
  const premiere = useRef(true);
  useEffect(() => {
    const sauter = premiere.current && forcage === 0;
    premiere.current = false;
    if (sauter) return;
    const cible = position ?? null;
    if (!cible || !positionExploitable(cible)) return;
    carte.panTo(cible, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, forcage, carte]);
  return null;
}

/**
 * Repli sans clé : Leaflet + tuiles OpenStreetMap. Mêmes marqueurs et mêmes couleurs que le rendu
 * Google, donc l'écran ne change pas de nature quand `VITE_GOOGLE_MAPS_API_KEY` est absente.
 */
export function CarteOsm({
  marqueurs,
  trace,
  polygone,
  centre,
  zoom = 14,
  className,
  suivre,
  recadrage = 0,
}: CarteProps) {
  const points = useMemo(() => marqueurs.filter((m) => positionExploitable(m.position)), [marqueurs]);
  const centreCarte: [number, number] = (centre ?? points[0]?.position ?? CENTRE_DEFAUT) as [number, number];
  const chemin = useMemo(
    () => (trace ?? []).filter(positionExploitable) as [number, number][],
    [trace],
  );

  return (
    <div className={className ?? 'relative h-full w-full'}>
      <MapContainer
        center={centreCarte}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recentrer position={suivre ?? centreCarte} forcage={recadrage} />

        {(polygone ?? []).map((anneau, index) => (
          <Polygon
            key={`zone-${index}`}
            positions={anneau.filter(positionExploitable) as [number, number][]}
            pathOptions={{ color: '#f97316', weight: 2, fillColor: '#f97316', fillOpacity: 0.08 }}
          />
        ))}

        {chemin.length >= 2 && (
          <Polyline positions={chemin} pathOptions={{ color: '#f97316', weight: 5, opacity: 0.85, dashArray: '10, 8' }} />
        )}

        {points.map((marqueur, index) => (
          <Marker
            key={`${marqueur.role}-${index}-${marqueur.position[0]}-${marqueur.position[1]}`}
            position={marqueur.position}
            icon={ICONES.get(marqueur.role) ?? ICONES.get('repere')!}
          >
            <Popup>
              <div className="p-1 text-center font-sans">
                <strong className={`block font-bold ${COULEURS_MARQUEUR[marqueur.role]?.texte ?? ''}`}>{marqueur.etiquette}</strong>
                {marqueur.detail && <span className="text-xs text-gray-600">{marqueur.detail}</span>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <span className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded bg-white/85 px-2 py-0.5 font-micro text-[10px] text-text-secondary">
        {tx('OpenStreetMap')}
      </span>
    </div>
  );
}

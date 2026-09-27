import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


// Coordonnées réelles du Bénin (Cotonou / Marché Dantokpa / Cadjehoun)
export const DANTOKPA_COORDS: [number, number] = [6.3725, 2.4332]; // Marché Dantokpa
export const RIDER_COORDS: [number, number] = [6.367, 2.421]; // Position actuelle Livreur Jean Kouassi sur Boulevard St Michel
export const CLIENT_COORDS: [number, number] = [6.362, 2.410]; // Destination Cadjehoun Cotonou

// Icônes personnalisées Leaflet Tokpa avec Material Symbols
const sellerIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `
    <div style="background-color: #f97316; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
      <span class="material-symbols-outlined" style="color: white; font-size: 20px;">store</span>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const riderIcon = L.divIcon({
  className: 'custom-leaflet-marker-rider',
  html: `
    <div style="background-color: #10B981; width: 46px; height: 46px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16,185,129,0.6); animation: pulse 1.8s infinite;">
      <span class="material-symbols-outlined" style="color: white; font-size: 24px;">motorcycle</span>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

const clientIcon = L.divIcon({
  className: 'custom-leaflet-marker-client',
  html: `
    <div style="background-color: #3B82F6; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
      <span class="material-symbols-outlined" style="color: white; font-size: 20px;">location_on</span>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapRecenterController({ center }: { center: [number, number] }) {
  useLanguage();
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

interface RealBeninMapProps {
  /** Position GPS réelle du livreur (endpoints tracking/Reverb) — null = aucun marqueur livreur (pas de simulation). */
  riderCoords?: [number, number] | null;
  /** Nom réel du livreur (GET /orders/{id} → livreur.nom_complet). */
  riderName?: string;
  /** Destination RÉELLE de la commande (landmark du point_reperes) — null = aucun marqueur destination (plus de coordonnées de test). */
  destinationCoords?: [number, number] | null;
  /** Libellé réel de la destination (landmark.nom + description_lieu). */
  destinationLabel?: string;
  onRecenterRider?: () => void;
}

export default function RealBeninMap({
  riderCoords = null,
  riderName,
  destinationCoords = null,
  destinationLabel,
  onRecenterRider,
}: RealBeninMapProps) {
  useLanguage();
  const mapCenter: [number, number] = riderCoords ?? destinationCoords ?? DANTOKPA_COORDS;
  const routePath: [number, number][] = [
    DANTOKPA_COORDS,
    ...(riderCoords ? [riderCoords] : []),
    ...(destinationCoords ? [destinationCoords] : []),
  ];

  return (
    <div className="relative w-full h-full min-h-[450px] z-10">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom={false}
        className="w-full h-full rounded-b-none"
        style={{ height: '100%', width: '100%', minHeight: '450px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenterController center={mapCenter} />

        {/* Tracé de l’itinéraire dynamique Cotonou */}
        <Polyline positions={routePath} color="#f97316" weight={5} opacity={0.85} dashArray="10, 8" />

        {/* Marqueur Marché Dantokpa */}
        <Marker position={DANTOKPA_COORDS} icon={sellerIcon}>
          <Popup>
            <div className="text-center font-sans p-1">
              <strong className="block text-primary font-bold">{tx("Marché Dantokpa")}</strong>
              <span className="text-xs text-gray-600">{tx("Cotonou, Bénin")}</span>
            </div>
          </Popup>
        </Marker>

        {/* Marqueur Livreur — SEULEMENT avec une position GPS réelle (aucune donnée inventée) */}
        {riderCoords && (
          <Marker position={riderCoords} icon={riderIcon}>
            <Popup>
              <div className="text-center font-sans p-1">
                <strong className="block text-success-dark font-bold">{riderName ? `${riderName} (Livreur)` : 'Livreur TOKPa'}</strong>
                <span className="text-xs text-gray-600">GPS : {riderCoords[0].toFixed(4)}, {riderCoords[1].toFixed(4)}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marqueur Destination RÉELLE de la commande (landmark) — aucune donnée de test */}
        {destinationCoords && (
          <Marker position={destinationCoords} icon={clientIcon}>
            <Popup>
              <div className="text-center font-sans p-1">
                <strong className="block text-info-dark font-bold">{destinationLabel || 'Point de livraison'}</strong>
                <span className="text-xs text-gray-600">{tx("Destination de la commande")}</span>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Control Button */}
      <button
        type="button"
        onClick={onRecenterRider}
        title={tx("Recentrer sur la position temps réel du livreur")}
        className="absolute bottom-6 right-6 z-[400] w-12 h-12 bg-white rounded-full flex items-center justify-center border border-border-default shadow-xl hover:bg-bg-secondary transition-transform active:scale-95 cursor-pointer"
      >
        <span className="material-symbols-outlined text-text-main">my_location</span>
      </button>
    </div>
  );
}

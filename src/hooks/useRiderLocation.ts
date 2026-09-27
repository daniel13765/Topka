import { useState, useEffect, useRef } from 'react';
import { DANTOKPA_COORDS, CLIENT_COORDS, RIDER_COORDS } from '../components/client/commandes/RealBeninMap';

// Segment d'itinéraire réel dans Cotonou (uniquement utilisé en mode simulation ?simu=1)
const COTONOU_PATH: [number, number][] = [
  DANTOKPA_COORDS, // [6.3725, 2.4332]
  [6.3705, 2.4310],
  [6.3685, 2.4260],
  RIDER_COORDS,    // [6.3670, 2.4210]
  [6.3650, 2.4160],
  [6.3635, 2.4130],
  CLIENT_COORDS,   // [6.3620, 2.4100]
];

interface UseRiderLocationOptions {
  orderId?: string; // si absent, le hook ne s'abonne à aucun canal (disabled)
  enabled?: boolean; // autorise l'abonnement (défaut : true si orderId fourni)
  initialCoords?: [number, number];
  destinationCoords?: [number, number];
  simulatedSpeedMs?: number; // millisecondes entre chaque micro-déplacement (simulation uniquement)
  /**
   * Position GPS réelle renvoyée par GET /orders/{id}/tracking (champ `position`).
   * Priorité sur la simulation.
   */
  realPosition?: [number, number] | null;
  /**
   * Autorise la simulation de démo (?simu=1). DÉFAUT FALSE :
   * sans données réelles, on n'invente aucune position (correspondance endpoints).
   */
  allowSimulation?: boolean;
}

/** Origine des coordonnées : WebSocket Reverb > API tracking > simulation (opt-in) > indisponible. */
export type RiderPositionSource = 'websocket' | 'api' | 'simulation' | 'unavailable';

/**
 * Hook `useRiderLocation` — Position GPS du livreur, alignée sur les endpoints backend :
 *  1. Reverb `private tracking.{orderId}` → événement `livreur.position.updated` (temps réel)
 *  2. GET /api/orders/{id}/tracking → `position` (instantané GPS réel, via `realPosition`)
 *  3. Simulation Cotonou — SEULEMENT si `allowSimulation` (URL ?simu=1) et aucune donnée réelle
 *  Sinon : `source = 'unavailable'` et `riderCoords = null` (aucune position inventée).
 */
export function useRiderLocation({
  orderId,
  enabled,
  initialCoords = RIDER_COORDS,
  destinationCoords = CLIENT_COORDS,
  simulatedSpeedMs = 2500,
  realPosition = null,
  allowSimulation = false,
}: UseRiderLocationOptions) {
  const active = enabled !== false && !!orderId;
  const [riderCoords, setRiderCoords] = useState<[number, number]>(initialCoords);
  const [isWebSocketActive, setIsWebSocketActive] = useState(false);
  const [apiPositionUsed, setApiPositionUsed] = useState(false);
  const pathIndexRef = useRef(3);

  // Calcul dynamique de la distance restante (formule Haversine approximée)
  const calculateDistanceKm = (c1: [number, number], c2: [number, number]) => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = ((c2[0] - c1[0]) * Math.PI) / 180;
    const dLng = ((c2[1] - c1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((c1[0] * Math.PI) / 180) *
        Math.cos((c2[0] * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const source: RiderPositionSource = isWebSocketActive
    ? 'websocket'
    : apiPositionUsed
      ? 'api'
      : allowSimulation
        ? 'simulation'
        : 'unavailable';
  const hasFix = source !== 'unavailable';

  const distanceKm = hasFix ? calculateDistanceKm(riderCoords, destinationCoords) : null;
  // Estimation : ~25 km/h en ville à Cotonou (uniquement avec une position)
  const estimatedMinutes = distanceKm !== null ? Math.max(1, Math.round((distanceKm / 25) * 60)) : null;

  // Priorité 1 — Écoute temps réel Reverb — CANAL RÉEL DU BACKEND :
  //   private tracking.{orderId}  →  événement `livreur.position.updated`
  //   payload : {order_id, livreur_id, latitude, longitude, horodatage}
  useEffect(() => {
    if (!active || !orderId) return undefined;
    if (typeof window !== 'undefined' && (window as unknown as { Echo?: unknown }).Echo) {
      try {
        const echo = (window as unknown as {
          Echo: { private: (channel: string) => { listen: (event: string, cb: (e: { latitude: number; longitude: number }) => void) => void; stopListening: (event: string) => void } };
        }).Echo;
        const channel = echo.private(`tracking.${orderId}`);
        const handler = (data: { latitude: number; longitude: number }) => {
          setIsWebSocketActive(true);
          setRiderCoords([Number(data.latitude), Number(data.longitude)]);
        };
        channel.listen('livreur.position.updated', handler);
        return () => {
          try {
            channel.stopListening('livreur.position.updated');
          } catch {
            /* noop */
          }
        };
      } catch {
        setIsWebSocketActive(false);
      }
    }
    return undefined;
  }, [orderId, active]);

  // Priorité 2 — Position réelle de l'API (GET /orders/{id}/tracking → position)
  useEffect(() => {
    if (!active || isWebSocketActive || !realPosition) return;
    setRiderCoords(realPosition);
    setApiPositionUsed(true);
  }, [active, isWebSocketActive, realPosition]);

  // Priorité 3 — Simulation Cotonou (opt-in ?simu=1, uniquement sans données réelles)
  useEffect(() => {
    if (!active || isWebSocketActive || apiPositionUsed || !allowSimulation) return;

    const interval = setInterval(() => {
      pathIndexRef.current = (pathIndexRef.current + 1) % COTONOU_PATH.length;
      const nextPoint = COTONOU_PATH[pathIndexRef.current];
      setRiderCoords(nextPoint);
    }, simulatedSpeedMs);

    return () => clearInterval(interval);
  }, [active, isWebSocketActive, apiPositionUsed, allowSimulation, simulatedSpeedMs]);

  return {
    /** null = aucune position fiable (n'invente rien) */
    riderCoords: (hasFix ? riderCoords : null) as [number, number] | null,
    estimatedMinutes,
    isWebSocketActive,
    source,
    distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
  };
}

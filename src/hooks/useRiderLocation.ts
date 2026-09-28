import { useEffect, useState } from 'react';

interface UseRiderLocationOptions {
  /** Identifiant de commande — sans lui, le hook ne s'abonne à aucun canal. */
  orderId?: string;
  /** Autorise l'abonnement (défaut : true si `orderId` est fourni). */
  enabled?: boolean;
  /** Destination RÉELLE de la commande (point de repère). Sans elle, ni distance ni ETA. */
  destinationCoords?: [number, number] | null;
  /** Position GPS renvoyée par `GET /orders/{id}/tracking` (champ `position`). */
  realPosition?: [number, number] | null;
}

/** Origine des coordonnées : WebSocket Reverb > API tracking > indisponible. */
export type RiderPositionSource = 'websocket' | 'api' | 'unavailable';

/** Distance orthodromique en km (approximation de l'itinéraire routier, pas un calcul d'itinéraire). */
export function distanceHaversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371; // rayon terrestre en km
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Vitesse commerciale retenue pour l'estimation : ~25 km/h en ville à Cotonou. */
export function minutesEstimees(distanceKm: number | null): number | null {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return null;
  return Math.max(1, Math.round((distanceKm / 25) * 60));
}

/**
 * Position GPS du livreur, alignée sur les endpoints réels :
 *  1. Reverb `private-center tracking.{orderId}` → événement `livreur.position.updated` (temps réel)
 *  2. `GET /orders/{id}/tracking` → `position` (instantané GPS, passé en `realPosition`)
 *
 * Aucune position inventée, aucun déplacement animé : sans donnée réelle, `riderCoords` reste `null`
 * et l'écran affiche « position non encore disponible ». Le mode démonstration qui faisait glisser un
 * faux livreur sur un tracé de Cotonou a été retiré.
 */
export function useRiderLocation({
  orderId,
  enabled,
  destinationCoords = null,
  realPosition = null,
}: UseRiderLocationOptions) {
  const active = enabled !== false && !!orderId;
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [isWebSocketActive, setIsWebSocketActive] = useState(false);
  const [apiPositionUsed, setApiPositionUsed] = useState(false);

  // Priorité 1 — temps réel Reverb. Payload du backend : { order_id, livreur_id, latitude, longitude, horodatage }.
  useEffect(() => {
    if (!active || !orderId) return undefined;
    if (typeof window === 'undefined' || !window.Echo) return undefined;
    try {
      const channel = window.Echo.private(`tracking.${orderId}`);
      const handler = (data: { latitude: number; longitude: number }) => {
        const lat = Number(data?.latitude);
        const lng = Number(data?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
        setIsWebSocketActive(true);
        setPosition([lat, lng]);
      };
      channel.listen('livreur.position.updated', handler);
      return () => {
        try {
          channel.stopListening('livreur.position.updated');
        } catch {
          /* le canal a déjà été fermé par ailleurs */
        }
      };
    } catch {
      setIsWebSocketActive(false);
      return undefined;
    }
  }, [orderId, active]);

  // Priorité 2 — instantané de l'API, seulement tant que le WebSocket ne parle pas.
  useEffect(() => {
    if (!active || isWebSocketActive || !realPosition) return;
    setPosition(realPosition);
    setApiPositionUsed(true);
  }, [active, isWebSocketActive, realPosition]);

  const source: RiderPositionSource = isWebSocketActive ? 'websocket' : apiPositionUsed ? 'api' : 'unavailable';
  const distanceKm = position && destinationCoords ? distanceHaversineKm(position, destinationCoords) : null;

  return {
    /** null = aucune position fiable : rien n'est inventé. */
    riderCoords: position,
    estimatedMinutes: minutesEstimees(distanceKm),
    isWebSocketActive,
    source,
    distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
  };
}

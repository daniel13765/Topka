import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import EmptyState from '../../../components/shared/EmptyState';
import RealBeninMap from '../../../components/client/commandes/RealBeninMap';
import { useRiderLocation } from '../../../hooks/useRiderLocation';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { catalogApi, ordersApi } from '../../../services/api';
import { isOwnOrder } from '../../../utils/ownOrder';
import { alertApiError } from '../../../utils/apiError';
import { tx } from '../../../i18n/tx';


interface ApiRider {
  id: number;
  nom_complet: string;
  telephone?: string;
}

/** Un item de commande — exactement `OrderResource::$items`. */
interface ApiOrderItem {
  id: number;
  product_id: number;
  nom?: string;
  quantite: number;
  prix_unitaire: number;
}

/** Commande — exactement `OrderResource::$data` (GET /orders et GET /orders/{id}). */
interface ApiOrder {
  id: number;
  montant_total?: number;
  frais_livraison?: number;
  devise?: string;
  statut: string;
  description_lieu?: string;
  created_at?: string;
  items?: ApiOrderItem[];
  landmark?: { id: number; nom: string; zone_id?: number } | null;
  livreur?: ApiRider | null;
  payment?: { id: number; montant: number; statut: string; methode: string } | null;
}

/** Position GPS — modèle `SuiviLivraison` sérialisé (decimal:7 → parfois string). */
interface TrackingPosition {
  latitude: number | string;
  longitude: number | string;
  horodatage?: string;
  livreur_id?: number;
  statut?: string;
}

/** GET /orders/{id}/tracking — exactement `TrackingController::show`. */
interface TrackingInfo {
  order_id?: number;
  statut?: string;
  position?: TrackingPosition | null;
  distance_km?: number | string | null;
}

/** Ordre du stepper d'après la machine à états du backend (Commande::STATUT_*). */
const STATUT_FLOW: Record<string, number> = {
  en_attente: 0,
  en_preparation: 1,
  en_livraison: 2,
  livre: 3,
};

/** Libellés FR des statuts réels (dont `annule`). */

/**
 * OrderTrackingPage — Suivi de commande avec GPS temps réel (route protégée).
 * - `?order={id}` (liens Confirmation / Panier) ; sinon liste des commandes + plus récente par défaut.
 * - GET /api/orders/{id}           → statut, montant, livreur assigné (nom + téléphone réels)
 * - GET /api/orders/{id}/tracking  → position + distance restante
 * - Reverb tracking.{id}           → livreur.position.updated (hook useRiderLocation)
 * - Reverb notifications.{userId}  → order.status.changed → rechargement du statut
 */
export default function OrderTrackingPage() {
  const { isFr } = useLanguage();
  const { isAuthenticated, isLoading } = useAuthGuard('/connexion');
  const navigate = useNavigate();
  const search = useSearch({ from: '/commandes/suivi' }) as unknown as { order?: string; simu?: string };

  const [allOrders, setAllOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(search.order ? Number(search.order) : null);
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);

  // Chargement de la liste (pour le sélecteur quand pas de ?order=)
  useEffect(() => {
    if (!isAuthenticated) return;
    ordersApi
      .getOrders()
      .then((res) => {
        const list: ApiOrder[] = (res?.data ?? res ?? []).map((o: Record<string, unknown> & { data?: ApiOrder }) => o.data ?? o);
        setAllOrders(list);
        if (!selectedId && list.length > 0) {
          // sans ?order= : la commande active la plus récente (sinon la plus récente).
          // Le choix d'une commande se fait via /commandes → « Suivre » — le sélecteur de
          // statuts/commandes est réservé au livreur assigné (design Stitch), pas au client.
          const active = list.find((o) => ["en_attente", 'en_preparation', 'en_livraison'].includes(o.statut));
          setSelectedId((active ?? list[0]).id);
        }
      })
      .catch((err) => {
        setFetchError(alertApiError(err, 'tracking-orders'));
      })
      .finally(() => setOrdersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Sync URL (?order=) → sélection (édition manuelle de l'URL incluse — le garde-fou ci-dessous s'applique)
  useEffect(() => {
    if (search.order) setSelectedId(Number(search.order));
  }, [search.order]);

  // Chargement commande + tracking — UNIQUEMENT si la commande figure dans MES commandes
  // (anti-IDOR côté UI : aucune donnée d'une commande étrangère n'est jamais affichée, y compris session admin/manager)
  useEffect(() => {
    if (!isAuthenticated || !selectedId) return;
    let alive = true;
    setAccessDenied(false);
    setOrder(null);
    setTracking(null);
    (async () => {
      try {
        const mine = await isOwnOrder(selectedId);
        if (!alive) return;
        if (!mine) {
          console.warn(`[anti-IDOR] commande #${selectedId} absente de GET /orders (pas à cet utilisateur) → affichage bloqué`);
          setAccessDenied(true);
          return;
        }
        const res = await ordersApi.getOrder(selectedId);
        if (!alive) return;
        setOrder((res?.data ?? res) as ApiOrder);
        const t = await ordersApi.getTracking(selectedId);
        if (alive) setTracking(t as TrackingInfo);
      } catch (err) {
        if (alive) setFetchError(alertApiError(err, 'tracking-detail'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, selectedId]);

  // Destination RÉELLE de la commande : landmark (point_reperes) → GPS via GET /zones.points_repere
  useEffect(() => {
    const lmId = order?.landmark?.id;
    if (!lmId) {
      setDestCoords(null);
      return;
    }
    let alive = true;
    catalogApi
      .getZones()
      .then((res) => {
        const list = (res?.data ?? res ?? []) as Array<{
          points_repere?: Array<{ id: number; latitude?: number | string; longitude?: number | string }>;
        }>;
        for (const z of Array.isArray(list) ? list : []) {
          for (const p of z.points_repere ?? []) {
            if (Number(p.id) === Number(lmId)) {
              const lat = Number(p.latitude);
              const lng = Number(p.longitude);
              if (alive && Number.isFinite(lat) && Number.isFinite(lng)) setDestCoords([lat, lng]);
              return;
            }
          }
        }
      })
      .catch(() => {
        /* zones indisponibles → pas de marqueur destination (honnête) */
      });
    return () => {
      alive = false;
    };
  }, [order?.landmark?.id]);

  // Rafraîchissement temps réel sur les événements de statut (notifications.{userId})
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeRealtimeRefresh(['orders'], (e) => {
      if (e.scope === 'orders' && selectedId && !accessDenied) {
        ordersApi.getOrder(selectedId).then((res) => setOrder((res?.data ?? res) as ApiOrder)).catch(() => {});
        ordersApi.getTracking(selectedId).then((t) => setTracking(t as TrackingInfo)).catch(() => {});
      }
    });
  }, [isAuthenticated, selectedId, accessDenied]);

  // Position GPS réelle (GET /orders/{id}/tracking → position) : priorité sur la simulation
  const realPosition = useMemo<[number, number] | null>(() => {
    const p = tracking?.position;
    if (!p) return null;
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [tracking]);

  const { riderCoords, estimatedMinutes, source } = useRiderLocation({
    orderId: selectedId ? String(selectedId) : undefined,
    enabled: isAuthenticated && !!selectedId && !accessDenied,
    realPosition,
    destinationCoords: destCoords ?? undefined, // ETA vers la destination RÉELLE de la commande
    allowSimulation: search.simu === '1', // démo opt-in uniquement : sans ça, aucune position inventée
    simulatedSpeedMs: 2500,
  });

  const distanceKm = useMemo(() => {
    const d = tracking?.distance_km;
    if (d === undefined || d === null) return null;
    return Number(d);
  }, [tracking]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="bg-bg-app min-h-screen flex items-center justify-center font-body text-text-main">
        <MIcon name="sync" className="text-primary text-4xl animate-spin" />
      </div>
    );
  }

  const stepIndex = order ? (STATUT_FLOW[order.statut] ?? 0) : 0;
  const isDelivered = order?.statut === 'livre';
  const isCancelled = order?.statut === 'annule';
  const articlesCount = (order?.items ?? []).reduce((sum, it) => sum + Number(it.quantite ?? 0), 0);
  const rider = order?.livreur ?? null;

  return (
    <div className="bg-bg-app font-body text-on-surface antialiased min-h-screen flex flex-col">
      <ClientNavbar />

      <main className="flex-grow pt-[52px] pb-[80px] md:pb-0 relative overflow-hidden flex flex-col">
        {/* GPS MAP SECTION */}
        <section className="relative h-[420px] sm:h-[520px] w-full overflow-hidden bg-[#E8F4FD]">
          <RealBeninMap
            riderCoords={riderCoords}
            riderName={rider?.nom_complet}
            destinationCoords={destCoords}
            destinationLabel={[order?.landmark?.nom, order?.description_lieu].filter(Boolean).join(' — ')}
          />
        </section>

        {/* STATUS PANEL (Floating Bottom Sheet) */}
        <section className="relative flex-grow bg-white rounded-t-[20px] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-lg pt-lg pb-xl z-40 -mt-8 overflow-y-auto max-w-[800px] mx-auto w-full">
          <div className="w-12 h-1.5 bg-border-default rounded-full mx-auto mb-lg" />

          {fetchError && (
            <div className="mb-lg p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark leading-relaxed">
              {fetchError}
            </div>
          )}

          {ordersLoading ? (
            <div className="py-2xl flex justify-center">
              <MIcon name="sync" className="text-primary text-3xl animate-spin" />
            </div>
          ) : allOrders.length === 0 ? (
            <div className="py-xl">
              <EmptyState
                icon={<MIcon name="local_shipping" className="text-4xl text-primary" />}
                title={isFr ? tx("Aucune commande à suivre") : 'No orders to track'}
                description={isFr ? tx("Vos commandes en cours apparaîtront ici.") : 'Your ongoing orders will appear here.'}
                action={
                  <button
                    type="button"
                    className="px-lg py-3 bg-primary-container text-white rounded-lg font-bold cursor-pointer"
                    onClick={() => navigate({ to: '/catalogue' })}
                  >
                    {isFr ? tx("Explorer le marché") : 'Browse the market'}
                  </button>
                }
              />
            </div>
          ) : accessDenied ? (
            <div className="py-xl">
              <EmptyState
                icon={<MIcon name="lock" className="text-4xl text-error-dark" />}
                title={isFr ? tx("Commande introuvable") : 'Order not found'}
                description={
                  isFr
                    ? 'Cette commande n’existe pas sur votre compte : elle ne peut pas être suivue ici.'
                    : 'This order does not exist on your account: it cannot be tracked here.'
                }
                action={
                  <button
                    type="button"
                    className="px-lg py-3 bg-primary-container text-white rounded-lg font-bold cursor-pointer"
                    onClick={() => navigate({ to: '/commandes' })}
                  >
                    {isFr ? tx("Mes commandes") : 'My orders'}
                  </button>
                }
              />
            </div>
          ) : (
            <>
              {/* Commande suivie — EN LECTURE SEULE (aucune sélection de statut : réservée au livreur assigné) */}
              <div className="flex justify-between items-center mb-md">
                <span className="font-label text-label text-text-secondary">
                  {isFr ? tx("Commande") : 'Order'} #{selectedId}
                </span>
                <Link to="/commandes" className="text-label text-primary-container font-bold hover:underline">
                  {isFr ? tx("Toutes mes commandes") : 'All my orders'}
                </Link>
              </div>

              {/* Header Status with Live GPS Badge */}
              <div className="flex flex-wrap justify-between items-start mb-lg gap-2">
                <div>
                  <div
                    className={`inline-flex items-center gap-xs px-md py-xs rounded-full mb-sm border ${
                      isDelivered
                        ? 'bg-success-light text-success-dark border-success-light'
                        : isCancelled
                          ? 'bg-error-light text-error-dark border-error/20'
                          : 'bg-primary-tint text-primary-dark border-primary-light'
                    }`}
                  >
                    {!isDelivered && !isCancelled && <span className="w-2.5 h-2.5 rounded-full bg-success animate-ping inline-block" />}
                    {(isDelivered || isCancelled) && <MIcon name={isCancelled ? 'cancel' : 'check'} className="text-[14px]" />}
                    <span className="text-label font-bold">
                      {isDelivered
                        ? isFr ? tx("Commande livrée") : 'Order delivered'
                        : isCancelled
                          ? isFr ? tx("Commande annulée") : 'Order cancelled'
                          : isFr ? 'Suivi en direct' : 'Live tracking'}
                    </span>
                  </div>
                  {!isDelivered && !isCancelled && (
                    <div className="flex items-center gap-sm text-primary-container">
                      <MIcon name="schedule" />
                      <span className="font-h3 font-bold">
                        {estimatedMinutes === null
                          ? isFr
                            ? tx("Arrivée estimée : dès la première position GPS")
                            : 'Estimated arrival: awaiting first GPS fix'
                          : isFr
                            ? `Arrivée estimée : ~${estimatedMinutes} min${
                                distanceKm !== null ? ` (${distanceKm.toFixed(1)} km restant)` : ''
                              }`
                            : `Estimated arrival: ~${estimatedMinutes} min${
                                distanceKm !== null ? ` (${distanceKm.toFixed(1)} km remaining)` : ''
                              }`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-micro bg-bg-secondary px-3 py-1.5 rounded-lg border border-border-default font-mono text-text-secondary">
                  {riderCoords ? (
                    <>
                      GPS: {riderCoords[0].toFixed(4)}, {riderCoords[1].toFixed(4)}
                      {source === 'websocket'
                        ? ' (WebSocket Reverb)'
                        : source === 'api'
                          ? ' (GPS API /orders/{id}/tracking)'
                          : ' (simulation ?simu=1)'}
                    </>
                  ) : isFr ? (
                    'Position du livreur non encore disponible'
                  ) : (
                    'Rider position not available yet'
                  )}
                </div>
              </div>

              {/* Progress Stepper — état piloté par le statut backend */}
              <div className="relative flex justify-between items-center mb-xl px-sm">
                <div className="absolute left-md right-md h-[3px] bg-border-default top-1/2 -translate-y-1/2 z-0" />
                <div
                  className="absolute left-md h-[3px] bg-primary-container top-1/2 -translate-y-1/2 z-0 transition-all duration-700"
                  style={{ width: `${(stepIndex / 3) * 100}%` }}
                />

                {[
                  { labelFr: tx("Marché Dantokpa"), labelEn: 'Dantokpa Market', icon: 'store' },
                  { labelFr: tx("Préparation"), labelEn: 'Preparing', icon: 'inventory_2' },
                  { labelFr: 'En cours de route', labelEn: 'In transit', icon: 'local_shipping' },
                  { labelFr: tx("Livrée"), labelEn: 'Delivered', icon: 'check_circle' },
                ].map((step, i) => {
                  const done = i < stepIndex || isDelivered;
                  const active = i === stepIndex && !isDelivered;
                  return (
                    <div key={step.labelFr} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${
                          done
                            ? 'bg-success text-white'
                            : active
                              ? 'bg-primary-container text-white animate-bounce'
                              : 'bg-white border-2 border-border-default text-border-default'
                        }`}
                      >
                        <MIcon name={done ? 'check' : (step.icon as string)} className="text-[16px]" />
                      </div>
                      <span
                        className={`text-micro mt-sm ${
                          active ? 'text-primary-container font-bold' : 'text-text-secondary'
                        }`}
                      >
                        {isFr ? step.labelFr : step.labelEn}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rider Info Card — livreur réel assigné (GET /orders/{id}) */}
              <div className="bg-bg-secondary rounded-lg p-md mb-lg flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center text-white font-bold text-h3">
                    {rider
                      ? rider.nom_complet
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'TK'}
                  </div>
                  <div>
                    <h4 className="font-label text-body text-text-main font-bold">
                      {rider ? rider.nom_complet : isFr ? 'Livreur en cours d’assignation…' : 'Rider being assigned…'}
                    </h4>
                    <p className="text-secondary text-text-secondary">
                      {rider
                        ? isFr
                          ? `Livreur TOKPa (zone Cotonou)`
                          : 'TOKPa rider (Cotonou zone)'
                        : isFr
                          ? 'Assignation par la supervision'
                          : 'Assigned by the supervisor'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-sm">
                  {rider?.telephone && (
                    <a
                      href={`tel:${rider.telephone.replace(/\s/g, '')}`}
                      className="w-10 h-10 bg-white border border-border-default rounded-lg flex items-center justify-center text-primary-container active:scale-95 transition-transform"
                      title={isFr ? 'Appeler le livreur' : 'Call rider'}
                    >
                      <MIcon name="call" />
                    </a>
                  )}
                  <Link
                    to="/messagerie"
                    className="w-10 h-10 bg-white border border-border-default rounded-lg flex items-center justify-center text-primary-container active:scale-95 transition-transform"
                    title={isFr ? tx("Discuter") : 'Chat'}
                  >
                    <MIcon name="chat" />
                  </Link>
                </div>
              </div>

              {/* Order Summary Card — données réelles */}
              {order && (
                <div className="border border-border-default rounded-lg p-md">
                  <div className="flex justify-between items-center mb-xs">
                    <span className="text-label font-bold text-text-main">
                      {isFr ? tx("Commande") : 'Order'} #{order.id}
                    </span>
                    <Link
                      to="/messagerie"
                      className="text-label text-primary-container font-bold hover:underline"
                    >
                      {isFr ? tx("Contacter le support") : 'Contact support'}
                    </Link>
                  </div>
                  <div className="flex justify-between text-body">
                    <span className="text-text-secondary">
                      {articlesCount} {isFr ? 'article(s)' : 'item(s)'}
                      {order.created_at ? ` · ${new Date(order.created_at).toLocaleDateString('fr-FR')}` : ''}
                    </span>
                    <span className="font-price text-text-main">
                      {Number(order.montant_total ?? 0).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  {(order.landmark?.nom || order.description_lieu) && (
                    <p className="mt-sm text-micro text-text-tertiary">
                      {isFr ? tx("Livraison") : 'Delivery'} : {order.landmark?.nom ?? '—'}
                      {order.description_lieu ? ` — ${order.description_lieu}` : ''}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <ClientBottomNav />
    </div>
  );
}

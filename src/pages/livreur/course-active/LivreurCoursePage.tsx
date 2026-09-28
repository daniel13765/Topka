import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import RealBeninMap from '../../../components/client/commandes/RealBeninMap';
import FaIcon from '../../../components/shared/FaIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import EmptyState from '../../../components/shared/EmptyState';
import { livreurApi } from '../../../services/api';
import { fmtFcfa } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { listenPrivate } from '../../../services/realtime/echo';
import { idCommandeDunEvenement } from '../../../utils/realtimeEvents';
import { currentUserName } from '../../../routes/authGuard';
import {
  dateHeure,
  destination,
  etaMinutes,
  fetchDeliveries,
  fetchLandmarkGeo,
  fmtKm,
  haversineKm,
  statutLabel,
  tokRef,
  URBAN_SPEED_KMH,
  type LandmarkGeo,
  type LivreurOrder,
} from '../livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';

/** Envoi de la position au plus toutes les 20 s (POST /livreur/position) pendant la livraison. */
const GPS_INTERVAL_MS = 20_000;

type GpsState = 'off' | 'waiting' | 'on' | 'denied' | 'unavailable';

/** « 2 500 » — la maquette affiche le montant sans suffixe, « FCFA » étant un libellé plus petit. */
const fmtNum = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('fr-FR');

/**
 * Course active — maquettes Stitch « course_active_tokpa » (mobile : carte plein écran + panneau
 * remontant sur la carte) et « course_active_tokpa_desktop » (carte 70 % / détails 30 %).
 *
 * Données réellement appelées :
 *  - GET /livreur/deliveries (course affichée), PATCH /livreur/deliveries/{id}/status (démarrer, livrer),
 *  - POST /livreur/position (GPS réel partagé pendant la course),
 *  - GET /zones → points_repere[] (lat/lng réels) pour le marqueur de destination, la distance haversine
 *    et l'ETA estimée (`/orders/{id}/tracking` qui fait ce calcul côté back est réservé au rôle client).
 *
 * Aucune donnée inventée : l'API ne transmet ni le nom/téléphone du client (OrderResource, B-25), ni
 * d'heure d'arrivée garantie — l'ETA est annoncée comme estimation ; Appeler/Message et « Signaler un
 * problème » restent désactivés tant qu'aucun endpoint livreur n'existe (messagerie réservée au client, B-21).
 */
export default function LivreurCoursePage() {
  useLanguage();
  const { commande } = useSearch({ from: '/livreur/course' });
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<LivreurOrder[] | null>(null);
  const [geoIndex, setGeoIndex] = useState<Map<number, LandmarkGeo> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [gps, setGps] = useState<GpsState>('off');
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const lastSentAt = useRef(0);

  useEffect(() => {
    let alive = true;
    setDeliveries(null);
    setErr(null);
    fetchDeliveries()
      .then((l) => alive && setDeliveries(l))
      .catch((e) => alive && setErr(alertApiError(e, 'livreur-load')));
    // Coordonnées des points de repère : index id → lat/lng (cache partagé 10 min, GET /zones).
    fetchLandmarkGeo()
      .then((m) => alive && setGeoIndex(m))
      .catch(() => alive && setGeoIndex(new Map()));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Course affichée : celle demandée (?commande=), sinon celle en livraison, sinon la première assignée.
  const order: LivreurOrder | null = deliveries
    ? ((commande
        ? deliveries.find((o) => o.id === commande)
        : (deliveries.find((o) => o.statut === 'en_livraison') ?? deliveries[0])) ?? null)
    : null;
  const enLivraison = order?.statut === 'en_livraison';

  // Relecture discrète : pas d'effacement de l'écran (la carte et le GPS en cours ne doivent pas
  // se figer) ; seule la liste des courses est remplacée quand le bus temps réel parle.
  const rechargerDiscrètement = useCallback(() => {
    fetchDeliveries()
      .then(setDeliveries)
      .catch(() => {
        /* silencieux : l'écran affiche déjà l'état chargé */
      });
  }, []);

  // `delivery.assigned` (nouvelle course pendant qu'on est sur l'écran) passe par le bridge global.
  useEffect(() => subscribeRealtimeRefresh(['orders'], () => rechargerDiscrètement()), [rechargerDiscrètement]);

  // Un administrateur peut retourner une statut (`PATCH /admin/orders/{order}/status` →
  // OrderStatusChanged sur `tracking.{orderId}`, canal dont le livreur est membre d'après
  // routes/channels.php). Sans cet abonnement, la course resterait « en livraison » à l'écran.
  useEffect(() => {
    if (!order) return;
    const orderId = order.id;
    const { stop } = listenPrivate(`tracking.${orderId}`, 'order.status.changed', (payload) => {
      if (idCommandeDunEvenement(payload) !== orderId) return;
      const statut = (payload as { statut?: string })?.statut;
      rechargerDiscrètement();
      if (statut === 'annule') {
        toast.error(tx('Cette course vient d’être annulée par l’administration.'), { id: 'livreur-course-annulee' });
      }
    });
    return stop;
  }, [order, rechargerDiscrètement]);

  // GPS réel partagé pendant la livraison uniquement (F-14) ; aucune position simulée.
  useEffect(() => {
    if (!order || !enLivraison) {
      setGps('off');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGps('unavailable');
      return;
    }
    setGps('waiting');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCoords(c);
        setGps('on');
        const now = Date.now();
        if (now - lastSentAt.current >= GPS_INTERVAL_MS) {
          lastSentAt.current = now;
          livreurApi
            .updatePosition({
              latitude: c[0],
              longitude: c[1],
              order_id: order.id,
            })
            .then(() => setLastSent(Date.now()))
            .catch((e) => alertApiError(e, 'livreur-gps'));
        }
      },
      (e) => setGps(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    const ticker = window.setInterval(() => setTick((t) => t + 1), 5_000); // « il y a X s »
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(ticker);
    };
  }, [order?.id, enLivraison]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = async (statut: 'en_livraison' | 'livre') => {
    if (!order) return;
    if (statut === 'livre' && !confirm(`Confirmer la livraison de la commande ${tokRef(order.id)} ?`)) return;
    setBusy(true);
    try {
      const r = await livreurApi.updateStatus(order.id, statut);
      if (statut === 'livre') {
        toast.success(tx('Livraison enregistrée.'));
        navigate({
          to: '/livreur/recapitulatif',
          search: { commande: order.id },
          state: {
            order: { ...order, statut: 'livre' },
            deliveredAt: r?.data?.updated_at ?? null,
          } as unknown as Record<string, unknown>,
        });
      } else {
        toast.success(tx('Livraison démarrée : votre position est partagée pendant la course.'));
        setDeliveries((l) => (l ?? []).map((o) => (o.id === order.id ? { ...o, statut } : o)));
      }
    } catch (e) {
      alertApiError(e, 'livreur-status'); // ex. 422 « Transition interdite. » (B-22)
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Ce que la carte et les statistiques peuvent réellement afficher ---------- */

  const geo: LandmarkGeo | null = useMemo(() => {
    const id = order?.landmark?.id;
    if (!geoIndex || id == null) return null;
    return geoIndex.get(Number(id)) ?? null;
  }, [geoIndex, order?.landmark?.id]);

  const destCoords: [number, number] | null = geo ? [geo.lat, geo.lng] : null;
  const distanceKm = coords && destCoords ? haversineKm(coords, destCoords) : null;
  const eta = enLivraison ? etaMinutes(distanceKm) : null;

  const gpsText = !enLivraison
    ? ''
    : gps === 'on'
      ? lastSent
        ? `Position partagée · il y a ${Math.max(1, Math.round((Date.now() - lastSent) / 1000))} s`
        : tx('Position GPS trouvée · envoi en cours')
      : gps === 'waiting'
        ? tx('Recherche de votre position GPS…')
        : gps === 'denied'
          ? tx('Localisation refusée : autorisez le GPS pour partager votre position')
          : gps === 'unavailable'
            ? 'GPS indisponible sur cet appareil'
            : '';

  /** Puce mobile « 1,2 km restant » : la distance réelle exige un point GPS + un repère géolocalisé. */
  const restant =
    distanceKm != null
      ? `${fmtKm(distanceKm)} ${tx('restant')}`
      : enLivraison
        ? tx('Distance en attente de votre position GPS')
        : tx('Distance disponible pendant la livraison');

  /** Ligne d'alerte ambre de la maquette : consigne réelle déduite du statut (aucun texte inventé). */
  const consigne = enLivraison
    ? tx('Votre position est partagée au client tant que la course est en livraison.')
    : order?.statut === 'en_preparation'
      ? tx('Démarrez la livraison une fois la commande récupérée au point de retrait.')
      : tx('La commande doit passer en préparation avant le retrait.');

  const badge = !order
    ? null
    : order.statut === 'en_livraison'
      ? {
          title: tx('En direction du client'),
          sub: eta != null ? `${tx('Arrivée estimée :')} ${eta} min` : gpsText || tx('Position GPS en attente'),
        }
      : order.statut === 'en_preparation'
        ? {
            title: tx('Commande en préparation'),
            sub: tx('Démarrez la livraison une fois la commande récupérée.'),
          }
        : {
            title: tx('En attente de préparation'),
            sub: tx('La commande doit d’abord être mise en préparation.'),
          };

  if (err || deliveries === null || !order) {
    return (
      <LivreurLayout>
        <div className="mx-auto max-w-[640px] p-lg">
          {err ? (
            <ApiErrorState
              title={tx('Impossible de charger vos courses')}
              message={err}
              onRetry={() => setReloadKey((k) => k + 1)}
              className="rounded-lg border border-border-default bg-bg-card px-md"
            />
          ) : deliveries === null ? (
            <LoadingState
              label={tx('Chargement de la course…')}
              className="rounded-lg border border-border-default bg-bg-card"
            />
          ) : (
            <EmptyState
              icon={<FaIcon name="local_shipping" className="text-4xl text-primary" />}
              title={commande ? `La course ${tokRef(commande)} n’est plus en cours` : tx('Aucune livraison en cours')}
              description={
                commande
                  ? tx('Elle a peut-être été livrée, refusée ou réattribuée. Consultez votre historique.')
                  : tx('Les courses qui vous sont assignées apparaîtront ici.')
              }
              action={
                <div className="flex flex-wrap justify-center gap-sm">
                  <Link to="/livreur" className="rounded-lg bg-primary-container px-lg py-3 font-bold text-white">
                    {tx('Tableau de bord')}
                  </Link>
                  <Link
                    to="/livreur/historique"
                    className="rounded-lg border border-border-default px-lg py-3 font-bold text-primary"
                  >
                    {tx('Historique')}
                  </Link>
                </div>
              }
              className="rounded-lg border border-border-default bg-bg-card px-md"
            />
          )}
        </div>
      </LivreurLayout>
    );
  }

  /* ---------- Blocs partagés entre les deux compositions ---------- */

  /** Bandeau 3 statistiques de la maquette mobile : Arrivée · Tarif · Distance. */
  const statStrip = (
    <div className="mb-md grid grid-cols-3 items-center gap-2 rounded-lg border border-outline-variant/30 bg-primary-tint p-3 text-center [&>div+div]:border-l [&>div+div]:border-outline-variant/20">
      <div className="flex flex-col items-center justify-center">
        <div className="mb-0.5 flex items-center gap-1 text-on-surface-variant">
          <FaIcon name="schedule" className="text-[16px] text-primary" />
          <span className="text-micro uppercase tracking-wider text-text-secondary">{tx('Arrivée')}</span>
        </div>
        <span
          className="text-h3 font-bold text-primary"
          title={
            eta != null
              ? tr(
                  `Estimation à ${URBAN_SPEED_KMH} km/h sur la distance réelle`,
                  `Estimated at ${URBAN_SPEED_KMH} km/h over the real distance`,
                )
              : tx('Aucune position GPS : distance et ETA indisponibles')
          }
        >
          {eta != null ? `${eta} min` : '—'}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center pl-2">
        <div className="mb-0.5 flex items-center gap-1 text-on-surface-variant">
          <FaIcon name="payments" className="text-[16px] text-primary" />
          <span className="text-micro uppercase tracking-wider text-text-secondary">{tx('Tarif')}</span>
        </div>
        <span className="text-h3 font-bold text-primary-container">
          {fmtNum(order.montant_total)} <span className="text-[11px] font-semibold">FCFA</span>
        </span>
      </div>
      <div className="flex flex-col items-center justify-center pl-2">
        <div className="mb-0.5 flex items-center gap-1 text-on-surface-variant">
          <FaIcon name="route" className="text-[16px] text-primary" />
          <span className="text-micro uppercase tracking-wider text-text-secondary">{tx('Distance')}</span>
        </div>
        <span
          className="text-h3 font-bold text-on-surface"
          title={
            distanceKm != null
              ? tx('Distance à vol d’oiseau jusqu’au point de livraison')
              : tx('Position GPS ou coordonnées du repère indisponibles')
          }
        >
          {fmtKm(distanceKm)}
        </span>
      </div>
    </div>
  );

  /** Contact client : l'API ne transmet ni téléphone ni messagerie côté livreur → boutons désactivés. */
  const contactButtons = (variant: 'mobile' | 'desktop') => (
    <div
      className={clsx(
        'grid grid-cols-2',
        variant === 'mobile' ? 'gap-3' : 'gap-sm',
        variant === 'mobile' ? 'mb-md' : '',
      )}
    >
      {(
        [
          {
            key: 'call',
            label: tx('Appeler'),
            disabledCls:
              variant === 'mobile' ? 'bg-success-light text-success-dark' : 'bg-white text-on-surface-variant',
            reason: tx("Numéro du client non transmis par l'API"),
          },
          {
            key: 'chat_bubble',
            label: variant === 'mobile' ? tx('Message') : tx('Chat'),
            disabledCls: variant === 'mobile' ? 'bg-info-light text-info-dark' : 'bg-white text-on-surface-variant',
            reason: tx('Messagerie non ouverte aux livreurs par le backend'),
          },
        ] as const
      ).map((b) => (
        <button
          key={b.key}
          type="button"
          disabled
          title={b.reason}
          className={clsx(
            'flex cursor-not-allowed items-center justify-center gap-2 rounded-[10px] font-h3 opacity-60 transition-all',
            variant === 'mobile' ? 'py-4' : 'border border-border-default py-sm text-sm',
            b.disabledCls,
          )}
        >
          <FaIcon name={b.key} className={variant === 'mobile' ? 'text-[20px]' : 'text-[16px]'} />
          {b.label}
        </button>
      ))}
    </div>
  );

  /** Contenu de la commande (maquette desktop) — quantités et prix réellement renvoyés par l'API. */
  const orderItems = (
    <div className="space-y-md">
      <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
        {tx('Contenu de la commande')}
      </h4>
      <div className="space-y-sm">
        {(order.items ?? []).length === 0 && (
          <p className="text-sm text-on-surface-variant">{tx('Aucun article transmis.')}</p>
        )}
        {(order.items ?? []).map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded-lg bg-bg-app px-md py-sm">
            <p className="text-sm">
              <span className="font-bold text-primary">{it.quantite}x</span> {it.nom ?? `Produit #${it.product_id}`}
            </p>
            <span className="text-xs text-on-surface-variant">{fmtFcfa(it.prix_unitaire)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const primaryAction = enLivraison ? (
    <button
      type="button"
      disabled={busy}
      onClick={() => changeStatus('livre')}
      className={clsx(
        'flex w-full items-center justify-center gap-2 rounded-[10px] py-4 font-h2 text-white shadow-md transition-all active:scale-[0.97] disabled:opacity-60 lg:gap-md lg:rounded-lg lg:py-lg lg:text-h3',
        'bg-primary-container hover:bg-primary-hover lg:bg-success lg:shadow-success-light lg:hover:bg-success-dark',
      )}
    >
      <FaIcon name="check_circle" className="text-[24px] lg:text-[20px]" />
      {tx('Marquer comme livré')}
    </button>
  ) : (
    <button
      type="button"
      disabled={busy || order.statut !== 'en_preparation'}
      onClick={() => changeStatus('en_livraison')}
      title={order.statut === 'en_attente' ? tx('La commande doit d’abord être mise en préparation') : undefined}
      className={clsx(
        'flex w-full items-center justify-center gap-2 rounded-[10px] py-4 font-h2 text-white shadow-md transition-all active:scale-[0.97] disabled:opacity-60 lg:gap-md lg:rounded-lg lg:py-lg lg:text-h3',
        order.statut === 'en_preparation'
          ? 'bg-primary-container hover:bg-primary-hover'
          : 'cursor-not-allowed bg-text-tertiary',
      )}
    >
      <FaIcon name="two_wheeler" className="text-[24px] lg:text-[20px]" />
      {order.statut === 'en_preparation' ? tx('Démarrer la livraison') : tx('En attente de préparation')}
    </button>
  );

  return (
    <LivreurLayout>
      <div className="flex min-h-0 flex-col lg:h-[calc(100dvh-52px)] lg:flex-row">
        {/* ============ CARTE (70 % desktop, plein écran mobile) ============ */}
        <section className="relative flex flex-col lg:h-full lg:w-[70%] lg:min-h-0">
          <div className="relative h-[450px] shrink-0 overflow-hidden bg-surface-container-low lg:h-full lg:flex-1 lg:min-h-[450px]">
            <div className="absolute inset-0 z-0">
              <RealBeninMap
                riderCoords={coords}
                riderName={currentUserName() ?? undefined}
                destinationCoords={destCoords}
                destinationLabel={geo?.nom ?? destination(order)}
              />
            </div>

            {/* Retour vers le tableau de bord — maquette mobile */}
            <Link
              to="/livreur"
              aria-label={tx('Retour au tableau de bord')}
              className="absolute left-md top-md z-[600] flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-white text-on-surface shadow-sm transition-all active:scale-95 lg:hidden"
            >
              <FaIcon name="chevron_left" />
            </Link>

            {/* Puce « X,X km restant » — maquette mobile */}
            <div className="absolute left-1/2 top-md z-[600] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[10px] border border-outline-variant/30 bg-white px-md py-sm shadow-sm">
              <FaIcon name="near_me" className="text-[20px] text-primary" />
              <span className="text-h3 text-on-surface">{restant}</span>
            </div>

            {/* Badge flottant d'état — maquette desktop */}
            {badge && (
              <div className="absolute left-md top-md z-[600] hidden max-w-[calc(100%-32px)] lg:block">
                <div className="flex items-center gap-md rounded-lg border border-border-default bg-white px-lg py-md shadow-lg">
                  <span
                    className={clsx(
                      'relative h-3 w-3 shrink-0 rounded-full bg-primary',
                      enLivraison && 'tokpa-pulse-ring',
                    )}
                  >
                    {enLivraison && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
                    )}
                    <span className="relative block h-3 w-3 rounded-full bg-primary" />
                  </span>
                  <div>
                    <h2 className="text-h3 font-bold text-primary">{badge.title}</h2>
                    {badge.sub && <p className="text-xs text-on-surface-variant">{badge.sub}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============ PANNEAU MOBILE (feuille qui remonte sur la carte) ============ */}
          <div className="tokpa-sheet relative z-[610] -mt-6 rounded-t-[20px] bg-white pb-md pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.10)] lg:hidden">
            <div className="flex w-full justify-center pb-2 pt-1">
              <span className="h-1 w-10 rounded-full bg-border-default" />
            </div>
            <div className="px-md">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-h2 font-bold text-white shadow-inner">
                  <FaIcon name="person" className="text-[22px]" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-h2 leading-tight text-on-surface">{tx('Client TOKPa')}</h2>
                  <p className="font-secondary text-secondary">
                    {geo?.zone ? `${geo.zone}, Cotonou` : destination(order)}
                  </p>
                </div>
              </div>

              {statStrip}

              <div className="mb-md space-y-4">
                <div className="flex gap-3">
                  <FaIcon name="location_on" className="mt-1 shrink-0 text-[20px] text-primary" />
                  <p className="font-label leading-snug text-on-surface-variant">
                    {order.description_lieu || destination(order)}
                  </p>
                </div>
                <div className="flex gap-3 rounded-lg border-l-4 border-secondary-container bg-amber-light/40 p-3">
                  <FaIcon name="info" className="shrink-0 text-[20px] text-secondary" />
                  <p className="font-secondary text-amber-text text-secondary">{consigne}</p>
                </div>
              </div>

              {contactButtons('mobile')}

              {primaryAction}

              <p className="mt-sm text-[11px] text-on-surface-variant">
                {tx('Coordonnées du client et messagerie livreur non encore fournies par l’API.')}
              </p>
            </div>
          </div>
        </section>

        {/* ============ DÉTAILS (colonne 30 %, desktop) ============ */}
        <section className="z-10 hidden flex-col border-l border-border-default bg-white lg:flex lg:h-full lg:w-[30%]">
          <div className="border-b border-border-default bg-surface-container-low p-lg">
            <div className="mb-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {tx('Référence commande')}
                </p>
                <h3 className="font-h2 text-h2 font-black text-on-surface">{tokRef(order.id)}</h3>
              </div>
              <span className="rounded-full border border-primary-light bg-primary-tint px-sm py-1 text-xs font-bold text-primary">
                {statutLabel(order.statut)}
              </span>
            </div>
            {gpsText && (
              <p className="mt-sm flex items-center gap-sm text-xs text-on-surface-variant">
                <FaIcon name="my_location" className="text-[14px] text-success" />
                {gpsText}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-lg overflow-y-auto p-lg">
            {/* Fiche client */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-md">
              <div className="mb-md flex items-center gap-md">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary-container text-white shadow-sm">
                  <FaIcon name="person" className="text-[20px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-on-surface">{tx('Client TOKPa')}</p>
                  <p className="text-xs text-on-surface-variant">
                    {tx('Commande du')} {dateHeure(order.created_at)}
                  </p>
                </div>
              </div>
              <div className="space-y-md">
                <div className="flex gap-md">
                  <FaIcon name="storefront" className="shrink-0 text-on-surface-variant" />
                  <div className="text-sm">
                    <p className="text-xs font-bold text-primary">{tx('Retrait')}</p>
                    <p className="text-on-surface">{tx('Marché Dantokpa')}</p>
                  </div>
                </div>
                <div className="flex gap-md">
                  <FaIcon name="pin_drop" className="shrink-0 text-primary" />
                  <div className="text-sm">
                    <p className="text-xs font-bold text-primary">{tx('Livraison')}</p>
                    <p className="text-on-surface">{destination(order)}</p>
                    {geo?.zone && <p className="text-xs text-on-surface-variant">{geo.zone}</p>}
                    {!geo && order.landmark?.id != null && (
                      <p className="text-xs text-on-surface-variant">
                        {tx('Coordonnées du repère absentes de GET /zones')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-lg">{contactButtons('desktop')}</div>
              <p className="mt-sm text-[11px] text-on-surface-variant">
                {tx('Coordonnées du client et messagerie livreur non encore fournies par l’API.')}
              </p>
            </div>

            {orderItems}

            {/* Paiement : montant_total inclut déjà les frais de livraison (OrderController). */}
            <div className="border-t border-border-default pt-lg">
              <div className="flex items-center justify-between">
                <p className="text-on-surface-variant">{tx('Total à percevoir')}</p>
                <p className="font-price text-h2 font-black text-primary-container">{fmtFcfa(order.montant_total)}</p>
              </div>
              <div className="mt-2 flex items-center gap-sm text-xs font-medium text-on-surface-variant">
                <FaIcon name="two_wheeler" className="text-sm" />
                {tx('dont frais de livraison')} {fmtFcfa(order.frais_livraison)}
              </div>
            </div>
          </div>

          {/* Actions (statut réel) */}
          <div className="space-y-md bg-white p-lg shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <div className="lg:space-y-md">{primaryAction}</div>
            <button
              type="button"
              disabled
              title={tx("Aucun endpoint d'incident n'existe encore côté backend")}
              className="flex w-full cursor-not-allowed items-center justify-center gap-sm rounded-lg py-sm font-medium text-error opacity-60 transition-colors hover:bg-error-light"
            >
              <FaIcon name="report" className="text-[14px]" />
              {tx('Signaler un problème')}
            </button>
          </div>
        </section>
      </div>
    </LivreurLayout>
  );
}

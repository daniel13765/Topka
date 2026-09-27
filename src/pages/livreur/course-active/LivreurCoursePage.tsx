import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import RealBeninMap from '../../../components/client/commandes/RealBeninMap';
import MIcon from '../../../components/shared/MIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import EmptyState from '../../../components/shared/EmptyState';
import { livreurApi } from '../../../services/api';
import { fmtFcfa } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { currentUserName } from '../../../routes/authGuard';
import { dateHeure, destination, fetchDeliveries, statutLabel, tokRef, type LivreurOrder } from '../livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


/** Envoi de la position au plus toutes les 20 s (POST /livreur/position) pendant la livraison. */
const GPS_INTERVAL_MS = 20_000;

type GpsState = 'off' | 'waiting' | 'on' | 'denied' | 'unavailable';

/**
 * Course active — design Stitch « course_active_tokpa_desktop » (carte 70 % + détails 30 %), données
 * réelles : GET /livreur/deliveries, PATCH /livreur/deliveries/{id}/status, POST /livreur/position.
 * Point de retrait = repère fixe « Marché Dantokpa » de la carte (conservé sur décision utilisateur).
 * Non disponibles dans l'API : nom/téléphone du client et coordonnées du point de repère (B-25),
 * messagerie livreur (B-21) — boutons Appeler/Chat affichés désactivés, avec leur explication.
 */
export default function LivreurCoursePage() {
  useLanguage();
  const { commande } = useSearch({ from: '/livreur/course' });
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<LivreurOrder[] | null>(null);
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
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Course affichée : celle demandée (?commande=), sinon celle en livraison, sinon la première assignée.
  const order: LivreurOrder | null = deliveries
    ? (commande ? deliveries.find((o) => o.id === commande) : (deliveries.find((o) => o.statut === 'en_livraison') ?? deliveries[0])) ?? null
    : null;
  const enLivraison = order?.statut === 'en_livraison';

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
            .updatePosition({ latitude: c[0], longitude: c[1], order_id: order.id })
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
        toast.success(tx("Livraison enregistrée."));
        navigate({
          to: '/livreur/recapitulatif',
          search: { commande: order.id },
          state: { order: { ...order, statut: 'livre' }, deliveredAt: r?.data?.updated_at ?? null } as unknown as Record<string, unknown>,
        });
      } else {
        toast.success(tx("Livraison démarrée : votre position est partagée pendant la course."));
        setDeliveries((l) => (l ?? []).map((o) => (o.id === order.id ? { ...o, statut } : o)));
      }
    } catch (e) {
      alertApiError(e, 'livreur-status'); // ex. 422 « Transition interdite. » (B-22)
    } finally {
      setBusy(false);
    }
  };

  const gpsText =
    gps === 'on'
      ? lastSent
        ? `Position partagée · il y a ${Math.max(1, Math.round((Date.now() - lastSent) / 1000))} s`
        : tx("Position GPS trouvée · envoi en cours")
      : gps === 'waiting'
        ? tx("Recherche de votre position GPS…")
        : gps === 'denied'
          ? tx("Localisation refusée : autorisez le GPS pour partager votre position")
          : gps === 'unavailable'
            ? 'GPS indisponible sur cet appareil'
            : '';

  const badge = !order
    ? null
    : order.statut === 'en_livraison'
      ? { title: 'En direction du client', sub: gpsText }
      : order.statut === 'en_preparation'
        ? { title: tx("Commande en préparation"), sub: tx("Démarrez la livraison une fois la commande récupérée.") }
        : { title: tx("En attente de préparation"), sub: tx("La commande doit d’abord être mise en préparation.") };

  if (err || deliveries === null || !order) {
    return (
      <LivreurLayout>
        <div className="mx-auto max-w-[640px] p-lg">
          {err ? (
            <ApiErrorState
              title={tx("Impossible de charger vos courses")}
              message={err}
              onRetry={() => setReloadKey((k) => k + 1)}
              className="rounded-lg border border-border-default bg-bg-card px-md"
            />
          ) : deliveries === null ? (
            <LoadingState label={tx("Chargement de la course…")} className="rounded-lg border border-border-default bg-bg-card" />
          ) : (
            <EmptyState
              icon={<MIcon name="local_shipping" className="text-4xl text-primary" />}
              title={commande ? `La course ${tokRef(commande)} n’est plus en cours` : tx("Aucune livraison en cours")}
              description={
                commande
                  ? tx("Elle a peut-être été livrée, refusée ou réattribuée. Consultez votre historique.")
                  : tx("Les courses qui vous sont assignées apparaîtront ici.")
              }
              action={
                <div className="flex flex-wrap justify-center gap-sm">
                  <Link to="/livreur" className="rounded-lg bg-primary-container px-lg py-3 font-bold text-white">
                    {tx("Tableau de bord")}
                  </Link>
                  <Link to="/livreur/historique" className="rounded-lg border border-border-default px-lg py-3 font-bold text-primary">
                    {tx("Historique")}
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

  return (
    <LivreurLayout>
      <div className="flex flex-col lg:h-[calc(100vh-52px)] lg:flex-row">
        {/* LEFT COLUMN: Interactive Map (70%) */}
        <section className="relative h-[360px] overflow-hidden bg-surface-container-low lg:h-full lg:w-[70%]">
          <div className="absolute inset-0 z-0">
            <RealBeninMap riderCoords={coords} riderName={currentUserName() ?? undefined} destinationLabel={destination(order)} />
          </div>
          {/* Floating Status Badge */}
          {badge && (
            <div className="absolute left-md top-md z-[500] max-w-[calc(100%-32px)]">
              <div className="flex items-center gap-md rounded-lg border border-border-default bg-white px-lg py-md shadow-lg">
                <div className="relative h-3 w-3 shrink-0">
                  {enLivraison && <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />}
                  <div className="relative h-3 w-3 rounded-full bg-primary" />
                </div>
                <div>
                  <h2 className="text-h3 font-bold text-primary">{badge.title}</h2>
                  {badge.sub && <p className="text-xs text-on-surface-variant">{badge.sub}</p>}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Delivery Details (30%) */}
        <section className="z-10 flex flex-col border-l border-border-default bg-white lg:h-full lg:w-[30%]">
          {/* Header */}
          <div className="border-b border-border-default bg-surface-container-low p-lg">
            <div className="mb-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{tx("Référence commande")}</p>
                <h3 className="font-h2 text-h2 font-black text-on-surface">{tokRef(order.id)}</h3>
              </div>
              <span className="rounded-full border border-primary-light bg-primary-tint px-sm py-1 text-xs font-bold text-primary">
                {statutLabel(order.statut)}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-lg overflow-y-auto p-lg">
            {/* Client Info Card */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-md">
              <div className="mb-md flex items-center gap-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-primary-tint text-primary shadow-sm">
                  <MIcon name="person" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-on-surface">{tx("Client TOKPa")}</p>
                  <p className="text-xs text-on-surface-variant">Commande du {dateHeure(order.created_at)}</p>
                </div>
              </div>
              <div className="space-y-md">
                <div className="flex gap-md">
                  <MIcon name="storefront" className="shrink-0 text-on-surface-variant" />
                  <div className="text-sm">
                    <p className="text-xs font-bold text-primary">Retrait</p>
                    <p className="text-on-surface">{tx("Marché Dantokpa")}</p>
                  </div>
                </div>
                <div className="flex gap-md">
                  <MIcon name="pin_drop" className="shrink-0 text-primary" />
                  <div className="text-sm">
                    <p className="text-xs font-bold text-primary">{tx("Livraison")}</p>
                    <p className="text-on-surface">{destination(order)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-lg grid grid-cols-2 gap-sm">
                <button
                  type="button"
                  disabled
                  title={tx("Numéro du client non transmis par l'API")}
                  className="flex cursor-not-allowed items-center justify-center gap-sm rounded-lg border border-border-default bg-white py-sm opacity-50"
                >
                  <MIcon name="call" className="text-on-surface-variant" />
                  <span className="text-sm font-medium">{tx("Appeler")}</span>
                </button>
                <button
                  type="button"
                  disabled
                  title={tx("Messagerie non ouverte aux livreurs par le backend")}
                  className="flex cursor-not-allowed items-center justify-center gap-sm rounded-lg border border-border-default bg-white py-sm opacity-50"
                >
                  <MIcon name="chat_bubble" className="text-on-surface-variant" />
                  <span className="text-sm font-medium">Chat</span>
                </button>
              </div>
              <p className="mt-sm text-[11px] text-on-surface-variant">
                {tx("Coordonnées du client et messagerie livreur non encore fournies par l’API.")}
              </p>
            </div>

            {/* Order Items */}
            <div className="space-y-md">
              <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">{tx("Contenu de la commande")}</h4>
              <div className="space-y-sm">
                {(order.items ?? []).length === 0 && <p className="text-sm text-on-surface-variant">{tx("Aucun article transmis.")}</p>}
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

            {/* Payment Details */}
            <div className="border-t border-border-default pt-lg">
              <div className="flex items-center justify-between">
                <p className="text-on-surface-variant">{tx("Montant de la commande")}</p>
                <p className="font-price text-h2 font-black text-primary-container">{fmtFcfa(order.montant_total)}</p>
              </div>
              <div className="mt-2 flex items-center gap-sm text-xs font-medium text-on-surface-variant">
                <MIcon name="two_wheeler" className="text-sm" />
                Frais de livraison : {fmtFcfa(order.frais_livraison)}
              </div>
            </div>
          </div>

          {/* Footer Actions (selon le vrai statut) */}
          <div className="space-y-md bg-white p-lg shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            {order.statut === 'en_livraison' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeStatus('livre')}
                className="flex w-full items-center justify-center gap-md rounded-lg bg-success py-lg text-h3 font-bold text-white shadow-lg shadow-success-light transition-all hover:bg-success-dark active:scale-[0.97] disabled:opacity-60"
              >
                <MIcon name="check_circle" />
                {tx("Marquer comme livré")}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || order.statut !== 'en_preparation'}
                onClick={() => changeStatus('en_livraison')}
                title={order.statut === "en_attente" ? 'La commande doit d’abord être mise en préparation' : undefined}
                className={clsx(
                  'flex w-full items-center justify-center gap-md rounded-lg py-lg text-h3 font-bold text-white transition-all active:scale-[0.97]',
                  order.statut === 'en_preparation' ? 'bg-[#F97316] hover:bg-[#EA580C]' : 'cursor-not-allowed bg-text-tertiary',
                  busy && 'opacity-60',
                )}
              >
                <MIcon name="two_wheeler" />
                {order.statut === 'en_preparation' ? tx("Démarrer la livraison") : 'En attente de préparation'}
              </button>
            )}
          </div>
        </section>
      </div>
    </LivreurLayout>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import FaIcon from '../../../components/shared/FaIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { authApi, livreurApi } from '../../../services/api';
import { fmtFcfa, listOf } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { currentUserName, initialsOf } from '../../../routes/authGuard';
import { useLanguage } from '../../../context/LanguageContext';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import { tx } from '../../../i18n/tx';

import {
  articlesCount,
  destination,
  fetchDeliveries,
  fetchLivreurProfile,
  statutLabel,
  tokRef,
  unwrapOrder,
  type LivreurOrder,
  type LivreurProfile,
} from '../livreurData';

function heureCourte(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
}

function pointLabel(order: LivreurOrder): string {
  return order.landmark?.nom || tx('Point de retrait');
}

function orderInitials(order: LivreurOrder): string {
  return initialsOf(pointLabel(order), 'PR');
}

/**
 * Tableau de bord livreur — maquette Stitch « tableau_de_bord_livreur_tokpa_fr ».
 *
 * Les données viennent de l'API :
 * - GET /dashboard ; GET /livreur/deliveries ; GET /livreur/history ; GET /profile
 * - PATCH /livreur/deliveries/{id}/accept et /refuse pour les actions rapides.
 *
 * La maquette contient des informations (client, véhicule, note) que les ressources
 * backend actuelles n'exposent pas encore. L'interface affiche donc le point de
 * repère, le statut réel et un tiret lorsque la donnée est absente, plutôt que de
 * présenter une valeur factice comme une information vérifiée.
 */
export default function LivreurDashboardPage() {
  useLanguage();
  const navigate = useNavigate();
  const sessionName = currentUserName();

  const [deliveries, setDeliveries] = useState<LivreurOrder[] | null>(null);
  const [delivErr, setDelivErr] = useState<string | null>(null);
  const [dash, setDash] = useState<{ commandes: number; en_cours: number } | null>(null);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<LivreurOrder[] | null>(null);
  const [histTotal, setHistTotal] = useState<number | null>(null);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<LivreurProfile | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    let alive = true;
    setDeliveries(null);
    setRecent(null);
    setDash(null);
    setDelivErr(null);
    setDashErr(null);
    setHistErr(null);

    fetchDeliveries()
      .then((items) => alive && setDeliveries(items))
      .catch((error) => alive && setDelivErr(alertApiError(error, 'livreur-load')));

    authApi
      .getDashboard()
      .then((data) => {
        if (!alive) return;
        setDash({ commandes: Number(data?.commandes ?? 0), en_cours: Number(data?.en_cours ?? 0) });
      })
      .catch((error) => alive && setDashErr(alertApiError(error, 'livreur-load')));

    livreurApi
      .getHistory(1)
      .then((response: { meta?: { total?: number } }) => {
        if (!alive) return;
        setRecent(listOf(response).map(unwrapOrder).slice(0, 5));
        setHistTotal(Number(response?.meta?.total ?? 0));
      })
      .catch((error) => alive && setHistErr(alertApiError(error, 'livreur-load')));

    fetchLivreurProfile()
      .then((value) => alive && setProfile(value))
      .catch(() => alive && setProfile(null));

    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Le bridge global émet `orders` quand un manager affecte une course (delivery.assigned sur le
  // canal notifications.{livreur}) : on recharge les compteurs sans vider l'écran, pour qu'aucun
  // clignotement de squelette n'intervienne pendant qu'on décide d'accepter une course.
  useEffect(
    () =>
      subscribeRealtimeRefresh(['orders'], () => {
        fetchDeliveries()
          .then(setDeliveries)
          .catch(() => {
            /* pas de toast ici : la prochaine action réaffichera l'erreur via reloadKey */
          });
        authApi
          .getDashboard()
          .then((data) => setDash({ commandes: Number(data?.commandes ?? 0), en_cours: Number(data?.en_cours ?? 0) }))
          .catch(() => undefined);
        livreurApi
          .getHistory(1)
          .then((response: { meta?: { total?: number } }) => {
            setRecent(listOf(response).map(unwrapOrder).slice(0, 5));
            setHistTotal(Number(response?.meta?.total ?? 0));
          })
          .catch(() => undefined);
      }),
    [],
  );

  const active = deliveries?.find((order) => order.statut === 'en_livraison') ?? null;
  const pending = (deliveries ?? []).filter((order) => order.statut !== 'en_livraison');
  const finished = dash ? Math.max(0, dash.commandes - dash.en_cours) : null;
  const successRate = finished && finished > 0 && histTotal != null ? Math.round((histTotal / finished) * 100) : null;
  const displayName = profile?.nom_complet || [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || sessionName || tx('Livreur');
  const locationLabel = profile?.zone || tx('Zone non attribuée');
  const recentTotal = useMemo(
    () => (recent ?? []).reduce((total, order) => total + Number(order.frais_livraison ?? 0), 0),
    [recent],
  );

  const accept = async (order: LivreurOrder) => {
    setBusy(order.id);
    try {
      const response = await livreurApi.acceptDelivery(order.id);
      toast.success(response?.message ?? tx('Course acceptée.'));
      navigate({ to: '/livreur/course', search: { commande: order.id } });
    } catch (error) {
      alertApiError(error, 'livreur-accept');
    } finally {
      setBusy(null);
    }
  };

  const refuse = async (order: LivreurOrder) => {
    if (!confirm(`Refuser la course ${tokRef(order.id)} ? Elle sera remise en file.`)) return;
    setBusy(order.id);
    try {
      const response = await livreurApi.refuseDelivery(order.id);
      toast.success(response?.message ?? tx('Course refusée.'));
      setDeliveries((items) => (items ?? []).filter((item) => item.id !== order.id));
    } catch (error) {
      alertApiError(error, 'livreur-refuse');
    } finally {
      setBusy(null);
    }
  };

  const statValues = {
    courses: dash ? String(dash.commandes).padStart(2, '0') : '—',
    success: successRate != null ? `${successRate}%` : '—',
    stars: '—',
  };

  return (
    <LivreurLayout>
      <div className="mx-auto max-w-[1280px] space-y-6 p-4 sm:p-6">
        {/* Version mobile : hero orange et statistiques intégrées, comme la maquette 375 px. */}
        <section className="rounded-[14px] bg-primary p-5 text-white shadow-lg lg:hidden">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
                <FaIcon name="location_on" className="text-xs" />
                {locationLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className={profile?.disponible === false ? 'text-xs font-bold text-text-secondary' : 'text-xs font-bold text-primary'}>
                {profile?.disponible === false ? tx('Indisponible') : tx('Disponible')}
              </span>
              <span className="relative h-4 w-8 rounded-full bg-primary/20" aria-hidden="true">
                <span
                  className={profile?.disponible === false ? 'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-text-tertiary' : 'absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-primary'}
                />
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <div className="border-r border-white/20 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">{tx('Courses')}</p>
              <p className="text-lg font-bold">{statValues.courses}</p>
            </div>
            <div className="border-r border-white/20 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">{tx('Succès')}</p>
              <p className="text-lg font-bold">{statValues.success}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">{tx('Étoiles')}</p>
              <p className="flex items-center justify-center gap-1 text-lg font-bold">
                {statValues.stars}
                <FaIcon name="star" className="text-[10px] text-amber-300" />
              </p>
            </div>
          </div>
        </section>

        {/* Version desktop : profil à gauche + trois cartes statistiques. */}
        <section className="hidden grid-cols-1 gap-4 lg:grid lg:grid-cols-4">
          <div className="flex flex-col justify-between rounded-[14px] border border-border-default bg-bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className={profile?.disponible === false ? 'badge bg-bg-secondary text-text-secondary' : 'badge badge-available'}>
                {profile?.disponible === false ? tx('Indisponible') : tx('Disponible')}
              </span>
              <span
                role="switch"
                aria-checked={profile?.disponible === true}
                aria-label={tx('Statut de disponibilité')}
                className={profile?.disponible === false ? 'relative h-6 w-11 rounded-full bg-border-default' : 'relative h-6 w-11 rounded-full bg-success'}
              >
                <span className={profile?.disponible === false ? 'absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-border-default bg-white' : 'absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white'} />
              </span>
            </div>
            <div className="flex flex-col items-center py-4">
              <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary-light bg-primary-tint text-2xl font-bold text-primary">
                {initialsOf(displayName, 'LV')}
              </div>
              <h2 className="text-center text-xl font-semibold text-text-main">{displayName}</h2>
              <p className="text-sm text-text-secondary">{locationLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:col-span-3">
            <div className="flex items-center gap-4 rounded-[14px] border border-border-default bg-bg-card p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
                <FaIcon name="motorcycle" className="text-2xl" />
              </div>
              <div>
                <p className="font-label text-text-secondary">{tx('Courses')}</p>
                <h3 className="font-h1 text-primary">{statValues.courses}</h3>
                <p className="text-[11px] font-bold text-text-secondary">{tx('Assignées depuis le début')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-[14px] border border-border-default bg-bg-card p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
                <FaIcon name="task_alt" className="text-2xl" />
              </div>
              <div>
                <p className="font-label text-text-secondary">{tx('Succès')}</p>
                <h3 className="font-h1 text-success">{statValues.success}</h3>
                <p className="text-[11px] font-bold text-text-secondary">
                  {finished ? `${histTotal ?? 0} livrées sur ${finished} terminées` : tx('Aucune course terminée')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-[14px] border border-border-default bg-bg-card p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-light text-amber-text">
                <FaIcon name="star" className="text-2xl" />
              </div>
              <div>
                <p className="font-label text-text-secondary">{tx('Étoiles')}</p>
                <h3 className="font-h1 text-on-surface">{statValues.stars}</h3>
                <p className="text-[11px] font-bold text-text-secondary">{tx('Non disponible dans le profil')}</p>
              </div>
            </div>
          </div>
        </section>

        {dashErr && (
          <div className="flex items-center justify-between rounded-[10px] border border-primary-light bg-primary-tint px-4 py-3 text-sm text-primary-dark">
            <span>{dashErr}</span>
            <button type="button" onClick={retry} className="font-semibold underline">
              {tx('Réessayer')}
            </button>
          </div>
        )}

        {/* En livraison / En attente */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-text-main">
              <FaIcon name="speed" className="text-primary" />
              {tx('En livraison')}
            </h2>
            {delivErr ? (
              <ApiErrorState
                title={tx('Impossible de charger vos courses')}
                message={delivErr}
                onRetry={retry}
                className="rounded-[14px] border border-border-default bg-bg-card px-4"
              />
            ) : deliveries === null ? (
              <LoadingState label={tx('Chargement de vos courses…')} className="rounded-[14px] border border-border-default bg-bg-card" />
            ) : active ? (
              <>
                {/* Compact card mobile : le CTA reste immédiatement accessible. */}
                <div className="rounded-[14px] border border-border-default bg-bg-card p-4 shadow-sm lg:hidden">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="badge badge-low-stock">{statutLabel(active.statut)}</span>
                    <span className="text-xs text-text-secondary">{tokRef(active.id)}</span>
                  </div>
                  <Link
                    to="/livreur/course"
                    search={{ commande: active.id }}
                    className="block w-full rounded-[10px] bg-primary py-3.5 text-center text-[15px] font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98]"
                  >
                    {tx('Voir la course active')}
                  </Link>
                </div>

                {/* Card desktop : détail du point de retrait et destination. */}
                <div className="hidden rounded-[14px] border-l-4 border-primary bg-bg-card p-6 shadow-sm lg:block">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded bg-primary-tint px-2 py-1 text-xs font-bold text-primary">{tokRef(active.id)}</span>
                      <h3 className="mt-3 text-base font-semibold text-text-main">{pointLabel(active)}</h3>
                      <p className="text-sm text-text-secondary">
                        {articlesCount(active)} {tx('article(s)')} · {statutLabel(active.statut)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-price text-primary">{fmtFcfa(active.montant_total)}</p>
                      <p className="text-[11px] text-text-secondary">
                        {tx('Livraison')} : {fmtFcfa(active.frais_livraison)}
                      </p>
                    </div>
                  </div>
                  <div className="mb-6 flex items-center gap-3 rounded-[10px] bg-bg-secondary p-4">
                    <FaIcon name="location_on" className="text-text-secondary" />
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase text-text-secondary">{tx('Destination')}</p>
                      <p className="text-sm text-text-main">{destination(active)}</p>
                    </div>
                  </div>
                  <Link
                    to="/livreur/course"
                    search={{ commande: active.id }}
                    className="block w-full rounded-[10px] bg-primary py-3.5 text-center text-[15px] font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-primary-hover active:scale-[0.98]"
                  >
                    {tx('Voir la course active')}
                  </Link>
                </div>
              </>
            ) : (
              <div className="rounded-[14px] border border-border-default bg-bg-card p-6 text-center text-sm text-text-secondary shadow-sm">
                {tx('Aucune livraison en cours pour le moment.')}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center justify-between text-xl font-semibold text-text-main">
              <span className="flex items-center gap-2">
                <FaIcon name="pending_actions" className="text-secondary-container" />
                {tx('En attente')} ({pending.length})
              </span>
              <Link to="/livreur/course" className="text-sm font-bold text-primary hover:underline">
                {tx('Voir tout')}
              </Link>
            </h2>

            {deliveries !== null && pending.length === 0 && !delivErr && (
              <div className="rounded-[14px] border border-border-default bg-bg-card p-6 text-center text-sm text-text-secondary shadow-sm">
                {tx('Aucune course en attente.')}
              </div>
            )}

            <div className="space-y-3">
              {pending.map((order) => (
                <div key={order.id} className="rounded-[14px] border-l-[3px] border-primary bg-bg-card shadow-sm transition-all hover:border-primary-hover">
                  {/* Mobile card, fidèle à la version 375 px de la maquette. */}
                  <div className="p-4 lg:hidden">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-text-main">{tokRef(order.id)}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-amber-light px-2 py-0.5 text-[10px] font-bold uppercase text-amber-text">
                            {statutLabel(order.statut)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-text-tertiary">
                            <FaIcon name="schedule" className="text-[10px]" />
                            {heureCourte(order.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-price text-lg text-primary">{fmtFcfa(order.montant_total)}</p>
                        <p className="text-[11px] uppercase text-text-secondary">
                          {articlesCount(order)} {tx('articles')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 border-y border-gray-100 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint font-bold text-primary">
                        {orderInitials(order)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-main">{pointLabel(order)}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-text-secondary">
                          <FaIcon name="motorcycle" className="text-[11px]" />
                          {destination(order)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={busy === order.id}
                        onClick={() => refuse(order)}
                        className="btn btn-danger w-full font-bold disabled:opacity-50"
                      >
                        {tx('Refuser')}
                      </button>
                      <button
                        type="button"
                        disabled={busy === order.id}
                        onClick={() => accept(order)}
                        className="btn w-full border-0 bg-success font-bold text-white hover:bg-success-dark disabled:opacity-50"
                      >
                        <FaIcon name="check" />
                        {tx('Accepter')}
                      </button>
                    </div>
                  </div>

                  {/* Desktop card : point de repère, montant et actions sur une ligne. */}
                  <div className="hidden items-center justify-between gap-4 p-4 lg:flex">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                        <FaIcon name="person" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-h3 truncate text-text-main">{pointLabel(order)}</h3>
                        <p className="text-xs text-text-secondary">
                          {tokRef(order.id)} · {articlesCount(order)} {tx('articles')}
                        </p>
                        <p className="truncate text-xs text-text-secondary">{destination(order)}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-price text-lg text-on-surface">{fmtFcfa(order.montant_total)}</p>
                      <p className="text-[11px] text-text-secondary">{heureCourte(order.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        title={tx('Refuser')}
                        aria-label={`Refuser la course ${tokRef(order.id)}`}
                        disabled={busy === order.id}
                        onClick={() => refuse(order)}
                        className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-error-border bg-error-light text-error-dark transition-all hover:bg-red-100 active:scale-90 disabled:opacity-50"
                      >
                        <FaIcon name="close" className="text-lg" />
                      </button>
                      <button
                        type="button"
                        disabled={busy === order.id}
                        onClick={() => accept(order)}
                        className="btn min-h-11 bg-success px-5 font-bold text-white hover:bg-success-dark disabled:opacity-50"
                      >
                        <FaIcon name="check" />
                        {tx('Accepter')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Historique court : tableau desktop, liste compacte mobile. */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-main">
            <FaIcon name="event_available" className="text-success" />
            {tx("Livrées aujourd'hui")}
          </h2>
          {histErr ? (
            <ApiErrorState
              title={tx("Impossible de charger l'historique")}
              message={histErr}
              onRetry={retry}
              className="rounded-[14px] border border-border-default bg-bg-card px-4"
            />
          ) : recent === null ? (
            <LoadingState label={tx("Chargement de l'historique…")} className="rounded-[14px] border border-border-default bg-bg-card" />
          ) : recent.length === 0 ? (
            <div className="rounded-[14px] border border-border-default bg-bg-card p-6 text-center text-sm text-text-secondary shadow-sm">
              {tx('Aucune livraison effectuée pour le moment.')}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-[14px] border border-border-default bg-bg-card shadow-sm lg:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">ID Course</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">{tx('Client / Destination')}</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">{tx('Heure')}</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">{tx('Montant')}</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">{tx('Statut')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {recent.map((order) => (
                      <tr key={order.id} className="transition-colors hover:bg-bg-secondary">
                        <td className="px-6 py-4 font-bold text-primary">{tokRef(order.id)}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-text-main">{pointLabel(order)}</p>
                          <p className="text-xs text-text-secondary">{order.description_lieu || destination(order)}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-text-main">{heureCourte(order.created_at)}</td>
                        <td className="px-6 py-4 font-price text-sm text-text-main">{fmtFcfa(order.frais_livraison)}</td>
                        <td className="px-6 py-4">
                          <span className="badge badge-available uppercase">{statutLabel(order.statut)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-primary/20 bg-primary-tint">
                      <td colSpan={3} className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-main">
                        {tx('Total affiché')}
                      </td>
                      <td colSpan={2} className="px-6 py-4 font-price text-lg text-primary">
                        {fmtFcfa(recentTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="overflow-hidden rounded-[14px] border border-border-default bg-bg-card shadow-sm lg:hidden">
                {recent.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 border-b border-gray-100 p-3 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-light text-success">
                        <FaIcon name="check" className="text-xs" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-text-main">{tokRef(order.id)}</p>
                        <p className="text-[11px] text-text-secondary">
                          {tx('Livré à')} {heureCourte(order.updated_at || order.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-text-main">{fmtFcfa(order.frais_livraison)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-bg-secondary p-4">
                  <p className="text-xs font-medium uppercase text-text-secondary">{tx('Total affiché')}</p>
                  <p className="font-price text-lg text-primary">{fmtFcfa(recentTotal)}</p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </LivreurLayout>
  );
}

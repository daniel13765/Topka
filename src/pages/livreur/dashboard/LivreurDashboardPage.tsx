import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import MIcon from '../../../components/shared/MIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { authApi, livreurApi } from '../../../services/api';
import { fmtFcfa, listOf } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { currentUserName, initialsOf } from '../../../routes/authGuard';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';

import {
  articlesCount,
  dateHeure,
  destination,
  fetchDeliveries,
  fetchLivreurProfile,
  statutLabel,
  tokRef,
  unwrapOrder,
  type LivreurOrder,
  type LivreurProfile,
} from '../livreurData';

/**
 * Tableau de bord livreur — design Stitch « tableau_de_bord_livreur_tokpa_fr », données réelles :
 * GET /dashboard (commandes, en_cours), GET /livreur/deliveries, GET /livreur/history, GET /profile.
 * Retirés (aucune donnée dans l'API) : photo, véhicule, étoiles/avis, tendances « vs hier »,
 * interrupteur « Disponible » (la disponibilité réelle est affichée, pas modifiable : B-26).
 */
export default function LivreurDashboardPage() {
  useLanguage();
  const navigate = useNavigate();
  const nom = currentUserName();
  const [deliveries, setDeliveries] = useState<LivreurOrder[] | null>(null);
  const [delivErr, setDelivErr] = useState<string | null>(null);
  const [dash, setDash] = useState<{ commandes: number; en_cours: number } | null>(null);
  const [recent, setRecent] = useState<LivreurOrder[] | null>(null);
  const [histTotal, setHistTotal] = useState<number | null>(null);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<LivreurProfile | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    setDeliveries(null);
    setDelivErr(null);
    setHistErr(null);
    fetchDeliveries()
      .then((l) => alive && setDeliveries(l))
      .catch((e) => alive && setDelivErr(alertApiError(e, 'livreur-load')));
    authApi
      .getDashboard()
      .then((d) => alive && setDash({ commandes: Number(d?.commandes ?? 0), en_cours: Number(d?.en_cours ?? 0) }))
      .catch((e) => alive && alertApiError(e, 'livreur-load'));
    livreurApi
      .getHistory(1)
      .then((res: { meta?: { total?: number } }) => {
        if (!alive) return;
        setRecent(listOf(res).map(unwrapOrder).slice(0, 5));
        setHistTotal(Number(res?.meta?.total ?? 0));
      })
      .catch((e) => alive && setHistErr(alertApiError(e, 'livreur-load')));
    fetchLivreurProfile()
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const active = deliveries?.find((o) => o.statut === 'en_livraison') ?? null;
  const pending = (deliveries ?? []).filter((o) => o.statut !== 'en_livraison');
  // Succès = livrées / courses terminées (livrées + annulées) = historique / (commandes − en cours)
  const terminees = dash ? dash.commandes - dash.en_cours : null;
  const succes = terminees && terminees > 0 && histTotal != null ? Math.round((histTotal / terminees) * 100) : null;

  const accept = async (o: LivreurOrder) => {
    setBusy(o.id);
    try {
      const r = await livreurApi.acceptDelivery(o.id);
      toast.success(r?.message ?? tx("Course acceptée."));
      navigate({ to: '/livreur/course', search: { commande: o.id } });
    } catch (e) {
      alertApiError(e, 'livreur-accept');
    } finally {
      setBusy(null);
    }
  };

  const refuse = async (o: LivreurOrder) => {
    if (!confirm(`Refuser la course ${tokRef(o.id)} ? Elle sera remise en file.`)) return;
    setBusy(o.id);
    try {
      const r = await livreurApi.refuseDelivery(o.id);
      toast.success(r?.message ?? tx("Course refusée."));
      setDeliveries((l) => (l ?? []).filter((x) => x.id !== o.id));
    } catch (e) {
      alertApiError(e, 'livreur-refuse');
    } finally {
      setBusy(null);
    }
  };

  return (
    <LivreurLayout>
      <div className="mx-auto max-w-[1280px] space-y-lg p-lg">
        {/* Top Section: Profile & Stats */}
        <div className="grid grid-cols-1 gap-md lg:grid-cols-4">
          {/* Profile Card */}
          <div className="flex flex-col justify-between rounded-lg border border-border-default bg-bg-card p-md shadow-sm lg:col-span-1">
            <div className="mb-md flex items-center justify-between">
              {profile?.disponible != null ? (
                <div
                  className={
                    profile.disponible
                      ? 'flex items-center gap-xs rounded-full bg-success-light px-sm py-xs text-success'
                      : 'flex items-center gap-xs rounded-full bg-bg-secondary px-sm py-xs text-text-secondary'
                  }
                >
                  <div className={profile.disponible ? 'h-2 w-2 rounded-full bg-success' : 'h-2 w-2 rounded-full bg-text-tertiary'} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {profile.disponible ? tx("Disponible") : 'Indisponible'}
                  </span>
                </div>
              ) : (
                <span />
              )}
            </div>
            <div className="flex flex-col items-center py-sm">
              <div className="mb-sm flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-primary-light bg-primary-tint text-2xl font-bold text-primary">
                {initialsOf(nom, 'LV')}
              </div>
              <h2 className="text-center font-h2 text-h2 text-text-main">{nom ?? tx("Livreur")}</h2>
              <p className="font-secondary text-secondary">{profile?.zone ? `Zone ${profile.zone}` : tx("Zone non attribuée")}</p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 gap-md md:grid-cols-3 lg:col-span-3">
            <div className="flex items-center gap-md rounded-lg border border-border-default bg-bg-card p-lg shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
                <MIcon name="motorcycle" className="text-3xl" />
              </div>
              <div>
                <p className="font-label text-text-secondary">{tx("Courses")}</p>
                <h3 className="font-h1 text-h1 text-primary">{dash ? String(dash.commandes).padStart(2, '0') : '—'}</h3>
                <p className="text-[11px] font-bold text-text-secondary">{tx("Assignées depuis le début")}</p>
              </div>
            </div>
            <div className="flex items-center gap-md rounded-lg border border-border-default bg-bg-card p-lg shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
                <MIcon name="task_alt" className="text-3xl" />
              </div>
              <div>
                <p className="font-label text-text-secondary">{tx("Succès")}</p>
                <h3 className="font-h1 text-h1 text-success">{succes != null ? `${succes}%` : '—'}</h3>
                <p className="text-[11px] font-bold text-text-secondary">
                  {terminees ? `${histTotal ?? 0} livrées sur ${terminees} terminées` : tx("Aucune course terminée")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-md rounded-lg border border-border-default bg-bg-card p-lg shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-light text-amber-text">
                <MIcon name="pending_actions" className="text-3xl" />
              </div>
              <div>
                <p className="font-label text-text-secondary">{tx("En cours")}</p>
                <h3 className="font-h1 text-h1 text-on-surface">{dash ? String(dash.en_cours) : '—'}</h3>
                <p className="text-[11px] font-bold text-text-secondary">{tx("À préparer ou à livrer")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Active & Requests */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          {/* Left: Active Delivery */}
          <section className="space-y-md">
            <h3 className="flex items-center gap-sm font-h2 text-h2 text-text-main">
              <MIcon name="speed" className="text-primary" />
              {tx("En livraison")}
            </h3>
            {delivErr ? (
              <ApiErrorState
                title={tx("Impossible de charger vos courses")}
                message={delivErr}
                onRetry={retry}
                className="rounded-lg border border-border-default bg-bg-card px-md"
              />
            ) : deliveries === null ? (
              <LoadingState label={tx("Chargement de vos courses…")} className="rounded-lg border border-border-default bg-bg-card" />
            ) : active ? (
              <div className="rounded-lg border-l-4 border-primary bg-bg-card p-lg shadow-sm">
                <div className="mb-md flex items-start justify-between gap-md">
                  <div>
                    <span className="rounded bg-primary-tint px-sm py-1 text-xs font-bold text-primary">{tokRef(active.id)}</span>
                    <h4 className="mt-sm font-h3 text-h3">{active.landmark?.nom ?? tx("Point de repère non renseigné")}</h4>
                    <p className="text-sm text-secondary">
                      {articlesCount(active)} article(s) · {statutLabel(active.statut)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-price text-primary">{fmtFcfa(active.montant_total)}</p>
                    <p className="text-[11px] text-text-secondary">Livraison : {fmtFcfa(active.frais_livraison)}</p>
                  </div>
                </div>
                <div className="mb-lg flex items-center gap-md rounded-lg bg-bg-secondary p-md">
                  <MIcon name="location_on" className="text-text-secondary" />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase text-text-secondary">Destination</p>
                    <p className="text-sm">{destination(active)}</p>
                  </div>
                </div>
                <Link
                  to="/livreur/course"
                  search={{ commande: active.id }}
                  className="block w-full rounded-xl bg-[#F97316] py-3.5 text-center text-[15px] font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-[#EA580C] active:scale-95"
                >
                  {tx("Voir la course active")}
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-border-default bg-bg-card p-lg text-center text-secondary text-text-secondary shadow-sm">
                {tx("Aucune livraison en cours pour le moment.")}
              </div>
            )}
          </section>

          {/* Right: Pending Requests */}
          <section className="space-y-md">
            <h3 className="flex items-center justify-between font-h2 text-h2 text-text-main">
              <span className="flex items-center gap-sm">
                <MIcon name="pending_actions" className="text-secondary-container" />
                En attente ({pending.length})
              </span>
              <Link to="/livreur/course" className="text-sm font-bold text-primary hover:underline">
                {tx("Voir tout")}
              </Link>
            </h3>
            <div className="space-y-md">
              {deliveries !== null && pending.length === 0 && !delivErr && (
                <div className="rounded-lg border border-border-default bg-bg-card p-lg text-center text-secondary text-text-secondary shadow-sm">
                  {tx("Aucune course en attente.")}
                </div>
              )}
              {pending.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col justify-between gap-md rounded-lg border border-border-default bg-bg-card p-md shadow-sm transition-all hover:border-primary/30 md:flex-row md:items-center"
                >
                  <div className="flex items-center gap-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
                      <MIcon name="inventory_2" className="text-on-surface-variant" />
                    </div>
                    <div>
                      <h4 className="font-h3 text-h3">{o.landmark?.nom ?? tx("Point de repère non renseigné")}</h4>
                      <p className="text-xs text-secondary">
                        {tokRef(o.id)} • {articlesCount(o)} article(s) • {statutLabel(o.statut)}
                      </p>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-sm">
                    <div className="mr-sm text-right">
                      <p className="font-price text-lg text-on-surface">{fmtFcfa(o.montant_total)}</p>
                    </div>
                    <div className="flex gap-xs">
                      <button
                        type="button"
                        title={tx("Refuser")}
                        aria-label={`Refuser la course ${tokRef(o.id)}`}
                        disabled={busy === o.id}
                        onClick={() => refuse(o)}
                        className="flex items-center justify-center rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[#991B1B] transition-all hover:bg-[#FEE2E2] active:scale-90 disabled:opacity-50"
                      >
                        <MIcon name="close" className="text-[20px]" />
                      </button>
                      <button
                        type="button"
                        disabled={busy === o.id}
                        onClick={() => accept(o)}
                        className="flex items-center gap-xs rounded-lg bg-success px-lg py-md font-bold text-white transition-all hover:bg-success-dark active:scale-95 disabled:opacity-50"
                      >
                        <MIcon name="check" />
                        {tx("Accepter")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Bottom Section: Recent Deliveries */}
        <section className="space-y-md">
          <h3 className="flex items-center gap-sm font-h2 text-h2 text-text-main">
            <MIcon name="event_available" className="text-success" />
            {tx("Dernières livraisons")}
          </h3>
          {histErr ? (
            <ApiErrorState
              title={tx("Impossible de charger l'historique")}
              message={histErr}
              onRetry={retry}
              className="rounded-lg border border-border-default bg-bg-card px-md"
            />
          ) : recent === null ? (
            <LoadingState label={tx("Chargement de l'historique…")} className="rounded-lg border border-border-default bg-bg-card" />
          ) : recent.length === 0 ? (
            <div className="rounded-lg border border-border-default bg-bg-card p-lg text-center text-secondary text-text-secondary shadow-sm">
              {tx("Aucune livraison effectuée pour le moment.")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-default bg-bg-card shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="px-lg py-md font-label text-xs uppercase tracking-wider text-text-secondary">ID Course</th>
                    <th className="px-lg py-md font-label text-xs uppercase tracking-wider text-text-secondary">Destination</th>
                    <th className="px-lg py-md font-label text-xs uppercase tracking-wider text-text-secondary">{tx("Commande du")}</th>
                    <th className="px-lg py-md font-label text-xs uppercase tracking-wider text-text-secondary">{tx("Frais de livraison")}</th>
                    <th className="px-lg py-md font-label text-xs uppercase tracking-wider text-text-secondary">{tx("Statut")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {recent.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-bg-secondary">
                      <td className="px-lg py-md font-bold text-primary">{tokRef(o.id)}</td>
                      <td className="px-lg py-md">
                        <p className="text-sm font-medium">{o.landmark?.nom ?? '—'}</p>
                        <p className="text-xs text-text-secondary">{o.description_lieu || `${articlesCount(o)} article(s)`}</p>
                      </td>
                      <td className="px-lg py-md text-sm">{dateHeure(o.created_at)}</td>
                      <td className="px-lg py-md font-price text-sm">{fmtFcfa(o.frais_livraison)}</td>
                      <td className="px-lg py-md">
                        <span className="rounded-full bg-success-light px-sm py-1 text-[10px] font-bold uppercase text-success">
                          {statutLabel(o.statut)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </LivreurLayout>
  );
}

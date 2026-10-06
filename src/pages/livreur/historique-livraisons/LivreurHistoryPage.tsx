import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import FaIcon from '../../../components/shared/FaIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import EmptyState from '../../../components/shared/EmptyState';
import { fmtFcfa } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { currentUserName } from '../../../routes/authGuard';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import {
  articlesCount,
  comparaisonSemaines,
  dateHeure,
  debutSemaine,
  destination,
  fetchAllHistory,
  fetchZoneNames,
  revenusParJour,
  sommeFrais,
  statutLabel,
  tokRef,
  type LivreurOrder,
  libelleArticle,
} from '../livreurData';
import { telechargerRecu } from './recuCourse';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';

const PER_PAGE = 10;
const CARD = 'rounded-lg border border-border-default bg-bg-card shadow-sm';
const TH = 'whitespace-nowrap px-md py-md font-label text-[13px] font-medium text-text-secondary';

/** Pastilles de statut du thème (mêmes classes que l'espace client) : plus de vert Tailwind en dur. */
const STATUT_CLASS: Record<string, string> = {
  en_attente: 'status-pending',
  en_preparation: 'status-preparing',
  en_livraison: 'status-shipping',
  livre: 'status-delivered',
  annule: 'status-cancelled',
};

type Filtre = 'all' | 'week' | 'month' | 'custom';
type Tri = { col: 'date' | 'gain'; asc: boolean };

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Historique des livraisons — maquette Stitch « historique_des_livraisons_tokpa » : 4 cartes de
 * synthèse, filtres (toutes / semaine / mois / personnalisé), tableau paginé + tri, colonne latérale
 * (revenus de la semaine, versement, rythme), et modale de détail avec reçu PDF.
 *
 * Données réelles : GET /livreur/history (toutes les pages, 20/page, au plus 500 courses) + GET /zones
 * pour la zone du repère. Cumuls, courbe et comparatif sont calculés ici sur les dates et montants de l'API.
 *
 * Écarts assumés (aucune donnée inventée, chacun expliqué en infobulle) : distance totale, note moyenne,
 * téléphone/nom du client, mode de paiement et horodatages du trajet — `grep` dans le backend : aucune
 * colonne `note`, aucune route de versement (`versements` existe en table mais n'est exposée par aucun
 * contrôleur), `OrderResource` ne charge ni `client` ni `payment`, et le livreur n'a pas d'endpoint de trace GPS.
 */
export default function LivreurHistoryPage() {
  useLanguage();
  const [data, setData] = useState<{ orders: LivreurOrder[]; total: number; capped: boolean } | null>(null);
  const [zones, setZones] = useState<Map<number, string>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [tri, setTri] = useState<Tri>({ col: 'date', asc: false });
  const [selected, setSelected] = useState<LivreurOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Fin de course ou annulation administrative : les cumuls, la pastille « ± % » et la ligne du
  // jour changent. `fetchAllHistory()` relit les pages, on remplace `data` d'un bloc pour éviter
  // le flash du squelette (le chargeur initial, lui, remet bien `data` à null).
  useEffect(
    () =>
      subscribeRealtimeRefresh(['orders'], () => {
        fetchAllHistory()
          .then((res) => setData(res))
          .catch(() => {
            /* silencieux : l'état affiché reste valide, le bouton Réessayer existe */
          });
      }),
    [],
  );

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    fetchAllHistory()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(alertApiError(e, 'livreur-load')));
    fetchZoneNames()
      .then((z) => alive && setZones(z))
      .catch(() => alive && setZones(new Map()));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => debutSemaine(now), [now]);
  const monthStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d;
  }, [now]);

  const orders = data?.orders ?? [];
  const inRange = (o: LivreurOrder, fromD: Date | null, toD: Date | null) => {
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    if (fromD && d < fromD) return false;
    if (toD && d > toD) return false;
    return true;
  };

  const bornes = useMemo(() => {
    if (filtre === 'week') return { from: weekStart, to: null as Date | null };
    if (filtre === 'month') return { from: monthStart, to: null as Date | null };
    if (filtre === 'custom') {
      return {
        from: from ? new Date(`${from}T00:00:00`) : null,
        to: to ? new Date(`${to}T23:59:59`) : null,
      };
    }
    return { from: null as Date | null, to: null as Date | null };
  }, [filtre, from, to, weekStart, monthStart]);

  const filtered = useMemo(
    () => orders.filter((o) => inRange(o, bornes.from, bornes.to)),
     
    [orders, bornes],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const v =
        tri.col === 'gain'
          ? Number(a.frais_livraison ?? 0) - Number(b.frais_livraison ?? 0)
          : (a.created_at ? Date.parse(a.created_at) : 0) - (b.created_at ? Date.parse(b.created_at) : 0);
      return tri.asc ? v : -v;
    });
    return copy;
  }, [filtered, tri]);

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const gains = sommeFrais(orders);
  const rythme = comparaisonSemaines(orders, now);
  const jours = revenusParJour(orders, now);
  const maxJour = Math.max(0, ...jours.map((j) => j.total));
  const totalSemaine = jours.reduce((s, j) => s + j.total, 0);

  const zoneOf = (o: LivreurOrder) =>
    o.landmark?.zone_id ? (zones.get(Number(o.landmark.zone_id)) ?? `Zone #${o.landmark.zone_id}`) : '—';

  const choisirFiltre = (f: Filtre) => {
    setFiltre(f);
    setPage(1);
  };
  const changerTri = (col: Tri['col']) => {
    setTri((t) => (t.col === col ? { col, asc: !t.asc } : { col, asc: false }));
    setPage(1);
  };

  // Échap ferme la modale ; le focus entre dans la boîte (le reste du piège reste géré par l'ordre DOM).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const sortIcon = (col: Tri['col']) => (tri.col !== col ? 'sort' : tri.asc ? 'arrow_upward' : 'arrow_downward');

  const enTete = (label: string, col?: Tri['col']) =>
    col ? (
      <th className={TH} aria-sort={tri.col === col ? (tri.asc ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => changerTri(col)}
          className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-primary"
          title={tri.col === col ? tx('Trier dans l’ordre inverse') : tx('Trier par ce critère')}
        >
          {label}
          <FaIcon name={sortIcon(col)} className={clsx('text-[11px]', tri.col === col ? 'text-primary' : 'opacity-40')} />
        </button>
      </th>
    ) : (
      <th className={`${TH} uppercase tracking-wider`}>{label}</th>
    );

  const pill = (s: string) => (
    <span className={clsx('status px-2.5 py-1 text-xs font-semibold', STATUT_CLASS[s] ?? 'status-pending')}>
      {statutLabel(s)}
    </span>
  );

  const carteKpi = (
    label: string,
    value: string,
    extra: React.ReactNode,
    delay: number,
    hint?: string,
  ) => (
    <div className={`${CARD} tokpa-rise p-lg transition-shadow hover:shadow-md`} style={{ animationDelay: `${delay}ms` }}>
      <p className="mb-xs font-label text-[13px] text-text-secondary" title={hint}>
        {label}
      </p>
      <p className="font-h1 text-h1 font-bold text-text-main">{value}</p>
      {extra}
    </div>
  );

  const ligneMobile = (o: LivreurOrder, i: number) => (
    <button
      key={o.id}
      type="button"
      onClick={() => setSelected(o)}
      className={clsx(CARD, 'tokpa-rise w-full px-md py-sm text-left transition-shadow hover:shadow-md')}
      style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
    >
      <div className="flex items-center justify-between gap-sm">
        <span className="font-label font-bold text-primary">{tokRef(o.id)}</span>
        {pill(o.statut)}
      </div>
      <p className="mt-1 text-sm font-medium text-text-main">{destination(o)}</p>
      <div className="mt-1 flex items-center justify-between text-[13px] text-text-secondary">
        <span>
          {dateHeure(o.created_at)} · {zoneOf(o)}
        </span>
        <span className={clsx('font-bold', Number(o.frais_livraison) > 0 ? 'text-primary' : 'text-error')}>
          {fmtFcfa(o.frais_livraison)}
        </span>
      </div>
    </button>
  );

  return (
    <LivreurLayout>
      <div className="flex-1 p-md lg:p-xl">
        <div className="mx-auto max-w-[1200px]">
          {/* En-tête — pastille iconique + titre, comme la maquette */}
          <div className="mb-xl flex flex-wrap items-center justify-between gap-md">
            <div className="flex items-center gap-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-shade text-white shadow-sm">
                <FaIcon name="history" className="text-[22px]" />
              </span>
              <div>
                <h1 className="font-h1 text-h1 text-text-main">{tx('Historique des livraisons')}</h1>
                {data && (
                  <p className="text-[13px] text-text-secondary">
                    {data.total} {tx('courses livrées')}
                    {data.capped ? ` · ${tx('500 dernières chargées')}` : ''}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-sm rounded-lg border border-border-default bg-bg-card px-md py-sm font-label text-label font-medium text-text-secondary transition-colors hover:border-primary/40 hover:text-primary active:scale-95"
            >
              <FaIcon name="refresh" className="text-[16px]" />
              {tx('Actualiser')}
            </button>
          </div>

          {err ? (
            <ApiErrorState
              title={tx("Impossible de charger l'historique")}
              message={err}
              onRetry={() => setReloadKey((k) => k + 1)}
              className={`${CARD} px-md`}
            />
          ) : !data ? (
            <LoadingState label={tx("Chargement de l'historique…")} className={CARD} />
          ) : (
            <>
              {/* 4 cartes de synthèse (maquette) : gains, courses, distance, note */}
              <div className="mb-xl grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
                {carteKpi(
                  tx('Gains totaux'),
                  fmtFcfa(gains),
                  <p className="mt-1 text-[12px] text-success">
                    {tx('Frais de livraison cumulés')}
                    {data.capped ? ` · ${tx('sur les 500 dernières courses')}` : ''}
                  </p>,
                  0,
                  tx('Somme des frais de livraison de vos courses : le backend ne calcule aucun autre reversement.'),
                )}
                {carteKpi(
                  tx('Courses terminées'),
                  String(data.total),
                  rythme.deltaPct === null ? (
                    <p className="mt-1 text-[12px] text-text-secondary">{tx('Aucune course la semaine précédente pour comparer')}</p>
                  ) : (
                    <p
                      className={clsx('mt-1 inline-flex items-center gap-1 text-[12px] font-semibold', rythme.deltaPct >= 0 ? 'text-success' : 'text-error')}
                      title={tx('Comparé au nombre de courses de la semaine précédente (dates réelles des commandes)')}
                    >
                      <FaIcon
                        name={rythme.deltaPct >= 0 ? 'trending_up' : 'trending_down'}
                        className="text-[12px]"
                      />
                      {rythme.deltaPct >= 0 ? '+' : ''}
                      {rythme.deltaPct}%
                    </p>
                  ),
                  60,
                )}
                {carteKpi(
                  tx('Distance totale'),
                  '—',
                  <p className="mt-1 text-[12px] text-text-secondary">{tx('Trace GPS non consultable par le livreur')}</p>,
                  120,
                  tx('Aucun endpoint de GET /livreur ne renvoie les positions enregistrées : distance non calculable.'),
                )}
                {carteKpi(
                  tx('Note moyenne'),
                  '—',
                  <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-text-secondary">
                    <FaIcon name="star" className="text-[12px] text-amber-400" />
                    {tx('Note client non enregistrée par le backend')}
                  </p>,
                  180,
                  tx('Aucune colonne de notation dans le schéma : la note ne peut pas être affichée.'),
                )}
              </div>

              <div className="grid grid-cols-1 gap-xl lg:grid-cols-12">
                {/* Colonne principale : filtres + tableau (desktop) + cartes (mobile) */}
                <div className="space-y-lg lg:col-span-8">
                  <div className="-mx-md flex gap-sm overflow-x-auto px-md pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
                    <FiltreBtn actif={filtre === 'all'} onClick={() => choisirFiltre('all')} label={tx('Toutes les courses')} />
                    <FiltreBtn actif={filtre === 'week'} onClick={() => choisirFiltre('week')} label={tx('Cette semaine')} />
                    <FiltreBtn actif={filtre === 'month'} onClick={() => choisirFiltre('month')} label={tx('Ce mois')} />
                    <FiltreBtn
                      actif={filtre === 'custom'}
                      onClick={() => choisirFiltre('custom')}
                      label={tx('Personnalisé')}
                      icon="calendar_month"
                    />
                  </div>

                  {filtre === 'custom' && (
                    <div className="flex flex-wrap items-end gap-md rounded-lg border border-border-default bg-bg-card p-md">
                      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
                        {tx('Du')}
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => {
                            setFrom(e.target.value);
                            setPage(1);
                          }}
                          className="rounded-lg border border-border-default px-sm py-1 text-[14px] text-text-main outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
                        {tx('Au')}
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => {
                            setTo(e.target.value);
                            setPage(1);
                          }}
                          className="rounded-lg border border-border-default px-sm py-1 text-[14px] text-text-main outline-none focus:border-primary"
                        />
                      </label>
                      {(from || to) && (
                        <span className="text-[12px] text-text-secondary">
                          {filtered.length} {tx('courses sur la période')}
                        </span>
                      )}
                    </div>
                  )}

                  {filtered.length === 0 ? (
                    <EmptyState
                      icon={<FaIcon name="local_shipping" className="text-4xl text-primary" />}
                      title={tx('Aucune livraison sur cette période')}
                      description={tx("Élargissez la période ou vérifiez que vos courses livrées remontent bien dans l'historique.")}
                      action={
                        <button
                          type="button"
                          onClick={() => choisirFiltre('all')}
                          className="rounded-lg bg-primary-container px-lg py-3 font-bold text-white transition-colors hover:bg-primary-hover active:scale-95"
                        >
                          {tx('Voir toutes les courses')}
                        </button>
                      }
                      className={CARD}
                    />
                  ) : (
                    <div className={clsx(CARD, 'hidden overflow-hidden lg:block')}>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-border-default bg-bg-secondary">
                              {enTete(tx('Date & Heure'), 'date')}
                              {enTete(tx('N° Commande'))}
                              {enTete(tx('Destination'))}
                              {enTete(tx('Zone'))}
                              {enTete(tx('Gain'), 'gain')}
                              {enTete(tx('Statut'))}
                              <th className={`${TH} text-right`}>{tx('Action')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-default text-[14px]">
                            {visible.map((o, i) => (
                              <tr
                                key={o.id}
                                onClick={() => setSelected(o)}
                                className="group cursor-pointer bg-bg-card transition-colors hover:bg-primary-tint/70"
                                style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                              >
                                <td className="whitespace-nowrap px-md py-md text-text-main">{dateHeure(o.created_at)}</td>
                                <td className="whitespace-nowrap px-md py-md font-label font-bold text-primary">{tokRef(o.id)}</td>
                                <td className="px-md py-md font-medium text-text-main">{o.landmark?.nom ?? '—'}</td>
                                <td className="whitespace-nowrap px-md py-md text-on-surface-variant">{zoneOf(o)}</td>
                                <td
                                  className={clsx(
                                    'whitespace-nowrap px-md py-md font-bold',
                                    Number(o.frais_livraison) > 0 ? 'text-primary' : 'text-error',
                                  )}
                                >
                                  {fmtFcfa(o.frais_livraison)}
                                </td>
                                <td className="whitespace-nowrap px-md py-md">{pill(o.statut)}</td>
                                <td className="whitespace-nowrap px-md py-md text-right">
                                  <button
                                    type="button"
                                    aria-label={`Détails de la course ${tokRef(o.id)}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelected(o);
                                    }}
                                    className="inline-flex items-center justify-center rounded-md p-1.5 text-text-secondary transition-colors group-hover:text-primary hover:bg-primary-tint"
                                  >
                                    <FaIcon name="visibility" className="text-[18px]" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pied
                        current={current}
                        pages={pages}
                        first={(current - 1) * PER_PAGE + 1}
                        last={Math.min(current * PER_PAGE, sorted.length)}
                        total={sorted.length}
                        onPage={setPage}
                      />
                    </div>
                  )}

                  {/* Liste mobile (sous 1024 px) : mêmes données, cartes empilées */}
                  {filtered.length > 0 && (
                    <div className="space-y-sm lg:hidden">
                      {sorted.slice((current - 1) * PER_PAGE, current * PER_PAGE).map(ligneMobile)}
                      <div className={clsx(CARD, 'overflow-hidden')}>
                        <Pied
                          current={current}
                          pages={pages}
                          first={(current - 1) * PER_PAGE + 1}
                          last={Math.min(current * PER_PAGE, sorted.length)}
                          total={sorted.length}
                          onPage={setPage}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Colonne latérale : revenus de la semaine, versement, rythme */}
                <div className="space-y-lg lg:col-span-4">
                  <div className={clsx(CARD, 'tokpa-rise p-lg')} style={{ animationDelay: '120ms' }}>
                    <div className="mb-lg flex items-end justify-between">
                      <h2 className="font-h2 text-h2 text-text-main">{tx('Revenus semaine')}</h2>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        {jours[0].date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} –{' '}
                        {jours[6].date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex h-40 items-end justify-between gap-2">
                      {jours.map((j) => {
                        const aujourdhui = memeJour(j.date, now);
                        return (
                          <div
                            key={j.date.toISOString()}
                            className="flex h-full w-full flex-col justify-end"
                            title={`${j.date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })} · ${fmtFcfa(j.total)}`}
                          >
                            <div
                              className={clsx(
                                'w-full rounded-t-md transition-all duration-500',
                                aujourdhui ? 'bg-success' : j.total > 0 ? 'bg-primary-light' : 'bg-border-default',
                              )}
                              style={{ height: maxJour > 0 ? `${Math.max(4, (j.total / maxJour) * 100)}%` : '4%' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-sm flex justify-between text-[11px] font-medium text-text-secondary">
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((lettre, i) => (
                        <span key={i} className={clsx('w-full text-center', memeJour(jours[i].date, now) && 'font-bold text-success')}>
                          {lettre}
                        </span>
                      ))}
                    </div>
                    <p className="mt-md text-[13px] text-text-secondary">
                      {tx('Total de la semaine :')} <span className="font-bold text-primary">{fmtFcfa(totalSemaine)}</span>
                    </p>
                  </div>

                  {/* Versement : la table `versements` existe côté back mais aucune route ne l'expose. */}
                  <div className="tokpa-rise rounded-lg border-[1.5px] border-primary-light bg-primary-tint p-lg" style={{ animationDelay: '180ms' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary-dark">{tx('Prochain versement')}</p>
                    <p className="mt-1 text-[13px] text-text-secondary">{tx('Prévu le')} —</p>
                    <p className="mt-1 font-h2 text-h2 font-black text-primary-dark">—</p>
                    <button
                      type="button"
                      disabled
                      title={tx('Aucune route de versement : la table `versements` du backend n’est exposée par aucun contrôleur.')}
                      className="mt-md flex w-full cursor-not-allowed items-center justify-center gap-sm rounded-lg bg-primary-shade px-md py-sm font-label text-label font-semibold text-white opacity-60"
                    >
                      <FaIcon name="account_balance_wallet" className="text-[18px]" />
                      {tx('Demander un virement')}
                    </button>
                    <p className="mt-md flex gap-sm rounded-lg bg-white/70 p-sm text-[12px] leading-snug text-on-surface-variant">
                      <FaIcon name="info" className="mt-0.5 shrink-0 text-[14px]" />
                      {tx('Le montant et la date de versement ne sont pas encore servis par l’API.')}
                    </p>
                  </div>

                  {/* Le « palier bonus » de la maquette devient un comparatif réel semaine / semaine dernière. */}
                  <div
                    className="tokpa-rise rounded-lg border-[1.5px] border-secondary-container/50 bg-amber-light/50 p-lg"
                    style={{ animationDelay: '240ms' }}
                    title={tx('Comparatif calculé sur les dates réelles de vos commandes ; aucun bonus n’est géré par le backend.')}
                  >
                    <p className="flex items-center gap-sm font-h3 text-h3 font-bold text-amber-text">
                      <FaIcon name="workspace_premium" className="text-[18px]" />
                      {tx('Rythme de la semaine')}
                    </p>
                    <p className="mt-1 text-[13px] text-on-surface-variant">
                      {rythme.cetteSemaine} {tx('courses cette semaine')} · {rythme.semainePrecedente}{' '}
                      {tx('la semaine dernière')}
                    </p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/70">
                      <div
                        className="h-full rounded-full bg-secondary-container transition-all duration-700"
                        style={{
                          width: `${Math.min(
                            100,
                            (rythme.cetteSemaine / Math.max(1, Math.max(rythme.cetteSemaine, rythme.semainePrecedente))) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modale détail de course (maquette) — bas de page sur mobile */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${tx('Détails de la course')} ${tokRef(selected.id)}`}
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-0 tokpa-fade sm:items-center sm:p-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="tokpa-rise w-full max-w-[560px] overflow-hidden rounded-t-[20px] bg-white shadow-xl sm:rounded-lg"
          >
            <div className="flex items-start justify-between gap-md border-b border-border-default p-lg">
              <div className="flex items-center gap-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-tint text-primary">
                  <FaIcon name="local_shipping" />
                </span>
                <div>
                  <h3 className="font-h3 text-h3 font-bold text-text-main">
                    {tx('Détails de la course')} {tokRef(selected.id)}
                  </h3>
                  <p className="text-[11px] uppercase tracking-wider text-text-secondary">{tx('Historique officiel TOKPa')}</p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                {pill(selected.statut)}
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={tx('Fermer')}
                  onClick={() => setSelected(null)}
                  className="rounded-md p-1 text-text-secondary transition-colors hover:bg-bg-app"
                >
                  <FaIcon name="close" />
                </button>
              </div>
            </div>

            <div className="max-h-[62vh] space-y-lg overflow-y-auto p-lg">
              {/* Client & Destination : seul le nom du client manque (OrderResource ne le charge pas) */}
              <div className="rounded-lg border border-border-default bg-bg-secondary p-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {tx('Client & Destination')}
                </span>
                <div className="mt-sm flex items-start gap-sm">
                  <FaIcon name="location_on" className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-semibold text-text-main">{destination(selected)}</p>
                    <p className="text-[13px] text-text-secondary">
                      {[zoneOf(selected) !== '—' ? `Zone ${zoneOf(selected)}` : null, selected.description_lieu || null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-sm flex flex-wrap items-center gap-sm text-[13px] text-text-secondary">
                  <FaIcon name="person" className="text-[14px]" />
                  <span>{tx('Nom du client non transmis par l’API')}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-card px-2 py-0.5 text-[12px]">
                    <FaIcon name="call" className="text-[12px]" /> —
                  </span>
                </div>
              </div>

              {/* Détails de la commande (valeurs réelles) */}
              <div className="space-y-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {tx('Détails de la commande')}
                </span>
                <div className="flex justify-between gap-md text-[13px]">
                  <span className="shrink-0 text-text-secondary">{tx('Articles livrés')} ({articlesCount(selected)})</span>
                  <span className="text-right font-medium text-text-main">
                    {(selected.items ?? []).map((it) => `${it.quantite}x ${libelleArticle(it)}`).join(', ') || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-secondary" title={tx('La relation payment n’est pas chargée par GET /livreur/history')}>
                    {tx('Mode de paiement')}
                  </span>
                  <span className="font-medium text-text-main">—</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-secondary">{tx('Montant de la commande')}</span>
                  <span className="font-medium text-text-main">{fmtFcfa(selected.montant_total)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-secondary">{tx('Gain de la course')}</span>
                  <span className="font-bold text-primary">{fmtFcfa(selected.frais_livraison)}</span>
                </div>
              </div>

              {/* Horodatages : une seule date est réellement exposée (création de la commande) */}
              <div className="space-y-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {tx('Horodatages du trajet')}
                </span>
                <ol className="space-y-sm">
                  <li className="flex items-start gap-sm text-[13px]">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span className="text-text-secondary">{tx('Commande passée')}</span>
                    <span className="ml-auto font-medium text-text-main">{dateHeure(selected.created_at)}</span>
                  </li>
                  <li className="flex items-start gap-sm text-[13px]">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-border-default" />
                    <span className="text-text-secondary">{tx('Retrait, arrivée et livraison')}</span>
                    <span className="ml-auto text-text-tertiary">{tx('non exposés par l’API')}</span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-sm border-t border-border-default p-lg sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border-default px-lg py-sm font-label text-label font-semibold text-text-main transition-colors hover:bg-bg-app"
              >
                {tx('Fermer')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const nom = await telechargerRecu(selected, { zone: zoneOf(selected), livreur: currentUserName() });
                    toast.success(tr(`Reçu ${nom} téléchargé.`, `Receipt ${nom} downloaded.`));
                  } catch {
                    toast.error(tx('Le reçu n’a pas pu être généré sur cet appareil.'));
                  } finally {
                    setSaving(false); // sinon le bouton reste bloqué sur « Génération… »
                  }
                }}
                className="inline-flex items-center justify-center gap-sm rounded-lg bg-primary-container px-lg py-sm font-label text-label font-semibold text-white transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-60"
              >
                <FaIcon name="download" className="text-[16px]" />
                {saving ? tx('Génération…') : tx('Télécharger le reçu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </LivreurLayout>
  );
}

function FiltreBtn({
  actif,
  label,
  onClick,
  icon,
}: {
  actif: boolean;
  label: string;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex shrink-0 items-center gap-sm rounded-lg border px-lg py-sm font-label text-label transition-all active:scale-95',
        actif
          ? 'border-primary-container bg-primary-container font-semibold text-white shadow-sm'
          : 'border-border-default bg-bg-card font-medium text-text-secondary hover:border-primary/40 hover:text-primary',
      )}
    >
      {icon && <FaIcon name={icon} className="text-[16px]" />}
      {label}
    </button>
  );
}

function Pied({
  current,
  pages,
  first,
  last,
  total,
  onPage,
}: {
  current: number;
  pages: number;
  first: number;
  last: number;
  total: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-md bg-bg-secondary px-lg py-md">
      <span className="text-[13px] text-text-secondary">
        {tr(`Affichage ${first}-${last} sur ${total} courses`, `Showing ${first}-${last} of ${total} runs`)}
      </span>
      <div className="flex items-center gap-xs">
        <button
          type="button"
          aria-label={tx('Page précédente')}
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-text-secondary transition-colors hover:border-border-default hover:bg-white disabled:opacity-40"
        >
          <FaIcon name="chevron_left" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((n) => Math.abs(n - current) <= 2)
          .map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === current ? 'page' : undefined}
              className={clsx(
                'h-8 w-8 rounded-md text-[13px] font-semibold transition-colors',
                n === current ? 'bg-primary-container text-white' : 'text-text-secondary hover:bg-white',
              )}
            >
              {n}
            </button>
          ))}
        <button
          type="button"
          aria-label={tx('Page suivante')}
          disabled={current >= pages}
          onClick={() => onPage(current + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-text-secondary transition-colors hover:border-border-default hover:bg-white disabled:opacity-40"
        >
          <FaIcon name="chevron_right" />
        </button>
      </div>
    </div>
  );
}

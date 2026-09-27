import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import LivreurLayout from '../../../components/layout/livreur/LivreurLayout';
import MIcon from '../../../components/shared/MIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { fmtFcfa } from '../../../services/api/unwrap';
import { alertApiError } from '../../../utils/apiError';
import { articlesCount, dateHeure, fetchAllHistory, fetchZoneNames, statutLabel, tokRef, type LivreurOrder } from '../livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


const PER_PAGE = 10;
type Filtre = 'all' | 'week' | 'month';

const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Historique des livraisons — design Stitch « historique_des_livraisons_tokpa », données réelles :
 * GET /livreur/history (toutes les pages, au plus 500 courses) + GET /zones. Dates = date de la
 * commande (l'API ne donne pas l'heure de livraison en liste). Retirés (aucune donnée dans l'API) :
 * distance, note, versements/virement, palier bonus, téléphone du client, horodatages, reçu.
 */
export default function LivreurHistoryPage() {
  useLanguage();
  const [data, setData] = useState<{ orders: LivreurOrder[]; total: number; capped: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zones, setZones] = useState<Map<number, string>>(new Map());
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LivreurOrder | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  const weekStart = useMemo(startOfWeek, []);
  const monthStart = useMemo(startOfMonth, []);
  const orders = data?.orders ?? [];
  const inWeek = (o: LivreurOrder) => !!o.created_at && new Date(o.created_at) >= weekStart;
  const inMonth = (o: LivreurOrder) => !!o.created_at && new Date(o.created_at) >= monthStart;
  const filtered = filtre === 'week' ? orders.filter(inWeek) : filtre === 'month' ? orders.filter(inMonth) : orders;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const cumul = orders.reduce((s, o) => s + Number(o.frais_livraison ?? 0), 0);

  // Frais de livraison de la semaine en cours, jour par jour (lundi → dimanche)
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const total = orders.filter((o) => o.created_at && sameDay(new Date(o.created_at), d)).reduce((s, o) => s + Number(o.frais_livraison ?? 0), 0);
    return { d, total };
  });
  const maxWeek = Math.max(0, ...week.map((w) => w.total));
  const fmtJour = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  const zoneOf = (o: LivreurOrder) => (o.landmark?.zone_id ? (zones.get(Number(o.landmark.zone_id)) ?? `Zone #${o.landmark.zone_id}`) : '—');
  const chooseFiltre = (f: Filtre) => {
    setFiltre(f);
    setPage(1);
  };
  const filterBtn = (f: Filtre, label: string) => (
    <button
      type="button"
      onClick={() => chooseFiltre(f)}
      className={clsx(
        'rounded-lg border px-lg py-sm font-label text-label transition-all',
        filtre === f
          ? 'border-[#F97316] bg-[#F97316] font-semibold text-white shadow-sm'
          : 'border-border-default bg-bg-card text-on-surface-variant hover:border-[#F97316]/50 hover:text-[#F97316]',
      )}
    >
      {label}
    </button>
  );

  return (
    <LivreurLayout>
      <div className="flex-1 p-xl">
        <div className="mx-auto max-w-[1200px]">
          {/* Header Section */}
          <div className="mb-xl flex items-center justify-between">
            <div className="flex items-center gap-md">
              <div className="flex items-center justify-center rounded-lg bg-primary p-sm text-on-primary">
                <MIcon name="history" className="text-h1" />
              </div>
              <h1 className="font-h1 text-h1 text-on-background">{tx("Historique des livraisons")}</h1>
            </div>
          </div>

          {err ? (
            <ApiErrorState
              title={tx("Impossible de charger l'historique")}
              message={err}
              onRetry={() => setReloadKey((k) => k + 1)}
              className="rounded-xl border border-border-default bg-bg-card px-md"
            />
          ) : !data ? (
            <LoadingState label={tx("Chargement de l'historique…")} className="rounded-xl border border-border-default bg-bg-card" />
          ) : (
            <>
              {/* Stats Summary */}
              <div className="mb-xl grid grid-cols-1 gap-lg md:grid-cols-4">
                <div className="rounded-xl border border-border-default bg-bg-card p-lg shadow-sm transition-colors hover:border-primary/30">
                  <p className="mb-xs font-label text-label text-text-secondary">{tx("Frais de livraison cumulés")}</p>
                  <p className="font-h1 text-h1 font-bold text-[#F97316]">{fmtFcfa(cumul)}</p>
                  {data.capped && <p className="text-micro text-text-secondary">{tx("Sur les 500 dernières courses")}</p>}
                </div>
                <div className="rounded-xl border border-border-default bg-bg-card p-lg shadow-sm transition-colors hover:border-primary/30">
                  <p className="mb-xs font-label text-label text-text-secondary">{tx("Courses terminées")}</p>
                  <p className="font-h1 text-h1 font-bold text-on-background">{data.total}</p>
                </div>
                <div className="rounded-xl border border-border-default bg-bg-card p-lg shadow-sm transition-colors hover:border-primary/30">
                  <p className="mb-xs font-label text-label text-text-secondary">{tx("Cette semaine")}</p>
                  <p className="font-h1 text-h1 font-bold text-on-background">{orders.filter(inWeek).length}</p>
                </div>
                <div className="rounded-xl border border-border-default bg-bg-card p-lg shadow-sm transition-colors hover:border-primary/30">
                  <p className="mb-xs font-label text-label text-text-secondary">{tx("Ce mois")}</p>
                  <p className="font-h1 text-h1 font-bold text-on-background">{orders.filter(inMonth).length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-xl lg:grid-cols-12">
                {/* Left Column: Table & Filters */}
                <div className="space-y-lg lg:col-span-8">
                  <div className="flex flex-wrap gap-sm">
                    {filterBtn('all', tx("Toutes les courses"))}
                    {filterBtn('week', tx("Cette semaine"))}
                    {filterBtn('month', tx("Ce mois"))}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border-default bg-bg-card shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-border-default bg-bg-secondary text-[13px]">
                            <th className="whitespace-nowrap px-md py-md font-label text-text-secondary">{tx("Commande du")}</th>
                            <th className="whitespace-nowrap px-md py-md font-label text-text-secondary">{tx("N° Commande")}</th>
                            <th className="whitespace-nowrap px-md py-md font-label text-text-secondary">Destination</th>
                            <th className="whitespace-nowrap px-md py-md font-label text-text-secondary">Zone</th>
                            <th className="whitespace-nowrap px-md py-md font-label text-text-secondary">{tx("Frais de livraison")}</th>
                            <th className="whitespace-nowrap px-md py-md font-label text-text-secondary">{tx("Statut")}</th>
                            <th className="whitespace-nowrap px-md py-md text-right font-label text-text-secondary">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-default text-[14px]">
                          {visible.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-md py-lg text-center text-text-secondary">
                                {tx("Aucune livraison sur cette période.")}
                              </td>
                            </tr>
                          )}
                          {visible.map((o) => (
                            <tr key={o.id} onClick={() => setSelected(o)} className="group cursor-pointer transition-colors hover:bg-orange-50/60">
                              <td className="whitespace-nowrap px-md py-md font-body text-body">{dateHeure(o.created_at)}</td>
                              <td className="whitespace-nowrap px-md py-md font-label font-bold text-[#F97316]">{tokRef(o.id)}</td>
                              <td className="whitespace-nowrap px-md py-md font-body font-medium text-on-surface">{o.landmark?.nom ?? '—'}</td>
                              <td className="whitespace-nowrap px-md py-md font-body text-on-surface-variant">{zoneOf(o)}</td>
                              <td className="whitespace-nowrap px-md py-md font-bold text-[#F97316]">{fmtFcfa(o.frais_livraison)}</td>
                              <td className="whitespace-nowrap px-md py-md">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold tracking-wide text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {statutLabel(o.statut)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-md py-md text-right">
                                <button
                                  type="button"
                                  aria-label={`Détails de la course ${tokRef(o.id)}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(o);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md p-1.5 text-text-secondary transition-colors hover:bg-orange-100 group-hover:text-[#F97316]"
                                >
                                  <MIcon name="visibility" className="text-[20px]" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination/Footer */}
                    <div className="flex items-center justify-between bg-bg-secondary px-lg py-md">
                      <span className="text-label text-text-secondary">
                        {filtered.length === 0
                          ? tx("Aucune course")
                          : `Affichage ${(current - 1) * PER_PAGE + 1}-${Math.min(current * PER_PAGE, filtered.length)} sur ${filtered.length} courses`}
                      </span>
                      <div className="flex items-center gap-xs">
                        <button
                          type="button"
                          aria-label={tx("Page précédente")}
                          disabled={current <= 1}
                          onClick={() => setPage(current - 1)}
                          className="rounded-md p-1 text-text-secondary hover:bg-white disabled:opacity-40"
                        >
                          <MIcon name="chevron_left" />
                        </button>
                        {Array.from({ length: pages }, (_, i) => i + 1)
                          .filter((n) => Math.abs(n - current) <= 2)
                          .map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPage(n)}
                              className={clsx(
                                'h-8 w-8 rounded-md text-label font-semibold',
                                n === current ? 'bg-[#F97316] text-white' : 'text-text-secondary hover:bg-white',
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        <button
                          type="button"
                          aria-label={tx("Page suivante")}
                          disabled={current >= pages}
                          onClick={() => setPage(current + 1)}
                          className="rounded-md p-1 text-text-secondary hover:bg-white disabled:opacity-40"
                        >
                          <MIcon name="chevron_right" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Frais de la semaine (réels) */}
                <div className="space-y-lg lg:col-span-4">
                  <div className="rounded-xl border border-border-default bg-bg-card p-lg shadow-sm">
                    <div className="mb-lg flex items-center justify-between">
                      <h2 className="font-h2 text-h2 text-on-background">{tx("Frais de la semaine")}</h2>
                      <span className="text-micro text-text-secondary">
                        {fmtJour(week[0].d)} – {fmtJour(week[6].d)}
                      </span>
                    </div>
                    <div className="flex h-40 items-end justify-between gap-2">
                      {week.map((w) => (
                        <div
                          key={w.d.toISOString()}
                          title={`${w.d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })} : ${fmtFcfa(w.total)}`}
                          className="w-full rounded-t-md bg-primary-light transition-all hover:bg-primary"
                          style={{ height: maxWeek > 0 ? `${Math.max(3, (w.total / maxWeek) * 100)}%` : '3%' }}
                        />
                      ))}
                    </div>
                    <div className="mt-sm flex justify-between text-micro text-text-secondary">
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
                        <span key={i}>{j}</span>
                      ))}
                    </div>
                    <p className="mt-md text-label text-text-secondary">
                      {tx("Total de la semaine :")} <span className="font-bold text-[#F97316]">{fmtFcfa(week.reduce((s, w) => s + w.total, 0))}</span>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delivery Details Modal */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-md"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-md border-b border-border-default p-lg">
              <div className="flex items-center gap-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-tint text-primary">
                  <MIcon name="local_shipping" />
                </div>
                <div>
                  <h3 className="font-h3 text-h3 font-bold text-on-surface">Détails de la course {tokRef(selected.id)}</h3>
                  <p className="text-micro text-text-secondary">{tx("Historique officiel TOKPa")}</p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {statutLabel(selected.statut)}
                </span>
                <button type="button" aria-label={tx("Fermer")} onClick={() => setSelected(null)} className="rounded-md p-1 text-text-secondary hover:bg-bg-app">
                  <MIcon name="close" />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="space-y-lg p-lg">
              <div className="rounded-lg border border-border-default bg-bg-secondary p-md">
                <span className="text-micro font-bold uppercase tracking-wider text-text-secondary">Destination</span>
                <div className="mt-sm flex items-start gap-sm">
                  <MIcon name="location_on" className="text-primary" />
                  <div>
                    <p className="font-semibold text-on-surface">{selected.landmark?.nom ?? '—'}</p>
                    <p className="text-label text-text-secondary">
                      {[selected.description_lieu, zoneOf(selected) !== '—' ? `Zone ${zoneOf(selected)}` : null].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-sm">
                <span className="text-micro font-bold uppercase tracking-wider text-text-secondary">{tx("Détails de la commande")}</span>
                <div className="flex justify-between gap-md text-label">
                  <span className="text-text-secondary">Articles livrés ({articlesCount(selected)})</span>
                  <span className="text-right font-medium text-on-surface">
                    {(selected.items ?? []).map((it) => `${it.quantite}x ${it.nom ?? `Produit #${it.product_id}`}`).join(', ') || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-label">
                  <span className="text-text-secondary">{tx("Montant de la commande")}</span>
                  <span className="font-medium text-on-surface">{fmtFcfa(selected.montant_total)}</span>
                </div>
                <div className="flex justify-between text-label">
                  <span className="text-text-secondary">{tx("Frais de livraison")}</span>
                  <span className="font-bold text-[#F97316]">{fmtFcfa(selected.frais_livraison)}</span>
                </div>
                <div className="flex justify-between text-label">
                  <span className="text-text-secondary">{tx("Commande passée le")}</span>
                  <span className="font-medium text-on-surface">{dateHeure(selected.created_at)}</span>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex justify-end border-t border-border-default p-lg">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border-default px-lg py-sm font-label text-label font-semibold text-on-surface hover:bg-bg-app"
              >
                {tx("Fermer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </LivreurLayout>
  );
}

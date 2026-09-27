import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { adminApi } from '../../services/api';
import { useLiveRows } from '../../services/api/useLiveRows';
import { unwrap, fmtFcfa, listOf } from '../../services/api/unwrap';
import { extractApiError, formatApiError } from '../../utils/apiError';
import MIcon from '../../components/shared/MIcon';
import { useLanguage } from '../../context/LanguageContext';
import { tr, tx } from '../../i18n/tx';


/** Activité récente — données statiques du design Stitch (copie conforme). */
interface Activity {
  id: string;
  action: string;
  detail: string;
  status: string;
  statusColor: string;
  date: string;
  time: string;
  userName: string;
  userRole: string;
  userPhone: string;
  userZone: string;
  amount: string;
  payment: string;
  fee: string;
  deliveryFee: string;
  items: string;
  audit: string;
  cta: string;
}


/** Couleurs du thème pour l'anneau « Ventes par Zone » (3 premières zones + « Autres »). */
const ZONE_COLORS = [
  { cls: 'bg-primary-container', css: 'var(--color-primary-container)' },
  { cls: 'bg-secondary-container', css: 'var(--color-secondary-container)' },
  { cls: 'bg-tertiary-container', css: 'var(--color-tertiary-container)' },
  { cls: 'bg-border-default', css: 'var(--color-border-default)' },
];
/** Seuil « stock faible » (même règle que le catalogue client : 1 à 5, 0 = rupture). */
const LOW_STOCK = 5;
/** GET /admin/orders est paginé par 20 sans per_page : on parcourt au plus 25 pages (500 commandes). */
const MAX_ORDER_PAGES = 25;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * AdminDashboardPage — « Tableau de bord global » — copie conforme statique du
 * design Stitch (`tableau_de_bord_global_admin_tokpa/code.html`).
 */
export default function AdminDashboardPage() {
  useLanguage();
  const { rows: commandes, err, loading } = useLiveRows(() => adminApi.getOrders({ page: 1 }));
  const [dash, setDash] = useState<any>(null);
  const SC = (s: string) => (s || '').includes('attente') ? 'bg-amber-light text-amber-text'
    : (s || '').includes('annul') || (s || '').includes('litige') ? 'bg-error-container text-error'
    : (s || '').includes('term') || (s || '').includes('livr') ? 'bg-success-light text-success'
    : 'bg-info-light text-info';
  // Zones (id → nom) : les commandes ne portent que landmark.zone_id.
  const [zoneNames, setZoneNames] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    adminApi
      .getZones()
      .then((r: any) => setZoneNames(new Map(listOf(unwrap(r)).map((z: any) => [Number(z.id), String(z.nom ?? '—')]))))
      .catch(() => setZoneNames(new Map()));
  }, []);
  // OrderResource enveloppe chaque commande dans { success, message, data } : on déballe.
  const orders = commandes.map((r: any) => r?.data ?? r);
  const activities: Activity[] = orders.slice(0, 6).map((o: any) => ({
    id: `CMD-${o.id}`,
    action: tx("Commande"),
    detail: `Commande #${o.id} — ${o.statut ?? '—'}`,
    status: o.statut ?? '—',
    statusColor: SC(o.statut),
    date: (o.created_at ?? '').slice(0, 10),
    time: (o.created_at ?? '').slice(11, 16),
    userName: o.client?.nom_complet ?? '—', // OrderResource n'expose pas encore le client
    userRole: 'client',
    userPhone: o.client?.telephone ?? '—',
    userZone: zoneNames.get(Number(o.landmark?.zone_id)) ?? o.landmark?.nom ?? '—',
    amount: fmtFcfa(o.montant_total),
    payment: o.payment?.methode ?? '—',
    fee: fmtFcfa(o.commission_plateforme ?? o.commission),
    deliveryFee: fmtFcfa(o.frais_livraison),
    items: (o.items ?? []).map((i: any) => `${i.nom ?? ''}${i.quantite ? ` ×${i.quantite}` : ''}`).join(', ') || '—',
    audit: `Commande n°${o.id}`,
    cta: tx("Voir la commande"),
  }));
  useEffect(() => {
    adminApi.getDashboard().then((r: any) => setDash(unwrap(r))).catch(() => setDash(null));
  }, []);
  // KPI réels (AdminDashboardController : ca, commandes, utilisateurs_actifs, par_statut)
  const parStatut: Record<string, number> = dash?.par_statut ?? {};
  const nbLivrees = Number(parStatut.livre ?? 0);
  const nbNonAnnulees = Number(dash?.commandes ?? 0) - Number(parStatut.annule ?? 0);
  const tauxLivraison = dash && nbNonAnnulees > 0 ? `${((nbLivrees / nbNonAnnulees) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : '—';

  // « Croissance des ventes » + « Ventes par Zone » : calculés depuis les vraies commandes de la période
  const [range, setRange] = useState<7 | 30>(7);
  const [periodOrders, setPeriodOrders] = useState<any[] | null>(null);
  const [capped, setCapped] = useState(false);
  const [chartErr, setChartErr] = useState<string | null>(null);
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (range - 1));
    return d;
  }, [range]);
  useEffect(() => {
    let alive = true;
    setPeriodOrders(null);
    setChartErr(null);
    setCapped(false);
    (async () => {
      const acc: any[] = [];
      for (let page = 1; page <= MAX_ORDER_PAGES; page++) {
        const res: any = await adminApi.getOrders({ page });
        const rows = listOf(res).map((r: any) => r?.data ?? r);
        acc.push(...rows);
        const oldest = rows[rows.length - 1]?.created_at;
        if (page >= Number(res?.meta?.last_page ?? 1) || !oldest || new Date(oldest) < since) return acc;
        if (page === MAX_ORDER_PAGES && alive) setCapped(true);
      }
      return acc;
    })()
      .then((acc) => alive && setPeriodOrders(acc.filter((o) => o?.created_at && new Date(o.created_at) >= since)))
      .catch((e) => alive && setChartErr(formatApiError(extractApiError(e))));
    return () => {
      alive = false;
    };
  }, [since]);
  const series = useMemo(() => {
    if (!periodOrders) return null;
    const totals = new Map<string, number>();
    periodOrders
      .filter((o) => o.statut !== 'annule')
      .forEach((o) => {
        const k = dayKey(new Date(o.created_at));
        totals.set(k, (totals.get(k) ?? 0) + Number(o.montant_total ?? 0));
      });
    return Array.from({ length: range }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const total = totals.get(dayKey(d)) ?? 0;
      const long = d.toLocaleDateString('fr-FR', { weekday: 'long' });
      return {
        key: dayKey(d),
        label: range === 7 ? long.charAt(0).toUpperCase() + long.slice(1) : i % 5 === 0 || i === range - 1 ? String(d.getDate()) : '',
        title: `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })} : ${fmtFcfa(total)}`,
        total,
      };
    });
  }, [periodOrders, range, since]);
  const maxDay = Math.max(0, ...(series ?? []).map((d) => d.total));
  const zoneStats = useMemo(() => {
    if (!periodOrders) return null;
    const counts = new Map<string, number>();
    periodOrders.forEach((o) => {
      const nom = zoneNames.get(Number(o.landmark?.zone_id)) ?? (o.landmark?.zone_id ? `Zone #${o.landmark.zone_id}` : 'Sans zone');
      counts.set(nom, (counts.get(nom) ?? 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3).map(([nom, n]) => ({ nom, n }));
    const autres = sorted.slice(3).reduce((sum, [, n]) => sum + n, 0);
    return autres > 0 ? [...top, { nom: tx("Autres"), n: autres }] : top;
  }, [periodOrders, zoneNames]);
  const totalPeriode = periodOrders?.length ?? 0;
  const donut = (() => {
    if (!zoneStats || totalPeriode === 0) return 'var(--color-border-default)';
    let acc = 0;
    const parts = zoneStats.map((z, i) => {
      const from = (acc / totalPeriode) * 360;
      acc += z.n;
      return `${ZONE_COLORS[i].css} ${from}deg ${(acc / totalPeriode) * 360}deg`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  })();

  // « Alertes Système » : vrais produits en stock faible (GET /admin/products) ; plus d'alertes inventées
  const [lowStock, setLowStock] = useState<{ id: number; nom: string; stock: number }[] | null>(null);
  const [lowStockErr, setLowStockErr] = useState<string | null>(null);
  useEffect(() => {
    adminApi
      .getProducts({ per_page: 100 })
      .then((r: any) =>
        setLowStock(
          listOf(unwrap(r))
            .filter((p: any) => Number(p.stock) <= LOW_STOCK)
            .sort((a: any, b: any) => Number(a.stock) - Number(b.stock))
            .map((p: any) => ({ id: Number(p.id), nom: String(p.nom), stock: Number(p.stock) })),
        ),
      )
      .catch((e) => setLowStockErr(formatApiError(extractApiError(e))));
  }, []);
  const [selected, setSelected] = useState<Activity | null>(null);

  return (
    <AdminLayout currentPath="/admin">
      {err && (
        <div className="m-lg rounded-lg border border-error bg-error-container p-4 text-label text-on-error-container">
          <p className="font-bold">{tx("Erreur API")}</p>
          <p>{err}</p>
        </div>
      )}
      {loading && <p className="m-lg text-label text-text-secondary">{tx("Chargement des données réelles…")}</p>}
      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
        <div className="stat-card-gradient p-lg rounded-lg border border-border-default hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-secondary text-label text-text-secondary uppercase tracking-wider">
              Volume d'affaires (GMV)
            </span>
            <span className="p-2 bg-primary-light text-primary rounded-lg material-symbols-outlined">payments</span>
          </div>
          <div className="space-y-xs">
            <h2 className="font-h1 text-h1 text-on-surface">{dash?.ca != null ? fmtFcfa(dash.ca) : '—'}</h2>
            <div className="flex items-center gap-1 text-text-secondary">
              <MIcon name="payments" className="text-sm" />
              <span className="font-secondary text-label font-bold">{tx("Paiements réussis")}</span>
            </div>
          </div>
        </div>

        <div className="stat-card-gradient p-lg rounded-lg border border-border-default hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-secondary text-label text-text-secondary uppercase tracking-wider">
              {tx("Commandes totales")}
            </span>
            <span className="p-2 bg-secondary-container/20 text-secondary rounded-lg material-symbols-outlined">
              shopping_cart
            </span>
          </div>
          <div className="space-y-xs">
            <h2 className="font-h1 text-h1 text-on-surface">{String(dash?.commandes ?? '—')}</h2>
            <div className="flex items-center gap-1 text-text-secondary">
              <MIcon name="schedule" className="text-sm" />
              <span className="font-secondary text-label font-bold">{dash ? `${Number(parStatut.en_attente ?? 0)} en attente` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card-gradient p-lg rounded-lg border border-border-default hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-secondary text-label text-text-secondary uppercase tracking-wider">
              {tx("Utilisateurs actifs")}
            </span>
            <span className="p-2 bg-tertiary-container/20 text-tertiary rounded-lg material-symbols-outlined">
              person_add
            </span>
          </div>
          <div className="space-y-xs">
            <h2 className="font-h1 text-h1 text-on-surface">{String(dash?.utilisateurs_actifs ?? '—')}</h2>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 bg-success-light text-success-dark rounded-full font-secondary text-micro font-bold">
                Comptes au statut actif
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card-gradient p-lg rounded-lg border border-border-default hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-secondary text-label text-text-secondary uppercase tracking-wider">
              Taux de livraison
            </span>
            <span className="p-2 bg-success-light text-success rounded-lg material-symbols-outlined">
              local_shipping
            </span>
          </div>
          <div className="space-y-xs">
            <h2 className="font-h1 text-h1 text-on-surface">{tauxLivraison}</h2>
            <div className="flex items-center gap-1 text-success">
              <MIcon name="check_circle" className="text-sm" />
              <span className="font-secondary text-label font-bold">{dash ? tr(`${nbLivrees} livrées sur ${Math.max(0, nbNonAnnulees)}`, `${nbLivrees} delivered out of ${Math.max(0, nbNonAnnulees)}`) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Croissance des ventes */}
        <div className="lg:col-span-2 bg-bg-card p-lg rounded-lg border border-border-default">
          <div className="flex justify-between items-center mb-xl">
            <div>
              <h3 className="font-h2 text-h2 text-on-surface">{tx("Croissance des ventes")}</h3>
              <p className="font-secondary text-label text-text-secondary">
                Performances journalières du réseau (commandes non annulées){capped ? tx(" — calculé sur les 500 dernières commandes") : ''}
              </p>
            </div>
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value) === 30 ? 30 : 7)}
              className="bg-bg-app border-none text-label rounded-lg px-md py-sm font-secondary"
            >
              <option value={7}>7 derniers jours</option>
              <option value={30}>30 derniers jours</option>
            </select>
          </div>
          <div className="h-[280px] w-full flex items-end justify-between gap-2 px-4 relative overflow-hidden">
            {chartErr ? (
              <p className="m-auto max-w-[420px] text-center font-secondary text-label text-error">Ventes indisponibles : {chartErr}</p>
            ) : !series ? (
              <p className="m-auto font-secondary text-label text-text-secondary">{tx("Chargement des ventes…")}</p>
            ) : (
              series.map((d) => (
                <div
                  key={d.key}
                  title={d.title}
                  className="w-full bg-primary-light h-full rounded-t-lg transition-all hover:bg-primary"
                  style={{ height: maxDay > 0 ? `${Math.max(2, (d.total / maxDay) * 100)}%` : '2%' }}
                />
              ))
            )}
          </div>
          <div className="flex justify-between mt-sm px-4 font-secondary text-micro text-text-tertiary">
            {(series ?? []).map((d) => (
              <span key={d.key}>{d.label}</span>
            ))}
          </div>
        </div>

        {/* Ventes par Zone */}
        <div className="bg-bg-card p-lg rounded-lg border border-border-default">
          <h3 className="font-h2 text-h2 text-on-surface mb-xl">{tx("Ventes par Zone")}</h3>
          <div className="relative h-[220px] flex items-center justify-center">
            <div className="w-40 h-40 rounded-full relative flex items-center justify-center" style={{ background: donut }}>
              <div className="absolute inset-[12px] rounded-full bg-bg-card" />
              <div className="relative text-center">
                <span className="block font-h3 text-h3 text-on-surface">Total</span>
                <span className="font-price text-price text-primary">{periodOrders ? totalPeriode : '—'}</span>
              </div>
            </div>
          </div>
          <div className="mt-lg space-y-sm">
            {chartErr && <p className="font-secondary text-label text-error">{tx("Données indisponibles.")}</p>}
            {zoneStats && zoneStats.length === 0 && (
              <p className="font-secondary text-label text-text-secondary">{tx("Aucune commande sur la période.")}</p>
            )}
            {(zoneStats ?? []).map((z, i) => (
              <div key={z.nom} className="flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <span className={`w-3 h-3 rounded-full ${ZONE_COLORS[i].cls}`} />
                  <span className="font-secondary text-label">{z.nom}</span>
                </div>
                <span className="font-secondary text-label font-bold">{Math.round((z.n / Math.max(1, totalPeriode)) * 100)} %</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LOWER SECTION: TABLE & ALERTS */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-lg items-start">
        {/* RECENT ACTIVITIES TABLE */}
        <div className="xl:col-span-3 bg-bg-card rounded-lg border border-border-default overflow-hidden shadow-sm">
          <div className="p-lg border-b border-border-default flex justify-between items-center">
            <h3 className="font-h2 text-h2 text-on-surface">{tx("Activités Récentes de la Plateforme")}</h3>
            <button
              type="button"
              className="text-primary font-secondary text-label font-bold flex items-center gap-1 hover:underline cursor-pointer"
            >
              {tx("Tout voir")} <MIcon name="arrow_forward" className="text-sm" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-secondary">
              <thead className="bg-bg-secondary text-text-tertiary text-micro uppercase tracking-widest border-b border-border-default">
                <tr>
                  <th className="px-lg py-md">Date</th>
                  <th className="px-lg py-md">Type d'action</th>
                  <th className="px-lg py-md">{tx("Utilisateur")}</th>
                  <th className="px-lg py-md">{tx("Détails")}</th>
                  <th className="px-lg py-md">{tx("Statut")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default text-label">
                {activities.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="hover:bg-orange-50/60 transition-colors cursor-pointer"
                  >
                    <td className="px-lg py-md text-text-secondary">{a.time}</td>
                    <td className="px-lg py-md font-bold">{a.action}</td>
                    <td className="px-lg py-md">{a.userName}</td>
                    <td className="px-lg py-md">{a.detail}</td>
                    <td className="px-lg py-md">
                      <span className={`px-3 py-1 font-bold rounded-full text-micro ${a.statusColor}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SYSTEM ALERTS */}
        <div className="space-y-md">
          <div className="bg-bg-card p-lg rounded-lg border border-border-default border-l-4 border-l-error">
            <div className="flex items-center gap-sm mb-md text-error">
              <MIcon name="warning" />
              <h4 className="font-h3 text-h3 font-bold">{tx("Alertes Système")}</h4>
            </div>
            <ul className="space-y-md">
              {lowStockErr ? (
                <li className="font-secondary text-micro text-error">Stocks indisponibles : {lowStockErr}</li>
              ) : lowStock === null ? (
                <li className="font-secondary text-micro text-text-secondary">{tx("Chargement…")}</li>
              ) : lowStock.length === 0 ? (
                <li className="font-secondary text-micro text-text-secondary">{tx("Aucune alerte pour le moment.")}</li>
              ) : (
                <li className="flex flex-col gap-1 border-b border-border-default pb-md last:border-0 last:pb-0">
                  <span className="font-secondary text-label font-bold text-on-surface">
                    Stocks Faibles ({lowStock.length})
                  </span>
                  {lowStock.slice(0, 4).map((p) => (
                    <p key={p.id} className="font-secondary text-secondary text-micro">
                      {p.nom} — {p.stock <= 0 ? 'en rupture' : `plus que ${p.stock} en stock`}
                    </p>
                  ))}
                  {lowStock.length > 4 && (
                    <p className="font-secondary text-secondary text-micro">+ {lowStock.length - 4} autre(s)</p>
                  )}
                  <Link to="/admin/catalogue" className="mt-2 text-primary font-bold text-micro text-left hover:underline">
                    {tx("Gérer le catalogue")}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Support card */}
          <div className="bg-primary text-white p-lg rounded-lg shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-h3 text-h3 font-bold mb-xs">{tx("Besoin d'aide ?")}</h4>
              <p className="text-micro opacity-80 mb-md font-secondary">
                {tx("Contactez le support technique 24/7 dédié aux administrateurs TOKPa.")}
              </p>
              <button
                type="button"
                className="bg-white text-primary px-4 py-2 rounded-lg font-bold text-label transition-transform active:scale-95 cursor-pointer"
              >
                Support Direct
              </button>
            </div>
            <MIcon
              name="support_agent"
              className="absolute -bottom-4 -right-4 text-[120px] opacity-10 rotate-12 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* MODALE DÉTAIL ACTIVITÉ — copie conforme du design */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-border-default w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2">
                <MIcon name="receipt_long" className="text-primary text-xl" />
                <div>
                  <h3 className="font-h2 text-h3 font-bold text-on-surface">
                    {selected.action} — {selected.id}
                  </h3>
                  <p className="font-secondary text-micro text-text-secondary">
                    Supervision &amp; Traitement administratif TOKPa
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={tx("Fermer le modal")}
                onClick={() => setSelected(null)}
                className="p-1.5 text-text-secondary hover:text-on-surface hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              >
                <MIcon name="close" className="text-xl" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-border-default">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-label text-primary bg-primary-light/40 px-2 py-0.5 rounded">
                      #{selected.id}
                    </span>
                    <span className="text-micro text-text-secondary font-medium">
                      {tr(`${selected.date} à ${selected.time}`, `${selected.date} at ${selected.time}`)}
                    </span>
                  </div>
                  <h4 className="text-h2 font-bold text-on-surface">{selected.action}</h4>
                </div>
                <span className={`px-3 py-1 font-bold rounded-full text-micro ${selected.statusColor}`}>
                  {selected.status}
                </span>
              </div>

              {/* Profil de l'acteur */}
              <div className="bg-bg-secondary p-3.5 rounded-lg border border-border-default space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-micro uppercase tracking-wider text-text-tertiary font-bold flex items-center gap-1">
                    <MIcon name="person" className="text-sm" />
                    {tx("Profil de l'Acteur")}
                  </span>
                  <span className="text-micro font-bold text-primary bg-white px-2 py-0.5 rounded border border-border-default">
                    {selected.userRole}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-label pt-1">
                  <div className="flex items-center gap-2">
                    <MIcon name="badge" className="text-text-tertiary text-base" />
                    <span className="font-bold text-on-surface">{selected.userName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MIcon name="call" className="text-text-tertiary text-base" />
                    <span className="font-mono text-text-secondary">{selected.userPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <MIcon name="location_on" className="text-text-tertiary text-base" />
                    <span className="text-text-secondary">{selected.userZone}</span>
                  </div>
                </div>
              </div>

              {/* Montant / Frais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-low p-3 rounded-lg border border-border-default">
                  <span className="text-micro uppercase tracking-wider text-text-tertiary font-bold block mb-1">
                    {tx("Montant &amp; Paiement")}
                  </span>
                  <p className="font-price text-h3 text-primary font-bold">{selected.amount}</p>
                  <p className="text-micro text-text-secondary mt-0.5">{selected.payment}</p>
                </div>
                <div className="bg-bg-app p-3 rounded-lg border border-border-default">
                  <span className="text-micro uppercase tracking-wider text-text-tertiary font-bold block mb-1">
                    {tx("Frais &amp; Livraison")}
                  </span>
                  <p className="text-label font-semibold text-on-surface">Commission TOKPa: {selected.fee}</p>
                  <p className="text-micro text-text-secondary mt-0.5">Livraison: {selected.deliveryFee}</p>
                </div>
              </div>

              {/* Articles */}
              <div className="space-y-1.5">
                <span className="text-micro uppercase tracking-wider text-text-tertiary font-bold flex items-center gap-1">
                  <MIcon name="shopping_bag" className="text-sm" />
                  {tx("Articles / Objet de l'opération")}
                </span>
                <div className="bg-white p-3 rounded-lg border border-border-default">
                  <p className="text-label text-on-surface font-medium leading-relaxed">{selected.items}</p>
                </div>
              </div>

              {/* Journal d'audit */}
              <div className="space-y-1 pt-1">
                <span className="text-micro uppercase tracking-wider text-text-tertiary font-bold flex items-center gap-1">
                  <MIcon name="verified" className="text-sm" />
                  {tx("Journal d'Audit Système")}
                </span>
                <p className="text-micro font-mono text-text-secondary bg-bg-app p-2.5 rounded border border-border-default">
                  {selected.audit}
                </p>
              </div>
            </div>

            {/* Pied de modale */}
            <div className="px-6 py-4 bg-bg-secondary border-t border-border-default flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                className="px-3 py-2 text-label font-medium text-text-secondary hover:bg-border-default/40 rounded-lg transition-colors flex items-center gap-1.5 border border-border-default bg-white cursor-pointer"
              >
                <MIcon name="download" className="text-base" />
                <span>{tx("Télécharger reçu")}</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 text-label font-medium text-text-secondary hover:bg-border-default/40 rounded-lg transition-colors cursor-pointer"
                >
                  {tx("Fermer")}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-label font-bold text-white bg-primary-container hover:bg-primary-hover rounded-lg transition-transform active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <MIcon name="open_in_new" className="text-base" />
                  <span>{selected.cta}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

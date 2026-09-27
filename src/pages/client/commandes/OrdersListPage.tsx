import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import EmptyState from '../../../components/shared/EmptyState';
import Pagination from '../../../components/shared/Pagination';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { ordersApi, paymentsApi } from '../../../services/api';
import { isOwnOrder } from '../../../utils/ownOrder';
import { alertApiError, extractApiError, formatApiError } from '../../../utils/apiError';
import { tx } from '../../../i18n/tx';


interface ApiOrderItem {
  id: number;
  product_id: number;
  nom?: string;
  quantite: number;
  prix_unitaire: number;
}

/** Commande — exactement `OrderResource::$data` (GET /orders, GET /orders/{id}). */
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
  livreur?: { id: number; nom_complet: string; telephone?: string } | null;
  payment?: { id: number; montant: number; statut: string; methode: string } | null;
}

const STATUT_LABELS: Record<string, { fr: string; en: string }> = {
  en_attente: { fr: 'En attente', en: 'Pending' },
  en_preparation: { fr: 'En préparation', en: 'Preparing' },
  en_livraison: { fr: 'En livraison', en: 'Out for delivery' },
  livre: { fr: 'Livrée', en: 'Delivered' },
  annule: { fr: 'Annulée', en: 'Cancelled' },
};

/** Pastilles de statut — design de base (comme Profil / commandes récentes). */
const STATUT_BADGE: Record<string, string> = {
  en_attente: 'bg-[#FFFBEB] text-amber-text border-[#FDE68A]',
  en_preparation: 'bg-primary-tint text-primary-dark border-primary-light',
  en_livraison: 'bg-primary-tint text-primary-dark border-primary-light',
  livre: 'bg-success-light text-success-dark border-success-light',
  annule: 'bg-error-light text-error-dark border-error/20',
};

/** Pastilles `.status-*` du thème — uniquement dans la modale (validée en l'état). */
const STATUT_CLASS: Record<string, string> = {
  en_attente: 'status-pending',
  en_preparation: 'status-preparing',
  en_livraison: 'status-shipping',
  livre: 'status-delivered',
  annule: 'status-cancelled',
};

const articlesCount = (o: ApiOrder) => (o.items ?? []).reduce((s, it) => s + Number(it.quantite ?? 0), 0);

/**
 * OrdersListPage — Mes commandes (route /commandes) :
 *   - GET /api/orders?page={n}  → tableau paginé (OrderResource, paginate(15))
 *   - clic sur une ligne        → modale détails complète (items, totaux, livraison, livreur, paiement)
 *   - bouton « Suivre »         → /commandes/suivi?order={id}
 *   - bouton « Annuler »        → DELETE /api/orders/{id} (modale, statut en_attente uniquement — F-13)
 */
export default function OrdersListPage() {
  const { isFr } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthGuard('/connexion');

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [paying, setPaying] = useState(false);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<ApiOrder | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    ordersApi
      .getOrders(page, statusFilter)
      .then((res) => {
        const raw = (res?.data ?? res ?? []) as Array<Record<string, unknown> & { data?: ApiOrder }>;
        const list: ApiOrder[] = (Array.isArray(raw) ? raw : []).map((o) => (o.data ?? o) as ApiOrder);
        setOrders(statusFilter ? list.filter((o) => o.statut === statusFilter) : list);
        setLastPage(Number(res?.meta?.last_page ?? res?.last_page ?? 1));
        setTotal(Number(res?.meta?.total ?? res?.total ?? list.length));
      })
      .catch((err) => {
        setError(alertApiError(err, 'orders-list'));
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, page, statusFilter]);

  const handlePayer = async (order: ApiOrder) => {
    if (paying) return;
    setPaying(true);
    try {
      const result = await paymentsApi.initPayment({ order_id: order.id });
      const payment = result?.data ?? result;
      if (payment?.redirect_url) window.location.assign(payment.redirect_url);
      else toast.success(isFr ? tx("Paiement initialisé.") : 'Payment initialized.');
    } catch (err) {
      toast.error(formatApiError(extractApiError(err)));
    } finally { setPaying(false); }
  };

  const search = useSearch({ from: '/commandes' }) as unknown as { detail?: string };

  const handleSuivre = (id: number) => {
    navigate({ to: '/commandes/suivi', search: { order: String(id) } });
  };

  // Annulation client — DELETE /api/orders/{id}. Le backend n'accepte que le statut
  // en_attente (sinon 422 « Seule une commande en attente peut être annulée. »).
  const [cancelling, setCancelling] = useState(false);
  const handleAnnuler = async (o: ApiOrder) => {
    if (cancelling) return;
    if (!confirm(isFr ? `Annuler la commande #TOK-${o.id} ?` : `Cancel order #TOK-${o.id}?`)) return;
    setCancelling(true);
    try {
      await ordersApi.cancelOrder(o.id);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, statut: 'annule' } : x)));
      setSelected((s) => (s && s.id === o.id ? { ...s, statut: 'annule' } : s));
      toast.success(isFr ? tx("Commande annulée") : 'Order cancelled');
    } catch (err) {
      toast.error(formatApiError(extractApiError(err)));
    } finally {
      setCancelling(false);
    }
  };

  // Ouverture de la modale via ?detail={id} (profil → « Détails ») — garde-fou anti-IDOR
  useEffect(() => {
    const raw = search.detail;
    if (!raw || !isAuthenticated || loading) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    let alive = true;
    (async () => {
      const inList = orders.some((o) => Number(o.id) === id);
      if (!inList && !(await isOwnOrder(id))) {
        console.warn(`[anti-IDOR] ?detail=${id} refusé (commande absente de GET /orders)`);
        return;
      }
      try {
        const res = await ordersApi.getOrder(id);
        if (alive) setSelected((res?.data ?? res) as ApiOrder);
      } catch (err) {
        if (alive) alertApiError(err, 'order-detail');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.detail, isAuthenticated, loading]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="bg-bg-app min-h-screen flex items-center justify-center font-body text-text-main">
        <MIcon name="sync" className="text-primary text-4xl animate-spin" />
      </div>
    );
  }

  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');
  const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');
  const money = (n?: number) => `${Number(n ?? 0).toLocaleString('fr-FR')} ${selected?.devise ?? 'FCFA'}`;

  return (
    <div className="bg-bg-app font-body text-on-surface antialiased min-h-screen flex flex-col">
      <ClientNavbar />

      <main className="flex-grow pt-[52px] pb-[80px] md:pb-0 px-lg py-xl">
        <div className="max-w-[1000px] mx-auto">
          {/* En-tête */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-lg">
            <h1 className="font-h1 text-h1 text-on-surface">{isFr ? tx("Mes commandes") : 'My orders'}</h1>
            <span className="text-micro text-text-secondary bg-white border border-border-default rounded-lg px-3 py-1.5">
              {total} {isFr ? tx("commande(s)") : 'order(s)'}
            </span>
          </div>

          <div className="mb-lg flex flex-wrap items-center gap-2">
            <label htmlFor="order-status" className="text-micro font-bold text-text-secondary">{isFr ? tx("Filtrer par statut") : 'Filter by status'}</label>
            <select id="order-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-border-default bg-white px-3 py-2 text-label">
              <option value="">{isFr ? tx("Tous les statuts") : 'All statuses'}</option>
              {Object.entries(STATUT_LABELS).map(([value, label]) => <option key={value} value={value}>{isFr ? label.fr : label.en}</option>)}
            </select>
          </div>

          {error && (
            <div className="mb-lg p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark leading-relaxed">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-2xl flex justify-center bg-white rounded-lg border border-border-default">
              <MIcon name="sync" className="text-primary text-3xl animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-xl bg-white rounded-lg border border-border-default">
              <EmptyState
                icon={<MIcon name="receipt_long" className="text-4xl text-primary" />}
                title={isFr ? tx("Aucune commande") : 'No orders yet'}
                description={isFr ? tx("Vos commandes apparaîtront ici.") : 'Your orders will appear here.'}
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
          ) : (
            /* Tableau — design de base (sans barre de défilement : colonnes responsives + scrollbar masquée) */
            <div className="bg-white rounded-lg border border-border-default overflow-hidden">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full text-left text-body">
                  <thead>
                    <tr className="border-b border-border-default bg-bg-secondary text-micro font-bold text-text-secondary uppercase">
                      <th className="px-md py-sm">{tx("Réf")}</th>
                      <th className="hidden lg:table-cell px-md py-sm">{isFr ? 'Date' : 'Date'}</th>
                      <th className="hidden sm:table-cell px-md py-sm">{isFr ? tx("Articles") : 'Items'}</th>
                      <th className="px-md py-sm">{isFr ? 'Total' : 'Total'}</th>
                      <th className="px-md py-sm">{isFr ? 'Statut' : 'Status'}</th>
                      <th className="hidden lg:table-cell px-md py-sm">{isFr ? tx("Livreur") : 'Rider'}</th>
                      <th className="px-md py-sm text-right">{isFr ? 'Actions' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const label = STATUT_LABELS[o.statut] ?? { fr: o.statut, en: o.statut };
                      return (
                        <tr
                          key={o.id}
                          onClick={() => {
                            setSelected(o);
                            // recharge la version COMPLÈTE (payment chargé par show()) sans fermer la modale
                            ordersApi
                              .getOrder(o.id)
                              .then((res) => {
                                const full = (res?.data ?? res) as ApiOrder;
                                setSelected((cur) => (cur?.id === full.id ? full : cur));
                              })
                              .catch(() => {});
                          }}
                          className="border-b border-border-default/60 last:border-0 hover:bg-bg-secondary cursor-pointer transition-colors"
                        >
                          <td className="px-md py-sm font-bold text-text-main">#{o.id}</td>
                          <td className="hidden lg:table-cell px-md py-sm text-text-secondary">
                            {fmtDate(o.created_at)}
                          </td>
                          <td className="hidden sm:table-cell px-md py-sm text-text-secondary">{articlesCount(o)}</td>
                          <td className="px-md py-sm font-price text-text-main whitespace-nowrap">
                            {Number(o.montant_total ?? 0).toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="px-md py-sm">
                            <span
                              className={`inline-flex items-center gap-xs px-md py-xs rounded-full text-micro font-bold border whitespace-nowrap ${
                                STATUT_BADGE[o.statut] ?? 'bg-bg-secondary text-text-secondary border-border-default'
                              }`}
                            >
                              {isFr ? label.fr : label.en}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-md py-sm text-text-secondary">
                            {o.livreur?.nom_complet ?? '—'}
                          </td>
                          <td className="px-md py-sm text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSuivre(o.id);
                              }}
                              className="inline-flex items-center gap-xs px-md py-xs rounded-lg bg-primary-tint border border-primary-light text-primary-container text-micro font-bold hover:bg-primary-lighter active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                            >
                              <MIcon name="near_me" className="text-[14px]" />
                              {isFr ? tx("Suivre") : 'Track'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination — MÊME composant que Notifications / Profil (carrés 40px, page active orange) */}
          {lastPage > 1 && <Pagination page={page} pageCount={lastPage} onChange={setPage} className="mt-8" />}
        </div>
      </main>

      {/* MODALE DÉTAILS COMMANDE — même gabarit que NegotiationModal (largeur arbitraire : max-w-lg = bug TW4) */}
      {selected && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-[600px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête modale */}
            <div className="flex items-start justify-between gap-md p-lg border-b border-line bg-warm">
              <div>
                <h2 className="font-h2 text-h2 text-on-surface">
                  {isFr ? tx("Commande") : 'Order'} #{selected.id}
                </h2>
                <p className="text-micro text-text-secondary mt-xs">{fmtDateTime(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-sm">
                <span className={`status ${STATUT_CLASS[selected.statut] ?? ''}`}>
                  {isFr
                    ? (STATUT_LABELS[selected.statut]?.fr ?? selected.statut)
                    : (STATUT_LABELS[selected.statut]?.en ?? selected.statut)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={isFr ? tx("Fermer") : 'Close'}
                  className="w-8 h-8 rounded-button border border-line flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                >
                  <MIcon name="close" className="text-[18px]" />
                </button>
              </div>
            </div>

            {/* Corps scrollable */}
            <div className="p-lg space-y-lg overflow-y-auto">
              {/* Articles */}
              <section>
                <h3 className="label text-text-main mb-sm flex items-center gap-xs">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary-lighter text-primary-dark">
                    <MIcon name="shopping_bag" className="text-[16px]" />
                  </span>
                  {isFr ? tx("Articles") : 'Items'}
                </h3>
                <table className="w-full text-body">
                  <tbody>
                    {(selected.items ?? []).map((it) => (
                      <tr key={it.id} className="border-b border-line/60 last:border-0">
                        <td className="py-xs pr-sm text-text-main">{it.nom ?? `Produit #${it.product_id}`}</td>
                        <td className="py-xs px-sm text-text-secondary whitespace-nowrap">× {it.quantite}</td>
                        <td className="py-xs px-sm text-text-secondary whitespace-nowrap">
                          {Number(it.prix_unitaire).toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="py-xs pl-sm text-right font-bold text-text-main whitespace-nowrap">
                          {(Number(it.prix_unitaire) * Number(it.quantite)).toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                    ))}
                    {(selected.items ?? []).length === 0 && (
                      <tr>
                        <td className="py-xs text-text-tertiary">—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="mt-sm space-y-xs text-body border-t border-line pt-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>{isFr ? tx("Sous-total produits") : 'Items subtotal'}</span>
                    <span>
                      {(selected.items ?? [])
                        .reduce((s, it) => s + Number(it.prix_unitaire) * Number(it.quantite), 0)
                        .toLocaleString('fr-FR')}{' '}
                      FCFA
                    </span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>{isFr ? tx("Frais de livraison") : 'Delivery fee'}</span>
                    <span>{Number(selected.frais_livraison ?? 0).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-main">
                    <span>{isFr ? 'Total' : 'Total'}</span>
                    <span className="price">{money(selected.montant_total)}</span>
                  </div>
                </div>
              </section>

              {/* Livraison */}
              <section>
                <h3 className="label text-text-main mb-sm flex items-center gap-xs">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary-lighter text-primary-dark">
                    <MIcon name="local_shipping" className="text-[16px]" />
                  </span>
                  {isFr ? tx("Livraison") : 'Delivery'}
                </h3>
                <div className="bg-warm rounded-card p-md space-y-xs text-body">
                  <p className="text-text-main font-bold">{selected.landmark?.nom ?? '—'}</p>
                  {selected.description_lieu && (
                    <p className="text-text-secondary">{selected.description_lieu}</p>
                  )}
                  <p className="text-text-secondary">
                    {selected.livreur ? (
                      <>
                        {isFr ? tx("Livreur") : 'Rider'} : {selected.livreur.nom_complet}
                        {selected.livreur.telephone && (
                          <>
                            {' · '}
                            <a
                              href={`tel:${selected.livreur.telephone.replace(/\s/g, '')}`}
                              className="text-primary-dark font-bold hover:underline"
                            >
                              {selected.livreur.telephone}
                            </a>
                          </>
                        )}
                      </>
                    ) : (
                      (isFr ? 'Livreur en cours d’assignation…' : 'Rider being assigned…')
                    )}
                  </p>
                </div>
              </section>

              {/* Paiement */}
              <section>
                <h3 className="label text-text-main mb-sm flex items-center gap-xs">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary-lighter text-primary-dark">
                    <MIcon name="credit_card" className="text-[16px]" />
                  </span>
                  {isFr ? tx("Paiement") : 'Payment'}
                </h3>
                <div className="bg-warm rounded-card p-md text-body text-text-secondary">
                  {selected.payment ? (
                    <div className="flex justify-between">
                      <span>
                        {selected.payment.methode} · {selected.payment.statut}
                      </span>
                      <span className="font-bold text-text-main">
                        {Number(selected.payment.montant).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  ) : (
                    <span>{isFr ? tx("Paiement non initialisé") : 'Payment not initialized'}</span>
                  )}
                </div>
              </section>

              {/* Actions modale */}
              <div className="flex gap-sm">
                {!selected.payment && selected.statut !== 'annule' && (
                  <button type="button" onClick={() => handlePayer(selected)} disabled={paying} className="btn btn-primary flex-1 disabled:opacity-60">
                    <MIcon name={paying ? 'sync' : 'payments'} className={paying ? 'animate-spin' : undefined} />
                    {isFr ? tx("Payer") : 'Pay'}
                  </button>
                )}
                <button type="button" onClick={() => handleSuivre(selected.id)} className="btn btn-primary flex-1">
                  <MIcon name="near_me" />
                  {isFr ? tx("Suivre cette commande") : 'Track this order'}
                </button>
                {selected.statut === "en_attente" && (
                  <button
                    type="button"
                    onClick={() => handleAnnuler(selected)}
                    disabled={cancelling}
                    className="btn btn-danger disabled:opacity-60"
                  >
                    <MIcon name={cancelling ? 'sync' : 'cancel'} className={cancelling ? 'animate-spin' : undefined} />
                    {isFr ? tx("Annuler") : 'Cancel'}
                  </button>
                )}
                <button type="button" onClick={() => setSelected(null)} className="btn btn-ghost">
                  {isFr ? tx("Fermer") : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import { useAppDispatch, useAppSelector } from '../../../hooks/useStore';
import { add } from '../../../store/slices/cart/cartSlice';
import { acceptCounterOffer, setProposals, type NegotiationItem } from '../../../store/slices/negotiation/negotiationSlice';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { negotiationApi } from '../../../services/api';
import { absImageUrl } from '../../../utils/imageUrl';
import { alertApiError } from '../../../utils/apiError';
import { subscribeRealtimeRefresh } from '../../../hooks/useRealtimeNotifications';
import type { Product } from '../../../types/models';
import { tx } from '../../../i18n/tx';


type FilterTab = 'all' | 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Page dédiée Mes Négociations — Synchronisée 100% avec l'API Backend Laravel GET /api/budget-proposals
 */
export default function NegotiationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isFr } = useLanguage();
  const { isAuthenticated, isLoading } = useAuthGuard('/connexion');

  const history = useAppSelector((state) => state.negotiation.history);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isApiLoading, setIsApiLoading] = useState(true);

  // Load real budget proposals from Backend GET /api/budget-proposals
  const loadProposals = useCallback(() => {
    setIsApiLoading(true);

    negotiationApi.getProposals()
      .then((res) => {
        const proposalsList = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(proposalsList)) {
          const mapped: NegotiationItem[] = proposalsList.map((p: any) => ({
            id: String(p.id),
            productId: String(p.product_id ?? p.product?.id ?? ''),
            productName: p.product?.nom || `Produit #${p.product_id ?? p.product?.id ?? '?'}`,
            productImage: absImageUrl(p.product?.image_url) ?? undefined,
            vendorName: '', // l'API ne rattache aucun produit à un marché : pas de provenance inventée
            originalPrice: Number(p.product?.prix) || Number(p.prix_propose) || 0,
            proposedPrice: Number(p.prix_propose),
            minPrice: Number(p.product?.prix_minimum) || Number(p.prix_propose),
            quantite: Number(p.quantite) || 1,
            orderId: p.commande?.id ?? p.order_id,
            adminResponse: p.admin_response || undefined,
            status:
              p.statut === 'accepte' ? 'accepted'
              : p.statut === 'refuse' ? 'rejected'
              : p.statut === 'expire' ? 'expired'
              : 'pending',
            createdAt: p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : tx("Récemment"),
          }));
          dispatch(setProposals(mapped));
        }
      })
      .catch((err) => {
        alertApiError(err, 'negotiations-load');
      })
      .finally(() => setIsApiLoading(false));
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    if (isAuthenticated) loadProposals();
  }, [isAuthenticated, loadProposals]);

  // Temps réel : budget.responded sur notifications.{userId} → rechargement silencieux
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeRealtimeRefresh(['proposals'], () => loadProposals());
  }, [isAuthenticated, loadProposals]);

  // ---- Modal « Modifier mon offre » (PUT /api/budget-proposals/{id}) ----
  const [editModal, setEditModal] = useState<NegotiationItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="bg-bg-app min-h-screen flex items-center justify-center font-body text-text-main">
        <MIcon name="sync" className="text-primary text-4xl animate-spin" />
      </div>
    );
  }

  const pendingCount = history.filter((n) => n.status === 'pending' || n.status === 'counter_offer').length;
  const acceptedCount = history.filter((n) => n.status === 'accepted').length;
  const rejectedCount = history.filter((n) => n.status === 'rejected').length;
  const expiredCount = history.filter((n) => n.status === 'expired').length;

  const filteredHistory = history.filter((n) => {
    if (activeTab === 'pending') return n.status === 'pending' || n.status === 'counter_offer';
    if (activeTab === 'accepted') return n.status === 'accepted';
    if (activeTab === 'rejected') return n.status === 'rejected';
    if (activeTab === 'expired') return n.status === 'expired';
    return true;
  });

  const handleAddToCart = (neg: NegotiationItem) => {
    if (neg.status === 'accepted' && (neg as any).orderId) {
      navigate({ to: '/commandes', search: { detail: String((neg as any).orderId) } });
      return;
    }
    const product: Product = {
      id: neg.productId,
      nom: neg.productName,
      origine: neg.vendorName ?? '',
      quantite: '',
      prix: neg.proposedPrice,
      prixMinimum: neg.minPrice,
      categorie: 'vegetable',
      stock: 'available',
      badges: [],
      image: neg.productImage,
      negotiated: { oldPrice: neg.originalPrice },
    };
    dispatch(add({ product, quantity: 1 }));
    toast.success(
      isFr
        ? `Ajouté au panier au prix négocié de ${neg.proposedPrice.toLocaleString('fr-FR')} FCFA`
        : `Added to cart at negotiated price of ${neg.proposedPrice.toLocaleString('fr-FR')} FCFA`,
    );
    navigate({ to: '/panier' });
  };

  const handleAcceptCounter = (productId: string, counterPrice: number) => {
    dispatch(acceptCounterOffer({ productId }));
    toast.success(
      isFr
        ? `Contre-offre de ${counterPrice.toLocaleString('fr-FR')} FCFA acceptée !`
        : `Counter offer of ${counterPrice.toLocaleString('fr-FR')} FCFA accepted!`,
    );
  };

  const handleDiscussionClick = (neg: NegotiationItem) => {
    if (neg.status === 'accepted') {
      // La conversation de la commande auto-créée vit dans la Messagerie
      navigate({ to: '/messagerie' });
      return;
    }
    toast(
      isFr
        ? tx("La discussion avec le marché se débloque à l’acceptation de votre offre (Messagerie).")
        : 'Chat with the market unlocks once your offer is accepted (Messaging).',
      { icon: '💬' },
    );
  };

  const openEditOffer = (neg: NegotiationItem) => {
    setEditModal(neg);
    setEditPrice(String(neg.proposedPrice));
    setEditError(null);
  };

  const submitEditOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setEditError(isFr ? 'Saisissez un prix valide.' : 'Enter a valid price.');
      return;
    }
    if (price < editModal.minPrice) {
      setEditError(
        isFr
          ? `Le prix minimum négociable est ${editModal.minPrice.toLocaleString('fr-FR')} FCFA.`
          : `The minimum negotiable price is ${editModal.minPrice.toLocaleString('fr-FR')} FCFA.`,
      );
      return;
    }
    setEditSaving(true);
    try {
      await negotiationApi.updateProposal(editModal.id, {
        product_id: Number(editModal.productId),
        prix_propose: price,
        quantite: editModal.quantite,
      });
      toast.success(isFr ? tx("Offre mise à jour et retransmise au marché.") : 'Offer updated and resubmitted.');
      setEditModal(null);
      loadProposals();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setEditError(detail?.message || (isFr ? tx("Impossible de modifier l’offre.") : 'Could not update the offer.'));
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="bg-bg-app min-h-screen pb-24 font-body">
      {/* TopNavBar */}
      <ClientNavbar />

      {/* Main Container */}
      <main className="pt-[92px] max-w-[1000px] mx-auto px-md md:px-lg">
        {/* Header Section */}
        <div className="mb-lg">
          <h1 className="font-h1 text-h1 text-on-surface mb-xs">
            {isFr ? tx("Mes Négociations") : 'My Negotiations'}
          </h1>
          <p className="font-body text-body text-text-secondary">
            {isFr
              ? tx("Suivez vos offres en cours, gérez vos contre-propositions et concluez vos meilleures affaires ici.")
              : 'Track your active offers, manage counter-proposals and close your best deals here.'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-lg">
          {/* Main Content: Negotiations List */}
          <div className="flex-1 space-y-md">
            {/* Filters/Tabs */}
            <nav className="flex border-b border-border-default mb-md overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={clsx('px-md py-sm font-label text-label cursor-pointer transition-colors', {
                  'tab-active': activeTab === 'all',
                  'text-on-surface-variant hover:text-primary': activeTab !== 'all',
                })}
              >
                {isFr ? `Toutes (${history.length})` : `All (${history.length})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={clsx('px-md py-sm font-label text-label cursor-pointer transition-colors', {
                  'tab-active': activeTab === 'pending',
                  'text-on-surface-variant hover:text-primary': activeTab !== 'pending',
                })}
              >
                {isFr ? `En cours (${pendingCount})` : `Pending (${pendingCount})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('accepted')}
                className={clsx('px-md py-sm font-label text-label cursor-pointer transition-colors', {
                  'tab-active': activeTab === 'accepted',
                  'text-on-surface-variant hover:text-primary': activeTab !== 'accepted',
                })}
              >
                {isFr ? `Acceptées (${acceptedCount})` : `Accepted (${acceptedCount})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rejected')}
                className={clsx('px-md py-sm font-label text-label cursor-pointer transition-colors', {
                  'tab-active': activeTab === 'rejected',
                  'text-on-surface-variant hover:text-primary': activeTab !== 'rejected',
                })}
              >
                {isFr ? `Refusées (${rejectedCount})` : `Rejected (${rejectedCount})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('expired')}
                className={clsx('px-md py-sm font-label text-label cursor-pointer transition-colors', {
                  'tab-active': activeTab === 'expired',
                  'text-on-surface-variant hover:text-primary': activeTab !== 'expired',
                })}
              >
                {isFr ? `Expirées (${expiredCount})` : `Expired (${expiredCount})`}
              </button>
            </nav>

            {/* Negotiation Items */}
            {isApiLoading ? (
              <div className="bg-bg-card rounded-card p-lg text-center border border-border-default shadow-sm">
                <MIcon name="sync" className="mx-auto text-[32px] text-primary animate-spin mb-2" />
                <p className="font-h3 text-h3 text-on-surface font-medium">{tx("Chargement des négociations...")}</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="bg-bg-card rounded-card p-lg text-center border border-border-default shadow-sm">
                <MIcon name="handshake" className="mx-auto text-[48px] text-text-tertiary mb-2" />
                <p className="font-h3 text-h3 text-on-surface font-medium">
                  {isFr ? tx("Aucune négociation enregistrée") : 'No negotiations found'}
                </p>
                <p className="font-secondary text-secondary mt-1">
                  {isFr
                    ? tx("Proposez une offre de prix sur un produit du catalogue pour débuter !")
                    : 'Make an offer on a catalog product to get started!'}
                </p>
              </div>
            ) : (
              filteredHistory.map((neg) => {
                const isPending = neg.status === 'pending';
                const isCounter = neg.status === 'counter_offer';
                const isAccepted = neg.status === 'accepted';
                const isRejected = neg.status === 'rejected';
                const isExpired = neg.status === 'expired';

                const iconName =
                  neg.productName.toLowerCase().includes('riz')
                    ? 'restaurant'
                    : neg.productName.toLowerCase().includes('huile')
                    ? 'oil_barrel'
                    : 'inventory_2';

                return (
                  <article
                    key={neg.id}
                    className={clsx(
                      'bg-bg-card rounded-card p-md shadow-sm border border-border-default flex flex-col sm:flex-row gap-md items-start group',
                      isPending && 'negotiation-card',
                      isCounter && 'border-l-4 border-primary',
                      isAccepted && 'border-l-4 border-success',
                      isRejected && 'border-l-4 border-error',
                      isExpired && 'border-l-4 border-border-default opacity-75',
                    )}
                  >
                    {/* Thumbnail matching code.html */}
                    <div className="w-24 h-24 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
                      {neg.productImage ? (
                        <img
                          src={neg.productImage}
                          alt={neg.productName}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <MIcon name={iconName} className="text-outline text-4xl" />
                      )}
                    </div>

                    {/* Content Block */}
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex justify-between items-start mb-xs">
                        <div>
                          <h3 className="font-h3 text-h3 text-on-surface truncate font-bold">{neg.productName}</h3>
                          {neg.vendorName && (
                            <p className="font-secondary text-secondary">
                              {isFr ? 'Provenance :' : 'Source:'}{' '}
                              <span className="font-medium text-on-surface">{neg.vendorName}</span>
                            </p>
                          )}
                        </div>

                        {/* Status Badges */}
                        {isPending && (
                          <span className="inline-flex items-center px-sm py-[2px] rounded-full bg-amber-light text-amber-text text-micro font-micro uppercase tracking-wider">
                            <span className="bubble-dot bg-amber-text" />
                            {isFr ? tx("En attente de réponse") : 'Pending response'}
                          </span>
                        )}
                        {isCounter && (
                          <span className="inline-flex items-center px-sm py-[2px] rounded-full bg-primary-light text-primary-deep text-micro font-micro uppercase tracking-wider">
                            <span className="bubble-dot bg-primary-deep" />
                            {isFr ? tx("Contre-proposition") : 'Counter proposal'}
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center px-sm py-[2px] rounded-full bg-success-light text-success-dark text-micro font-micro uppercase tracking-wider">
                            <span className="bubble-dot bg-success" />
                            {isFr ? tx("Offre acceptée") : 'Offer accepted'}
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-sm py-[2px] rounded-full bg-error-light text-error-dark text-micro font-micro uppercase tracking-wider">
                            <span className="bubble-dot bg-error" />
                            {isFr ? tx("Offre refusée") : 'Offer rejected'}
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center px-sm py-[2px] rounded-full bg-bg-secondary text-text-secondary text-micro font-micro uppercase tracking-wider">
                            {isFr ? tx("Offre expirée") : 'Offer expired'}
                          </span>
                        )}
                      </div>

                      {/* Prices comparison */}
                      <div className="flex flex-wrap gap-md mt-md mb-lg">
                        {isCounter ? (
                          <>
                            <div className="flex flex-col">
                              <span className="font-secondary text-secondary">{isFr ? 'Prix initial' : 'Initial price'}</span>
                              <span className="font-price text-price text-text-secondary">
                                {neg.originalPrice.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                            <div className="flex flex-col bg-amber-light border border-[#F59E0B] px-sm py-xs rounded-lg">
                              <span className="font-secondary text-amber-text">{isFr ? tx("Votre offre") : 'Your offer'}</span>
                              <span className="font-price text-price text-amber-text">
                                {neg.proposedPrice.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                          </>
                        ) : isAccepted ? (
                          <>
                            <div className="flex flex-col">
                              <span className="font-secondary text-secondary">{isFr ? 'Prix initial' : 'Original price'}</span>
                              <span className="font-price text-price text-text-secondary line-through opacity-70">
                                {neg.originalPrice.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                            <div className="flex flex-col bg-success-light border border-success-dark px-sm py-xs rounded-lg">
                              <span className="font-secondary text-success-dark">{isFr ? 'Prix final' : 'Final price'}</span>
                              <span className="font-price text-price text-success-dark">
                                {neg.proposedPrice.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-col">
                              <span className="font-secondary text-secondary">{isFr ? 'Prix initial' : 'Original price'}</span>
                              <span className="font-price text-price text-text-secondary line-through opacity-70">
                                {neg.originalPrice.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                            <div className="flex flex-col bg-amber-light border border-[#F59E0B] px-sm py-xs rounded-lg">
                              <span className="font-secondary text-amber-text">{isFr ? tx("Votre offre") : 'Your offer'}</span>
                              <span className="font-price text-price text-amber-text">
                                {neg.proposedPrice.toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Réponse de l'admin (backend admin_response) */}
                      {(isRejected || isExpired) && neg.adminResponse && (
                        <div className="mt-md p-sm bg-error-light/60 border border-error/20 rounded-lg">
                          <p className="text-micro font-bold text-error-dark uppercase tracking-wider mb-xs">
                            {isFr ? tx("Réponse du marché") : 'Market response'}
                          </p>
                          <p className="text-secondary text-text-main">{neg.adminResponse}</p>
                        </div>
                      )}

                      {/* Action buttons strictly matching code.html */}
                      <div className="flex gap-sm flex-wrap">
                        {isAccepted && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAddToCart(neg)}
                              className="px-md py-2 bg-primary-container text-white font-medium text-label rounded-button hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-xs cursor-pointer shadow-sm"
                            >
                              <MIcon name="shopping_basket" className="text-[18px]" />
                              {isFr ? "Finaliser l'achat" : 'Checkout deal'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscussionClick(neg)}
                              className="px-md py-2 border border-border-default text-on-surface-variant font-medium text-label rounded-button hover:bg-bg-secondary active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? tx("Voir discussion") : 'View chat'}
                            </button>
                          </>
                        )}

                        {isCounter && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDiscussionClick(neg)}
                              className="px-md py-2 border border-primary text-primary font-medium text-label rounded-button hover:bg-primary-tint active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? tx("Voir la discussion") : 'View discussion'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAcceptCounter(neg.productId, neg.counterPrice || neg.minPrice)}
                              className="px-md py-2 bg-primary-container text-white font-medium text-label rounded-button hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? tx("Répondre") : 'Reply'}
                            </button>
                          </>
                        )}

                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDiscussionClick(neg)}
                              className="px-md py-2 border border-primary text-primary font-medium text-label rounded-button hover:bg-primary-tint active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? tx("Voir la discussion") : 'View discussion'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditOffer(neg)}
                              className="px-md py-2 bg-white border border-border-default text-on-surface font-medium text-label rounded-button hover:bg-bg-secondary active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? tx("Modifier mon offre") : 'Edit my offer'}
                            </button>
                          </>
                        )}

                        {isRejected && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDiscussionClick(neg)}
                              className="px-md py-2 border border-border-default text-on-surface-variant font-medium text-label rounded-button hover:bg-bg-secondary active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? tx("Voir discussion") : 'View chat'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditOffer(neg)}
                              className="px-md py-2 border border-primary text-primary font-medium text-label rounded-button hover:bg-primary-tint active:scale-95 transition-all cursor-pointer"
                            >
                              {isFr ? 'Reproposer un prix' : 'Reprice offer'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Sidebar: Guide */}
          <aside className="w-full lg:w-[300px] shrink-0">
            <div className="bg-white rounded-card p-lg border border-border-default shadow-sm sticky top-[80px]">
              <div className="flex items-center gap-sm mb-md text-primary">
                <MIcon name="tips_and_updates" />
                <h2 className="font-h2 text-h2">{isFr ? tx("Guide de Négociation") : 'Negotiation Guide'}</h2>
              </div>
              <p className="font-secondary text-secondary mb-md">
                {isFr
                  ? tx("Sur TOKPa, la négociation est un art. Voici comment obtenir le meilleur prix :")
                  : 'On TOKPa, negotiation is an art. Here is how to get the best price:'}
              </p>
              <ul className="space-y-md">
                <li className="flex gap-sm">
                  <span className="text-primary font-bold">1.</span>
                  <div className="font-body text-body text-on-surface">
                    <p className="font-bold">{isFr ? tx("Restez réaliste") : 'Stay realistic'}</p>
                    <p className="text-secondary">
                      {isFr
                        ? tx("Une offre trop basse est souvent rejetée immédiatement. Proposez -10% à -15%.")
                        : 'An offer that is too low is often rejected immediately. Aim for -10% to -15%.'}
                    </p>
                  </div>
                </li>
                <li className="flex gap-sm">
                  <span className="text-primary font-bold">2.</span>
                  <div className="font-body text-body text-on-surface">
                    <p className="font-bold">{isFr ? tx("Soyez réactif") : 'Be responsive'}</p>
                    <p className="text-secondary">
                      {isFr
                        ? tx("Répondez vite aux contre-propositions.")
                        : 'Respond quickly to counter-proposals.'}
                    </p>
                  </div>
                </li>
                <li className="flex gap-sm">
                  <span className="text-primary font-bold">3.</span>
                  <div className="font-body text-body text-on-surface">
                    <p className="font-bold">{isFr ? tx("Achat groupé") : 'Bulk purchase'}</p>
                    <p className="text-secondary">
                      {isFr
                        ? 'Achetez plusieurs articles pour plus de poids.'
                        : 'Buy multiple items for better leverage.'}
                    </p>
                  </div>
                </li>
              </ul>
              <div className="mt-lg p-md bg-primary-tint rounded-lg border border-primary-light">
                <p className="font-label text-label text-primary-deep italic font-medium">
                  {isFr
                    ? '"Le marché appartient à ceux qui osent proposer."'
                    : '"The market belongs to those who dare to bargain."'}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modal « Modifier mon offre » — PUT /api/budget-proposals/{id} */}
      {editModal && (
        <div className="fixed inset-0 bg-on-surface/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4 animate-fade-in">
          <div className="bg-white w-full max-w-[480px] rounded-xl shadow-2xl overflow-hidden p-lg">
            <div className="flex justify-between items-center mb-md border-b border-border-default pb-3">
              <h3 className="font-h2 text-h2 font-bold">{isFr ? tx("Modifier mon offre") : 'Edit my offer'}</h3>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <MIcon name="close" />
              </button>
            </div>

            <form onSubmit={submitEditOffer} className="space-y-md">
              <div className="p-md bg-bg-secondary rounded-lg">
                <p className="font-bold text-on-surface">{editModal.productName}</p>
                <p className="text-secondary text-text-secondary text-micro">
                  {isFr ? 'Prix actuel' : 'Current price'} :{' '}
                  {editModal.originalPrice.toLocaleString('fr-FR')} FCFA ·{' '}
                  {isFr ? tx("Votre offre") : 'Your offer'} :{' '}
                  {editModal.proposedPrice.toLocaleString('fr-FR')} FCFA
                </p>
                <p className="text-micro text-text-tertiary mt-xs">
                  {isFr ? tx("Prix minimum accepté par le marché") : 'Market minimum price'} :{' '}
                  <span className="font-bold text-primary-container">{editModal.minPrice.toLocaleString('fr-FR')} FCFA</span>
                </p>
              </div>

              <div>
                <label className="block text-label mb-1 text-text-secondary font-medium">
                  {isFr ? tx("Nouveau prix proposé (FCFA)") : 'New proposed price (FCFA)'}
                </label>
                <input
                  type="number"
                  min={editModal.minPrice}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                  className="w-full px-md py-2 rounded-lg border border-border-default focus:border-primary outline-none font-price"
                />
              </div>

              {editError && (
                <div className="p-3 bg-error-light border border-error/20 rounded-lg text-xs font-semibold text-error-dark">
                  {editError}
                </div>
              )}

              <div className="pt-md border-t border-border-default flex justify-end gap-md">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-md py-2 rounded-lg border border-border-default font-medium hover:bg-gray-50 transition-all cursor-pointer"
                >
                  {isFr ? tx("Annuler") : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-lg py-2 rounded-lg bg-primary-container hover:bg-primary-hover text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {editSaving
                    ? (isFr ? tx("Envoi…") : 'Sending…')
                    : isFr
                      ? 'Reproposer'
                      : 'Submit new price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BottomNavBar */}
      <ClientBottomNav />
    </div>
  );
}

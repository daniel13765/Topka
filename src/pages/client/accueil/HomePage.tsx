import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import DarkFooter from '../../../components/layout/client/DarkFooter';
import MIcon from '../../../components/shared/MIcon';
import EmptyState from '../../../components/shared/EmptyState';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { useAppDispatch } from '../../../hooks/useStore';
import { add } from '../../../store/slices/cart/cartSlice';
import { submitOffer } from '../../../store/slices/negotiation/negotiationSlice';
import type { Product } from '../../../types/models';
import { useLanguage } from '../../../context/LanguageContext';
import { catalogApi, negotiationApi, type ApiCategory, type ApiProduct } from '../../../services/api';
import { absImageUrl } from '../../../utils/imageUrl';
import { categoryKind, type CategoryKind } from '../../../utils/categoryKind';
import { alertApiError, apiErrorStatus } from '../../../utils/apiError';
import { tx } from '../../../i18n/tx';


/** Icônes de la maquette accueil (Categories Grid), par famille — icone non persistée côté backend (B-17). */
const HOME_KIND_ICON: Record<CategoryKind, string> = {
  vegetable: 'potted_plant',
  fish: 'set_meal',
  grain: 'grain',
  spice: 'liquor',
  pack: 'shopping_basket',
  other: 'category',
};

interface SelectionItem {
  id: string;
  nom: string;
  /** Nom réel de la catégorie (remplace l'ancien faux « Marché Dantokpa » : l'API n'a pas de marché). */
  categorie: string;
  prixLabel: string;
  prix: number;
  /** Vrai prix minimum négociable (ProductResource.prix_minimum). */
  prixMinimum: number;
  image: string | null;
  badge: string;
}

/** Accueil TOKPa — Connecté au Backend API Laravel + UI Stitch */
export default function HomePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t, isFr } = useLanguage();
  const [offre, setOffre] = useState('');
  // Uniquement des produits réels : rien pendant le chargement, message de l'API en cas d'échec.
  const [selection, setSelection] = useState<SelectionItem[]>([]);
  const [selLoading, setSelLoading] = useState(true);
  const [selError, setSelError] = useState<string | null>(null);
  // Visiteur non connecté : l'API refuse les produits (401 — B-1 côté backend) → invitation à se
  // connecter au lieu d'une alerte. Quand B-1 sera corrigé, les vrais produits s'afficheront seuls.
  const [needsLogin, setNeedsLogin] = useState(false);
  // Bandeau « Propose ton prix » : un vrai produit négociable (prix minimum < prix) ; sinon masqué.
  const [negoProduct, setNegoProduct] = useState<SelectionItem | null>(null);
  const [sendingOffer, setSendingOffer] = useState(false);
  // « Réessayer » : relance produits + catégories.
  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => setReloadKey((k) => k + 1);

  // Connection API Backend GET /api/products — produits réels ET commandables uniquement
  useEffect(() => {
    let alive = true;
    setSelLoading(true);
    setSelError(null);
    setNeedsLogin(false);
    catalogApi
      .getProducts({ per_page: 12 })
      .then((res) => {
        if (!alive) return;
        const list: ApiProduct[] = Array.isArray(res?.data) ? res.data : [];
        // Commandables (disponible et stock > 0) : même règle que « Disponible uniquement » du catalogue.
        const items: SelectionItem[] = list
          .filter((p) => p.disponible !== false && Number(p.stock) > 0)
          .map((p) => ({
            id: String(p.id),
            nom: p.nom,
            categorie: p.categorie?.nom ?? '',
            prixLabel: `${Number(p.prix).toLocaleString('fr-FR')} FCFA`,
            prix: Number(p.prix),
            prixMinimum: Number(p.prix_minimum ?? 0),
            // Même source que l'admin ; pas d'image → null = dégradé
            image: absImageUrl(p.image_url ?? p.img_url),
            badge: Number(p.stock) > 5 ? tx("Disponible") : tx("Stock Limité"),
          }));
        setSelection(items.slice(0, 4));
        const nego = items.find((it) => it.prixMinimum > 0 && it.prixMinimum < it.prix) ?? null;
        setNegoProduct(nego);
        // Offre suggérée : -10 % du prix (comme la fiche produit), jamais sous le prix minimum.
        if (nego) setOffre(String(Math.max(nego.prixMinimum, Math.round(nego.prix * 0.9))));
      })
      .catch((err) => {
        if (!alive) return;
        setSelection([]);
        setNegoProduct(null);
        if (apiErrorStatus(err) === 401) setNeedsLogin(true);
        else setSelError(alertApiError(err, 'home-api'));
      })
      .finally(() => {
        if (alive) setSelLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Catégories réelles — GET /api/categories (F-07). Plus de tuiles de la maquette : échec → message de
  // l'API ; visiteur non connecté (401, B-1) → section masquée (l'invitation est dans la sélection).
  const [apiCats, setApiCats] = useState<ApiCategory[] | null>(null);
  const [catsError, setCatsError] = useState<string | null>(null);
  const [catsNeedLogin, setCatsNeedLogin] = useState(false);
  useEffect(() => {
    let alive = true;
    setApiCats(null);
    setCatsError(null);
    setCatsNeedLogin(false);
    catalogApi
      .getCategories()
      .then((res) => {
        const list: ApiCategory[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (alive) setApiCats(list);
      })
      .catch((err) => {
        if (!alive) return;
        if (apiErrorStatus(err) === 401) setCatsNeedLogin(true);
        else setCatsError(alertApiError(err, 'home-api'));
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Bandeau « Propose ton prix » → vraie offre POST /budget-proposals (comme la fiche produit).
  const sendOffer = async () => {
    if (!negoProduct || sendingOffer) return;
    const proposed = Number(offre.replace(/\D/g, ''));
    if (!proposed) {
      toast.error(isFr ? 'Veuillez entrer un montant valide en FCFA' : 'Please enter a valid amount in FCFA');
      return;
    }
    if (proposed < negoProduct.prixMinimum) {
      const min = negoProduct.prixMinimum.toLocaleString('fr-FR');
      toast.error(isFr ? `Le prix minimum négociable est de ${min} FCFA` : `The minimum negotiable price is ${min} FCFA`);
      return;
    }
    setSendingOffer(true);
    try {
      await negotiationApi.createProposal({ product_id: Number(negoProduct.id), prix_propose: proposed, quantite: 1 });
      dispatch(
        submitOffer({
          productId: negoProduct.id,
          productName: negoProduct.nom,
          productImage: negoProduct.image ?? undefined,
          originalPrice: negoProduct.prix,
          proposedPrice: proposed,
          minPrice: negoProduct.prixMinimum,
        }),
      );
      toast.success(isFr ? tx("Offre envoyée au marché ! Vous serez notifié de sa réponse.") : 'Offer sent! You will be notified of the answer.');
      navigate({ to: '/negociations' });
    } catch (err) {
      alertApiError(err, 'home-offer');
    } finally {
      setSendingOffer(false);
    }
  };

  const atoutsList = [
    { icon: 'payments', titre: t('home.atouts.a1Title'), texte: t('home.atouts.a1Text') },
    { icon: 'local_shipping', titre: t('home.atouts.a2Title'), texte: t('home.atouts.a2Text') },
    { icon: 'location_on', titre: t('home.atouts.a3Title'), texte: t('home.atouts.a3Text') },
  ];

  // 4 tuiles comme la maquette : 3 catégories réelles (celles marquées en_accueil d'abord — champ
  // non persisté aujourd'hui, B-17) + « Packs ». Clic → catalogue déjà filtré (?cat=).
  const categoriesList: { icon: string; nom: string; cat: string }[] = apiCats
    ? [
        ...[...apiCats.filter((c) => c.en_accueil), ...apiCats.filter((c) => !c.en_accueil)]
          .slice(0, 3)
          .map((c) => ({ icon: c.icone || HOME_KIND_ICON[categoryKind(c)], nom: c.nom, cat: `c${c.id}` })),
        { icon: 'shopping_basket', nom: t('categories.packs'), cat: 'pack' },
      ]
    : [];

  const addToCart = (item: SelectionItem) => {
    const product: Product = {
      id: item.id,
      nom: item.nom,
      origine: item.categorie,
      quantite: '',
      prix: item.prix,
      prixMinimum: item.prixMinimum,
      categorie: ((k) => (k === 'other' ? 'vegetable' : k))(categoryKind({ nom: item.categorie })),
      stock: item.badge === tx("Disponible") ? 'available' : 'low',
      badges: [],
      image: item.image ?? undefined,
    };
    dispatch(add({ product }));
    toast.success(isFr ? `${item.nom} ajouté au panier` : `${item.nom} added to cart`);
  };

  return (
    <div className="min-h-screen bg-page font-body text-on-surface">
      <ClientNavbar />

      <main className="mx-auto w-full max-w-[1200px] overflow-x-hidden px-3 sm:px-4 pb-[80px] pt-[52px] lg:pb-0">
        {/* ---- Hero ---- */}
        <section className="relative mt-md sm:mt-lg flex min-h-[380px] sm:min-h-[460px] md:min-h-[500px] items-center overflow-hidden rounded-[20px] sm:rounded-[24px] border border-line bg-white shadow-sm">
          <div className="absolute inset-0 z-0">
            <img
              alt={tx("Marché TOKPa Illustration")}
              className="h-full w-full object-cover"
              src="/images/brand/illustration-pattern.png"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
          </div>
          <div className="relative z-10 max-w-3xl p-4 sm:p-8 md:p-xl">
            <h1 className="mb-sm sm:mb-md font-h1 text-[26px] sm:text-[36px] md:text-[42px] font-bold leading-tight text-primary-darker">
              {t('home.heroTitle')}
            </h1>
            <p className="mb-md sm:mb-lg text-sm sm:text-base md:text-lg leading-relaxed text-on-surface-variant">
              {t('home.heroSub')}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: '/catalogue' })}
              className="scale-interaction flex items-center gap-2 rounded-[10px] bg-primary px-4 py-3 sm:px-lg sm:py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-primary-hover cursor-pointer"
            >
              {t('home.heroCta')}
              <MIcon name="arrow_forward" />
            </button>
          </div>
        </section>

        {/* ---- Value Propositions ---- */}
        <section className="my-lg sm:my-xl grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
          {atoutsList.map((a) => (
            <div key={a.titre} className="flex items-start gap-md rounded-[14px] border border-line bg-card p-4 sm:p-lg">
              <div className="rounded-xl bg-primary-lighter p-2 sm:p-sm">
                <MIcon name={a.icon} className="text-[24px] sm:text-[32px] text-primary-shade" />
              </div>
              <div>
                <h3 className="font-h3 text-sm sm:text-base font-bold text-on-surface">{a.titre}</h3>
                <p className="mt-xs text-xs sm:text-body text-ink-2">{a.texte}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ---- Categories Grid (catégories réelles ; masquée pour un visiteur non connecté) ---- */}
        {!catsNeedLogin && (
        <section className="mb-lg sm:mb-xl">
          <div className="mb-md sm:mb-lg flex items-end justify-between">
            <h2 className="font-h1 text-lg sm:text-h1 text-on-surface">{t('home.exploreCategories')}</h2>
            <Link to="/catalogue" className="flex items-center gap-1 text-xs sm:text-sm font-bold text-primary-shade hover:underline">
              {t('common.seeAll')} <MIcon name="chevron_right" className="text-[18px]" />
            </Link>
          </div>
          {catsError ? (
            <ApiErrorState
              title={isFr ? tx("Impossible de charger les catégories") : 'Unable to load categories'}
              message={catsError}
              onRetry={retry}
              className="rounded-[14px] border border-line bg-white px-md"
            />
          ) : apiCats === null ? (
            <LoadingState label={isFr ? tx("Chargement des catégories…") : 'Loading categories…'} className="rounded-[14px] bg-warm-low" />
          ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-md md:grid-cols-4">
            {categoriesList.map((c) => (
              <div
                key={c.cat}
                onClick={() => navigate({ to: '/catalogue', search: { cat: c.cat } })}
                className="bento-hover group flex cursor-pointer flex-col items-center gap-sm rounded-[14px] border border-transparent bg-warm-low p-4 sm:p-lg hover:border-primary-light"
              >
                <MIcon name={c.icon} className="text-[36px] sm:text-[48px] text-primary-shade transition-transform group-hover:scale-110" />
                <span className="font-h3 text-xs sm:text-base text-on-surface">{c.nom}</span>
              </div>
            ))}
          </div>
          )}
        </section>
        )}

        {/* ---- Featured Products (produits réels uniquement) ---- */}
        {(selLoading || needsLogin || selError || selection.length > 0) && (
          <section className="mb-lg sm:mb-xl">
            <div className="mb-md sm:mb-lg flex items-end justify-between">
              <h2 className="font-h1 text-lg sm:text-h1 text-on-surface">{t('home.selectionTitle')}</h2>
              <Link to="/catalogue" className="flex items-center gap-1 text-xs sm:text-sm font-bold text-primary-shade hover:underline">
                {t('common.seeAll')} <MIcon name="chevron_right" className="text-[18px]" />
              </Link>
            </div>

            {selLoading ? (
              <LoadingState
                label={isFr ? tx("Chargement des produits…") : 'Loading products…'}
                className="rounded-[14px] border border-line bg-white"
              />
            ) : needsLogin ? (
              <EmptyState
                icon={<MIcon name="lock" className="text-4xl text-primary" />}
                title={isFr ? 'Connectez-vous pour voir les produits du jour' : 'Log in to see today’s products'}
                description={
                  isFr
                    ? tx("Les produits et les prix du marché sont réservés aux clients connectés.")
                    : 'Market products and prices are available to signed-in customers.'
                }
                action={
                  <Link to="/connexion" className="rounded-lg bg-primary-container px-lg py-3 font-bold text-white">
                    {isFr ? tx("Se connecter") : 'Log in'}
                  </Link>
                }
                className="rounded-[14px] border border-line bg-white px-md"
              />
            ) : selError ? (
              <ApiErrorState
                title={isFr ? tx("Impossible de charger les produits") : 'Unable to load products'}
                message={selError}
                onRetry={retry}
                className="rounded-[14px] border border-line bg-white px-md"
              />
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {selection.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate({ to: '/produit/$productId', params: { productId: item.id } })}
                  className="bento-hover group cursor-pointer overflow-hidden rounded-[14px] border border-line bg-white p-md shadow-xs"
                >
                  <div className="relative mb-md h-48 sm:h-40 overflow-hidden rounded-[10px] bg-page flex items-center justify-center">
                    {!item.image ? (
                      <div className="w-full h-full bg-gradient-to-br from-primary-lighter to-primary-light flex items-center justify-center">
                        <MIcon name="shopping_bag" className="text-4xl text-primary" />
                      </div>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.nom}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-micro text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" /> {item.badge}
                    </span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <span className="text-label text-ink-2">{item.categorie}</span>
                    <h3 className="font-h3 font-bold text-on-surface line-clamp-1">{item.nom}</h3>
                    <div className="mt-sm flex items-center justify-between">
                      <span className="font-price text-price text-primary-shade">{item.prixLabel}</span>
                      <button
                        type="button"
                        aria-label={`Ajouter ${item.nom}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(item);
                        }}
                        className="scale-interaction flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white cursor-pointer"
                      >
                        <MIcon name="add" className="text-[18px]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </section>
        )}

        {/* ---- Négociation : vrai produit négociable (masqué s'il n'y en a pas) ---- */}
        {negoProduct && (
        <section className="mb-lg sm:mb-xl bg-white rounded-[14px] border-l-[3px] border-secondary-container p-4 sm:p-lg flex flex-col md:flex-row items-center justify-between gap-md sm:gap-lg">
          <div className="w-full md:w-[70%]">
            <div className="inline-flex max-w-full items-center gap-2 bg-secondary-container/10 text-on-secondary-container px-2.5 py-1 rounded-full mb-sm text-xs sm:text-label font-medium uppercase tracking-wider overflow-hidden">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] shrink-0">handshake</span>
              <span className="truncate sm:whitespace-normal">{t('home.negoBadge')}</span>
            </div>
            <h2 className="font-h1 text-lg sm:text-h1 text-on-surface mb-xs">{t('home.negoTitle')}</h2>
            <p className="text-secondary text-xs sm:text-body leading-relaxed max-w-2xl">
              {t('home.negoText')}
            </p>
          </div>
          <div className="w-full md:w-[30%] bg-bg-app p-4 rounded-xl">
            <div className="flex flex-col gap-sm">
              <p className="truncate text-xs sm:text-label font-bold text-on-surface" title={negoProduct.nom}>
                {negoProduct.nom}
              </p>
              <div className="flex justify-between items-center text-xs sm:text-label">
                <span className="text-secondary">{t('home.sellerPrice')}</span>
                <span className="font-bold text-on-surface">{negoProduct.prix.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="h-[1.5px] bg-border-default w-full"></div>
              <div className="flex justify-between items-center text-xs sm:text-label">
                <span className="text-secondary">{t('home.yourOffer')}</span>
                <input
                  className="w-20 sm:w-24 text-right border-none bg-white rounded-lg p-1 font-bold text-primary focus:ring-1 focus:ring-primary text-xs sm:text-sm"
                  type="text"
                  value={offre}
                  onChange={(e) => setOffre(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={sendingOffer}
                onClick={sendOffer}
                className="w-full bg-secondary text-white font-bold py-2 rounded-lg mt-2 text-xs sm:text-sm scale-interaction cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {sendingOffer ? (isFr ? tx("Envoi…") : 'Sending…') : t('home.sendOffer')}
              </button>
            </div>
          </div>
        </section>
        )}
      </main>

      <DarkFooter />
      <ClientBottomNav />
    </div>
  );
}

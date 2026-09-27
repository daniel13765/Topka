import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import ClientNavbar from '../../../components/layout/client/ClientNavbar';
import ClientBottomNav from '../../../components/layout/client/ClientBottomNav';
import MIcon from '../../../components/shared/MIcon';
import ApiErrorState from '../../../components/shared/ApiErrorState';
import LoadingState from '../../../components/shared/LoadingState';
import { useAppDispatch } from '../../../hooks/useStore';
import { add } from '../../../store/slices/cart/cartSlice';
import type { CategoryId, Product } from '../../../types/models';
import { catalogApi, type ApiBundle, type ApiCategory, type ApiProduct } from '../../../services/api';
import { absImageUrl } from '../../../utils/imageUrl';
import { categoryKind, type CategoryKind } from '../../../utils/categoryKind';
import { alertApiError } from '../../../utils/apiError';
import { mapApiCategory } from '../../../utils/catalogMap';
import { useLanguage } from '../../../context/LanguageContext';
import { tr, tx } from '../../../i18n/tx';


/* ---- Catalogue : données UNIQUEMENT issues de l'API (plus aucun produit, catégorie ni marché de la maquette) ---- */

/** 'all' | 'pack' (Packs & Bundles = GET /bundles) | `c{id}` = catégorie réelle de l'API. */
type CatFilter = 'all' | 'pack' | `c${number}`;

/** Icônes de la maquette catalogue, par famille — pour les catégories réelles (icone non persistée, B-17). */
const KIND_ICON: Record<CategoryKind, string> = {
  vegetable: 'eco',
  fish: 'restaurant',
  grain: 'grain',
  spice: 'soup_kitchen',
  pack: 'shopping_basket',
  other: 'category',
};

/** ?cat= (tuiles de l'accueil) → filtre initial : « c{id} » = catégorie API, « pack » = Packs & Bundles. */
const parseCat = (v: string): CatFilter => (/^c\d+$/.test(v) ? (v as CatFilter) : v === 'pack' ? 'pack' : 'all');

// Entrées fixes de la barre latérale ; entre les deux : les catégories réelles (GET /categories).
// Le filtre « Zone du marché » de la maquette est retiré : le backend ne rattache aucun produit à un
// marché (ni colonne, ni route) — il reviendra quand l'API fournira l'information.
const CAT_ALL = { id: 'all' as CatFilter, icon: 'grid_view', nom: 'Tous les produits' };
const CAT_PACK = { id: 'pack' as CatFilter, icon: 'shopping_basket', nom: 'Packs & Bundles' };

interface CatalogProduct {
  id: string;
  nom: string;
  meta: string;
  quantite: string;
  prix: number;
  prixLabel: string;
  /** Vrai prix minimum négociable (ProductResource.prix_minimum) — plus de « 80 % du prix » inventé. */
  prixMinimum: number;
  prixAncienLabel?: string;
  promo?: string;
  stock: 'available' | 'low' | 'none';
  icon: string;
  cat: CategoryId;
  /** id réel de ProductResource.categorie (filtre par catégorie API, rattaché à sa racine). */
  catRawId?: number;
  /** Nom réel de la catégorie (affiché sous le produit dans le panier, à la place d'un faux marché). */
  catNom?: string;
  /** Pack réel (GET /bundles) : pas de fiche produit ni d'ajout au panier (le panier n'accepte que des produits). */
  isPack?: boolean;
  /** Image réelle = ProductResource.image_url résolue par absImageUrl (même source que l'admin) ; absente → dégradé + icône. */
  image?: string | null;
}



const PER_PAGE = 9;

/** Catalogue — Copie conforme Stitch + Intégration API Backend Laravel */
export default function CatalogPage() {
  useLanguage();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const q = useRouterState({ select: (s) => (s.location.search as { q?: string }).q ?? '' });
  const catParam = useRouterState({ select: (s) => (s.location.search as { cat?: string }).cat ?? '' });

  // Produits réels uniquement : vide pendant le chargement, vide + message de l'API en cas d'échec.
  const [productsList, setProductsList] = useState<CatalogProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  // « Réessayer » : relance les appels (produits, catégories, packs).
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState(q);
  const [cat, setCat] = useState<CatFilter>(() => parseCat(catParam));
  // Prix max choisi au curseur ; null = aucune limite (la maquette figeait value="7500", ce qui masquait
  // tout article plus cher dès qu'une catégorie était choisie).
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [dispoOnly, setDispoOnly] = useState(true);
  const [sort, setSort] = useState('pop');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Catégories réelles — GET /api/categories (F-07 : impact immédiat sur le catalogue).
  // null = non chargées (ou en échec) → seulement « Tous les produits » et « Packs & Bundles ».
  const [apiCats, setApiCats] = useState<ApiCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    catalogApi
      .getCategories()
      .then((res) => {
        const list: ApiCategory[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (alive) setApiCats(list);
      })
      .catch((err) => {
        if (alive) alertApiError(err, 'catalog-categories');
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Packs réels — GET /api/bundles (F-08 : produits inclus + prix total), affichés quand « Packs & Bundles »
  // est choisi, avec le design des cartes produit. null = en cours de chargement ; échec → packsError.
  const [apiPacks, setApiPacks] = useState<CatalogProduct[] | null>(null);
  const [packsError, setPacksError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setApiPacks(null);
    setPacksError(null);
    catalogApi
      .getBundles()
      .then((res) => {
        const list: ApiBundle[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (!alive) return;
        setApiPacks(
          list.map((b) => {
            const inclus = b.products ?? b.produits ?? [];
            const prix = Number(b.prix_total ?? 0);
            return {
              id: `pack-${b.id}`,
              nom: b.nom,
              meta: inclus.length
                ? `${inclus.length} produit${inclus.length > 1 ? 's' : ''} inclus : ${inclus
                    .map((it) => `${it.nom} ×${Number(it.pivot?.qte ?? 1)}`)
                    .join(', ')}`
                : (b.description ?? ''),
              quantite: 'Pack',
              prix,
              prixLabel: `${prix} F`,
              prixMinimum: Number(b.prix_minimum ?? 0),
              stock: b.disponible === false ? 'none' : 'available',
              icon: 'shopping_basket',
              cat: 'pack',
              image: absImageUrl(b.img_url),
              isPack: true,
            } satisfies CatalogProduct;
          }),
        );
      })
      .catch((err) => {
        if (!alive) return;
        setApiPacks([]);
        setPacksError(alertApiError(err, 'catalog-packs'));
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);
  const packMode = cat === 'pack';

  // Plafond du curseur prix : article le plus cher de la liste affichée (produits, ou packs), arrondi
  // aux 500 F supérieurs, jamais moins que les 10 000 de la maquette.
  const priceCeil = useMemo(() => {
    const base = packMode ? (apiPacks ?? []) : productsList;
    const top = base.reduce((m, p) => Math.max(m, Number(p.prix) || 0), 0);
    return Math.max(10000, Math.ceil(top / 500) * 500);
  }, [packMode, apiPacks, productsList]);

  // Sous-catégorie → catégorie racine (le filtre de la barre latérale porte sur les racines)
  const rootOf = useMemo(() => {
    const m = new Map<number, number>();
    const walk = (c: ApiCategory, root: number) => {
      m.set(c.id, root);
      (c.children ?? []).forEach((ch) => walk(ch, root));
    };
    (apiCats ?? []).forEach((c) => walk(c, c.id));
    return m;
  }, [apiCats]);

  const categories = useMemo<{ id: CatFilter; icon: string; nom: string }[]>(
    () => [
      CAT_ALL,
      ...(apiCats ?? []).map((c) => ({
        id: `c${c.id}` as CatFilter,
        icon: c.icone || KIND_ICON[categoryKind(c)],
        nom: c.nom,
      })),
      CAT_PACK,
    ],
    [apiCats],
  );

  const catTitle = tx(cat === 'all' ? CAT_ALL.nom : cat === 'pack' ? CAT_PACK.nom : (categories.find((c) => c.id === cat)?.nom ?? 'Catalogue'));

  // Connection API Backend GET /api/products — 100 premiers, nouveautés d'abord, recherche q (debounce)
  useEffect(() => {
    let alive = true;
    setProductsLoading(true);
    const timer = window.setTimeout(() => {
      catalogApi.getProducts({ q: search.trim() || undefined, per_page: 100, sort: 'created_at', dir: 'desc' })
        .then((res) => {
          if (!alive) return;
          const list = Array.isArray(res?.data) ? res.data : [];
          const fetched: CatalogProduct[] = list.map((p: ApiProduct) => ({
            id: String(p.id),
            nom: p.nom,
            meta: p.description ?? '',
            quantite: p.stock > 0 ? `${p.stock} en stock` : tx("Rupture"),
            prix: Number(p.prix ?? 0),
            prixLabel: `${p.prix} F`,
            prixMinimum: Number(p.prix_minimum ?? 0),
            stock: p.disponible === false || Number(p.stock) <= 0 ? 'none' : Number(p.stock) <= 5 ? 'low' : 'available',
            icon: mapApiCategory(p.categorie) === 'fish' ? 'set_meal' : mapApiCategory(p.categorie) === 'grain' ? 'nutrition' : mapApiCategory(p.categorie) === 'spice' ? 'restaurant' : mapApiCategory(p.categorie) === 'pack' ? 'package_2' : 'eco',
            cat: mapApiCategory(p.categorie),
            catRawId: p.categorie?.id,
            catNom: p.categorie?.nom,
            image: absImageUrl(p.image_url ?? p.img_url),
          }));
          setProductsList(fetched);
          setProductsError(null);
        })
        .catch((err) => {
          if (!alive) return;
          setProductsList([]);
          setProductsError(alertApiError(err, 'catalog-products'));
        })
        .finally(() => {
          if (alive) setProductsLoading(false);
        });
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [search, reloadKey]);

  // Curseur prix (bureau + mobile) : ramené tout à droite = plus de limite.
  const onPriceChange = (v: number) => {
    setMaxPrice(v >= priceCeil ? null : v);
    setPage(1);
  };

  const filtered = useMemo(() => {
    let items = [...(packMode ? (apiPacks ?? []) : productsList)];
    const needle = search.trim().toLowerCase();
    if (needle) items = items.filter((p) => p.nom.toLowerCase().includes(needle) || p.meta.toLowerCase().includes(needle));
    if (cat.startsWith('c')) {
      const id = Number(cat.slice(1));
      items = items.filter((p) => p.catRawId != null && (rootOf.get(p.catRawId) ?? p.catRawId) === id);
    }
    if (maxPrice !== null) items = items.filter((p) => p.prix <= maxPrice);
    // « Disponible uniquement » = commandable : stock > 0 et disponible (les stocks faibles 1–5 restent visibles).
    if (dispoOnly) items = items.filter((p) => p.stock !== 'none');
    if (sort === 'asc') items.sort((a, b) => a.prix - b.prix);
    if (sort === 'desc') items.sort((a, b) => b.prix - a.prix);
    if (sort === 'new') items.reverse();
    return items;
  }, [search, cat, maxPrice, dispoOnly, sort, productsList, rootOf, packMode, apiPacks]);

  // Liste affichée : chargement initial (jamais de faux produits) ou échec (message de l'API + Réessayer).
  const listLoading = packMode ? apiPacks === null : productsLoading && productsList.length === 0 && !productsError;
  const listError = packMode ? packsError : productsError;
  const retry = () => setReloadKey((k) => k + 1);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const resetFilters = () => {
    setCat('all');
    setMaxPrice(null);
    setDispoOnly(true);
    setSearch('');
    setSort('pop');
    setPage(1);
    if (q || catParam) navigate({ to: '/catalogue', search: {} });
  };


  const addToCart = (p: CatalogProduct) => {
    if (p.stock === 'none') return; // rupture : pas d'ajout au panier
    const product: Product = {
      id: p.id,
      nom: p.nom,
      origine: p.catNom ?? '',
      quantite: p.quantite,
      prix: p.prix,
      prixMinimum: p.prixMinimum,
      categorie: p.cat,
      stock: p.stock === 'low' ? 'low' : 'available', // rupture déjà écartée plus haut
      badges: p.promo ? ["promo"] : [],
      image: p.image ?? undefined,
    };
    dispatch(add({ product }));
    toast.success(tr(`${p.nom} ajouté au panier`, `${p.nom} added to cart`));
  };

  const openProduct = (id: string | number) =>
    navigate({ to: '/produit/$productId', params: { productId: String(id) } });

  const badges = (p: CatalogProduct) => (
    <div className="absolute left-2 top-2 flex flex-col gap-1">
      {p.stock === 'available' && (
        <span className="flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> {tx("Disponible")}
        </span>
      )}
      {p.promo && <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-white">{p.promo}</span>}
      {p.stock === 'low' && (
        <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> {tx("Stock faible")}
        </span>
      )}
      {p.stock === 'none' && (
        <span className="flex items-center gap-1 rounded-full bg-ink-3 px-2 py-0.5 text-[10px] font-bold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> {tx("Rupture")}
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-page pt-[52px] font-body text-on-surface">
      <ClientNavbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />

      <main className="mx-auto flex w-full max-w-[1200px] gap-4 px-4 py-lg">
        {/* ---- Sidebar Filters ---- */}
        <aside className="hidden w-[260px] flex-shrink-0 space-y-md md:block">
          <div className="rounded-xl border-[0.5px] border-line bg-white p-md shadow-sm">
            <h3 className="mb-md font-h3 text-h3">{tx("Catégories")}</h3>
            <nav className="space-y-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCat(c.id);
                    setPage(1);
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all',
                    cat === c.id
                      ? 'bg-primary-lighter font-semibold text-primary'
                      : 'text-on-surface-variant hover:bg-primary-lighter hover:text-primary',
                  )}
                >
                  <MIcon name={c.icon} className="text-[20px]" />
                  <span className="text-label">{tx(c.nom)}</span>
                </button>
              ))}
            </nav>

            <div className="mt-8 border-t border-line pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-h3 text-h3">{tx("Prix (FCFA)")}</h3>
                <span className="text-micro font-bold text-primary">{(maxPrice ?? priceCeil).toLocaleString('fr-FR')} max</span>
              </div>
              <input
                type="range"
                min={0}
                max={priceCeil}
                step={50}
                value={Math.min(maxPrice ?? priceCeil, priceCeil)}
                onChange={(e) => onPriceChange(Number(e.target.value))}
                className="range-tokpa h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-warm-container accent-primary"
              />
              <div className="mt-2 flex justify-between text-micro text-ink-3">
                <span>0</span>
                <span>{(priceCeil / 1000).toLocaleString('fr-FR')}k</span>
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <div className="flex items-center justify-between">
                <span className="text-label font-semibold">{tx("Disponible uniquement")}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dispoOnly}
                  onClick={() => {
                    setDispoOnly((v) => !v);
                    setPage(1);
                  }}
                  className={clsx(
                    'relative h-5 w-10 rounded-full shadow-inner transition-all',
                    dispoOnly ? 'bg-primary' : 'bg-ink-3',
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow',
                      dispoOnly ? 'right-0.5' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-8 w-full rounded-lg py-2 text-label font-semibold text-primary transition-colors hover:bg-primary-lighter active:scale-95"
            >
              {tx("Réinitialiser les filtres")}
            </button>
          </div>
        </aside>

        {/* ---- Mobile Filter Drawer ---- */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/50 md:hidden">
            <div className="mt-auto max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-lg shadow-xl">
              <div className="mb-md flex items-center justify-between border-b border-line pb-sm">
                <h3 className="font-h2 text-h2 text-on-surface">{tx("Filtres du catalogue")}</h3>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="rounded-full p-2 text-ink-2 hover:bg-page"
                >
                  <MIcon name="close" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="mb-sm font-h3 text-h3 text-on-surface">{tx("Catégories")}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCat(c.id);
                          setPage(1);
                        }}
                        className={clsx(
                          'flex items-center gap-2 rounded-lg p-2 text-left text-xs transition-all',
                          cat === c.id ? 'bg-primary-lighter font-bold text-primary' : 'bg-page text-ink-2',
                        )}
                      >
                        <MIcon name={c.icon} className="text-[18px]" />
                        <span className="truncate">{tx(c.nom)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-h3 text-h3 text-on-surface">{tx("Prix max")}</h4>
                    <span className="text-xs font-bold text-primary">{(maxPrice ?? priceCeil).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={priceCeil}
                    step={500}
                    value={Math.min(maxPrice ?? priceCeil, priceCeil)}
                    onChange={(e) => onPriceChange(Number(e.target.value))}
                    className="range-tokpa h-2 w-full cursor-pointer appearance-none rounded-lg bg-page"
                  />
                </div>

                <div className="border-t border-line pt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface">{tx("Disponible uniquement")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDispoOnly(!dispoOnly);
                      setPage(1);
                    }}
                    className={clsx(
                      'relative h-5 w-10 rounded-full shadow-inner transition-all',
                      dispoOnly ? 'bg-primary' : 'bg-ink-3',
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow',
                        dispoOnly ? 'right-0.5' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-1/2 rounded-lg border border-line py-3 text-xs font-bold text-ink-2"
                  >
                    {tx("Réinitialiser")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(false)}
                    className="w-1/2 rounded-lg bg-primary py-3 text-xs font-bold text-white shadow-sm"
                  >
                    Voir ({filtered.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Main Content Area ---- */}
        <section className="min-w-0 flex-grow">
          {/* Barre de recherche des produits */}
          <div className="mb-md">
            <div className="relative">
              <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={tx("Rechercher un produit (nom ou description)…")}
                className="w-full rounded-[10px] border-0.5 border-line bg-card py-3 pl-10 pr-4 text-label placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="mb-md flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-lg">
            <div>
              <h2 className="font-h1 text-h1 text-on-surface">{catTitle}</h2>
              <p className="mt-1 text-ink-2">
                {listLoading ? tx("Chargement…") : listError ? '' : `${filtered.length} ${packMode ? tx("packs trouvés") : 'produits trouvés'}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {/* Mobile Filter Button */}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm md:hidden"
              >
                <MIcon name="tune" className="text-[18px]" />
                {tx("Filtres")}
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5">
                <span className="hidden text-xs text-ink-2 sm:inline">{tx("Trier :")}</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                  }}
                  className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold focus:ring-0"
                >
                  <option value="pop">{tx("Popularité")}</option>
                  <option value="asc">{tx("Prix croissant")}</option>
                  <option value="desc">{tx("Prix décroissant")}</option>
                  <option value="new">{tx("Nouveautés")}</option>
                </select>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-line bg-white">
                <button
                  type="button"
                  aria-label={tx("Vue grille")}
                  onClick={() => setView('grid')}
                  className={clsx('p-2', view === 'grid' ? 'border-r border-line bg-warm text-primary' : 'text-ink-3 hover:bg-surface')}
                >
                  <MIcon name="grid_view" className="text-[20px]" />
                </button>
                <button
                  type="button"
                  aria-label={tx("Vue liste")}
                  onClick={() => setView('list')}
                  className={clsx('p-2', view === 'list' ? 'bg-warm text-primary' : 'text-ink-3 hover:bg-surface')}
                >
                  <MIcon name="view_list" className="text-[20px]" />
                </button>
              </div>
            </div>
          </div>

          {listLoading ? (
            <LoadingState
              label={packMode ? tx("Chargement des packs…") : 'Chargement des produits…'}
              className="rounded-xl border-[0.5px] border-line bg-white"
            />
          ) : listError ? (
            <ApiErrorState
              title={packMode ? tx("Impossible de charger les packs") : tx("Impossible de charger les produits")}
              message={listError}
              onRetry={retry}
              className="rounded-xl border-[0.5px] border-line bg-white px-md"
            />
          ) : visible.length === 0 ? (
            <div className="rounded-xl border-[0.5px] border-line bg-white p-xl text-center text-ink-2">
              {packMode ? tx("Aucun pack ne correspond à ces filtres.") : tx("Aucun produit ne correspond à ces filtres.")}
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!p.isPack) openProduct(p.id);
                  }}
                  className={clsx(
                    'group overflow-hidden rounded-xl border-[0.5px] border-line bg-white transition-all hover:shadow-md',
                    p.isPack ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  <div className="relative flex h-[110px] items-center justify-center bg-gradient-to-br from-primary-lighter to-primary-light">
                    {p.image ? (
                      <img src={p.image} alt={p.nom} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <MIcon name={p.icon} className="text-[40px] text-primary-hover" />
                    )}
                    {badges(p)}
                  </div>
                  <div className="p-md">
                    <h4 className="line-clamp-1 text-label font-semibold text-ink">{p.nom}</h4>
                    <p className="mt-1 text-ink-2">{p.meta}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <span className="font-price text-price text-primary">{p.prixLabel}</span>
                        {p.prixAncienLabel && (
                          <span className="block text-micro text-ink-3 line-through">{p.prixAncienLabel}</span>
                        )}
                      </div>
                      {!p.isPack && (
                        <button
                          type="button"
                          aria-label={`Ajouter ${p.nom}`}
                          disabled={p.stock === 'none'}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                        >
                          <MIcon name="add" className="text-[20px]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:gap-4">
              {visible.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!p.isPack) openProduct(p.id);
                  }}
                  className={clsx(
                    'group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-md rounded-xl border-[0.5px] border-line bg-white p-3 sm:p-md transition-all hover:shadow-md',
                    p.isPack ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex h-[70px] w-[90px] sm:h-[80px] sm:w-[110px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-lighter to-primary-light">
                      {p.image ? (
                        <img src={p.image} alt={p.nom} className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                      ) : (
                        <MIcon name={p.icon} className="text-[28px] sm:text-[32px] text-primary-hover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-label font-semibold text-ink line-clamp-1">{p.nom}</h4>
                      <p className="mt-0.5 text-xs text-ink-2">{p.meta}</p>

                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.stock === 'available' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success-dark">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" /> {tx("Disponible")}
                          </span>
                        )}
                        {p.promo && (
                          <span className="inline-flex items-center rounded-full bg-amber-light px-2 py-0.5 text-[10px] font-bold text-amber-text">
                            {p.promo}
                          </span>
                        )}
                        {p.stock === 'low' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-lighter px-2 py-0.5 text-[10px] font-bold text-primary-dark">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {tx("Stock faible")}
                          </span>
                        )}
                        {p.stock === 'none' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-ink-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-ink-3" /> {tx("Rupture")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-md border-t sm:border-t-0 border-line/60 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="font-price text-sm sm:text-price text-primary">{p.prixLabel}</span>
                      {p.prixAncienLabel && (
                        <span className="block text-micro text-ink-3 line-through">{p.prixAncienLabel}</span>
                      )}
                    </div>
                    {!p.isPack && (
                      <button
                        type="button"
                        aria-label={`Ajouter ${p.nom}`}
                        disabled={p.stock === 'none'}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p);
                        }}
                        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-hover active:scale-95 shrink-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                      >
                        <MIcon name="add" className="text-[18px] sm:text-[20px]" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---- Pagination ---- */}
          <div className="mt-xl flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label={tx("Page précédente")}
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-on-surface-variant transition-all hover:border-line hover:bg-white disabled:opacity-40"
            >
              <MIcon name="chevron_left" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-all',
                  n === currentPage
                    ? 'bg-primary font-bold text-white shadow-sm'
                    : 'border border-transparent text-on-surface-variant hover:border-line hover:bg-white',
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              aria-label={tx("Page suivante")}
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-on-surface-variant transition-all hover:border-line hover:bg-white disabled:opacity-40"
            >
              <MIcon name="chevron_right" />
            </button>
          </div>
        </section>
      </main>

      {/* ---- Footer catalogue ---- */}
      <footer className="mt-xl border-t border-line bg-white py-lg">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 text-ink-2">
          <div className="flex items-center gap-2">
            <span className="font-h3 text-primary">TOKPa</span>
            <span className="text-micro">{tx("© 2026 - Le Marché Béninois en ligne")}</span>
          </div>
          <div className="hidden gap-lg sm:flex">
            <Link to="/profil" className="text-label transition-colors hover:text-primary">
              {tx("Aide & Support")}
            </Link>
            <Link to="/negociations" className="text-label transition-colors hover:text-primary">
              {tx("Négocier sur TOKPa")}
            </Link>
            <Link to="/commandes/suivi" className="text-label transition-colors hover:text-primary">
              {tx("Suivi Livraison")}
            </Link>
          </div>
        </div>
      </footer>
      <ClientBottomNav />
    </div>
  );
}

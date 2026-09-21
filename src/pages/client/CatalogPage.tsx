import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { faChevronDown, faChevronLeft, faChevronRight, faFilter, faRotateLeft, faTableCellsLarge, faTableList } from '@fortawesome/free-solid-svg-icons';
import { ProductCard } from '../../components/client/catalog/ProductCard';
import { MarketplaceHeader } from '../../components/layout/MarketplaceHeader';
import { Icon } from '../../components/ui/Icon';
import { mockProducts } from '../../data/mockProducts';

type SortOption = 'popular' | 'priceAsc' | 'priceDesc';

const categoryOptions = ['Tous les produits', 'Fruits & légumes', 'Légumes', 'Céréales & graines', 'Épices & condiments', 'Packs & bundles'];
const marketOptions = ['Marché Dantokpa', 'Marché Ganhì', 'Marché Missebo', 'Marché Gbégamey'];

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous les produits');
  const [market, setMarket] = useState('Tous les marchés');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [sort, setSort] = useState<SortOption>('popular');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const pageSize = 9;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const result = mockProducts.filter((product) => {
      const matchesSearch = !normalizedSearch || `${product.name} ${product.category} ${product.seller || ''}`.toLocaleLowerCase().includes(normalizedSearch);
      const matchesCategory = category === 'Tous les produits' || product.category === category;
      const matchesMarket = market === 'Tous les marchés' || product.market === market;
      const matchesPrice = product.price <= maxPrice;
      const matchesAvailability = !onlyAvailable || product.available !== false;
      return matchesSearch && matchesCategory && matchesMarket && matchesPrice && matchesAvailability;
    });

    return [...result].sort((a, b) => {
      if (sort === 'priceAsc') return a.price - b.price;
      if (sort === 'priceDesc') return b.price - a.price;
      return b.rating - a.rating;
    });
  }, [category, market, maxPrice, onlyAvailable, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);
  const resetFilters = () => {
    setSearch('');
    setCategory('Tous les produits');
    setMarket('Tous les marchés');
    setMaxPrice(10000);
    setOnlyAvailable(true);
    setSort('popular');
    setPage(1);
  };

  const updateCategory = (value: string) => { setCategory(value); setPage(1); };
  const updateMarket = (value: string) => { setMarket(value); setPage(1); };
  const updateSearch = (value: string) => { setSearch(value); setPage(1); };
  const updateMaxPrice = (value: number) => { setMaxPrice(value); setPage(1); };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <MarketplaceHeader searchValue={search} onSearchChange={updateSearch} active="market" />
      <div className="mx-auto grid max-w-[1500px] gap-7 px-5 py-8 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black">Catégories</h2><Icon icon={faFilter} className="text-brand-500" /></div>
          <div className="mt-5 space-y-1">{categoryOptions.map((option) => <button key={option} type="button" onClick={() => updateCategory(option)} className={`flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${category === option ? 'bg-orange-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50'}`}>{option}</button>)}</div>
          <div className="my-6 border-t border-slate-100" />
          <h3 className="font-black">Zone du marché</h3>
          <div className="mt-4 space-y-3">{['Tous les marchés', ...marketOptions].map((option) => <label key={option} className="flex items-center gap-3 text-sm text-slate-600"><input type="radio" name="market" checked={market === option} onChange={() => updateMarket(option)} className="accent-orange-500" />{option}</label>)}</div>
          <div className="my-6 border-t border-slate-100" />
          <div className="flex items-center justify-between"><h3 className="font-black">Prix (FCFA)</h3><span className="text-xs font-bold text-brand-600">{new Intl.NumberFormat('fr-FR').format(maxPrice)} max</span></div>
          <input type="range" min="0" max="10000" step="50" value={maxPrice} onChange={(event) => updateMaxPrice(Number(event.target.value))} className="mt-5 w-full accent-orange-500" />
          <div className="flex justify-between text-xs text-slate-400"><span>0</span><span>10k</span></div>
          <div className="my-6 border-t border-slate-100" />
          <label className="flex items-center justify-between text-sm font-semibold text-slate-700">Disponible uniquement<input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)} className="h-5 w-5 accent-orange-500" /></label>
          <button type="button" onClick={resetFilters} className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"><Icon icon={faRotateLeft} /> Réinitialiser les filtres</button>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Marché local · Cotonou</p><h1 className="mt-1 text-3xl font-black tracking-tight">Légumes frais</h1><p className="mt-1 text-sm text-slate-500">{filteredProducts.length} produits trouvés</p></div><div className="flex items-center gap-2"><label className="relative"><span className="sr-only">Trier les produits</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none focus:border-orange-300"><option value="popular">Popularité</option><option value="priceAsc">Prix croissant</option><option value="priceDesc">Prix décroissant</option></select><Icon icon={faChevronDown} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" /></label><div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:flex"><button type="button" onClick={() => setView('grid')} className={`grid h-11 w-11 place-items-center ${view === 'grid' ? 'bg-orange-50 text-brand-600' : 'text-slate-400'}`} aria-label="Vue grille"><Icon icon={faTableCellsLarge} /></button><button type="button" onClick={() => setView('list')} className={`grid h-11 w-11 place-items-center ${view === 'list' ? 'bg-orange-50 text-brand-600' : 'text-slate-400'}`} aria-label="Vue liste"><Icon icon={faTableList} /></button></div></div></div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden"><button type="button" onClick={() => updateCategory('Tous les produits')} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${category === 'Tous les produits' ? 'bg-orange-100 text-brand-700' : 'bg-white text-slate-600'}`}>Toutes les catégories</button>{categoryOptions.slice(1).map((option) => <button key={option} type="button" onClick={() => updateCategory(option)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${category === option ? 'bg-orange-100 text-brand-700' : 'bg-white text-slate-600'}`}>{option}</button>)}</div>

          <div className={`mt-6 grid gap-5 ${view === 'grid' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {visibleProducts.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><h2 className="text-lg font-black">Aucun produit ne correspond à ces filtres</h2><p className="mt-2 text-sm text-slate-500">Modifiez vos critères ou réinitialisez la recherche.</p><button type="button" onClick={resetFilters} className="btn-secondary mt-5">Réinitialiser</button></div>}
          <div className="mt-9 flex items-center justify-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40"><Icon icon={faChevronLeft} /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} onClick={() => setPage(pageNumber)} className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold ${page === pageNumber ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{pageNumber}</button>)}<button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40"><Icon icon={faChevronRight} /></button></div>
          <p className="mt-6 text-center text-xs text-slate-400">Les prix et disponibilités sont mis à jour par les vendeurs partenaires.</p>
        </section>
      </div>
    </main>
  );
}

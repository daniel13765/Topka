import {
  faAppleWhole,
  faArrowRight,
  faArrowRightLong,
  faBasketShopping,
  faBell,
  faBottleWater,
  faBreadSlice,
  faCarrot,
  faCartShopping,
  faChevronRight,
  faCircleCheck,
  faClock,
  faComments,
  faFish,
  faHandshake,
  faLocationDot,
  faMagnifyingGlass,
  faMotorcycle,
  faShieldHalved,
  faSliders,
  faStar,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Link } from 'react-router-dom';
import { ROLE_DEFINITIONS } from '../constants/roles';
import { ProductCard } from '../components/client/catalog/ProductCard';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import type { Product } from '../types/domain';
import { useAppSelector } from '../hooks/redux';

const categories: Array<{ name: string; icon: IconDefinition; color: string }> = [
  { name: 'Fruits & légumes', icon: faAppleWhole, color: 'bg-orange-100 text-orange-700' },
  { name: 'Poissons frais', icon: faFish, color: 'bg-sky-100 text-sky-700' },
  { name: 'Épicerie', icon: faBasketShopping, color: 'bg-amber-100 text-amber-700' },
  { name: 'Viandes', icon: faCarrot, color: 'bg-rose-100 text-rose-700' },
  { name: 'Boulangerie', icon: faBreadSlice, color: 'bg-yellow-100 text-yellow-700' },
  { name: 'Boissons', icon: faBottleWater, color: 'bg-emerald-100 text-emerald-700' },
];

const products: Product[] = [
  {
    id: 1,
    name: 'Bananes plantain mûres',
    category: 'Fruits & légumes',
    price: 1800,
    unit: 'le régime',
    image: '/images/placeholders/bananes-plantain.jpg',
    rating: 4.9,
    badge: 'Très demandé',
  },
  {
    id: 2,
    name: 'Papaye fraîche du jour',
    category: 'Fruits & légumes',
    price: 1200,
    unit: "à l'unité",
    image: '/images/placeholders/papaye.jpg',
    rating: 4.8,
    negotiable: true,
  },
  {
    id: 3,
    name: 'Mangoustans frais',
    category: 'Fruits & légumes',
    price: 2500,
    unit: 'le panier de 500 g',
    image: '/images/placeholders/mangoustan.jpg',
    rating: 4.7,
    badge: 'Nouveau',
  },
  {
    id: 4,
    name: 'Panier tropical du marché',
    category: 'Sélection TOKPa',
    price: 6500,
    unit: 'le panier',
    image: '/images/brand/tropical-still-life.jpg',
    rating: 4.9,
    negotiable: true,
  },
];

export function HomePage() {
  const cartItems = useAppSelector((state) => state.cart.items);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-900">
      <div className="bg-slate-900 px-5 py-2 text-center text-xs font-semibold text-white sm:text-sm">
        <span className="text-orange-300">Livraison à Cotonou</span> · Frais calculés selon votre zone · Paiement sécurisé FedaPay
      </div>

      <header className="sticky top-0 z-20 border-b border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-center gap-4 py-4">
            <Link to="/" className="shrink-0" aria-label="TOKPa, accueil">
              <span className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">TOK<span className="text-brand-500">Pa</span></span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:block">Ton marché, ta façon</span>
            </Link>

            <div className="hidden items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 md:flex">
              <Icon icon={faLocationDot} />
              <span>Cotonou</span>
              <Icon icon={faChevronRight} className="text-xs text-orange-400" />
            </div>

            <label className="relative hidden min-w-0 flex-1 md:block">
              <span className="sr-only">Rechercher un produit</span>
              <Icon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" placeholder="Rechercher un produit, une catégorie…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
            </label>

            <nav className="ml-auto flex items-center gap-2" aria-label="Actions principales">
              <Link to="/client" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-orange-50 hover:text-orange-700 lg:inline-flex">Mes commandes</Link>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-orange-50 hover:text-orange-700" aria-label="Rechercher">
                <Icon icon={faMagnifyingGlass} className="md:hidden" />
              </button>
              <Link to="/connexion" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-orange-50 hover:text-orange-700" aria-label="Mon compte">
                <Icon icon={faUser} />
              </Link>
              <Link to="/client" className="relative grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-700 transition hover:bg-brand-500 hover:text-white" aria-label={`Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`}>
                <Icon icon={faCartShopping} />
                {cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-black text-white">{cartCount}</span>}
              </Link>
            </nav>
          </div>
          <div className="pb-4 md:hidden">
            <label className="relative block">
              <span className="sr-only">Rechercher un produit</span>
              <Icon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" placeholder="Rechercher dans le marché…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <section className="relative mt-6 overflow-hidden rounded-[2rem] bg-orange-100">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-100 via-orange-100/95 to-transparent" />
          <div className="relative grid min-h-[430px] items-center lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative z-10 max-w-xl px-6 py-12 sm:px-12 lg:py-16">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm"><Icon icon={faStar} /> La sélection du jour</span>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">Ton marché,<br /><span className="text-brand-500">ta façon.</span></h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-700 sm:text-lg">Les bons produits du marché béninois, livrés simplement chez toi. Choisis, négocie et suis ta commande.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#catalogue" className="btn-primary">Découvrir le marché <Icon icon={faArrowRightLong} className="ml-2" /></a>
                <Link to="/connexion" className="btn-secondary">Se connecter</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-2"><Icon icon={faShieldHalved} className="text-emerald-600" />Paiement sécurisé</span>
                <span className="inline-flex items-center gap-2"><Icon icon={faMotorcycle} className="text-orange-600" />Livraison locale</span>
              </div>
            </div>
            <div className="relative min-h-[280px] overflow-hidden lg:absolute lg:inset-y-0 lg:right-0 lg:w-[58%] lg:min-h-0">
              <img src="/images/brand/market-fruits.jpg" alt="Fruits frais sur un marché" className="h-full w-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-r from-orange-100 via-transparent to-transparent lg:from-orange-100/95 lg:via-orange-100/20" />
              <div className="absolute bottom-5 right-5 hidden rounded-2xl bg-white/95 p-4 shadow-xl sm:block">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon icon={faCircleCheck} /></span><div><p className="text-xs text-slate-500">Producteurs locaux</p><p className="font-black text-slate-900">+ 120 partenaires</p></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12" aria-labelledby="categories-title">
          <div className="flex items-end justify-between gap-4">
            <div><p className="eyebrow">Explorer le marché</p><h2 id="categories-title" className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Que cherches-tu aujourd’hui ?</h2></div>
            <button type="button" className="hidden items-center gap-2 text-sm font-bold text-orange-700 sm:inline-flex">Tout voir <Icon icon={faArrowRight} /></button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {categories.map((category) => <button key={category.name} type="button" className="group rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"><span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl text-xl ${category.color}`}><Icon icon={category.icon} /></span><span className="mt-3 block text-xs font-bold leading-5 text-slate-700 sm:text-sm">{category.name}</span></button>)}
          </div>
        </section>

        <section id="catalogue" className="pb-16" aria-labelledby="catalogue-title">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="eyebrow">Frais, local, choisi pour toi</p><h2 id="catalogue-title" className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">La sélection du marché</h2></div>
            <div className="flex gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-orange-200 hover:text-orange-700"><Icon icon={faSliders} /> Filtrer</button><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-orange-200 hover:text-orange-700">Trier <Icon icon={faChevronRight} className="rotate-90 text-xs" /></button></div>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          <div className="mt-8 text-center"><Link to="/catalogue" className="btn-secondary">Voir plus de produits <Icon icon={faArrowRight} className="ml-2" /></Link></div>
        </section>

        <section className="mb-16 grid overflow-hidden rounded-3xl bg-slate-900 text-white lg:grid-cols-2">
          <div className="p-7 sm:p-10"><p className="eyebrow !text-orange-300">Pensé pour le Bénin</p><h2 className="mt-3 text-3xl font-black tracking-tight">Le marché vient à toi.</h2><p className="mt-4 max-w-lg leading-7 text-slate-300">Une expérience simple pour acheter, proposer ton budget et échanger avec ton livreur en temps réel.</p><div className="mt-7 flex flex-wrap gap-3"><span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold"><Icon icon={faClock} className="mr-2 text-orange-300" />Suivi en direct</span><span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold"><Icon icon={faHandshake} className="mr-2 text-orange-300" />Prix négociables</span></div></div>
          <div className="relative min-h-64 overflow-hidden"><img src="/images/brand/tropical-still-life.jpg" alt="Sélection de fruits tropicaux" className="h-full w-full object-cover opacity-80" /><div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-transparent to-transparent" /></div>
        </section>

        <section className="mb-16 grid gap-4 md:grid-cols-3">
          <Card className="p-5"><Icon icon={faShieldHalved} className="text-2xl text-emerald-600" /><h3 className="mt-4 font-black">Paiement en confiance</h3><p className="mt-2 text-sm leading-6 text-slate-500">FedaPay et confirmation sécurisée de la commande.</p></Card>
          <Card className="p-5"><Icon icon={faMotorcycle} className="text-2xl text-orange-600" /><h3 className="mt-4 font-black">Livraison de proximité</h3><p className="mt-2 text-sm leading-6 text-slate-500">Des livreurs affectés selon ta zone de livraison.</p></Card>
          <Card className="p-5"><Icon icon={faComments} className="text-2xl text-sky-600" /><h3 className="mt-4 font-black">Toujours en contact</h3><p className="mt-2 text-sm leading-6 text-slate-500">Une messagerie pour échanger pendant la course.</p></Card>
        </section>
      </div>

      <footer className="border-t border-orange-100 bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-slate-500 sm:flex-row sm:items-center"><div><span className="font-black text-slate-900">TOK<span className="text-brand-500">Pa</span></span><span className="ml-3">Ton marché, ta façon.</span></div><div className="flex gap-5"><Link to="/connexion" className="hover:text-orange-700">Se connecter</Link><Link to="/admin" className="hover:text-orange-700">Espace équipe</Link><span>© 2026 TOKPa</span></div></div>
      </footer>
    </main>
  );
}

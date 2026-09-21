import { faBell, faCartShopping, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../hooks/redux';
import { Icon } from '../ui/Icon';

interface MarketplaceHeaderProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  active?: 'market' | 'negotiations' | 'orders' | 'profile';
}

export function MarketplaceHeader({ searchValue = '', onSearchChange, placeholder = 'Rechercher un produit…', active = 'market' }: MarketplaceHeaderProps) {
  const cartItems = useAppSelector((state) => state.cart.items);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const navItems = [
    { id: 'market', label: 'Marché', to: '/catalogue' },
    { id: 'negotiations', label: 'Négociations', to: '/client/negociations' },
    { id: 'orders', label: 'Commandes', to: '/client' },
    { id: 'profile', label: 'Profil', to: '/connexion' },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-[1500px] items-center gap-4 px-5 sm:px-8">
        <Link to="/" className="shrink-0 text-2xl font-black tracking-tight text-slate-950">TOK<span className="text-brand-500">Pa</span></Link>
        <label className="relative hidden min-w-0 max-w-[450px] flex-1 md:block">
          <span className="sr-only">{placeholder}</span>
          <Icon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
        </label>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Navigation du marché">
          {navItems.map((item) => <Link key={item.id} to={item.to} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active === item.id ? 'text-slate-950' : 'text-slate-600 hover:bg-orange-50 hover:text-brand-700'}`}>{item.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <Link to="/client/notifications" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-orange-50 hover:text-brand-600" aria-label="Notifications"><Icon icon={faBell} /></Link>
          <Link to="/commande" className="relative grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-brand-700 transition hover:bg-brand-500 hover:text-white" aria-label={`Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`}><Icon icon={faCartShopping} />{cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-black text-white">{cartCount}</span>}</Link>
        </div>
      </div>
      <div className="px-5 pb-3 md:hidden">
        <label className="relative block"><span className="sr-only">{placeholder}</span><Icon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" /></label>
      </div>
    </header>
  );
}

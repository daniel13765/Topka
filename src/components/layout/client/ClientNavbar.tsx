import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import MIcon from '../../shared/MIcon';
import { useAppSelector } from '../../../hooks/useStore';
import { selectCount } from '../../../store/slices/cart/cartSlice';
import { useLanguage } from '../../../context/LanguageContext';
import { currentRole, hasSession, staffSpace } from '../../../routes/authGuard';
import { tx } from '../../../i18n/tx';


interface ClientNavbarProps {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
}

/**
 * Navbar cliente unique — copie conforme de la TopNavBar du code.html « accueil_tokpa »
 * (utilisée sur toutes les pages client : accueil, catalogue, fiche produit, panier…).
 * fixed 52px, fond #fff8f6, logo + liens, recherche pillule #fff1eb, icônes #9d4300, sélecteur de langue FR/EN.
 */
export default function ClientNavbar({ search, onSearch, searchPlaceholder }: ClientNavbarProps) {
  useLanguage();
  const cartCount = useAppSelector((s) => selectCount(s.cart.items));
  const negotiations = useAppSelector((s) => s.negotiation.history);
  const activeNegoCount = negotiations.filter((n) => n.status === 'accepted' || n.status === 'counter_offer').length;

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { language, toggleLanguage, t } = useLanguage();
  const [localSearch, setLocalSearch] = useState('');

  const onMarket = pathname === '/' || pathname.startsWith('/catalogue') || pathname.startsWith('/produit');
  const onNegociations = pathname.startsWith('/negociations');
  const onCommandes = pathname.startsWith('/commandes');

  const submitSearch = (e: FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const q = (search ?? localSearch).trim();
    if (q) navigate({ to: '/catalogue', search: { q } });
  };

  return (
    <header className="fixed top-0 z-50 w-full border-b border-line bg-warm">
      <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between px-4">
        {/* Logo + liens */}
        <div className="flex items-center gap-lg">
          <Link to="/" className="font-h2 text-h2 tracking-tight text-primary-shade">
            TOKPa
          </Link>
          <nav className="hidden gap-md md:flex">
            <Link
              to="/catalogue"
              className={clsx(
                'py-3 font-body text-body transition-colors',
                onMarket
                  ? 'border-b-2 border-primary-shade font-bold text-primary-shade'
                  : 'rounded px-2 text-on-surface-variant hover:bg-primary-lighter',
              )}
            >
              {t('nav.market')}
            </Link>
            <Link
              to="/negociations"
              className={clsx(
                'relative py-3 font-body text-body transition-colors',
                onNegociations
                  ? 'border-b-2 border-primary-shade font-bold text-primary-shade'
                  : 'rounded px-2 text-on-surface-variant hover:bg-primary-lighter',
              )}
            >
              {t('nav.negotiations')}
              {activeNegoCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {activeNegoCount}
                </span>
              )}
            </Link>
            <Link
              to="/commandes"
              className={clsx(
                'py-3 font-body text-body transition-colors',
                onCommandes
                  ? 'border-b-2 border-primary-shade font-bold text-primary-shade'
                  : 'rounded px-2 text-on-surface-variant hover:bg-primary-lighter',
              )}
            >
              {t('nav.orders')}
            </Link>
          </nav>
        </div>

        {/* Recherche (pillule) */}
        <form onSubmit={submitSearch} className="mx-8 hidden max-w-1xl flex-1 lg:block">
          <div className="relative flex items-center rounded-full border border-line bg-warm-low px-4 py-1.5">
            <MIcon name="search" className="mr-2 text-ink-3" />
            <input
              type="text"
              value={search ?? localSearch}
              onChange={(e) => (onSearch ? onSearch(e.target.value) : setLocalSearch(e.target.value))}
              placeholder={searchPlaceholder ?? t('common.searchPlaceholder')}
              className="w-full border-none bg-transparent p-0 text-ink-2 focus:outline-none focus:ring-0 text-xs sm:text-sm"
            />
          </div>
        </form>

        {/* Icônes & Sélecteur de langue */}
        <div className="flex items-center gap-3 sm:gap-md text-primary-shade">
          {/* Bouton de bascule de langue FR / EN */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === 'fr' ? 'Switch to English' : tx("Passer en Français")}
            className="flex items-center gap-1 rounded-full border border-primary-light bg-primary-lighter px-2.5 py-1 text-xs font-bold text-primary-shade transition-transform active:scale-95"
          >
            <MIcon name="language" className="text-[16px]" />
            <span className="uppercase">{language}</span>
          </button>

          <Link
            to="/negociations"
            className="scale-interaction relative md:hidden"
            title={t('nav.negotiations')}
          >
            <MIcon name="handshake" />
            {activeNegoCount > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />}
          </Link>

          <Link to="/notifications" className="scale-interaction" aria-label="Notifications">
            <MIcon name="notifications" />
          </Link>
          <Link to="/panier" className="scale-interaction relative" aria-label={tx("Panier")}>
            <MIcon name="shopping_cart" />
            {cartCount > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />}
          </Link>
          {/* Bascule vers l'espace de travail (admin / manager) — invisible pour un client */}
          {(() => {
            const space = staffSpace(currentRole());
            return space ? (
              <Link to={space.to} className="scale-interaction" aria-label={space.label} title={space.label}>
                <MIcon name={space.icon} />
              </Link>
            ) : null;
          })()}
          <Link
            to="/profil"
            className="scale-interaction"
            aria-label={hasSession() ? tx("Profil") : tx("Se connecter")}
            title={hasSession() ? tx("Profil") : tx("Se connecter")}
          >
            <MIcon name={hasSession() ? "account_circle" : "login"} />
          </Link>
        </div>
      </div>
    </header>
  );
}

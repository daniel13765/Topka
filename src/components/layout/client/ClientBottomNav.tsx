import { Link, useRouterState } from '@tanstack/react-router';
import MIcon from '../../shared/MIcon';
import { useAppSelector } from '../../../hooks/useStore';
import { selectCount } from '../../../store/slices/cart/cartSlice';
import { useLanguage } from '../../../context/LanguageContext';
import { hasSession } from '../../../routes/authGuard';

/**
 * ClientBottomNav — Composant commun de navigation mobile pour toutes les pages client.
 * Fixe en bas de l'écran (lg:hidden).
 */
export default function ClientBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cartCount = useAppSelector((s) => selectCount(s.cart.items));
  const negotiations = useAppSelector((s) => s.negotiation.history);
  const activeNegoCount = negotiations.filter((n) => n.status === 'accepted' || n.status === 'counter_offer').length;

  const { t } = useLanguage();

  const isHome = pathname === '/';
  const isCatalogue = pathname.startsWith('/catalogue');
  const isNegociations = pathname.startsWith('/negociations');
  const isPanier = pathname.startsWith('/panier');
  const isProfil = pathname.startsWith('/profil');

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-line bg-warm px-2 py-2 shadow-lg lg:hidden">
      <Link
        to="/"
        className={`scale-interaction flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-colors ${
          isHome ? 'bg-primary-lighter text-primary-shade font-semibold' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <MIcon name="home" className="text-[20px]" />
        <span className="font-micro text-micro">{t('nav.home')}</span>
      </Link>

      <Link
        to="/catalogue"
        className={`scale-interaction flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-colors ${
          isCatalogue ? 'bg-primary-lighter text-primary-shade font-semibold' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <MIcon name="category" className="text-[20px]" />
        <span className="font-micro text-micro">{t('nav.categories')}</span>
      </Link>

      <Link
        to="/negociations"
        className={`scale-interaction relative flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-colors ${
          isNegociations ? 'bg-primary-lighter text-primary-shade font-semibold' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <div className="relative">
          <MIcon name="handshake" className="text-[20px]" />
          {activeNegoCount > 0 && (
            <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
              {activeNegoCount}
            </span>
          )}
        </div>
        <span className="font-micro text-micro">{t('nav.negotiations')}</span>
      </Link>

      <Link
        to="/panier"
        className={`scale-interaction relative flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-colors ${
          isPanier ? 'bg-primary-lighter text-primary-shade font-semibold' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <div className="relative">
          <MIcon name="shopping_cart" className="text-[20px]" />
          {cartCount > 0 && (
            <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-container text-[9px] font-bold text-white">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </div>
        <span className="font-micro text-micro">{t('nav.cart')}</span>
      </Link>

      <Link
        to="/profil"
        className={`scale-interaction flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-colors ${
          isProfil ? 'bg-primary-lighter text-primary-shade font-semibold' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <MIcon name={hasSession() ? "person" : "login"} className="text-[20px]" />
        <span className="font-micro text-micro">{hasSession() ? t('nav.profile') : t('auth.loginBtn')}</span>
      </Link>
    </nav>
  );
}

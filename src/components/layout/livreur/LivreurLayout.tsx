import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import FaIcon from '../../shared/FaIcon';
import LangToggle from '../../shared/LangToggle';
import { authApi } from '../../../services/api';
import { currentUserName, initialsOf } from '../../../routes/authGuard';
import { fetchLivreurProfile } from '../../../pages/livreur/livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';

const NAV: {
  to: '/livreur' | '/livreur/course' | '/livreur/historique' | '/livreur/messagerie' | '/livreur/parametres';
  icon: string;
  label: string;
  short: string;
  exact: boolean;
}[] = [
  { to: '/livreur', icon: 'dashboard', label: 'Tableau de bord', short: 'Tableau de bord', exact: true },
  { to: '/livreur/course', icon: 'local_shipping', label: 'Livraisons en cours', short: 'Livraison en cours', exact: false },
  { to: '/livreur/historique', icon: 'history', label: 'Historique', short: 'Historique', exact: false },
  { to: '/livreur/messagerie', icon: 'chat_bubble', label: 'Messagerie', short: 'Messagerie', exact: false },
  { to: '/livreur/parametres', icon: 'settings', label: 'Paramètres', short: 'Paramètres', exact: false },
];

/**
 * Chrome partagé de l'espace livreur.
 *
 * Le layout reprend les deux compositions de la maquette TOKPa : sidebar orange
 * sur desktop et barre basse sur mobile. La disponibilité est affichée en lecture
 * seule tant que l'API ne fournit pas d'action de bascule sûre pour le livreur.
 */
export default function LivreurLayout({ children }: { children: ReactNode }) {
  useLanguage();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const nom = currentUserName();
  const [disponible, setDisponible] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLivreurProfile()
      .then((profile) => alive && setDisponible(profile.disponible))
      .catch(() => alive && setDisponible(null));
    return () => {
      alive = false;
    };
  }, []);

  const isActive = (to: string, exact: boolean) =>
    exact
      ? pathname === to || pathname === `${to}/`
      : pathname === to || pathname.startsWith(`${to}/`) || (to === '/livreur/course' && pathname.startsWith('/livreur/recapitulatif'));

  const pageTitle = pathname === '/livreur' ? tx('Mes courses') : pathname.includes('historique') ? tx('Historique') : pathname.includes('parametres') ? tx('Paramètres') : tx('Livraison en cours');

  const logout = async () => {
    await authApi.logout();
    toast.success(tx('Déconnexion effectuée'));
    navigate({ to: '/connexion' });
  };

  return (
    <div className="min-h-screen bg-bg-app font-body text-text-main">
      {/* Sidebar desktop */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col bg-primary text-white shadow-xl lg:flex">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-black tracking-tight text-white">TOKPa</h1>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-white/80">{tx('Portail Chauffeur')}</p>
          </div>
          <nav className="space-y-1.5" aria-label={tx('Navigation livreur')}>
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.to, item.exact) ? 'page' : undefined}
                className={
                  isActive(item.to, item.exact)
                    ? 'flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 font-bold text-primary shadow-sm transition-all'
                    : 'flex items-center gap-3 rounded-xl px-4 py-2.5 font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white'
                }
              >
                <FaIcon name={item.icon} className="text-[20px]" />
                <span className="text-[14px]">{tx(item.label)}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto space-y-2 border-t border-white/15 p-6">
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-white/80 transition-colors hover:text-white">
            <FaIcon name="storefront" className="text-[20px]" />
            <span className="text-[14px] font-medium">{tx('Espace client')}</span>
          </Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-white/80 transition-colors hover:text-white">
            <FaIcon name="logout" className="text-[20px]" />
            <span className="text-[14px] font-medium">{tx('Déconnexion')}</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen pb-20 lg:ml-64 lg:pb-0">
        {/* TopAppBar : compact sur mobile, complet sur desktop. */}
        <header className="relative z-40 flex h-14 w-full items-center justify-between border-b border-border-default bg-bg-card px-4 lg:sticky lg:top-0 lg:h-[52px] lg:px-6">
          <span className="font-h1 font-bold text-primary">TOKPa</span>
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-base font-semibold text-text-main lg:hidden">{pageTitle}</span>
          <div className="flex items-center gap-3 lg:gap-6">
            <div className="hidden lg:block">
              <LangToggle />
            </div>
            <Link to="/notifications" aria-label={tx('Notifications')} className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary-tint hover:text-primary">
              <FaIcon name="notifications" className="text-[18px]" />
            </Link>
            <div className="hidden items-center gap-2 border-l border-border-default pl-6 sm:flex">
              <div className="text-right">
                <p className="font-label leading-none text-text-main">{nom ?? tx('Livreur')}</p>
                {disponible !== null && <p className={clsx('text-xs font-medium', disponible ? 'text-success' : 'text-text-secondary')}>{disponible ? tx('Disponible') : tx('Indisponible')}</p>}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary ring-2 ring-primary">
                {initialsOf(nom, 'LV')}
              </div>
            </div>
          </div>
        </header>
        {children}
      </main>

      {/* Bottom navigation mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border-default bg-white lg:hidden" aria-label={tx('Navigation livreur')}>
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={clsx(
              'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium leading-tight',
              isActive(item.to, item.exact) ? 'text-primary' : 'text-text-secondary',
            )}
          >
            <FaIcon name={item.icon} className="text-[19px]" />
            <span className="text-center">{tx(item.short)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import MIcon from '../../shared/MIcon';
import LangToggle from '../../shared/LangToggle';
import { authApi } from '../../../services/api';
import { currentUserName, initialsOf } from '../../../routes/authGuard';
import { fetchLivreurProfile } from '../../../pages/livreur/livreurData';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


const NAV: { to: '/livreur' | '/livreur/course' | '/livreur/historique' | '/livreur/parametres'; icon: string; label: string; short: string; exact: boolean }[] = [
  { to: '/livreur', icon: 'dashboard', label: 'Tableau de bord', short: 'Accueil', exact: true },
  { to: '/livreur/course', icon: 'local_shipping', label: 'Livraisons en cours', short: 'En cours', exact: false },
  { to: '/livreur/historique', icon: 'history', label: 'Historique', short: 'Historique', exact: false },
  { to: '/livreur/parametres', icon: 'settings', label: 'Paramètres', short: 'Paramètres', exact: false },
];

/**
 * Espace livreur — chrome du design Stitch « tableau_de_bord_livreur_tokpa_fr » : barre latérale
 * orange « Portail Chauffeur » + barre du haut ; barre du bas sur mobile. « Passer en ligne » n'est
 * pas repris : aucune route ne permet au livreur de changer sa disponibilité (B-26) — elle est affichée.
 */
export default function LivreurLayout({ children }: { children: ReactNode }) {
  useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const nom = currentUserName();
  const [disponible, setDisponible] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLivreurProfile()
      .then((p) => alive && setDisponible(p.disponible))
      .catch(() => alive && setDisponible(null)); // les pages affichent leurs propres erreurs d'API
    return () => {
      alive = false;
    };
  }, []);

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to || pathname === `${to}/` : pathname === to || pathname.startsWith(`${to}/`) || (to === '/livreur/course' && pathname.startsWith('/livreur/recapitulatif'));

  const logout = async () => {
    await authApi.logout();
    toast.success(tx("Déconnexion effectuée"));
    navigate({ to: '/connexion' });
  };

  return (
    <div className="min-h-screen bg-bg-app font-body text-text-main">
      {/* SideNavBar (bureau) */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col bg-[#F97316] text-white shadow-xl lg:flex">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-black tracking-tight text-white">TOKPa</h1>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-white/80">{tx("Portail Chauffeur")}</p>
          </div>
          <nav className="space-y-1.5">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item.to, item.exact) ? 'page' : undefined}
                className={
                  isActive(item.to, item.exact)
                    ? 'flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 font-bold text-[#F97316] shadow-sm transition-all'
                    : 'flex items-center gap-3 rounded-xl px-4 py-2.5 font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white'
                }
              >
                <MIcon name={item.icon} className="text-[20px]" />
                <span className="text-[14px]">{tx(item.label)}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto space-y-2 border-t border-white/15 p-6">
          {/* Bascule vers l'espace client (le livreur y a accès) */}
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-white/80 transition-colors hover:text-white">
            <MIcon name="storefront" className="text-[20px]" />
            <span className="text-[14px] font-medium">{tx("Espace client")}</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-white/80 transition-colors hover:text-white"
          >
            <MIcon name="logout" className="text-[20px]" />
            <span className="text-[14px] font-medium">{tx("Déconnexion")}</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen pb-20 lg:ml-64 lg:pb-0">
        {/* TopAppBar */}
        <header className="sticky top-0 z-40 flex h-[52px] w-full items-center justify-between border-b border-border-default bg-bg-card px-lg">
          <span className="font-h1 text-h1 font-bold text-primary">TOKPa</span>
          <div className="flex items-center gap-lg">
            <LangToggle />
            <Link to="/notifications" aria-label="Notifications" className="text-text-secondary transition-colors hover:text-primary">
              <MIcon name="notifications" />
            </Link>
            <div className="flex items-center gap-sm border-l border-border-default pl-lg">
              <div className="text-right">
                <p className="font-label text-label leading-none text-text-main">{nom ?? tx("Livreur")}</p>
                {disponible !== null && (
                  <p className={clsx('text-xs font-medium', disponible ? 'text-success' : 'text-text-secondary')}>
                    {disponible ? tx("Disponible") : tx("Indisponible")}
                  </p>
                )}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary ring-2 ring-primary-container">
                {initialsOf(nom, 'LV')}
              </div>
            </div>
          </div>
        </header>
        {children}
      </main>

      {/* Barre du bas (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border-default bg-white lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={clsx(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
              isActive(item.to, item.exact) ? 'text-[#F97316]' : 'text-text-secondary',
            )}
          >
            <MIcon name={item.icon} className="text-[22px]" />
            {tx(item.short)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

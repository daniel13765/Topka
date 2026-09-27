import { Link } from '@tanstack/react-router';
import MIcon from '../../shared/MIcon';
import { currentUserName, currentUserZone, initialsOf } from '../../../routes/authGuard';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


type Item = { label: string; path: string; icon: string; badge?: string };

const ITEMS: Item[] = [
  { label: 'Tableau de bord', path: '/manager', icon: 'dashboard' },
  { label: 'Commandes', path: '/manager/commandes', icon: 'shopping_cart' },
  { label: 'Mon équipe', path: '/manager/equipe', icon: 'group' },
  { label: 'Statistiques', path: '/manager/statistiques', icon: 'trending_up' },
  { label: 'Litiges & Réclamations', path: '/manager/litiges', icon: 'gavel' },
  { label: 'Paramètres', path: '/manager/parametres', icon: 'settings' },
];

type Props = { currentPath: string };

export default function ManagerSidebar({ currentPath }: Props) {
  useLanguage();
  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/10"
      style={{ backgroundColor: 'rgb(31,19,11)' }}
    >
      <div className="flex items-center gap-2 p-lg pb-4">
        <MIcon name="local_shipping" className="text-primary-tint text-[22px]" />
        <p className="text-lg font-bold text-white">
          TOKPa <span className="text-primary-tint">Manager</span>
        </p>
      </div>
      <div className="px-lg pb-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <MIcon name="location_on" className="text-primary-tint text-[18px]" />
          <div className="flex-1">
            {/* Vraie zone du manager connecté (UserResource.profil.zone) — plus de « Zone Akpakpa » inventée */}
            <p className="text-label font-semibold text-white">
              {currentUserZone() ? `Zone ${currentUserZone()}` : tx("Zone non attribuée")}
            </p>
            <p className="text-label text-white/80">{tx("Votre zone de gestion")}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {ITEMS.map((item) => {
          const active = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-body text-white transition ${
                active ? 'bg-primary' : 'hover:bg-white/10'
              }`}
            >
              <MIcon name={item.icon} className="text-[18px]" />
              <span className="flex-1">{tx(item.label)}</span>
              {item.badge && (
                <span className="rounded-full bg-primary-container px-2 py-0.5 text-overline text-on-surface">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-lg">
        {/* Bascule vers l'espace client (le manager y a accès) */}
        <Link
          to="/"
          className="mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-body text-white transition hover:bg-white/10"
        >
          <MIcon name="storefront" className="text-[18px]" />
          <span className="flex-1">{tx("Espace client")}</span>
        </Link>
        {/* Utilisateur réellement connecté (plus de « Serge Migan » inventé) */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-label font-bold text-white">
            {initialsOf(currentUserName(), 'MG')}
          </div>
          <div className="flex-1">
            <p className="text-label font-semibold text-white">{currentUserName() ?? 'Manager'}</p>
            <p className="text-label text-white/80">{tx("Manager de zone")}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

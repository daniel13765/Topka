import { Link, useRouterState } from '@tanstack/react-router';
import MIcon from '../../shared/MIcon';
import { currentRole, currentUserName, initialsOf } from '../../../routes/authGuard';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


interface AdminSidebarProps {
  currentPath?: string;
}

interface NavItem {
  key: string;
  icon: string;
  label: string;
  to: string;
}

/** Gestion Métier (Admin) + DevOps (super-admin) — libellés des designs Stitch. */
const METIER_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard Global', to: '/admin' },
  { key: 'catalogue', icon: 'inventory_2', label: 'Catalogue & Produits', to: '/admin/catalogue' },
  { key: 'categories', icon: 'category', label: 'Catégories', to: '/admin/categories' },
  { key: 'zones', icon: 'map', label: 'Zones de Livraison', to: '/admin/zones' },
  { key: 'utilisateurs', icon: 'group', label: 'Utilisateurs', to: '/admin/utilisateurs' },
  { key: 'livreurs', icon: 'two_wheeler', label: 'Livreurs', to: '/admin/livreurs' },
  { key: 'validations', icon: 'verified_user', label: 'Validations', to: '/admin/validations' },
  { key: 'logs', icon: 'history', label: 'Logs & Audit', to: '/admin/logs' },
  { key: 'parametres', icon: 'settings', label: 'Paramètres', to: '/admin/parametres' },
];

const DEVOPS_ITEMS: NavItem[] = [
  { key: 'systeme', icon: 'terminal', label: 'Console Système', to: '/admin/systeme' },
  { key: 'bdd', icon: 'database', label: 'BDD & Jobs', to: '/admin/bdd-jobs' },
  { key: 'cles', icon: 'key', label: 'Clés API & Webhooks', to: '/admin/cles-api' },
  { key: 'securite', icon: 'shield', label: 'Sécurité & Env', to: '/admin/securite' },
];

const ACTIVE_CLASS =
  'flex items-center gap-3 px-4 py-3 bg-primary-tint text-primary-container rounded-lg font-bold transition-all duration-200 active:scale-[0.97]';
const IDLE_CLASS =
  'flex items-center gap-3 px-4 py-3 text-white transition-colors hover:bg-primary-hover/10 rounded-lg active:scale-[0.97]';

/**
 * AdminSidebar — chrome latéral admin (design Stitch) : groupe Gestion Métier
 * + groupe DevOps & Core Engine (super-admin) + bloc profil.
 */
export default function AdminSidebar({ currentPath }: AdminSidebarProps) {
  useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activePath = currentPath || pathname;

  const renderItem = (item: NavItem) => {
    const active =
      item.to === '/admin'
        ? activePath === '/admin' || activePath === '/admin/'
        : activePath.startsWith(item.to);
    return (
      <Link
        key={item.key}
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={active ? ACTIVE_CLASS : IDLE_CLASS}
      >
        <MIcon name={item.icon} />
        <span className="font-secondary text-body">{tx(item.label)}</span>
      </Link>
    );
  };

  const groupLabel = (label: string) => (
    <p className="px-4 pt-3 pb-1 font-secondary text-micro uppercase tracking-widest opacity-50 text-surface-variant">
      {label}
    </p>
  );

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 bg-inverse-surface border-r border-outline-variant flex flex-col p-md z-50"
      style={{ backgroundColor: 'rgb(31, 19, 11)', borderColor: 'rgba(249, 115, 22, 0.15)' }}
    >
      <div className="mb-lg px-4">
        <h1 className="text-h2 font-h2 font-bold text-primary-container tracking-tight">
          <span style={{ color: 'rgb(255, 255, 255)' }}>TOK</span>
          <span style={{ color: 'rgb(249, 115, 22)' }}>Pa</span>
        </h1>
        <p className="font-secondary text-label text-surface-variant opacity-70">Marketplace v2.0</p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groupLabel(tx("Gestion Métier (Admin)"))}
        {METIER_ITEMS.map(renderItem)}
        {groupLabel(tx("DevOps & Core Engine"))}
        {DEVOPS_ITEMS.map(renderItem)}
      </nav>

      <div
        className="mt-auto pt-md border-t border-white/10 px-2"
        style={{ borderColor: 'rgba(249, 115, 22, 0.15)' }}
      >
        {/* Bascule vers l'espace client (l'admin y a accès) */}
        <Link to="/" className={IDLE_CLASS}>
          <MIcon name="storefront" />
          <span className="font-secondary text-body">{tx("Espace client")}</span>
        </Link>
        {/* Utilisateur réellement connecté (plus de profil générique) */}
        <div className="flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white font-bold text-label">
            {initialsOf(currentUserName(), 'AD')}
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-label">{currentUserName() ?? tx("Administrateur")}</span>
            <span className="text-surface-variant text-micro opacity-70">
              {currentRole() === 'super_admin' ? tx("Super administrateur") : tx("Administrateur")}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

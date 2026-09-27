import type { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import MIcon from '../../shared/MIcon';
import AdminNotificationBell from './AdminNotificationBell';
import LangToggle from '../../shared/LangToggle';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


interface AdminLayoutProps {
  children: ReactNode;
  currentPath?: string;
  mainClassName?: string;
}

/**
 * AdminLayout — chrome complet admin, copie conforme du design Stitch :
 * sidebar sombre + top bar fixe (recherche, notifications, aide, profil) + canvas.
 */
export default function AdminLayout({ children, currentPath, mainClassName }: AdminLayoutProps) {
  useLanguage();
  return (
    <div className="bg-bg-app text-on-surface font-body min-h-screen">
      <AdminSidebar currentPath={currentPath} />

      {/* TOP APP BAR */}
      <header className="fixed top-0 right-0 left-64 h-[52px] bg-white border-b border-border-default flex justify-between items-center px-lg z-40">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <MIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder={tx("Rechercher une commande, un utilisateur...")}
              className="w-full pl-10 pr-4 py-1.5 text-secondary text-label bg-bg-app border-none rounded-lg focus:ring-2 focus:ring-primary-container focus:ring-opacity-20 placeholder:text-text-tertiary"
            />
          </div>
        </div>
        <div className="flex items-center gap-md">
          <LangToggle />
          {/* Vraies notifications (GET /notifications) : compteur, liste, marquer comme lue */}
          <AdminNotificationBell
            className="p-2 text-text-secondary hover:bg-bg-app rounded-full transition-all active:scale-[0.97] cursor-pointer"
            icon={<MIcon name="notifications" />}
            dotClassName="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"
          />
          <button
            type="button"
            className="p-2 text-text-secondary hover:bg-bg-app rounded-full transition-all active:scale-[0.97] cursor-pointer"
          >
            <MIcon name="help" />
          </button>
          <div className="h-8 w-[1px] bg-border-default mx-2" />
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-micro font-bold">
              AT
            </div>
            <span className="font-secondary text-label font-bold text-primary">{tx("Admin TOKPa")}</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className={mainClassName ?? 'ml-64 pt-[52px] min-h-screen p-lg space-y-lg'}>{children}</main>
    </div>
  );
}

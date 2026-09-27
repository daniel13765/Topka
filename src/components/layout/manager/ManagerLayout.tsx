import type { ReactNode } from 'react';
import MIcon from '../../shared/MIcon';
import ManagerSidebar from './ManagerSidebar';
import LangToggle from '../../shared/LangToggle';
import { useLanguage } from '../../../context/LanguageContext';
import { tx } from '../../../i18n/tx';


type Props = { children: ReactNode; currentPath: string };

export default function ManagerLayout({ children, currentPath }: Props) {
  useLanguage();
  return (
    <div className="min-h-screen bg-bg-primary text-on-surface">
      <ManagerSidebar currentPath={currentPath} />
      <header className="fixed left-64 right-0 top-0 z-40 flex h-[52px] items-center justify-between border-b border-border-default bg-bg-primary px-lg">
        <div className="flex items-center gap-2">
          <MIcon name="location_on" className="text-primary text-[18px]" />
          <p className="text-label font-semibold">{tx("Zone Akpakpa — Active")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            type="button"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-secondary hover:text-on-surface"
          >
            <MIcon name="notifications" className="text-[18px]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-overline font-bold text-primary">
              SM
            </div>
            <p className="text-label font-semibold">Serge Migan</p>
          </div>
        </div>
      </header>
      <main className="ml-64 space-y-lg p-lg pt-[calc(52px+16px)]">{children}</main>
    </div>
  );
}

import type { ReactNode } from 'react';
import { IconTruckDelivery, IconTags, IconMapPin } from '@tabler/icons-react';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


const BULLETS = [
  { icon: IconTruckDelivery, label: 'Livraison rapide' },
  { icon: IconTags, label: 'Prix négociables' },
  { icon: IconMapPin, label: 'Suivi en temps réel' },
];

interface AuthSplitLayoutProps {
  children: ReactNode;
}

/**
 * Écran scindé de la page Connexion (maquette Stitch) :
 * panneau gauche orange 40 % (logo, illustration marché, 3 puces, slogan)
 * masqué sous 768px ; panneau droit blanc centré, contenu max 440px.
 */
export default function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  useLanguage();
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      {/* Panneau brand orange */}
      <aside className="relative hidden overflow-hidden bg-primary p-lg flex-col justify-between md:flex md:w-[40%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#ffffff,_transparent,_transparent)]"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <span className="text-[36px] font-bold tracking-tight text-white">TOKPa</span>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <img
            src="/images/brand/illustration-marche.png"
            alt={tx("Illustration du marché béninois")}
            className="h-auto w-4/5 max-w-[320px] drop-shadow-2xl transition-transform duration-500 hover:scale-105"
          />
          <ul className="mt-md w-full max-w-[280px] space-y-md">
            {BULLETS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-sm text-white">
                <Icon size={20} />
                <span className="text-body">{tx(label)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10">
          <p className="text-[18px] font-medium text-white opacity-90">{tx("Ton marché, ta façon")}</p>
        </div>
      </aside>

      {/* Panneau formulaire */}
      <main className="flex flex-1 flex-col items-center justify-center bg-white p-lg md:p-[48px]">
        <span className="mb-lg text-[28px] font-bold tracking-tight text-primary md:hidden">TOKPa</span>
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}
